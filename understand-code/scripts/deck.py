#!/usr/bin/env python3
"""The optional stakeholder deck (WORK/deck.json, the Brief tab): validation errors, mitigation refs, lint, and the summary line.

Schema and writing rules: references/deck.md. build_prmap.py calls this only when deck.json exists.
"""
import base64
import os
import re

SLIDE_TYPES = ['title', 'value', 'before_after', 'system', 'flow', 'risk', 'takeaways']
LEVELS = ['low', 'medium', 'high']
MAX_FLOWS = 3
MAX_TERMS, TERM_MEANS_WORDS = 8, 15
MAX_DATABASE = 8
DB_USES = ['new column', 'new table', 'changed column', 'reads', 'writes']
DB_SCHEMA_USES = DB_USES[:3]  # a change to the schema: a risk area that needs a detail on how it reaches site databases
DB_WORDS = re.compile(r'\b(database|sql|schema|migration|tables?)\b', re.I)
BRAND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'brands')
LOGO_TYPES = {'.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp'}
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


OBJECT_LISTS = ('stats', 'cards', 'blocks', 'links', 'actors', 'steps', 'areas', 'mitigations', 'database')
OBJECTS = ('before', 'after')
TEXT_LISTS = ('points', 'watch', 'step_notes')
TEXT_FIELDS = ('title', 'scenario', 'ref', 'id', 'from', 'to', 'when', 'table', 'use', 'detail')


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


def top_level_errors(deck):
    """Wrong shapes in the deck's own fields (title, terms, brand), so later checks can trust the types."""
    out = ['deck: "title" must be text'] if 'title' in deck and not isinstance(deck['title'], str) else []
    terms, brand = deck.get('terms', []), deck.get('brand', {'name': ''})
    if not (isinstance(terms, list) and all(isinstance(t, dict) for t in terms)):
        out.append('deck: "terms" must be a list of objects')
    else:
        out += ['deck term %d: "%s" must be text' % (i, k) for i, t in enumerate(terms, 1) for k in ('term', 'means') if k in t and not isinstance(t[k], str)]
        out += ['deck term %d: needs a "term"' % i for i, t in enumerate(terms, 1) if not t.get('term')]
    if not isinstance(brand, dict):
        out.append('deck: "brand" must be an object')
    else:
        out += ['deck brand: "%s" must be text' % k for k in ('name', 'logo') if k in brand and not isinstance(brand[k], str)]
        out += ['deck brand: needs a "name"'] if 'brand' in deck and not brand.get('name') else []
    return out


def deck_errors(deck):
    """Reasons the deck cannot be drawn: wrong shapes, unknown slide type, a flow step or system link naming something that is not there."""
    if not isinstance(deck, dict):
        return ['deck: deck.json must be an object with a "slides" list']
    top = top_level_errors(deck)
    if top:
        return top
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
    if kind == 'flow':
        yield 'when', sl.get('when'), 20
    for st in sl.get('steps') or []:
        yield 'step label', st.get('label'), 6
        yield 'step text', st.get('text'), 18
    for key, limit in (('result', 16), ('reason', 25), ('rollout', 20), ('rollback', 20)):
        yield key, sl.get(key), limit
    for a in sl.get('areas') or []:
        yield 'area name', a.get('name'), 5
    for a in sl.get('areas') or []:
        yield 'area why', a.get('why'), 20
    for m in sl.get('mitigations') or []:
        yield 'mitigation', m.get('text'), 16
    for d in sl.get('database') or []:
        yield 'database detail', d.get('detail'), 12
    for w in sl.get('watch') or []:
        yield 'watch item', w, 12
    for p in sl.get('points') or []:
        yield 'takeaway', p, 14


def _plain(token):
    return token.strip('.,;:!?"\'“”()[]{}').lower()


def term_pattern(terms):
    """A regex for the listed terms as whole words (case-insensitive, longest first), or None when there are none."""
    names = sorted({t for t in terms if t}, key=len, reverse=True)
    return re.compile(r'(?<!\w)(?:%s)(?!\w)' % '|'.join(re.escape(n) for n in names), re.I) if names else None


def code_like(text, symbols, terms=()):
    """Tokens of `text` that read as code to a stakeholder: identifiers, paths, file extensions, hashes, call syntax.
    A listed term (a product name such as CleanStation) is a word to a stakeholder, so it is never code."""
    found = []
    listed = term_pattern(terms)
    text = listed.sub(' ', text) if listed else text
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


def _terms_lint(deck, symbols):
    """A term needs a short meaning and has to appear in the shown text, or it explains nothing."""
    terms = [t for t in deck.get('terms') or [] if t.get('term')]
    names = [t['term'] for t in terms]
    shown = ' '.join(str(text or '') for sl in deck.get('slides', []) for _, text, _ in shown_texts(sl))
    out = ['deck: %d terms (use at most %d)' % (len(terms), MAX_TERMS)] if len(terms) > MAX_TERMS else []
    for t in terms:
        means = t.get('means') or ''
        words = len(means.split())
        out += [] if words else ['deck term "%s": no "means"' % t['term']]
        out += ['deck term "%s": means is %d words (max %d)' % (t['term'], words, TERM_MEANS_WORDS)] if words > TERM_MEANS_WORDS else []
        out += ['deck term "%s": means "%s" reads as code, say it in business words' % (t['term'], tok) for tok in code_like(means, symbols, names)]
        out += [] if term_pattern([t['term']]).search(shown) else ['deck term "%s": never used in the shown text' % t['term']]
    return out


def table_names(deck):
    """The database tables the deck names: shown verbatim, so never code-like."""
    return [d['table'] for sl in deck.get('slides', []) for d in sl.get('database') or [] if d.get('table')]


def _database_lint(deck):
    """The database list of a risk slide (known uses, a detail for every schema change) and a changed block that talks about the database with no list."""
    slides = deck.get('slides', [])
    out = []
    for n, sl in enumerate(slides, 1):
        rows = sl.get('database') or []
        out += ['deck slide %d: %d database rows (use at most %d)' % (n, len(rows), MAX_DATABASE)] if len(rows) > MAX_DATABASE else []
        out += ['deck slide %d: database use "%s" is unknown (use %s)' % (n, d.get('use'), ', '.join(DB_USES)) for d in rows if d.get('use') not in DB_USES]
        out += ['deck slide %d: database table "%s" is a %s with no detail (say how it reaches site databases, or that no script is in this change)'
                % (n, d.get('table'), d['use']) for d in rows if d.get('use') in DB_SCHEMA_USES and not d.get('detail')]
    touched = [b.get('name') for sl in slides if sl.get('type') == 'system' for b in sl.get('blocks') or []
               if b.get('status') in ('new', 'changed') and DB_WORDS.search('%s %s' % (b.get('name'), b.get('text')))]
    touched += [a.get('name') for sl in slides if sl.get('type') == 'flow' for a in sl.get('actors') or [] if a.get('icon') == 'db']
    listed = any(sl.get('database') for sl in slides if sl.get('type') == 'risk')
    return out + (['database touched but no database list ("%s" is the database or mentions it; list the tables on the risk slide)' % touched[0]] if touched and not listed else [])


def _areas_lint(n, sl):
    return ['deck slide %d: area "%s" has no why (ground its level in what the code touches, max 20 words)' % (n, a.get('name')) for a in sl.get('areas') or [] if not a.get('why')]


def _database_step_lint(n, sl, tables):
    """A flow step that touches a database actor has to name one of the risk slide's tables (checked only when that list exists)."""
    pattern = term_pattern(tables)
    dbs = {a.get('id') for a in sl.get('actors') or [] if a.get('icon') == 'db'}
    if sl.get('type') != 'flow' or not pattern:
        return []
    return ['deck flow slide %d step %d touches the database but names no table (%s)' % (n, i, ', '.join(tables))
            for i, st in enumerate(sl.get('steps') or [], 1)
            if {st.get('from'), st.get('to')} & dbs and not pattern.search('%s %s' % (st.get('label'), st.get('text')))]


def _flow_lint(n, sl):
    return ['deck slide %d: flow has no "when" (who does what and why, the trigger, max 20 words)' % n] if sl.get('type') == 'flow' and not sl.get('when') else []


def deck_lint(deck, scenario_ids, code_mode, symbols):
    """Warnings only (never errors): structure, counts, word limits, missing notes or stat sources, code-like words in shown text."""
    slides = deck.get('slides', [])
    names = [t.get('term') for t in deck.get('terms') or []] + table_names(deck)
    out = _structure_lint(slides, scenario_ids, code_mode) + _terms_lint(deck, symbols) + _database_lint(deck)
    if len((deck.get('title') or '').split()) > 9:
        out.append('deck: title is over 9 words')
    for n, sl in enumerate(slides, 1):
        out += _count_lint(n, sl) + _notes_lint(n, sl) + _flow_lint(n, sl) + _areas_lint(n, sl) + _database_step_lint(n, sl, table_names(deck))
        out += ['deck slide %d: stat "%s" has no source (commit, ticket, test, config or doc)' % (n, st.get('label')) for st in sl.get('stats') or [] if not st.get('source')]
        for field, text, limit in shown_texts(sl):
            words = len(str(text or '').split())
            if limit and words > limit:
                out.append('deck slide %d: %s is %d words (max %d)' % (n, field, words, limit))
            out += ['deck slide %d: %s "%s" reads as code, say it in business words' % (n, field, tok) for tok in code_like(str(text or ''), symbols, names)]
    return out


def deck_summary(deck, lint_count):
    slides = deck.get('slides', [])
    return 'deck: %d slides (%d flows), %d reveal steps; %d lint' % (
        len(slides), sum(1 for sl in slides if sl.get('type') == 'flow'), sum(reveal_steps(sl) for sl in slides), lint_count)


def embed_brand(deck, work):
    """(the deck as the page carries it, errors). The brand's logo (the built-in name "labos", or a path relative to `work` or absolute)
    becomes `src`, a data URI, so the page stays one file. A deck without a brand logo is returned as it is."""
    brand = deck.get('brand')
    if not brand or not brand.get('logo'):
        return deck, []
    logo = brand['logo']
    built_in = os.path.join(BRAND_DIR, logo + '.svg')
    path = built_in if os.path.isfile(built_in) else logo if os.path.isabs(logo) else os.path.join(work, logo)
    mime = LOGO_TYPES.get(os.path.splitext(path)[1].lower())
    if not os.path.isfile(path):
        return deck, ['deck brand: logo "%s" is not a built-in brand or a file' % logo]
    if not mime:
        return deck, ['deck brand: logo "%s" is not an image (use %s)' % (logo, ', '.join(LOGO_TYPES))]
    with open(path, 'rb') as f:
        src = 'data:%s;base64,%s' % (mime, base64.b64encode(f.read()).decode('ascii'))
    return {**deck, 'brand': {'name': brand['name'], 'src': src}}, []
