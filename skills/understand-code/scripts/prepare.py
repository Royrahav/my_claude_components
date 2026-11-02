#!/usr/bin/env python3
"""Create the work folder for a change map: files.json + meta.json, the same way every time.

  prepare.py WORK --pr https://github.com/OWNER/REPO/pull/N     (run inside a clone of that repo)
  prepare.py WORK --git BASE..HEAD [--title "..."]
  prepare.py WORK --p4 CL [--shelved]
  prepare.py WORK --code PATH [PATH ...] [--kind Class|Library|"Code area"] [--title "..."] [--force]

--code is code mode (the understand-code skill): no diff, every file under the paths is in scope, and
excerpts come from the files as they are. It refuses a scope above LARGE unless --force.
For a PR the diff is merge-base(base tip, head), where the base tip is the base branch for an open PR and
the merge commit's first parent for a merged one, which is the diff GitHub shows. Prints a short digest.
"""
import argparse
import difflib
import json
import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from collect_change import (collect_git, collect_p4, p4_depot_root, p4_describe, p4_file_revs,  # noqa: E402
                            p4_relative, p4_status)
from collect_code import collect_code, digest, version_of  # noqa: E402


def sh(*cmd):
    r = subprocess.run(list(cmd), capture_output=True, text=True, encoding='utf-8', errors='replace')
    if r.returncode != 0:
        sys.exit('prepare: %s failed: %s' % (' '.join(cmd[:3]), r.stderr.strip()[:200]))
    return r.stdout.strip()


def from_pr(url):
    owner_repo, number = url.split('github.com/')[1].split('/pull/')
    number = number.strip('/').split('/')[0]
    pr = json.loads(sh('gh', 'pr', 'view', number, '--repo', owner_repo, '--json',
                       'title,number,url,state,baseRefName,headRefName,headRefOid,mergeCommit,commits'))
    head = pr['headRefOid']
    fetch = [head] + ([pr['mergeCommit']['oid']] if pr.get('mergeCommit') else [])
    subprocess.run(['git', 'fetch', '-q', 'origin'] + fetch, capture_output=True)
    base_tip = pr['mergeCommit']['oid'] + '^1' if pr.get('mergeCommit') else 'origin/' + pr['baseRefName']
    base = sh('git', 'merge-base', base_tip, head)
    repo_url = 'https://github.com/' + owner_repo
    meta = {'kind': 'Pull request', 'title': pr['title'], 'number': pr['number'], 'url': pr['url'], 'repo_url': repo_url,
            'base': pr['baseRefName'], 'head': pr['headRefName'], 'sha': head, 'diff_base': base, 'unit': 'commits',
            'state': pr['state'], 'short_title': 'PR #%s change map' % pr['number'],
            'commits': [{'oid': c['oid'][:7], 'headline': c['messageHeadline'], 'url': repo_url + '/commit/' + c['oid']} for c in pr['commits']]}
    return meta, '%s..%s' % (base, head)


def from_git(rng, title):
    base, head = rng.split('..')
    base, head = sh('git', 'rev-parse', base), sh('git', 'rev-parse', head)
    log = sh('git', 'log', '--reverse', '--no-merges', '--format=%h%x09%s', '%s..%s' % (base, head))
    commits = [dict(zip(('oid', 'headline'), l.split('\t', 1))) for l in log.splitlines() if '\t' in l]
    meta = {'kind': 'Branch', 'title': title or rng, 'sha': head, 'diff_base': base, 'unit': 'commits', 'commits': commits,
            'short_title': (title or 'Change') + ' map'}
    return meta, '%s..%s' % (base, head)


def p4_print(spec, dest):
    r = subprocess.run(['p4', 'print', '-q', spec], capture_output=True)
    if r.returncode != 0:
        sys.exit('prepare: p4 print %s failed: %s' % (spec, r.stderr.decode('utf-8', 'replace').strip()[:200]))
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, 'wb') as f:
        f.write(r.stdout)
    return r.stdout.splitlines()


def p4_snapshot(work, cl, shelved):
    """Print each file of the CL before (old/) and after (new/) it, so excerpts show this CL's exact diff
    even when the workspace is synced past it or does not have it. Returns {path: (added, deleted)} counted
    from the snapshot, since p4 describe's summary misses files (e.g. CRLF-only or text+ko types)."""
    snap = os.path.abspath(os.path.join(work, 'p4'))
    shutil.rmtree(snap, ignore_errors=True)
    root, counts = p4_depot_root(), {}
    for depot, rev, action in p4_file_revs(p4_describe(cl, shelved)):
        rel, status = p4_relative(depot, root), p4_status(action)
        before = rev if shelved else rev - 1
        old, new = [], []
        if status != 'added' and before > 0:
            old = p4_print('%s#%d' % (depot, before), os.path.join(snap, 'old', rel))
        if status != 'removed':
            new = p4_print('%s@=%s' % (depot, cl) if shelved else '%s#%d' % (depot, rev), os.path.join(snap, 'new', rel))
        ops = difflib.SequenceMatcher(None, old, new, autojunk=False).get_opcodes()
        counts[rel] = (sum(j2 - j1 for t, _, _, j1, j2 in ops if t != 'equal'), sum(i2 - i1 for t, i1, i2, _, _ in ops if t != 'equal'))
    print('prepare: snapshot of the CL before/after in %s' % snap)
    return snap, counts


def write(work, files, meta):
    for name, doc in (('files.json', files), ('meta.json', meta)):
        with open(os.path.join(work, name), 'w', encoding='utf-8') as f:
            json.dump(doc, f, indent=1, ensure_ascii=False)
    print('prepare: wrote %s/files.json and meta.json' % work)


def prepare_code(a):
    root = os.getcwd()
    files = collect_code(a.code, root)
    if not files:
        sys.exit('prepare: no text files under ' + ' '.join(a.code))
    size, lines = digest(files)
    for line in lines:
        print(line)
    if size == 'TOO LARGE' and not a.force:
        sys.exit('prepare: scope too large to explain well; narrow it to the classes or libraries that matter (or pass --force)')
    title = a.title or ', '.join(p.rstrip('/\\').replace('\\', '/').split('/')[-1] for p in a.code)
    meta = {'mode': 'code', 'kind': a.kind or 'Code area', 'title': title, 'scope': [p.replace('\\', '/') for p in a.code],
            'short_title': title + ' code map', 'commits': [], **version_of(root, a.code)}
    write(a.work, [{'path': f, 'status': 'scope', 'lines': n, 'add': 0, 'del': 0} for f, n in sorted(files.items())], meta)


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    ap = argparse.ArgumentParser()
    ap.add_argument('work')
    ap.add_argument('--pr')
    ap.add_argument('--git')
    ap.add_argument('--p4')
    ap.add_argument('--shelved', action='store_true')
    ap.add_argument('--code', nargs='+')
    ap.add_argument('--kind')
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--title')
    a = ap.parse_args()
    os.makedirs(a.work, exist_ok=True)
    if a.code:
        return prepare_code(a)
    if a.p4:
        label, files, desc, status = collect_p4(a.p4, a.shelved)
        snapshot, counts = p4_snapshot(a.work, a.p4, a.shelved)
        files.update(counts)
        meta = {'kind': 'Shelved changelist' if a.shelved else 'Changelist', 'title': a.title or (desc[0] if desc else label),
                'number': a.p4, 'unit': 'CLs', 'commits': [{'oid': a.p4, 'headline': desc[0] if desc else label}],
                'short_title': 'CL %s change map' % a.p4, 'snapshot': snapshot}
    else:
        meta, rng = from_pr(a.pr) if a.pr else from_git(a.git, a.title)
        label, files, _, status = collect_git(rng)
    rows = [{'path': f, 'status': status.get(f, 'modified'), 'add': ad, 'del': de} for f, (ad, de) in sorted(files.items())]
    added = sum(1 for r in rows if r['status'] == 'added')
    print('prepare: %s · %d files (%d added, %d modified/removed), +%d/-%d lines, %d %s'
          % (meta['title'][:70], len(rows), added, len(rows) - added, sum(r['add'] for r in rows), sum(r['del'] for r in rows),
             len(meta.get('commits', [])), meta.get('unit', 'commits')))
    if meta.get('diff_base'):
        print('prepare: diff %s..%s' % (meta['diff_base'][:7], meta['sha'][:7]))
    write(a.work, rows, meta)


if __name__ == '__main__':
    main()
