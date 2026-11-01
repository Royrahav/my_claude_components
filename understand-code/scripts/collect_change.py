#!/usr/bin/env python3
"""Print a compact digest of a change so the lesson starts from facts, not from raw diffs.

  collect_change.py                      git: current branch vs its base (origin/main, main, master)
  collect_change.py --git A..B           git: an explicit range (or a single commit)
  collect_change.py --p4 CL [--shelved]  Perforce: a submitted or shelved changelist
  collect_change.py --files a b c        no VCS: just these files

Run it from inside the repo. Output is about 40 lines: size, areas, hot files, tests, commit subjects,
and a suggested lesson size (one lesson, or chapters).
"""
import argparse
import collections
import json
import os
import re
import subprocess
import sys

TEST_RE = re.compile(r'(^|/)(tests?|unittests?|__tests__|spec)/|(^|/)UT_\w+\.\w+$|_test\.|\.test\.|\.spec\.|Test\.(java|cs|cpp)$|test_[^/]*\.py$', re.I)
DOC_RE = re.compile(r'\.(md|rst|txt|adoc)$|(^|/)docs?/', re.I)


def run(cmd):
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
    except OSError as e:
        sys.exit('collect: cannot run %s: %s' % (cmd[0], e))
    return r.returncode, r.stdout


def git_base():
    for cand in ('origin/main', 'origin/master', 'main', 'master'):
        if run(['git', 'rev-parse', '--verify', '-q', cand])[0] == 0:
            code, out = run(['git', 'merge-base', cand, 'HEAD'])
            if code == 0 and out.strip():
                return out.strip(), cand
    return None, None


def collect_git(rng):
    if rng:
        label = rng
        diff_args = rng.split('..') if '..' in rng else [rng + '^', rng]
        log_range = rng if '..' in rng else rng + '^!'
    else:
        base, name = git_base()
        if not base:
            sys.exit('collect: no base branch found; pass --git <range>')
        branch = run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'])[1].strip()
        label, diff_args, log_range = '%s vs %s' % (branch, name), [base, 'HEAD'], base + '..HEAD'
    files, status = {}, {}
    for line in run(['git', 'diff', '--no-renames', '--numstat'] + diff_args)[1].splitlines():
        a, d, path = (line.split('	') + ['', '', ''])[:3]
        files[path] = (int(a) if a.isdigit() else 0, int(d) if d.isdigit() else 0)
    for line in run(['git', 'diff', '--no-renames', '--name-status'] + diff_args)[1].splitlines():
        code, _, path = line.partition('	')
        status[path] = {'A': 'added', 'D': 'removed'}.get(code[:1], 'modified')
    subjects = run(['git', 'log', '--format=%h %s', '--no-merges', log_range])[1].splitlines()
    return label, files, subjects, status


def p4_depot_root():
    """Depot path of the current directory, so depot paths can be made repo-relative."""
    code, out = run(['p4', '-ztag', 'where', os.getcwd()])
    m = re.search(r'^\.\.\. depotFile (\S+)', out, re.M) if code == 0 else None
    return m.group(1).rstrip('/') if m else ''


def p4_relative(depot_path, root):
    return depot_path[len(root) + 1:] if root and depot_path.startswith(root + '/') else depot_path


def p4_file_revs(out):
    """[(depot path, rev, action)] from the '... //path#rev action' lines of p4 describe. A shelved add has no
    revision yet ('#none'), which maps to rev 0."""
    return [(m.group(1), 0 if m.group(2) == 'none' else int(m.group(2)), m.group(3))
            for m in re.finditer(r'^\.\.\. (\S+?)#(\d+|none) ([\w/]+)', out, re.M)]


def p4_status(action):
    return 'added' if action in ('add', 'branch', 'move/add') else 'removed' if action in ('delete', 'move/delete') else 'modified'


def p4_describe(cl, shelved):
    code, out = run(['p4', 'describe', '-ds'] + (['-S'] if shelved else []) + [cl])
    if code != 0 or not out.strip():
        sys.exit('collect: p4 describe failed for %s' % cl)
    return out


def collect_p4(cl, shelved):
    out = p4_describe(cl, shelved)
    root = p4_depot_root()
    desc = [l.strip() for l in out.splitlines()[1:8] if l.strip()][:1]
    files, cur = {}, None
    for line in out.splitlines():
        m = re.match(r'==== (\S+?)#\d+ \(', line)
        if m:
            cur = p4_relative(m.group(1), root)
            files[cur] = (0, 0)
            continue
        if cur:
            m = re.match(r'(add|deleted|changed) \d+ chunks (?:(\d+) / (\d+) )?(\d+) lines', line)
            if m:
                a, d = files[cur]
                kind, old, new, n = m.group(1), m.group(2), m.group(3), int(m.group(4))
                files[cur] = (a + (n if kind == 'add' else int(new or 0) if kind == 'changed' else 0),
                              d + (n if kind == 'deleted' else int(old or 0) if kind == 'changed' else 0))
    status = {}
    for depot, _, action in p4_file_revs(out):
        path = p4_relative(depot, root)
        files.setdefault(path, (0, 0))
        status[path] = p4_status(action)
    return 'p4 CL %s%s' % (cl, ' (shelved)' if shelved else ''), files, desc, status


def area(path):
    parts = path.replace('\\', '/').strip('/').split('/')
    return '/'.join(parts[:3]) if len(parts) > 3 else '/'.join(parts[:-1]) or '.'


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    ap = argparse.ArgumentParser()
    ap.add_argument('--git', nargs='?', const='')
    ap.add_argument('--p4')
    ap.add_argument('--shelved', action='store_true')
    ap.add_argument('--files', nargs='+')
    ap.add_argument('--json', metavar='PATH', help='also write files.json for build_prmap.py')
    args = ap.parse_args()

    if args.files:
        label, files, subjects, status = 'files', {f: (0, 0) for f in args.files}, [], {}
    elif args.p4:
        label, files, subjects, status = collect_p4(args.p4, args.shelved)
    else:
        label, files, subjects, status = collect_git(args.git)
    if not files:
        sys.exit('collect: no changed files found')
    if args.json:
        rows = [{'path': f, 'status': status.get(f, 'modified'), 'add': a, 'del': d} for f, (a, d) in sorted(files.items())]
        with open(args.json, 'w', encoding='utf-8') as out:
            json.dump(rows, out, indent=1)

    added = sum(a for a, _ in files.values())
    deleted = sum(d for _, d in files.values())
    tests = [f for f in files if TEST_RE.search(f)]
    docs = [f for f in files if DOC_RE.search(f)]
    code = [f for f in files if f not in tests and f not in docs]
    areas = collections.Counter(area(f) for f in code)
    churn = sorted(code, key=lambda f: -sum(files[f]))[:8]
    changed_lines = added + deleted
    size = 'SMALL' if len(code) <= 5 and changed_lines < 400 else 'MEDIUM' if len(code) <= 25 and changed_lines < 2500 else 'LARGE'
    advice = {'SMALL': 'read the diff directly; map optional', 'MEDIUM': 'change map; trace 3-5 scenarios yourself',
              'LARGE': 'change map; delegate tracing and the file inventory to subagents'}[size]

    print('change: %s' % label)
    print('size: %d files (%d code, %d test, %d doc), +%d/-%d lines -> %s: %s' % (len(files), len(code), len(tests), len(docs), added, deleted, size, advice))
    print('areas: ' + ', '.join('%s (%d)' % kv for kv in areas.most_common(6)))
    print('hot files:')
    for f in churn:
        print('  %5d  %s' % (sum(files[f]), f))
    print('tests: ' + (', '.join(t.split('/')[-1] for t in tests[:8]) + (' ...' if len(tests) > 8 else '') if tests else 'none touched'))
    if docs:
        print('docs: ' + ', '.join(d.split('/')[-1] for d in docs[:6]))
    if subjects:
        print('commits (%d):' % len(subjects))
        for s in subjects[:10]:
            print('  ' + s[:110])
        if len(subjects) > 10:
            print('  ... %d more' % (len(subjects) - 10))


if __name__ == '__main__':
    main()
