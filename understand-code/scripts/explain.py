"""Beat ranges and explanation lints for the walkthrough and the simulator (used by build_prmap.py)."""
import re

from refs import split_ref
from snippets import _code

NOISE = re.compile(r'^[\s{}()\[\];,]*$')
LONG_EXCERPT = 80
DECISION = re.compile(r'\b(?:if|elif|for|foreach|while|switch|case|catch|except|try)\b|&&|\|\||\s\?\s')  # a `?` counts only as a ternary
ORPHAN_DOC = re.compile(r'^\s*(?:\*(?:\s|/|$)|--(?:\s|$))')  # a block-comment line whose /* is not in the excerpt, or an SQL comment
SKIPPED_ROWS = ('-', '…')  # removed rows and the fold row are not code the reader has to follow
DEPTHS = ('normal', 'deep', 'line')
HIGH_DECISIONS, CORE_DECISIONS = 3, 2  # a unit is complex at 3 decision rows, or at 2 when it runs in several scenarios
DEEP_ROWS, DEEP_DECISIONS = 3, 1  # a deep beat covers at most 3 meaningful rows and 1 decision row


def _anchors(beat):
    code = beat.get('code')
    return [] if code is None else [code] if isinstance(code, str) else [a for a in code if a]


def _find(shown, anchor, at):
    return next((i for i in range(at, len(shown)) if anchor in shown[i]), None)


def resolve_beats(beats, shown):
    """Set beat['rows'] = [[first, last], ...] (inclusive row indexes into the shown excerpt) for every beat and return the
    unresolved anchors as [(beat number, anchor)]. A beat searches from the row where the previous beat started (the same
    anchor again moves on one row), so repeated text such as `return err` lands on the right line. A single anchor without
    `to` covers every row up to the next beat's first row; `to` covers first..to; a list covers the rows it names plus the
    run after its last one."""
    misses, at, prev = [], 0, None
    for n, beat in enumerate(beats):
        anchors, rows, pos = _anchors(beat), [], at
        for k, anchor in enumerate(anchors):
            i = _find(shown, anchor, pos + 1 if k == 0 and anchor == prev else pos)
            i = _find(shown, anchor, 0) if i is None else i  # out of order (older JSON): still resolve it
            if i is None:
                misses.append((n + 1, anchor))
                continue
            rows.append([i, i])
            pos = i
        if rows and beat.get('to'):
            j = _find(shown, beat['to'], rows[0][0])
            if j is None:
                misses.append((n + 1, beat['to']))
            else:
                rows[0][1] = j
        beat['rows'], beat['_open'] = rows, bool(rows) and not beat.get('to')
        prev, at = (anchors[0] if anchors else prev), (rows[0][0] if rows else at)
    _close_runs(beats, len(shown))
    return misses


def _close_runs(beats, size):
    """Extend each open beat from its last row to the row before the next beat's first row (the last beat: to the end)."""
    for n, beat in enumerate(beats):
        if beat.pop('_open'):
            nxt = next((b['rows'][0][0] for b in beats[n + 1:] if b['rows']), size)
            beat['rows'][-1][1] = max(beat['rows'][-1][1], nxt - 1)


def uncovered(texts, beats):
    """Maximal runs [a, b] of rows that matter (not blank, not only brackets or semicolons) that no beat range covers."""
    covered = {r for b in beats for lo, hi in b.get('rows', []) for r in range(lo, hi + 1)}
    runs, cur = [], None
    for i, text in enumerate(texts):
        if i in covered:
            cur = None
        elif not NOISE.match(text):
            if cur:
                cur[1] = i
            else:
                cur = [i, i]
                runs.append(cur)
    return runs


def line_numbers(sn):
    """File line number for each shown row (a removed row takes the number of the line it sits before, a gap row None)."""
    if 'nums' in sn:
        return sn['nums']
    nums, n = [], sn['start'] - 1
    for prefix, _ in sn['lines']:
        n += prefix != '-'
        nums.append(n if prefix != '-' else n + 1)
    return nums


def item_lint(item_id, it):
    """Warnings for one walkthrough item: a long excerpt, lines no beat explains."""
    sn, out = it.get('snippet'), []
    if it.get('depth') is not None and it['depth'] not in DEPTHS:
        out.append('story %s: depth "%s" must be one of %s' % (item_id, it['depth'], ', '.join(DEPTHS)))
    if not sn:
        return out
    size = len(sn['lines'])
    if size > LONG_EXCERPT and not it.get('span'):
        out.append('story %s: %d-line excerpt: split it into parts with span (<=60 lines each)' % (item_id, size))
    if not it.get('beats'):
        return out + ['story %s: no beats, the whole excerpt (%d lines) is unexplained' % (item_id, size)]
    nums = line_numbers(sn)
    for a, b in uncovered([t for _, t in sn['lines']], it['beats']):
        out.append('story %s: excerpt lines %d-%d (file lines) no beat explains' % (item_id, nums[a], nums[b]))
    return out


def scenarios_running(scenarios, path, symbol):
    """[{scenario, title, step}] for every simulator step whose ref is this unit."""
    return [{'scenario': sc['id'], 'title': sc['title'], 'step': i} for sc in scenarios for i, st in enumerate(sc['steps'])
            if st.get('ref') and split_ref(st['ref']) == (path, symbol)]


def _kinds(sn, python=False):
    """{row index: is a decision row} for the meaningful rows of an excerpt: no removed or fold rows, and no blank, bracket or
    comment-only ones (strings and comments are stripped with snippets._code; python=True keeps // as floor division)."""
    kinds, state = {}, ''
    for i, (p, t) in enumerate(sn['lines']):
        if p not in SKIPPED_ROWS:
            code, state = _code(t, state, not python)
            if not NOISE.match(code) and not ORPHAN_DOC.match(t):
                kinds[i] = bool(DECISION.search(code))
    return kinds


def complexity(sn, runs_in=(), python=False):
    """(rating, decision rows, meaningful rows) of the shown excerpt: high when it holds HIGH_DECISIONS decision rows, or
    CORE_DECISIONS when the unit is core (runs in 2+ simulator scenarios)."""
    kinds = _kinds(sn, python)
    decisions = sum(kinds.values())
    core = len({r['scenario'] for r in runs_in}) >= 2
    return ('high' if decisions >= (CORE_DECISIONS if core else HIGH_DECISIONS) else 'low'), decisions, len(kinds)


def complexity_hint(sn, runs_in=(), python=False):
    """One line for the story writer: how complex the excerpt is and the depth to give it."""
    rating, decisions, size = complexity(sn, runs_in, python)
    return 'complexity: high (%d decisions, %d lines) -> depth deep' % (decisions, size) if rating == 'high' else 'complexity: low -> depth normal'


def _loads(beats, kinds):
    """[(meaningful rows, decision rows)] each beat covers."""
    out = []
    for b in beats:
        covered = {r for lo, hi in b.get('rows', []) for r in range(lo, hi + 1)} & kinds.keys()
        out.append((len(covered), sum(kinds[r] for r in covered)))
    return out


def depth_lint(item_id, it):
    """Findings about explanation depth: beats too coarse for the item's depth (or for a complex or core unit with no depth set).
    An invalid depth is reported by item_lint, not here."""
    sn, beats, depth = it.get('snippet'), it.get('beats'), it.get('depth')
    if not sn or not beats or depth == 'normal' or (depth is not None and depth not in DEPTHS):
        return []
    python = split_ref(it.get('ref') or '')[0].endswith('.py')
    loads = _loads(beats, _kinds(sn, python))
    widest, most = max(r for r, _ in loads), max(d for _, d in loads)
    if depth == 'line':
        n = sum(1 for r, _ in loads if r > 1)
        return ['story %s: depth line but %d beats cover more than one line (widest %d): one beat per line' % (item_id, n, widest)] if n else []
    coarse = sum(1 for r, d in loads if r > DEEP_ROWS or d > DEEP_DECISIONS)
    cause = '%d beats cover more than %d lines or %d decision (widest %d lines, %d decisions)' % (coarse, DEEP_ROWS, DEEP_DECISIONS, widest, most)
    if depth == 'deep':
        return ['story %s: depth deep but %s: split them, each beat saying why' % (item_id, cause)] if coarse else []
    rating, decisions, size = complexity(sn, it.get('runs_in', ()), python)
    if rating == 'high' and coarse:
        return ['story %s: complex unit (%d decisions, %d lines): %s: set depth deep and split them, each beat saying why; '
                'depth normal only if the code is truly flat (a table, a list of assignments)' % (item_id, decisions, size, cause)]
    return []


def changed_gaps(parts):
    """Change mode: the changed lines of a unit that none of its items shows. parts: [(item id, snippet)]."""
    sns = [(i, s) for i, s in parts if s]
    if not sns:
        return []
    shown = {n for _, s in sns for n in s.get('nums', [])}
    missing = [n for n in sns[0][1].get('changed_at', []) if n not in shown]
    return ['story %s: changed file lines %s are in no excerpt' % (','.join(i for i, _ in sns), ', '.join(map(str, missing[:12])))] if missing else []


def span_gaps(parts):
    """Code mode: for items that share one ref and use span, the lines of the whole unit no part shows. parts: [(item id, snippet)]."""
    sns = [(i, s) for i, s in parts if s]
    if not any(s.get('spanned') for _, s in sns):
        return []
    lo, hi = sns[0][1]['block']
    gaps, at = [], lo
    for a, b in sorted((s['start'], s['end']) for _, s in sns):
        if a > at:
            gaps.append((at, a - 1))
        at = max(at, b + 1)
    if at <= hi:
        gaps.append((at, hi))
    return ['story %s: the parts of this unit leave file lines %d-%d unshown' % (','.join(i for i, _ in sns), a, b) for a, b in gaps]


def jumps(scenario, edges):
    """Warnings for consecutive steps on different nodes with no inventory edge between them in either direction."""
    linked = {(e['from'], e['to']) for e in edges}
    steps, out = scenario.get('steps', []), []
    for k in range(1, len(steps)):
        a, b = steps[k - 1].get('node'), steps[k].get('node')
        if a != b and (a, b) not in linked and (b, a) not in linked:
            out.append('scenario %s step %d: jump %s -> %s with no call edge between them; add the step in between or the missing edge'
                       % (scenario.get('id'), k + 1, a, b))
    return out
