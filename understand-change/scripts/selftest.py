#!/usr/bin/env python3
"""Smoke test for the scripts: a throwaway git repo with a two-commit change, built into a page without audio.

  selftest.py        prints PASS or the failed checks; exit code 1 on failure
"""
import json
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from explain import changed_gaps, item_lint, jumps, resolve_beats, span_gaps, uncovered  # noqa: E402
from deck_selftest import deck_checks  # noqa: E402
from refs import method_in  # noqa: E402
from snippets import GAP, _focus, _numbers, find_block, snippet  # noqa: E402

TWO_ERRORS = ['type ForbiddenError struct{}', '', 'func (a *ForbiddenError) Error() string { return "a" }', '', 'type LookupError struct{}', '',
              'func (e LookupError) Error() string {', '\treturn "l"', '}']

LONG_FN = lambda op7: '\n\ndef long_fn(x):\n' + ''.join('    a%d = x %s %d\n' % (i, op7 if i == 7 else '+', i) for i in range(15)) + '    return a14\n'
WIDE_FN = lambda op: '\n\ndef wide_fn(x):\n' + ''.join('    w%d = x %s %d\n' % (i, op if i in (2, 26) else '+', i) for i in range(30)) + '    return w29\n'
BASE = 'def greet(name):\n    return "hi " + name\n' + LONG_FN('+') + WIDE_FN('+')
HEAD = ('def greet(name):\n    if not name:\n        raise ValueError("name is required")\n    return "hello " + name\n\n\n'
        'def farewell(name):\n    return "bye " + name\n\n\ndef unused(x):\n    return x\n' + LONG_FN('*') + WIDE_FN('-'))


def rows(n, changes):
    """n unchanged numbered rows with an added row at each index in changes."""
    out = [(' ', 'l%d' % i, i + 1) for i in range(n)]
    for k in changes:
        out[k] = ('+', 'c%d' % k, k + 1)
    return out


def focus_checks():
    """Change mode cuts a modified unit to its changed lines; a new or untouched unit stays whole."""
    far, near = _focus(rows(30, [3, 25])), _focus(rows(30, [3, 11]))
    deleted = rows(20, [])
    deleted.insert(10, ('-', 'gone', None))
    cut = _focus(deleted)
    return [
        (far and len(far) == 15 and far[7] == GAP, 'changes far apart are shown with a gap row between them'),
        (near and GAP not in near and len(near) == 15, 'a one-line hole between context runs is filled, not folded'),
        (_focus([('+', 'a', 1), ('+', 'b', 2)]) is None and _focus(rows(10, [])) is None, 'a new or untouched unit is shown whole'),
        (cut and [p for p, _, _ in cut].count('-') == 1 and len(cut) == 7, 'a deletion-only change keeps the removed line with its context'),
        (_numbers([(' ', 'a', 5), ('-', 'b', None), (' ', 'c', 6)]) == [5, 6, 6] and _numbers([(' ', 'a', 5), ('-', 'b', None), GAP]) == [5, 6, None],
         'a removed row takes the next line number, a gap row none'),
        ('26' in ' '.join(changed_gaps([('a', {'changed_at': [4, 26], 'nums': [1, 2, 3, 4]})])) and changed_gaps([('a', {'changed_at': [4], 'nums': [4]})]) == [],
         'changed lines no excerpt shows are listed'),
    ]
CHECK = ['def check(a, b):', '    if a:', '        return "err"', '    x = b', '    if b:', '        return "err"', '    return "ok"']
GO_LINES = ['func A() {', '    // a stray } in a comment', '    s := `{`', '    return', '}', '', 'func B() {', '}']


def beats(*codes):
    return [{'say': 's', 'code': c} for c in codes]


def logic_checks():
    """Beat ranges, coverage lint, span gaps, block detection and the jump lint, on small in-memory inputs."""
    rep = beats('if a:', 'return "err"', 'x = b', 'return "err"', 'return "ok"')
    misses = resolve_beats(rep, CHECK)
    implicit = beats('if a:')
    resolve_beats(implicit, CHECK)
    ranged = [{'say': 's', 'code': 'if a:', 'to': 'return "err"'}]
    resolve_beats(ranged, CHECK)
    whole = beats('def check')
    resolve_beats(whole, CHECK)
    lst = [{'say': 's', 'code': ['if a:', 'x = b']}]
    resolve_beats(lst, CHECK)
    snip = {'start': 1, 'lines': [[' ', 'x = %d' % i] for i in range(90)]}
    long_it = {'snippet': snip, 'beats': beats('x = 0')}
    parts = [('a', {'block': [1, 100], 'start': 1, 'end': 40, 'spanned': True}), ('b', {'block': [1, 100], 'start': 60, 'end': 100, 'spanned': True})]
    complete = [('a', {'block': [1, 100], 'start': 1, 'end': 60, 'spanned': True}), ('b', {'block': [1, 100], 'start': 61, 'end': 100, 'spanned': True})]
    bare = item_lint('y', {'snippet': snip, 'beats': []})
    steps = {'id': 's', 'steps': [{'node': 'a'}, {'node': 'b'}, {'node': 'c'}]}
    return [
        (not misses and [b['rows'] for b in rep] == [[[1, 1]], [[2, 2]], [[3, 4]], [[5, 5]], [[6, 6]]], 'repeated anchor text lands on the right row'),
        (implicit[0]['rows'] == [[1, 6]], 'a single anchor covers the rows up to the next beat (the last: to the end)'),
        (ranged[0]['rows'] == [[1, 2]], 'to ends an explicit range'),
        (lst[0]['rows'] == [[1, 1], [3, 6]], 'a list of anchors covers the rows it names plus the run after the last'),
        (uncovered(CHECK, implicit) == [[0, 0]] and uncovered(CHECK, whole) == [], 'coverage lint reports an uncovered stretch and is silent when covered'),
        (any('90-line' in w and 'span' in w for w in item_lint('x', long_it)) and not any('span' in w for w in item_lint('x', {**long_it, 'span': ['a', 'b']})),
         'an excerpt over 80 lines without span is flagged'),
        (bare and 'no beats' in bare[-1], 'an item without beats is flagged'),
        ('41-59' in ' '.join(span_gaps(parts)) and span_gaps(complete) == [], 'parts of one unit must cover it'),
        (find_block(GO_LINES, 'A')[:2] == (0, 4), 'braces in comments and raw strings do not end a block'),
        (find_block(['f() {', '  for x in ${s//,/ }; do', '  [[ $t == */*/* ]] && { echo; }', '  done', '}', '', 'g() {', '}'], 'f')[:2] == (0, 4),
         'shell expansions and globs with // or /* are not comments'),
        (find_block(['def f(x):', '    d = {1: 2}', '    return {k: v // 2 for k, v in d.items()}', '', 'def g():', '    pass'], 'f')[:2] == (0, 2),
         'a Python function keeps its whole body despite {} literals and floor division'),
        (find_block(['type Mode int', '', 'var ErrX = errors.New("x")', '', 'func f() {', '}'], 'ErrX')[:2] == (2, 2)
         and find_block(['type Mode int', '', 'func f() {', '}'], 'Mode')[:2] == (0, 0), 'a brace-less Go definition ends before the next declaration'),
        (find_block(['type U = string | number', '', 'function g() {', '}'], 'U')[:2] == (0, 0), 'a brace-less TypeScript type ends before the next function'),
        (find_block(['const (', '\tKindQueue Kind = iota', '\tKindIPP', ')', '', '// Target', 'type Target struct {', '\tKind Kind', '}'], 'KindIPP')[:2] == (0, 3),
         'a name inside a Go const group shows the whole group, not the struct after it'),
        (find_block(TWO_ERRORS, 'LookupError.Error')[:2] == (6, 8) and find_block(TWO_ERRORS, 'ForbiddenError.Error')[:2] == (2, 2)
         , "the excerpt of Type.Method shows the receiver's own method, not another type's"),
        (method_in('Store.Get', 'type Store interface {\n\tGet(id string) error\n}\n\nfunc (m *mem) Get(id string) error { return nil }')
         and method_in('Svc.bar', 'public class Svc {\n    public void bar() {}\n}'), 'a Go interface method (with its implementation in the file) and a Java method resolve'),
        (find_block(['x = 1', 'call(foo)'], 'foo')[2] is True, 'a literal match is flagged'),
        (find_block(['func A() {', '', 'func B() {', '}'], 'A')[3] is True, 'a block running into the next definition is flagged'),
        (len(jumps(steps, [{'from': 'b', 'to': 'a'}])) == 1, 'a hop without a call edge is flagged (either direction counts)'),
    ]


def run(cmd, cwd):
    return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, encoding='utf-8', errors='replace')


def write(path, doc):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(doc, f) if not isinstance(doc, str) else f.write(doc)


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    tmp = tempfile.mkdtemp(prefix='uc-selftest-')
    repo, work = os.path.join(tmp, 'repo'), os.path.join(tmp, 'work')
    os.makedirs(os.path.join(repo, 'app'))
    git = lambda *a: run(['git', '-c', 'user.name=t', '-c', 'user.email=t@t'] + list(a), repo)
    git('init', '-q')
    write(os.path.join(repo, 'app', 'greet.py'), BASE)
    git('add', '.'); git('commit', '-qm', 'base')
    write(os.path.join(repo, 'app', 'greet.py'), HEAD)
    git('add', '.'); git('commit', '-qm', 'Validate names and add farewell')

    failures = []
    prep = run([sys.executable, os.path.join(HERE, 'prepare.py'), work, '--git', 'HEAD~1..HEAD', '--title', 'Greeting rules'], repo)
    if prep.returncode != 0:
        print('FAIL prepare.py:', prep.stdout, prep.stderr)
        return 1
    write(os.path.join(work, 'inventory.json'), {
        'modules': [{'id': 'app', 'name': 'Greeter', 'path': 'app', 'job': 'Builds greetings.', 'status': 'changed',
                     'entry': 'app/greet.py → greet'}],
        'files': [{'path': 'app/greet.py', 'module': 'app', 'kind': 'code', 'job': 'Greeting helpers.', 'change': 'Validates names.',
                   'symbols': ['greet', 'farewell']}],
        'edges': []})
    write(os.path.join(work, 'layout.json'), {'summary': 'Greetings now refuse empty names.', 'problem_order': ['empty', 'bye'],
                                              'nodes': {'caller': {'name': 'Caller', 'job': 'Asks for a greeting.', 'status': 'external'}}})
    write(os.path.join(work, 'scenarios.json'), {'scenarios': [{
        'id': 'empty', 'title': 'Empty name is refused', 'request': {'method': 'CALL', 'path': 'greet("")'},
        'steps': [{'node': 'caller', 'title': 'Caller asks', 'does': 'Calls greet with an empty name.', 'say': 'The caller asks for a greeting with no name.'},
                  {'node': 'app', 'ref': 'app/greet.py → greet', 'title': 'Name checked', 'does': 'Raises before building text.',
                   'say': 'The greeter refuses right away, before building any text.'}],
        'result': {'status': 400, 'side_effects': ['nothing returned']}},
        {'id': 'ok', 'title': 'Greeting works', 'purpose': 'The happy path: a name in, a greeting out.', 'say_intro': 'This is the happy path.',
         'request': {'method': 'CALL', 'path': 'greet("x")'},
         'steps': [{'node': 'app', 'title': 'Greets', 'does': 'Builds the text.', 'say': 'It builds the greeting.'}], 'result': {'status': 200}}]})
    write(os.path.join(work, 'story_b.json'), {'problems': [{'id': 'bye', 'title': 'Say goodbye', 'problem': 'No farewell.', 'solution': 'A farewell helper.',
        'items': [{'id': 'bye-fn', 'ref': 'app/greet.py → farewell', 'title': 'Farewell', 'what': 'Returns a goodbye.', 'why': 'Callers needed one.',
                   'picture': 'Used next to greet.', 'maintain': 'Keep the wording.', 'beats': [{'say': 'It returns a goodbye.', 'code': 'def farewell'}]},
                  {'id': 'bye-bare', 'ref': 'app/greet.py → farewell', 'title': 'Farewell again', 'what': 'Same.', 'why': 'None.', 'picture': 'None.',
                   'maintain': 'None.', 'beats': []},
                  {'id': 'long-mid', 'ref': 'app/greet.py → long_fn', 'title': 'One step multiplies', 'what': 'Step 7 multiplies.', 'why': 'Needed.',
                   'picture': 'None.', 'maintain': 'None.',
                   'beats': [{'say': 'The steps before it are unchanged.', 'code': 'a4 = x + 4'}, {'say': 'Now this step multiplies.', 'code': 'a7 = x * 7'}]}]}]})
    write(os.path.join(work, 'story_a.json'), {'intro': 'Greetings got rules.', 'problems': [{'id': 'empty', 'title': 'Refuse empty names',
        'problem': 'Empty names produced odd text.', 'solution': 'Raise early.',
        'items': [{'id': 'empty-check', 'ref': 'app/greet.py → greet', 'focus': 'if not name', 'title': 'Check the name first',
                   'what': 'Raises on empty names.', 'why': 'Odd greetings reached users.', 'picture': 'Runs first in greet.',
                   'maintain': 'Keep the error message.',
                   'beats': [{'say': 'Greet is the entry.', 'code': 'def greet'}, {'say': 'Empty names are refused here.', 'code': 'if not name:'}, {'say': 'With a clear message.', 'code': 'name is required'}]}]}]})

    out = os.path.join(work, 'out.html')
    build = run([sys.executable, os.path.join(HERE, 'build_prmap.py'), '--dir', work, out, '--repo', repo, '--standalone'], repo)
    report = build.stdout + build.stderr
    checks = [
        (build.returncode == 0, 'build exits 0'),
        ('1 unresolved' not in report and ' 0 unresolved' in report, 'all refs resolve'),
        ('explain 1 of 1 changed code files' in report, 'coverage is counted'),
        ('auto-placed' in report, 'unplaced nodes are auto-placed'),
        ('not in the excerpt shown' not in report, 'beat anchors are on screen'),
        (os.path.exists(os.path.join(work, 'story.json')), 'story parts are merged'),
        ('beats: 1 items leave code unexplained' in report, 'the build summarizes items that leave code unexplained'),
        ('units: 2 definitions no item shows' in report, 'the build counts changed definitions no item shows'),
    ]
    lint_path = os.path.join(work, 'lint.txt')
    lint = open(lint_path, encoding='utf-8').read() if os.path.exists(lint_path) else ''
    checks += [
        ('story bye-bare: no beats' in lint, 'lint.txt lists the item without beats'),
        ('story empty-check' not in lint and 'story bye-fn' not in lint and 'long-mid' not in lint, 'lint.txt is silent about fully explained items'),
        ('scenario empty step 2: jump caller -> app' in lint and 'scenario empty: no purpose' in lint, 'lint.txt lists the jump and the missing purpose'),
        ('scenario ok' not in lint, 'a scenario with purpose, intro and a call chain is clean'),
    ] + logic_checks() + focus_checks()
    whole = snippet(repo, 'HEAD~1', 'HEAD', 'app/greet.py', 'long_fn', None, {}, None, focus=False)
    checks.append((whole and len(whole['lines']) == 18 and not whole['focused'], '"whole" (focus off) shows the entire modified unit'))
    wide = lambda span: snippet(repo, 'HEAD~1', 'HEAD', 'app/greet.py', 'wide_fn', span, {}, None, focus=True)
    full, first, second = wide(None), wide(['def wide_fn', 'w14 =']), wide(['w15 =', None])
    checks += [
        (full and full['focused'] and ['…', ''] in full['lines'], 'changes far apart in one unit render with a gap row'),
        (first and second and first['focused'] and second['focused'] and first['changed'] == 2 and second['changed'] == 2,
         'span parts are trimmed to their own changed lines'),
        (changed_gaps([('p1', first), ('p2', second)]) == [] and changed_gaps([('p1', first)]), 'two parts together show every changed line; one alone does not'),
    ]
    if os.path.exists(out):
        with open(out, encoding='utf-8') as f:
            page = f.read()
        data = json.loads(page.split('<script type="application/json" id="data">', 1)[1].split('</script>', 1)[0].replace('<\\/', '</'))
        story = data.get('story') or {}
        items = [it for p in story.get('problems', []) for it in p['items']]
        checks += [
            ([p['id'] for p in story.get('problems', [])] == ['empty', 'bye'], 'problem_order is applied'),
            (all(it.get('snippet') and it['snippet']['changed'] > 0 for it in items), 'excerpts come from the real diff'),
            (items and items[0]['snippet']['lines'][0][1].startswith('def greet'), 'excerpt starts at the definition'),
            ([[p, t.strip()] for p, t in next(it for it in items if it['id'] == 'long-mid')['snippet']['lines']] ==
             [[' ', 'a4 = x + 4'], [' ', 'a5 = x + 5'], [' ', 'a6 = x + 6'], ['-', 'a7 = x + 7'], ['+', 'a7 = x * 7'], [' ', 'a8 = x + 8'], [' ', 'a9 = x + 9'], [' ', 'a10 = x + 10']],
             'a modified function is cut to its changed line plus three lines of context'),
            (data['meta'].get('diff_base') and data['meta'].get('sha'), 'meta has the diff range'),
            (any(it.get('runs_in') for it in items), 'items link to the simulator'),
            (items[0]['beats'][1]['rows'] == [[2, 2]] and items[0]['beats'][2]['rows'] == [[3, 4]], "the page carries each beat's resolved rows"),
            ("' focus'" not in page and '.code .focus' not in page, 'the static focus highlight is gone'),
            (page.count("'controls bar'") == 2 and page.count("'withbar'") == 2, 'walkthrough and simulator both have the sticky control bar'),
        ]
        build_to = lambda target: run([sys.executable, os.path.join(HERE, 'build_prmap.py'), '--dir', work, target, '--repo', repo, '--standalone'], repo)
        checks += deck_checks(work, repo, build_to, 'empty', 'app/greet.py → greet', False, report, data)
    else:
        checks.append((False, 'page was written'))
    failed = [name for ok, name in checks if not ok]
    if failed:
        print('FAIL: ' + '; '.join(failed))
        print(report[-1500:])
        return 1
    print('PASS: %d checks (%s)' % (len(checks), tmp))
    return 0


if __name__ == '__main__':
    sys.exit(main())
