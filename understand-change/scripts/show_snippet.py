#!/usr/bin/env python3
"""Print a code excerpt exactly as the change map will show it, so walkthrough beats anchor to visible lines.

  show_snippet.py --dir WORK --repo ROOT "path/from/root → Symbol" ["path → Other" ...] [--span FIRST LAST]

Each line is printed as "<file line> <marker> <code>" (marker: + added, - removed, space unchanged, ⋯ unchanged lines
not shown). In code mode the whole unit is printed, never truncated. In change mode a modified unit is cut to its changed
lines plus a little context, as the page shows it; --whole prints the whole unit (the item's "whole": true). --span
previews one part of a long unit (FIRST and LAST are substrings of the part's first and last line). A "complexity:" line
rates the excerpt (decision rows, lines, simulator scenarios it runs in) and names the "depth" to give the item. A beat's `code` (and
`to`) must be a substring of the code part of a shown line.
"""
import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from explain import LONG_EXCERPT, complexity_hint, line_numbers, scenarios_running  # noqa: E402
from refs import split_ref  # noqa: E402
from snippets import snippet  # noqa: E402


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    ap = argparse.ArgumentParser()
    ap.add_argument('--dir', required=True)
    ap.add_argument('--repo', default='.')
    ap.add_argument('--span', nargs=2, metavar=('FIRST', 'LAST'))
    ap.add_argument('--whole', action='store_true')
    ap.add_argument('refs', nargs='+')
    a = ap.parse_args()
    with open(os.path.join(a.dir, 'meta.json'), encoding='utf-8') as f:
        meta = json.load(f)
    scenarios = os.path.join(a.dir, 'scenarios.json')
    scen = []
    if os.path.exists(scenarios):
        with open(scenarios, encoding='utf-8') as f:
            scen = json.load(f).get('scenarios', [])
    cache, focus = {}, meta.get('mode') != 'code' and not a.whole
    for ref in a.refs:
        path, symbol = split_ref(ref)
        sn = snippet(os.path.abspath(a.repo), meta.get('diff_base'), meta.get('sha'), path, symbol, a.span, cache, meta.get('snapshot'), focus)
        print('=== %s' % ref)
        if not sn:
            print('(not found: fix the ref)')
            continue
        total = sn['block'][1] - sn['block'][0] + 1
        note = ('; span not found, whole unit used' if sn['span_miss'] else '') + ('; changed lines only' if sn['focused'] else '')
        print('lines %d-%d of the unit (file lines %d-%d, %d lines), %d changed%s' % (sn['start'], sn['end'], sn['block'][0], sn['block'][1], total, sn['changed'], note))
        if len(sn['lines']) > LONG_EXCERPT:
            print('(over %d lines: split it into parts of <=60 lines with "span": ["first line text", "last line text"])' % LONG_EXCERPT)
        print(complexity_hint(sn, scenarios_running(scen, path, symbol), path.endswith('.py')))
        for n, (marker, text) in zip(line_numbers(sn), sn['lines']):
            print('%5s %s %s' % ('' if n is None else n, marker, text))


if __name__ == '__main__':
    main()
