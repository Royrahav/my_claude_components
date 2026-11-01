#!/usr/bin/env python3
"""Smoke test for code mode of the engine: a throwaway repo explained as-is, built into a page without audio.

  selftest.py        prints PASS or the failed checks; exit code 1 on failure
"""
import json
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from collect_code import code_size  # noqa: E402
from deck_selftest import deck_checks  # noqa: E402
from snippets import find_block, snippet  # noqa: E402

GREET = ('def greet(name):\n    if not name:\n        raise ValueError("name is required")\n    return "hello " + name\n\n\n'
         'def report(rows):\n' + ''.join('    total_%d = len(rows) + %d\n' % (i, i) for i in range(100)) + '    return total_99\n')
CPP = ('#include "Greeter.h"\n\nvoid ClCaller::Run()\n{\n    ClGreeter::Greet(1);\n}\n\n'
       'int ClGreeter::Greet(int times)\n{\n    if (times <= 0)\n        return 0;\n    return times * 2;\n}\n')


def run(cmd, cwd):
    return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, encoding='utf-8', errors='replace')


def write(path, doc):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(doc, f) if not isinstance(doc, str) else f.write(doc)


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    tmp = tempfile.mkdtemp(prefix='ucode-selftest-')
    repo, work = os.path.join(tmp, 'repo'), os.path.join(tmp, 'work')
    write(os.path.join(repo, 'app', 'greet.py'), GREET)
    write(os.path.join(repo, 'app', 'Greeter.cpp'), CPP)
    write(os.path.join(repo, 'app', 'logo.png'), '\0PNG')
    write(os.path.join(repo, 'other', 'main.py'), 'from app.greet import greet\nprint(greet("x"))\n')
    git = lambda *a: run(['git', '-c', 'user.name=t', '-c', 'user.email=t@t'] + list(a), repo)
    git('init', '-q'); git('add', '.'); git('commit', '-qm', 'base')

    prep = run([sys.executable, os.path.join(HERE, 'prepare.py'), work, '--code', 'app', '--kind', 'Library', '--title', 'Greeter'], repo)
    if prep.returncode != 0:
        print('FAIL prepare.py --code:', prep.stdout, prep.stderr)
        return 1
    with open(os.path.join(work, 'files.json'), encoding='utf-8') as f:
        files = json.load(f)
    write(os.path.join(work, 'inventory.json'), {
        'modules': [{'id': 'app', 'name': 'Greeter', 'path': 'app', 'job': 'Builds greetings.', 'status': 'scope', 'entry': 'app/greet.py → greet'},
                    {'id': 'other', 'name': 'Main', 'path': 'other', 'job': 'Prints a greeting.', 'status': 'context'}],
        'files': [{'path': 'app/greet.py', 'module': 'app', 'kind': 'code', 'job': 'Greeting helpers.', 'symbols': ['greet', 'report']},
                  {'path': 'app/Greeter.cpp', 'module': 'app', 'kind': 'code', 'job': 'Native greeter.', 'symbols': ['ClGreeter::Greet']}],
        'edges': [{'from': 'other', 'to': 'app', 'label': 'greet a user'}]})
    write(os.path.join(work, 'layout.json'), {'summary': 'Builds greetings for callers.', 'problem_order': ['greet', 'native'],
                                              'nodes': {'other': {'at': [0, 0]}, 'app': {'at': [1, 0]}}})
    write(os.path.join(work, 'scenarios.json'), {'scenarios': [{
        'id': 'empty', 'title': 'Empty name is refused', 'request': {'method': 'CALL', 'path': 'greet("")'},
        'steps': [{'node': 'other', 'ref': 'other/main.py → greet', 'title': 'Main asks', 'does': 'Calls greet.', 'say': 'Main asks for a greeting.'},
                  {'node': 'app', 'ref': 'app/greet.py → greet', 'title': 'Name checked', 'does': 'Raises before building text.', 'say': 'The greeter refuses.'}],
        'result': {'status': 400}}]})
    write(os.path.join(work, 'story.json'), {'intro': 'A small greeter.', 'problems': [
        {'id': 'greet', 'title': 'Greet safely', 'problem': 'Callers may pass empty names.', 'solution': 'Refuse them early.',
         'items': [{'id': 'g', 'ref': 'app/greet.py → greet', 'title': 'Check the name', 'what': 'Raises on empty names.', 'why': 'Probably to keep odd text away.',
                    'picture': 'Main calls it.', 'maintain': 'Keep the message.', 'beats': [{'say': 'Empty names stop here.', 'code': 'if not name:'}]},
                   {'id': 'r', 'ref': 'app/greet.py → report', 'title': 'Report', 'what': 'Totals rows.', 'why': 'Reporting.', 'picture': 'Unused.',
                    'maintain': 'Nothing.', 'beats': [{'say': 'Deep inside the long function.', 'code': 'total_50 = len(rows) + 50'}]},
                   {'id': 'r1', 'ref': 'app/greet.py → report', 'span': ['def report', 'total_49 ='], 'title': 'Report (1 of 2)', 'what': 'First half.', 'why': 'Reporting.',
                    'picture': 'Unused.', 'maintain': 'Nothing.', 'beats': [{'say': 'The first half sums rows.', 'code': 'def report'}]},
                   {'id': 'r2', 'ref': 'app/greet.py → report', 'span': ['total_50 =', 'return total_99'], 'title': 'Report (2 of 2)', 'what': 'Second half.',
                    'why': 'Reporting.', 'picture': 'Unused.', 'maintain': 'Nothing.', 'beats': [{'say': 'The second half finishes.', 'code': 'total_50 ='}]}]},
        {'id': 'native', 'title': 'Native greeting', 'problem': 'C++ callers.', 'solution': 'A class.',
         'items': [{'id': 'n', 'ref': 'app/Greeter.cpp → ClGreeter::Greet', 'title': 'Greet in C++', 'what': 'Doubles.', 'why': 'Legacy.', 'picture': 'Run calls it.',
                    'maintain': 'Keep it pure.', 'beats': [{'say': 'Non-positive counts give zero.', 'code': 'if (times <= 0)'}]}]}]})

    out = os.path.join(work, 'out.html')
    build = run([sys.executable, os.path.join(HERE, 'build_prmap.py'), '--dir', work, out, '--repo', repo, '--standalone'], repo)
    report = build.stdout + build.stderr
    many = {'f%d.py' % i: 300 for i in range(140)}
    lint_path = os.path.join(work, 'lint.txt')
    lint = open(lint_path, encoding='utf-8').read() if os.path.exists(lint_path) else ''
    whole = snippet(repo, None, None, 'app/greet.py', 'report', None, {})
    part = snippet(repo, None, None, 'app/greet.py', 'report', ['total_0 =', 'total_49 ='], {})
    miss = snippet(repo, None, None, 'app/greet.py', 'report', ['nope', 'nada'], {})
    checks = [
        ('scope: 2 files (2 code' in prep.stdout and '-> SMALL' in prep.stdout, 'prepare prints the scope digest and size'),
        (sorted(f['path'] for f in files) == ['app/Greeter.cpp', 'app/greet.py'], 'binaries and out-of-scope files are left out'),
        (all(f['status'] == 'scope' and f['lines'] > 0 for f in files), 'files carry status scope and a line count'),
        (code_size(many)[0] == 'TOO LARGE', 'an oversized scope is flagged'),
        (build.returncode == 0, 'build exits 0'),
        (' 0 unresolved' in report, 'all refs resolve'),
        ('explain 2 of 2 in-scope code files; 1 of 1 code modules have an item' in report, 'coverage counts files and modules'),
        ('not in the excerpt shown' not in report, 'beat anchors are on screen'),
        ('units: 1 definitions no item shows' in report and 'Greeter.cpp: void ClCaller::Run()' in lint, 'in-scope definitions no item shows are listed'),
        ('story g: excerpt lines 1-1 (file lines) no beat explains' in lint, 'lint.txt lists the stretch no beat explains'),
        ('story r1' not in lint and 'story r2' not in lint and 'the parts of this unit' not in lint, 'parts that cover the whole unit are clean'),
        ('story r: 102-line excerpt: split it into parts with span' in lint, 'a long excerpt without span is flagged'),
        (len(whole['lines']) == 102 and whole['more'] == 0 and not any(row[0] == '…' for row in whole['lines']), 'a 100+ line unit is never truncated'),
        (len(part['lines']) == 50 and part['block'] == whole['block'] and part['spanned'], 'span cuts a contiguous part of the unit'),
        (miss['span_miss'] and len(miss['lines']) == 102, 'an unresolved span falls back to the whole unit'),
        (find_block(['ClFoo::ClFoo()', ': m_a(1)', ', m_b(2)', '{', '    Init();', '}', '', 'void ClFoo::Run()', '{', '}'], 'ClFoo::ClFoo')[:2] == (0, 5),
         'a C++ constructor keeps its column-0 initializer list and body'),
    ]
    if os.path.exists(out):
        with open(out, encoding='utf-8') as f:
            page = f.read()
        data = json.loads(page.split('<script type="application/json" id="data">', 1)[1].split('</script>', 1)[0].replace('<\\/', '</'))
        items = {it['id']: it for p in data['story']['problems'] for it in p['items']}
        long_lines = [t for _, t in items['r']['snippet']['lines']]
        checks += [
            (data['meta'].get('mode') == 'code' and not data['meta'].get('diff_base'), 'meta is code mode with no diff'),
            (all(it['snippet'] and it['snippet']['changed'] == 0 for it in items.values()), 'excerpts come from the files as they are'),
            (len(long_lines) >= 100 and any('total_99' in t for t in long_lines), 'a long unchanged block keeps every line'),
            (items['g']['beats'][0]['rows'] == [[1, 3]], 'beats carry their resolved rows (implicit range to the end)'),
            (items['n']['snippet']['lines'][0][1].startswith('int ClGreeter::Greet'), 'a C++ Owner::Method ref finds the definition, not a call'),
            ([m['status'] for m in data['modules'] if m['id'] == 'other'] == ['context'], 'context modules keep their status'),
        ]
        build_to = lambda target: run([sys.executable, os.path.join(HERE, 'build_prmap.py'), '--dir', work, target, '--repo', repo, '--standalone'], repo)
        checks += deck_checks(work, repo, build_to, 'empty', 'app/greet.py → greet', True, report, data)
    else:
        checks.append((False, 'page was written'))
    failed = [name for ok, name in checks if not ok]
    if failed:
        print('FAIL: ' + '; '.join(failed))
        print(prep.stdout[-600:] + report[-1500:])
        return 1
    print('PASS: %d checks (%s)' % (len(checks), tmp))
    return 0


if __name__ == '__main__':
    sys.exit(main())
