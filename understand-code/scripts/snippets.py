"""Code snippets for walkthrough items: a symbol's block in the head version with the change's +/- lines."""
import difflib
import os
import re
import subprocess

DOC_LINE = re.compile(r'^\s*(//|#|\*|/\*|--)')


def _git(repo, *args):
    try:
        r = subprocess.run(['git', '-C', repo] + list(args), capture_output=True, text=True, encoding='utf-8', errors='replace')
    except OSError:
        return None
    return r.stdout if r.returncode == 0 else None


def _definition(name):
    n = re.escape(name)
    return re.compile(r'^\s*(?:func\s*(?:\([^)]*\)\s*)?%s\b|def\s+%s\b|class\s+%s\b|type\s+%s\b|(?:export\s+)?(?:async\s+)?function\s+%s\b'
                      r'|%s\s*\(\)\s*\{|(?:const|var|let|readonly)\s+%s\b|%s\s*[:=(])' % ((n,) * 8))


def _cpp_definition(symbol):
    """Owner::Method( on a line that is not a call statement, so a C++ ref finds its body, not a call site."""
    pat = re.compile(r'\b%s\s*\(' % re.escape(symbol))
    return lambda l: pat.search(l) and not l.rstrip().endswith(';') and '=' not in l.split(symbol)[0] and 'return' not in l.split(symbol)[0]


NEXT_DEF = re.compile(r'^\s*(?:func\b|def\b|async\s+def\b|class\b|(?:export\s+)?(?:async\s+)?function\b)')
QUOTED = re.compile(r'"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'')


PY_DEF = re.compile(r'^\s*(?:async\s+)?def\s+\w+.*:\s*(?:#.*)?$')


def _code(line, state, c_comments=True):
    """(line without strings and comments, state) for brace counting; state is '' or '`' (Go raw string) or '*' (block comment) carried across lines.
    c_comments False (a Python file) leaves // (floor division) and /* alone."""
    out, i = [], 0
    while i < len(line):
        c, two = line[i], line[i:i + 2]
        edge = i == 0 or line[i - 1] in ' \t;{})('  # a comment starts after a gap or a bracket: not in ${a//b/c}, */*/* or a URL
        if state == '`':
            j = line.find('`', i)
            i, state = (len(line), state) if j < 0 else (j + 1, '')
        elif state == '*':
            j = line.find('*/', i)
            i, state = (len(line), state) if j < 0 else (j + 2, '')
        elif c == '`':
            state, i = '`', i + 1
        elif two == '/*' and edge and c_comments:
            state, i = '*', i + 2
        elif (two == '//' and edge and c_comments) or (c == '#' and edge and line[i + 1:i + 2] in ('', ' ', '\t')):
            break
        elif c in ('"', "'") and QUOTED.match(line, i):
            i = QUOTED.match(line, i).end()
        else:
            out.append(c)
            i += 1
    return ''.join(out), state


def _indent(line):
    return len(line) - len(line.lstrip())


def _ends_statement(line, own):
    """A non-blank line at the definition's own indent or less that is not a continuation bracket."""
    return bool(line.strip()) and _indent(line) <= own and not line.lstrip().startswith(('{', ')', ']', '}', ':', ','))  # also a C++ initializer list (`: m_x(1)`, `, m_y(2)`)


def method_start(lines, owner, name):
    """Index of the line declaring Owner.Name: a Go method on Owner (also Owner[T]), or a method inside `class Owner`; None if there is none."""
    go = re.compile(r'^\s*func\s*\(\s*(?:\w+\s+)?\*?\s*%s(?:\[[^\]]*\])?\s*\)\s*%s\b' % (re.escape(owner), re.escape(name)))
    hit = next((i for i, l in enumerate(lines) if go.match(l)), None)
    if hit is not None:
        return hit
    cls = re.compile(r'^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+%s\b' % re.escape(owner))
    meth = re.compile(r'^\s+(?:(?:async|static|public|private|protected|get|set|override)\s+)*(?:def\s+%s\b|%s\s*[(<])' % (re.escape(name), re.escape(name)))
    c = next((i for i, l in enumerate(lines) if cls.match(l)), None)
    if c is None:
        return None
    for j in range(c + 1, len(lines)):
        if lines[j].strip() and _indent(lines[j]) <= _indent(lines[c]):
            return None
        if meth.match(lines[j]):
            return j
    return None


def find_block(lines, symbol):
    """(start, end, literal, runs_into) line indexes of the code that defines symbol, including its doc comment.
    literal: no definition matched, a plain mention was used; runs_into: another definition starts inside the block."""
    name = symbol.rpartition('.')[2] if re.match(r'^[\w.]+$', symbol) else symbol
    if re.match(r'^[\w:~]+::~?\w+$', symbol):
        is_def = _cpp_definition(symbol)
    else:
        pat = _definition(name) if re.match(r'^\w+$', name) else None
        is_def = pat.search if pat else None
    owner, _, method = symbol.rpartition('.')
    start = method_start(lines, owner.split('.')[-1], method) if owner and re.match(r'^[\w.]+$', symbol) else None
    if start is None:
        start = next((i for i, l in enumerate(lines) if is_def and is_def(l)), None)
    literal = start is None
    if literal:
        start = next((i for i, l in enumerate(lines) if symbol in l or name in l), None)
    if start is None:
        return None
    group = _paren_group(lines, start)
    if group:  # a name inside `const (` / `var (` / `type (`: the whole group is the unit
        start = group[0]
        literal = False
    first = _with_doc(lines, start)
    end, runs_into = _extent(lines, start, literal, group[1] if group else None)
    return first, end, literal, runs_into


def _with_doc(lines, start):
    first = start
    while first > 0 and DOC_LINE.match(lines[first - 1]) and start - first < 12:
        first -= 1
    return first


GROUP_OPEN = re.compile(r'^(?:const|var|type|import)\s*\($')


def _paren_group(lines, start):
    """(opener, closer) line indexes of the Go paren group a line sits inside, or None."""
    own = _indent(lines[start])
    if GROUP_OPEN.match(lines[start].strip()):
        return None
    j = start - 1
    while j >= 0 and (not lines[j].strip() or _indent(lines[j]) >= own):
        j -= 1
    if j < 0 or _indent(lines[j]) >= own or not GROUP_OPEN.match(lines[j].strip()):
        return None
    close = next((k for k in range(start + 1, len(lines)) if lines[k].strip() and _indent(lines[k]) <= _indent(lines[j])), None)
    return (j, close) if close is not None and lines[close].lstrip().startswith(')') else None


TOP_DEF = re.compile(r'^\s*(?:func|type|const|var|class|def|async\s+def|function|export|import)\b')


def _extent(lines, start, literal, closer=None):
    """(end, runs_into): the last line of the unit that begins at start."""
    if closer is not None:
        return closer, False
    own = _indent(lines[start])
    c_comments = not any(PY_DEF.match(l) for l in lines)
    head = _code(lines[start], '', c_comments)[0].rstrip()
    py = not literal and (bool(re.match(r'\s*(?:async\s+)?def\b', head)) or (head.endswith(':') and '{' not in head))
    depth, opened, end, state = 0, False, start, ''
    for j in range(start, start if py else min(len(lines), start + 600)):
        # a brace-less definition (Go type/const, TS type) ends at the next statement; a literal match only at the next top-level definition
        if j > start and not opened and (TOP_DEF.match(lines[j]) and _indent(lines[j]) <= own if literal else _ends_statement(lines[j], own)):
            break
        code, state = _code(lines[j], state, c_comments)
        depth += code.count('{') - code.count('}')
        opened = opened or '{' in code
        end = j
        if opened and depth <= 0:
            break
    if py or not opened:
        end = start
        for j in range(start + 1, min(len(lines), start + (12 if literal else len(lines)))):
            if _ends_statement(lines[j], own):
                break
            end = j
        while end > start and not lines[end].strip():
            end -= 1
    runs_into = any(NEXT_DEF.match(lines[j]) and _indent(lines[j]) == own for j in range(start + 1, end + 1))
    return end, runs_into


UNIT_START = re.compile(r'^(?:func|type|const|var|class|def|async\s+def|(?:export\s+)?(?:async\s+)?function|export\s+(?:const|class|type|default))\b'
                        r'|^[A-Za-z_]\w*\s*\(\)\s*\{|^[\w:~<>*&\s]+::~?\w+\s*\(')


def file_units(repo, base, head, path, snapshot, cache, changed_only):
    """[(first, last, label)] file lines of each top-level definition; with changed_only, just those containing changed lines."""
    cache = cache if cache is not None else {}
    if path not in cache:
        cache[path] = _annotated(repo, base, head, path, snapshot)
    rows = cache[path]
    if not rows:
        return []
    lines = [t for _, t, n in rows if n is not None]
    # A lone brace or blank line is diff alignment (an added function after this one borrows its closing
    # brace), not a change to this unit.
    changed = {n for p, t, n in rows if p == '+' and n is not None and t.strip() not in ('', '{', '}', '};')}
    units, k = [], 0
    while k < len(lines):
        l = lines[k]
        if UNIT_START.match(l) and not l.rstrip().endswith(';'):
            end, _ = _extent(lines, k, False)
            if not changed_only or any(k + 1 <= n <= end + 1 for n in changed):
                units.append((_with_doc(lines, k) + 1, end + 1, l.strip()[:48]))
            k = end + 1
        else:
            k += 1
    return units


def read_text(full):
    """File text as utf-8, or Windows-1252 for legacy files that are not valid utf-8."""
    with open(full, 'rb') as f:
        raw = f.read()
    try:
        return raw.decode('utf-8')
    except UnicodeDecodeError:
        return raw.decode('cp1252', errors='replace')


def _snapshot_rows(snapshot, path):
    """Rows for a Perforce CL from its before/after snapshot (prepare.py --p4), or None if path is not in it."""
    old_f, new_f = (os.path.join(snapshot, side, path) for side in ('old', 'new'))
    if not os.path.exists(new_f):
        return None
    new = read_text(new_f).splitlines()
    old = read_text(old_f).splitlines() if os.path.exists(old_f) else []
    rows, new_no = [], 0
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, old, new, autojunk=False).get_opcodes():
        if tag == 'equal':
            for t in new[j1:j2]:
                new_no += 1
                rows.append((' ', t, new_no))
            continue
        rows.extend(('-', t, None) for t in old[i1:i2])
        for t in new[j1:j2]:
            new_no += 1
            rows.append(('+', t, new_no))
    return rows


def _annotated(repo, base, head, path, snapshot=None):
    """[(prefix, text, new_line_no)] for the whole file at head, with removed lines interleaved."""
    if snapshot:
        rows = _snapshot_rows(snapshot, path)
        if rows is not None:
            return rows
    content = None
    if base and head:
        out = _git(repo, 'diff', '-U100000', '--no-color', base, head, '--', path)
        if out:
            rows, new_no, body = [], 0, False
            for line in out.splitlines():
                if line.startswith('@@'):
                    body = True
                    new_no = int(re.match(r'@@ -\d+(?:,\d+)? \+(\d+)', line).group(1)) - 1
                    continue
                if not body or line.startswith('\\'):
                    continue
                tag, text = line[:1], line[1:]
                if tag == '-':
                    rows.append(('-', text, None))
                else:
                    new_no += 1
                    rows.append(('+' if tag == '+' else ' ', text, new_no))
            if rows:
                return rows
        content = _git(repo, 'show', '%s:%s' % (head, path))
    if content is None:
        full = os.path.join(repo, path)
        if not os.path.exists(full):
            return None
        content = read_text(full)
    return [(' ', t, i + 1) for i, t in enumerate(content.splitlines())]


def _slice(picked, span):
    """picked rows cut to the lines from the one containing span[0] to the one containing span[1] (plus the removed lines just above the first);
    a span[1] of null runs to the end of the unit, for a last part whose closing lines are only braces; None if unresolved."""
    i = next((k for k, (_, t, n) in enumerate(picked) if n is not None and span[0] in t), None)
    if i is None:
        return None
    if span[1] is None:
        j = len(picked) - 1
    else:
        j = next((k for k in range(i, len(picked)) if picked[k][2] is not None and span[1] in picked[k][1]), None)
    if j is None:
        return None
    while i > 0 and picked[i - 1][2] is None:
        i -= 1
    return picked[i:j + 1]


CONTEXT = 3
GAP = ('…', '', None)


def _focus(picked):
    """picked rows cut to the changed lines plus CONTEXT unchanged lines around each run, a longer unchanged stretch
    between runs folded into one gap row; None when nothing in the unit changed or all of it did (then it is shown whole)."""
    changed = [k for k, (p, _, _) in enumerate(picked) if p != ' ']
    if not changed or len(changed) == len(picked):
        return None
    keep = sorted({j for k in changed for j in range(max(0, k - CONTEXT), min(len(picked), k + CONTEXT + 1))})
    out = []
    for prev, k in zip([None] + keep, keep):
        if prev is not None and k - prev > 2:
            out.append(GAP)
        elif prev is not None and k - prev == 2:
            out.append(picked[k - 1])
        out.append(picked[k])
    return out


def _numbers(rows):
    """File line number per row; a removed row takes the number of the line it sits before (at the end: after), a gap row None."""
    nums, nxt = [None] * len(rows), None
    for k in range(len(rows) - 1, -1, -1):
        p, _, n = rows[k]
        if n is not None:
            nxt = n
        nums[k] = n if n is not None else None if p == GAP[0] else nxt
    last = 0
    for k, (p, _, n) in enumerate(rows):
        if nums[k] is None and p != GAP[0]:
            nums[k] = last + 1
        last = nums[k] or last
    return nums


def snippet(repo, base, head, path, symbol, span=None, cache=None, snapshot=None, focus=False):
    """{start, end, lines: [[prefix, text]], nums, changed, changed_at, more: 0, block: [first, last] file lines of the whole unit,
    literal, runs_into, span_miss} or None when the symbol cannot be found. Every line of the unit is kept, unless span (two
    substrings) cuts it to one contiguous part and/or focus (change mode) cuts it to its changed lines with a little context."""
    cache = cache if cache is not None else {}
    if path not in cache:
        cache[path] = _annotated(repo, base, head, path, snapshot)
    rows = cache[path]
    if not rows:
        return None
    head_lines = [t for p, t, n in rows if n is not None]
    block = find_block(head_lines, symbol)
    if block is None:
        return None
    lo, hi = block[0] + 1, block[1] + 1
    picked, inside = [], False
    for p, t, n in rows:
        if n is not None:
            inside = lo <= n <= hi
            if n > hi:
                break
        if inside:
            picked.append((p, t, n))
    part = _slice(picked, span) if span else None
    focused = _focus(part or picked) if focus else None
    shown = focused or part or picked
    numbered = [n for _, _, n in shown if n is not None]
    unit_nums = _numbers(picked)
    return {'start': numbered[0] if numbered else lo, 'end': numbered[-1] if numbered else hi, 'lines': [[p, t] for p, t, _ in shown],
            'nums': _numbers(shown), 'changed': sum(1 for p, _, _ in shown if p in '+-'),
            'changed_at': sorted({unit_nums[k] for k, (p, _, _) in enumerate(picked) if p != ' ' and unit_nums[k] is not None}),
            'more': 0, 'block': [lo, hi], 'literal': block[2], 'runs_into': block[3],
            'spanned': part is not None, 'focused': focused is not None, 'span_miss': bool(span) and part is None}
