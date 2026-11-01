#!/usr/bin/env python3
"""The optional stakeholder deck (WORK/deck.json, the Brief tab): validation errors, mitigation refs, lint, and the summary line.

Schema and writing rules: references/deck.md. build_prmap.py calls this only when deck.json exists.
"""
import re

SLIDE_TYPES = ['title', 'value', 'before_after', 'system', 'flow', 'risk', 'takeaways']
LEVELS = ['low', 'medium', 'high']
MAX_FLOWS = 3
RANGES = {'cards': (2, 4), 'blocks': (3, 7), 'actors': (2, 5), 'steps': (2, 7), 'areas': (1, 6), 'points': (2, 4), 'stats': (0, 4)}
# Product, company and technology names that look like code to a pattern but are plain words to a stakeholder.
PRODUCT_NAMES = {'labos', 'postgresql', 'mysql', 'mongodb', 'iphone', 'ipad', 'github', 'gitlab', 'javascript', 'typescript', 'node.js', 'vue.js',
                 'next.js', 'asp.net', '.net', 'powershell', 'openai', 'youtube', 'linkedin', 'devops', 'oauth', 'macos', 'ios', 'saas'}
CODE_EXTS = 'go cpp cc c h hpp py js ts tsx jsx json yaml yml xml sql md cs java rb rs txt html css sh cfg ini toml csproj'.split()
SNAKE = re.compile(r'\b[A-Za-z0-9]+(?:_[A-Za-z0-9]+)+\b')
PATH = re.compile(r'[\w.\-]*[/\\][\w.\-/\\]*\.\w{1,6}\b')
EXT_TOKEN = re.compile(r'(?<![\w-])[\w-]*\.(?:%s)\b' % '|'.join(CODE_EXTS), re.I)
HASH = re.compile(r'\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{7,40}\b')
CAMEL = re.compile(r'[a-z]{2,}[A-Z]')
OTHER_MARKER = re.compile(r'[_./\\:]|\(\)|\d')


def reveal_steps(sl):
    """Reveal steps of a slide (Next presses before the next slide). Keep in step with dkSteps in assets/prmap.html."""
    kind = sl.get('type')
    return {'value': len(sl.get('cards') or []), 'before_after': 1, 'system': len(sl.get('blocks') or []),
            'flow': len(sl.get('steps') or []) + 1, 'risk': 5, 'takeaways': len(sl.get('points') or [])}.get(kind, 0)


OBJECT_LISTS = ('stats', 'cards', 'blocks', 'links', 'actors', 'steps', 'areas', 'mitigations')
OBJECTS = ('before', 'after')
TEXT_LISTS = ('points', 'watch', 'step_notes')
TEXT_FIELDS = ('title', 'scenario', 'ref', 'id', 'from', 'to')


def shape_errors(n, sl):
    """Wrong JSON shapes inside a slide (an entry that is not an object, a text list holding something else), so later checks can trust the types."""
    out = ['deck slide %d: "%s" must be a list of objects' % (n, k) for k in OBJECT_LISTS
           if k in sl and not (isinstance(sl[k], list) and all(isinstance(x, dict) for x in sl[k]))]
    out += ['deck slide %d: "%s" must be an object' % (n, k) for k in OBJECTS if k in sl and not isinstance(sl[k], dict)]
    out += ['deck slide %d: "%s" must be a list of text' % (n, k) for k in TEXT_LISTS
            if k in sl and not (isinstance(sl[k], list) and all(isinstance(x, str) for x in sl[k]))]
    if out:
        return out
    entries = [sl] + [x for k in OBJECT_LISTS for x in sl.get(k, [])]
    return ['deck slide %d: "%s" must be text' % (n, k) for x in entries for k in TEXT_FIELDS if k in x and not isinstance(x[k], str)]


def deck_errors(deck):
    """Reasons the deck cannot be drawn: wrong shapes, unknown slide type, a flow step or system link naming something that is not there."""
    if not isinstance(deck, dict):
        return ['deck: deck.json must be an object with a "slides" list']
    if 'title' in deck and not isinstance(deck['title'], str):
        return ['deck: "title" must be text']
    slides = deck.get('slides')
    if not isinstance(slides, list) or not slides:
        return ['deck: "slides" must be a non-empty list']
    out = []
    for n, sl in enumerate(slides, 1):
        if not isinstance(sl, dict) or sl.get('type') not in SLIDE_TYPES:
            out.append('deck slide %d: unknown type "%s" (use %s)' % (n, sl.get('type') if isinstance(sl, dict) else sl, ', '.join(SLIDE_TYPES)))
            continue
        shape = shape_errors(n, sl)
        if shape:
            out += shape
            continue
        if sl['type'] == 'flow':
            actors = {a.get('id') for a in sl.get('actors') or []}
            for i, st in enumerate(sl.get('steps') or [], 1):
                for end in ('from', 'to'):
                    if st.get(end) not in actors:
                        out.append('deck slide %d step %d: %s actor "%s" is not in actors' % (n, i, end, st.get(end)))
        if sl['type'] == 'system':
            blocks = {b.get('id') for b in sl.get('blocks') or []}
            for l in sl.get('links') or []:
                for end in ('from', 'to'):
                    if l.get(end) not in blocks:
                        out.append('deck slide %d: link %s->%s names unknown block "%s"' % (n, l.get('from'), l.get('to'), l.get(end)))
    return out


def deck_refs(deck):
    """[(where, ref)] for the mitigations that cite code, to be resolved with the rest of the refs."""
    return [('deck slide %d mitigation %d' % (n, i), m['ref']) for n, sl in enumerate(deck.get('slides', []), 1)
            for i, m in enumerate(sl.get('mitigations') or [], 1) if m.get('ref')]


def shown_texts(sl):
    """(field, text, word limit or None) for every piece of text the slide shows. A limit of None means the jargon check only."""
    kind = sl.get('type')
    yield 'title', sl.get('title'), 9
    if kind == 'title':
        yield 'subtitle', sl.get('subtitle'), 25
        for st in sl.get('stats') or []:
            yield 'stat value', st.get('value'), None
            yield 'stat label', st.get('label'), 6
    for cd in sl.get('cards') or []:
        yield 'card head', cd.get('head'), 6
        yield 'card text', cd.get('text'), 20
    for side in ('before', 'after'):
        yield side + ' head', (sl.get(side) or {}).get('head'), None
        for p in (sl.get(side) or {}).get('points') or []:
            yield side + ' point', p, 14
    for b in sl.get('blocks') or []:
        yield 'block name', b.get('name'), None
        yield 'block text', b.get('text'), 12
    for l in sl.get('links') or []:
        yield 'link label', l.get('label'), 4
    for a in sl.get('actors') or []:
        yield 'actor name', a.get('name'), None
    for st in sl.get('steps') or []:
        yield 'step label', st.get('label'), 6
        yield 'step text', st.get('text'), 18
    for key, limit in (('result', 16), ('reason', 25), ('rollout', 20), ('rollback', 20)):
        yield key, sl.get(key), limit
    for a in sl.get('areas') or []:
        yield 'area name', a.get('name'), 5
    for m in sl.get('mitigations') or []:
        yield 'mitigation', m.get('text'), 16
    for w in sl.get('watch') or []:
        yield 'watch item', w, 12
    for p in sl.get('points') or []:
        yield 'takeaway', p, 14


def _plain(token):
    return token.strip('.,;:!?"\'“”()[]{}').lower()


def code_like(text, symbols):
    """Tokens of `text` that read as code to a stakeholder: identifiers, paths, file extensions, hashes, call syntax."""
    found = []
    if re.search(r'::|->|→', text):
        found.append('::, -> or an arrow')
    if re.search(r'\w\(\)', text):
        found.append('()')
    for tok in text.split():
        if _plain(tok) in PRODUCT_NAMES:
            continue
        bare = tok.strip('.,;:!?"\'“”()[]{}')
        camel = CAMEL.search(bare) and (OTHER_MARKER.search(bare) or bare in symbols)
        if SNAKE.search(bare) or PATH.search(bare) or EXT_TOKEN.search(bare) or HASH.search(bare) or camel:
            found.append(bare)
    return list(dict.fromkeys(found))


def _count_lint(n, sl):
    key = {'value': 'cards', 'system': 'blocks', 'flow': 'actors', 'risk': 'areas', 'takeaways': 'points', 'title': 'stats'}.get(sl.get('type'))
    out = []
    for name in [k for k in (key, 'steps' if sl.get('type') == 'flow' else None) if k]:
        lo, hi = RANGES[name]
        count = len(sl.get(name) or [])
        if count not in range(lo, hi + 1):
            out.append('deck slide %d: %d %s (use %d to %d)' % (n, count, name, lo, hi))
    return out


def _notes_lint(n, sl):
    out = [] if sl.get('notes') else ['deck slide %d: no notes (the presenter speaks from them)' % n]
    if sl.get('type') in ('risk', 'takeaways'):
        have, need = len([x for x in sl.get('step_notes') or [] if x]), reveal_steps(sl)
        if have < need:
            out.append('deck slide %d: step_notes has %d of %d notes (one per reveal, in order)' % (n, have, need))
    per_step = {'value': ('cards', 'note'), 'system': ('blocks', 'note'), 'flow': ('steps', 'note')}.get(sl.get('type'))
    if per_step:
        out += ['deck slide %d %s %d: no %s' % (n, per_step[0], i, per_step[1]) for i, x in enumerate(sl.get(per_step[0]) or [], 1) if not x.get(per_step[1])]
    if sl.get('type') == 'before_after' and not sl.get('note_after'):
        out.append('deck slide %d: no note_after' % n)
    return out


def _structure_lint(slides, scenario_ids, code_mode):
    kinds = [sl.get('type') for sl in slides]
    out = ['deck: no %s slide' % k for k in ('title', 'value', 'system', 'flow', 'risk', 'takeaways') if k not in kinds]
    if 'before_after' in kinds and code_mode:
        out.append('deck: before_after is for a change; code mode explains why the area exists instead')
    if 'before_after' not in kinds and not code_mode:
        out.append('deck: no before_after slide')
    if kinds.count('flow') > MAX_FLOWS:
        out.append('deck: %d flow slides (major use cases only, at most %d)' % (kinds.count('flow'), MAX_FLOWS))
    ranks = [SLIDE_TYPES.index(k) for k in kinds if k in SLIDE_TYPES]
    if ranks != sorted(ranks):
        out.append('deck: slides out of order (title, value, before_after, system, flow, risk, takeaways)')
    for n, sl in enumerate(slides, 1):
        if sl.get('type') == 'flow' and sl.get('scenario') and sl['scenario'] not in scenario_ids:
            out.append('deck slide %d: scenario "%s" is not in scenarios.json' % (n, sl['scenario']))
        if sl.get('type') == 'system':
            out += ['deck slide %d: link %s->%s joins a block to itself and is not drawn' % (n, l['from'], l['to'])
                    for l in sl.get('links') or [] if l.get('from') == l.get('to')]
        if sl.get('type') == 'risk' and sl.get('level') not in LEVELS:
            out.append('deck slide %d: risk level "%s" is not low, medium or high' % (n, sl.get('level')))
    return out


def deck_lint(deck, scenario_ids, code_mode, symbols):
    """Warnings only (never errors): structure, counts, word limits, missing notes or stat sources, code-like words in shown text."""
    slides = deck.get('slides', [])
    out = _structure_lint(slides, scenario_ids, code_mode)
    if len((deck.get('title') or '').split()) > 9:
        out.append('deck: title is over 9 words')
    for n, sl in enumerate(slides, 1):
        out += _count_lint(n, sl) + _notes_lint(n, sl)
        out += ['deck slide %d: stat "%s" has no source (commit, ticket, test, config or doc)' % (n, st.get('label')) for st in sl.get('stats') or [] if not st.get('source')]
        for field, text, limit in shown_texts(sl):
            words = len(str(text or '').split())
            if limit and words > limit:
                out.append('deck slide %d: %s is %d words (max %d)' % (n, field, words, limit))
            out += ['deck slide %d: %s "%s" reads as code, say it in business words' % (n, field, tok) for tok in code_like(str(text or ''), symbols)]
    return out


def deck_summary(deck, lint_count):
    slides = deck.get('slides', [])
    return 'deck: %d slides (%d flows), %d reveal steps; %d lint' % (
        len(slides), sum(1 for sl in slides if sl.get('type') == 'flow'), sum(reveal_steps(sl) for sl in slides), lint_count)
