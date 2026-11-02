#!/usr/bin/env python3
"""Merge a change's facts into one interactive change map (architecture map, simulator, files, commits).

  build_prmap.py --dir WORK out.html [--repo ROOT] [--standalone] [--allow-unresolved]

WORK holds:
  files.json      [{path, status: added|modified|removed|renamed, add, del}]   (collect_change.py --json, or gh api)
  meta.json       {kind, title, number?, url?, base?, head?, sha?, unit?, commits: [{oid, headline, url?}], repo_url?}
  inventory.json  {modules: [{id, name, path, job, status, entry}], files: [{path, module, kind, job, change, symbols}], edges: [{from, to, label}]}
  layout.json     {summary, nodes: {id: {at: [col, row], name?, path?, job?, status?}}}   (positions + nodes outside the repo)
  scenarios.json  {request_defaults: {base, token_header}, scenarios: [{id, title, purpose, request, env, steps: [{node, ref, title, does, in, out, decision, fail}], result}]}
  deck.json       optional, the stakeholder deck of the Brief tab, with optional terms and brand logo (schema: references/deck.md)
Prints a few summary lines and writes every lint finding to WORK/lint.txt; exit 2 if refs are unresolved, 3 if the inputs are malformed.
"""
import argparse
import base64
import hashlib
import html
import json
import os
import re
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from refs import Resolver, split_ref  # noqa: E402
from narrate import narration_items  # noqa: E402
from snippets import file_units, snippet  # noqa: E402
from explain import changed_gaps, depth_lint, item_lint, jumps, resolve_beats, scenarios_running, span_gaps  # noqa: E402
from deck import deck_errors, deck_lint, deck_refs, deck_summary, embed_brand  # noqa: E402

TEMPLATE = os.path.join(HERE, '..', 'assets', 'prmap.html')
WORD_LIMITS = {'does': 26, 'title': 8, 'decision': 22, 'job': 18, 'change': 20}


def load(work, name, default=None):
    path = os.path.join(work, name)
    if not os.path.exists(path):
        if default is not None:
            return default
        raise SystemExit('prmap: missing %s' % path)
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def github_links(meta, paths, ref_files):
    """PR files link to their diff anchor; other cited files (in code mode: all files) link to the blob at the head commit."""
    links = {}
    url, repo, sha = meta.get('url'), meta.get('repo_url'), meta.get('sha')
    if meta.get('mode') == 'code':
        ref_files = set(ref_files) | set(paths)
    if url and '/pull/' in url:
        for p in paths:
            links[p] = '%s/files#diff-%s' % (url.rstrip('/'), hashlib.sha256(p.encode('utf-8')).hexdigest())
        repo = repo or url.split('/pull/')[0]
    if repo and sha:
        for p in ref_files:
            links.setdefault(p, '%s/blob/%s/%s' % (repo.rstrip('/'), sha, p))
    return links


def load_story(work, layout):
    """The story_*.json parts written in parallel, merged (and saved as story.json for narrate.py), or story.json when
    there are no parts. With parts, story.json is derived output and is rebuilt every time, so edits to a part count."""
    parts = sorted(n for n in os.listdir(work) if n.startswith('story_') and n.endswith('.json'))
    if not parts:
        return load(work, 'story.json') if os.path.exists(os.path.join(work, 'story.json')) else {}
    story = {'problems': []}
    for name in parts:
        doc = load(work, name)
        for key in ('intro', 'say_intro'):
            if doc.get(key) and not story.get(key):
                story[key] = doc[key]
        story['problems'] += doc.get('problems', [])
    order = layout.get('problem_order') or []
    story['problems'].sort(key=lambda p: order.index(p['id']) if p['id'] in order else len(order))
    with open(os.path.join(work, 'story.json'), 'w', encoding='utf-8') as f:
        json.dump(story, f, indent=1, ensure_ascii=False)
    return story


def auto_place(modules, flows, first):
    """Grid positions for nodes the scenarios visit but layout.json does not place: column = hops from the
    first scenario's first node, row = next free slot. Returns the ids it placed."""
    need = sorted({x for e in flows for x in (e['from'], e['to'])} - {k for k, m in modules.items() if m.get('at')})
    if not need:
        return []
    depth, queue = ({first: 0}, [first]) if first else ({}, [])
    while queue:
        x = queue.pop(0)
        for e in flows:
            if e['from'] == x and e['to'] not in depth:
                depth[e['to']] = depth[x] + 1
                queue.append(e['to'])
    taken = {tuple(m['at']) for m in modules.values() if m.get('at')}
    for nid in need:
        col, row = depth.get(nid, max(depth.values(), default=0) + 1), 0
        while (col, row) in taken:
            row += 1
        modules[nid]['at'] = [col, row]
        taken.add((col, row))
    return need


def commits_touching(repo, meta, path, cache):
    """Short ids of the change's commits that touched path (git only), so each commit can list its items."""
    if path not in cache:
        cache[path] = []
        if meta.get('snapshot'):
            cache[path] = [meta['number']] if os.path.exists(os.path.join(meta['snapshot'], 'new', path)) else []
        elif meta.get('diff_base') and meta.get('sha'):
            try:
                out = subprocess.run(['git', '-C', repo, 'log', '--format=%h', '--abbrev=7', '%s..%s' % (meta['diff_base'], meta['sha']), '--', path],
                                     capture_output=True, text=True, encoding='utf-8', errors='replace').stdout
                cache[path] = out.split()
            except OSError:
                pass
    return cache[path]


RATE = 24000
BUNDLE_BYTES = 12_000_000  # stays under the 15 MB per-file publish limit


def _pcm(path):
    """Decoded 16-bit mono samples of a clip, so offsets in the bundle are exact."""
    return subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 's16le', '-ac', '1', '-ar', str(RATE), '-'],
                          capture_output=True, check=True).stdout


def voice_track(work, audio_dir=None):
    """Narration per line, as text plus a [start, end) window in one bundled MP3 (a published file next to the
    page, or a data URI when audio_dir is None). Lines without a recorded clip carry text only."""
    clips = {}
    path = os.path.join(work, 'narration.json')
    if os.path.exists(path):
        with open(path, encoding='utf-8') as f:
            clips = json.load(f).get('clips', {})
    track, order = {}, []
    for key, text in narration_items(work):
        track[key] = {'text': text}
        clip = clips.get(key)
        if clip and clip.get('text') == text and os.path.exists(clip.get('file', '')):
            order.append((key, clip['file']))
    if not order:
        return track, {}
    files = list(dict.fromkeys(f for _, f in order))
    chunks, size = [[]], 0
    for f in files:
        if chunks[-1] and size + os.path.getsize(f) > BUNDLE_BYTES:
            chunks.append([])
            size = 0
        chunks[-1].append(f)
        size += os.path.getsize(f)
    tag = hashlib.sha1('|'.join(os.path.basename(f) for f in files).encode('ascii')).hexdigest()[:10]
    out_root = audio_dir or os.path.join(work, '_bundle')
    os.makedirs(os.path.join(out_root, 'audio'), exist_ok=True)
    where, published = {}, {}
    for n, chunk in enumerate(chunks):
        name = 'audio/narration-%s-%d.mp3' % (tag, n)
        target = os.path.join(out_root, name)
        pcm, t = [], 0.0
        for f in chunk:
            samples = _pcm(f)
            secs = len(samples) / 2 / RATE
            where[f] = (name, round(t, 3), round(t + secs, 3))
            t += secs
            pcm.append(samples)
        if not os.path.exists(target):
            subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 's16le', '-ar', str(RATE), '-ac', '1', '-i', '-', '-b:a', '32k', target],
                           input=b''.join(pcm), check=True)
        published[name] = target
    for key, f in order:
        name, start, end = where[f]
        track[key].update({'src': name, 'start': start, 'end': end, 'secs': round(end - start, 1)})
    return track, published


def embedded_audio(published):
    """Bundles as data URIs keyed by their published path, embedded once for a standalone page."""
    uris = {}
    for name, target in published.items():
        with open(target, 'rb') as f:
            uris[name] = 'data:audio/mpeg;base64,' + base64.b64encode(f.read()).decode('ascii')
    return uris


def block_lint(it, symbol, sn):
    """Warnings about how the unit's block was detected."""
    out = []
    if sn.get('literal') and re.match(r'^[\w.:~]+$', symbol or ''):
        out.append('story %s: "%s" matched a use, not a definition' % (it.get('id'), symbol))
    if sn.get('runs_into'):
        out.append('story %s: excerpt runs into the next definition' % it.get('id'))
    if sn.get('span_miss'):
        out.append('story %s: span %s not found in the unit, the whole unit is shown' % (it.get('id'), it.get('span')))
    return out


def units_lint(repo, meta, paths, shown, cache, changed_only):
    """[(finding, ...)]: top-level definitions (in change mode: those with changed lines) whose lines no item excerpt overlaps."""
    out = []
    for path in paths:
        for a, b, label in file_units(repo, meta.get('diff_base'), meta.get('sha'), path, meta.get('snapshot'), cache, changed_only):
            if not any(lo <= b and a <= hi for lo, hi in shown.get(path, [])):
                out.append('units %s: %s (lines %d-%d) no item shows' % (path, label, a, b))
    return out


def write_lint(work, lint):
    """All lint findings in WORK/lint.txt; returns (items leaving code unexplained, summary line)."""
    with open(os.path.join(work, 'lint.txt'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(''.join(l + '\n' for l in lint))
    open_items = {l.split(':')[0] for l in lint if l.startswith('story ') and ('no beat explains' in l or ': no beats' in l)}
    return len(open_items), 'beats: %d items leave code unexplained; lint: %d findings in %s' % (len(open_items), len(lint), os.path.join(work, 'lint.txt'))


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    ap = argparse.ArgumentParser()
    ap.add_argument('--dir', required=True)
    ap.add_argument('out')
    ap.add_argument('--repo', default='.')
    ap.add_argument('--standalone', action='store_true')
    ap.add_argument('--allow-unresolved', action='store_true')
    a = ap.parse_args()

    files = load(a.dir, 'files.json')
    meta = load(a.dir, 'meta.json')
    inv = load(a.dir, 'inventory.json')
    layout = load(a.dir, 'layout.json', {})
    scen = load(a.dir, 'scenarios.json', {'scenarios': []})
    deck = load(a.dir, 'deck.json', {})
    errs, warns, lint = [], [], []

    by_path = {f['path']: f for f in inv.get('files', [])}
    merged = []
    for f in files:
        extra = by_path.pop(f['path'], None)
        if extra is None:
            warns.append('no inventory entry for ' + f['path'])
            extra = {'module': 'other', 'kind': 'code'}
        merged.append({**extra, **{k: f.get(k) for k in ('path', 'status', 'add', 'del', 'lines') if k in f}})
    for p in by_path:
        warns.append('inventory lists a file not in the change: ' + p)

    modules = {m['id']: dict(m) for m in inv.get('modules', [])}
    for nid, spec in (layout.get('nodes') or {}).items():
        modules.setdefault(nid, {'id': nid, 'status': 'external'})
        modules[nid].update({k: v for k, v in spec.items() if v is not None})
    code_mode = meta.get('mode') == 'code'
    for f in merged:
        if f.get('module') not in modules:
            modules[f['module']] = {'id': f['module'], 'name': f['module'], 'status': 'scope' if code_mode else 'changed'}
    for m in modules.values():
        m.setdefault('name', m['id'])

    flows, labels = [], {(e['from'], e['to']): e.get('label') for e in inv.get('edges', [])}
    for sc in scen.get('scenarios', []):
        if not (sc.get('purpose') or sc.get('teaches')):
            lint.append('scenario %s: no purpose (one sentence: which flow this is and what it is for)' % sc.get('id'))
        if not sc.get('say_intro'):
            lint.append('scenario %s: no say_intro (name the flow and its purpose first)' % sc.get('id'))
        lint += jumps(sc, inv.get('edges', []))
        prev = None
        for i, st in enumerate(sc.get('steps', [])):
            if st.get('node') not in modules:
                errs.append('scenario %s step %d: unknown node "%s"' % (sc.get('id'), i + 1, st.get('node')))
            for key, limit in WORD_LIMITS.items():
                if key in st and len(str(st[key]).split()) > limit:
                    warns.append('scenario %s step %d: %s is %d words (max %d)' % (sc.get('id'), i + 1, key, len(str(st[key]).split()), limit))
            if prev and prev != st.get('node'):
                flows.append({'from': prev, 'to': st['node'], 'label': labels.get((prev, st['node']))})
            prev = st.get('node')
    for e in inv.get('edges', []):
        for end in ('from', 'to'):
            if e.get(end) not in modules:
                errs.append('edge %s->%s: unknown module "%s"' % (e.get('from'), e.get('to'), e.get(end)))
    first = next((sc['steps'][0]['node'] for sc in scen.get('scenarios', []) if sc.get('steps')), None)
    placed = auto_place(modules, flows, first)
    if placed:
        warns.append('auto-placed on the map (set layout.nodes.<id>.at to override): ' + ', '.join(placed))
    deck_errs = deck_errors(deck) if deck or os.path.exists(os.path.join(a.dir, 'deck.json')) else []
    errs += deck_errs
    if deck and not deck_errs:
        page_deck, brand_errs = embed_brand(deck, a.dir)
        errs += brand_errs
    if errs:
        print('prmap: malformed')
        for e in errs:
            print('  - ' + e)
        return 3

    resolver = Resolver(os.path.abspath(a.repo), meta.get('snapshot'))
    refs = [('module %s entry' % m['id'], m['entry']) for m in modules.values() if m.get('entry')]
    refs += [('scenario %s step %d' % (sc['id'], i + 1), st['ref']) for sc in scen.get('scenarios', []) for i, st in enumerate(sc['steps']) if st.get('ref')]
    refs += deck_refs(deck) if deck else []
    story = load_story(a.dir, layout)
    file_module = {f['path']: f.get('module') for f in merged}
    snip_cache, commit_cache, no_snippet, by_ref, shown_spans, coarse = {}, {}, [], {}, {}, 0
    for p in story.get('problems', []):
        for it in p.get('items', []):
            refs.append(('story %s' % it.get('id'), it['ref']))
            path, symbol = split_ref(it['ref'])
            it['module'] = it.get('module') or file_module.get(path)
            it['snippet'] = snippet(os.path.abspath(a.repo), meta.get('diff_base'), meta.get('sha'), path, symbol or it.get('focus') or '', it.get('span'), snip_cache,
                                    meta.get('snapshot'), focus=not code_mode and not it.get('whole'))
            sn = it['snippet']
            if not sn:
                no_snippet.append(it.get('id'))
            else:
                by_ref.setdefault(it['ref'], []).append((it.get('id'), sn))
                shown_spans.setdefault(path, []).append((sn['start'], sn['end']))
                lint += block_lint(it, symbol, sn)
            shown = [t for _, t in (sn or {}).get('lines', [])]
            for n, anchor in resolve_beats(it.get('beats') or [], shown):
                warns.append('story %s beat %d: code "%s" is not in the excerpt shown' % (it.get('id'), n, anchor[:40]))
            lint += item_lint(it.get('id'), it)
            it['commits'] = commits_touching(os.path.abspath(a.repo), meta, path, commit_cache)
            it['runs_in'] = scenarios_running(scen.get('scenarios', []), path, symbol)
            found = depth_lint(it.get('id'), it)
            coarse += bool(found)
            lint += found
    for parts in by_ref.values():
        lint += span_gaps(parts) if code_mode else changed_gaps(parts)
    if no_snippet:
        warns.append('no code snippet found for: ' + ', '.join(no_snippet))
    explained = {split_ref(it['ref'])[0] for p in story.get('problems', []) for it in p.get('items', [])}
    code_files = [f['path'] for f in merged if f.get('kind') == 'code' and f.get('status') != 'removed']
    missed = [p for p in code_files if p not in explained]
    unit_lint = units_lint(os.path.abspath(a.repo), meta, code_files, shown_spans, snip_cache, not code_mode) if story else []
    coverage = 'walkthrough: %d items explain %d of %d %s code files' % (
        sum(len(p.get('items', [])) for p in story.get('problems', [])), len(code_files) - len(missed), len(code_files),
        'in-scope' if code_mode else 'changed')
    if code_mode:
        scoped = {f.get('module') for f in merged if f.get('kind') == 'code'}
        told = {file_module.get(p) for p in explained}
        coverage += '; %d of %d code modules have an item' % (len(scoped & told), len(scoped))
        if story and scoped - told:
            warns.append('modules no walkthrough item explains: ' + ', '.join(sorted(scoped - told)))
    if story and missed:
        warns.append('code files no walkthrough item explains (add an item, or confirm they are plumbing): ' + ', '.join(missed[:8]) + (' ...' if len(missed) > 8 else ''))
    bad = []
    for where, ref in refs:
        why = resolver.check(ref)
        if why:
            bad.append('%s: %s -> %s' % (where, ref, why))
    sym_bad = 0
    for f in merged:
        body = resolver.text(f['path']) if f.get('status') != 'removed' else None
        if body is not None:
            missing = [s for s in f.get('symbols') or [] if s not in body]
            if missing:
                sym_bad += 1
                warns.append('%s: symbols not found %s' % (f['path'], missing))

    ref_files = {split_ref(r)[0] for _, r in refs}
    data = {
        'meta': meta, 'summary': layout.get('summary') or meta.get('summary'),
        'modules': list(modules.values()), 'files': merged, 'edges': inv.get('edges', []), 'flows': flows,
        'scenarios': scen.get('scenarios', []), 'request_defaults': scen.get('request_defaults', {}),
        'links': github_links(meta, [f['path'] for f in merged], ref_files),
        'story': story,
    }
    if deck:
        data['deck'] = page_deck
    out_dir = os.path.dirname(os.path.abspath(a.out))
    data['voice'], published = voice_track(a.dir, None if a.standalone else out_dir) if data['scenarios'] or story else ({}, {})
    voiced = sum(1 for v in data['voice'].values() if v.get('src'))
    if a.standalone:
        data['audio'], published = embedded_audio(published), {}
    if published:
        with open(os.path.join(out_dir, 'audio_files.json'), 'w', encoding='utf-8') as f:
            json.dump(sorted(published), f, indent=0)
    with open(TEMPLATE, encoding='utf-8') as f:
        page = f.read()
    page = page.replace('__TITLE__', html.escape(layout.get('title') or meta.get('short_title') or 'Change map'))
    page = page.replace('__DATA_JSON__', json.dumps(data, ensure_ascii=False).replace('</', '<\\/'))
    if a.standalone:
        page = ('<!doctype html>\n<html lang="en"><head><meta charset="utf-8">'
                '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>\n'
                + page + '\n</body></html>\n')
    with open(a.out, 'w', encoding='utf-8', newline='\n') as f:
        f.write(page)
    print('built %s (%d KB): %d files, %d modules, %d scenarios, %d steps' % (
        a.out, os.path.getsize(a.out) // 1024, len(merged), len(modules), len(data['scenarios']),
        sum(len(s['steps']) for s in data['scenarios'])))
    print('voice: %d of %d lines have a recorded clip; %s' % (voiced, len(data['voice']),
          'the rest show their caption silently' if voiced else 'none recorded, so the browser voice reads them'))
    if published:
        print('audio: %d bundled file(s) in %s/audio; publish them with the page (paths in audio_files.json): %s'
              % (len(published), out_dir, ', '.join(sorted(published))))
    print('refs: %d checked, %d unresolved; file symbols: %d files with misses' % (len(refs), len(bad), sym_bad))
    if story:
        print(coverage)
    deck_found = deck_lint(deck, {sc.get('id') for sc in scen.get('scenarios', [])}, code_mode,
                           {s for f in inv.get('files', []) for s in f.get('symbols') or []}) if deck else []
    if story or data['scenarios'] or deck:
        main_lint = list(lint)
        lint += unit_lint + deck_found
        print(write_lint(a.dir, lint)[1])
        if story:
            print('depth: %d items explained too coarsely' % coarse)
            print('units: %d definitions no item shows' % len(unit_lint))
            for l in unit_lint[:3]:
                print('  lint: ' + l)
        for l in main_lint[:4]:
            print('  lint: ' + l)
    if deck:
        print(deck_summary(deck, len(deck_found)))
        for l in deck_found[:3]:
            print('  lint: ' + l)
    for b in bad:
        print('  UNRESOLVED ' + b)
    for w in warns[:12]:
        print('  warn: ' + w)
    if len(warns) > 12:
        print('  ... %d more warnings' % (len(warns) - 12))
    if bad and not a.allow_unresolved:
        print('fix the unresolved refs before publishing')
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
