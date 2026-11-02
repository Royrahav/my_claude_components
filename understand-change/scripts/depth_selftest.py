#!/usr/bin/env python3
"""Checks for the explanation depth lint (explain.depth_lint, complexity), shared by both skills' selftest.py: complex or core
units need fine beats unless marked normal, deep and line items are held to their own limits, and only real decisions count.
"""
from explain import complexity, complexity_hint, depth_lint, item_lint, resolve_beats
from snippets import GAP

BRANCHY = ['def f(a, b):', '    if not a:', '        return 0', '    for x in b:', '        if x > a:', '            return x', '    try:', '        return g(a)',
           '    except KeyError:', '        return -1']
TWO_BRANCHES = ['def g(a):', '    if a:', '        return 1', '    x = a + 1', '    y = x * 2', '    if y:', '        return y']
BODY = ['def h(a):', '    if a:', '        x = 1', '        y = 2', '        z = 3', '        w = 4', '    return 0']
FLAT = ['def check(a, b):', '    x = a + b', '    y = x * 2', '    z = y - 1', '    w = z / 3', '    return w']


def _item(lines, codes, **extra):
    """A walkthrough item whose beats start at each anchor in codes, resolved against lines."""
    beats = [{'say': 's', 'code': c} for c in codes]
    resolve_beats(beats, lines)
    return {'snippet': {'lines': [[' ', t] for t in lines]}, 'beats': beats, **extra}


def _changed_rows(rows):
    """A change-mode excerpt: each row is its diff prefix followed by the text."""
    return {'lines': [[r[0], r[1:]] for r in rows]}


def depth_checks():
    """Depth lint: complex or core units need fine beats unless marked normal; deep and line items are held to their own limits."""
    per_decision = ['def f(a, b):', 'if not a', 'for x in b', 'if x > a', 'try:', 'except KeyError']
    per_line = [t.strip() for t in FLAT]
    two_scenarios = [{'scenario': 'a', 'title': 'A', 'step': 0}, {'scenario': 'b', 'title': 'B', 'step': 1}]
    flag = lambda it: depth_lint('x', it)
    return [
        (any('complex unit (5 decisions' in w and 'depth deep' in w for w in flag(_item(BRANCHY, ['def f']))), 'a complex unit with coarse beats and no depth is flagged'),
        (flag(_item(BRANCHY, ['def f'], depth='normal')) == [], 'an explicit depth normal silences the complexity flag'),
        (flag(_item(BRANCHY, ['def f'], depth='deep')) and 'more than 3 lines or 1 decision' in flag(_item(BRANCHY, ['def f'], depth='deep'))[0], 'a deep item with a coarse beat is flagged'),
        (flag(_item(BRANCHY, per_decision, depth='deep')) == [] and flag(_item(BRANCHY, per_decision)) == [], 'one beat per decision passes, with or without depth'),
        (flag(_item(FLAT, ['def check'])) == [], 'a simple unit with one block beat is not flagged'),
        (flag(_item(TWO_BRANCHES, ['def g'], runs_in=two_scenarios)) and not flag(_item(TWO_BRANCHES, ['def g'])) and not flag(_item(TWO_BRANCHES[:3], ['def g'], runs_in=two_scenarios)),
         'a core unit (2+ scenarios) is complex from 2 decisions; the same unit outside the simulator, or a one-decision one, is not'),
        (flag(_item(FLAT, per_line, depth='line')) == [] and 'one beat per line' in ' '.join(flag(_item(FLAT, ['def check', 'z = y'], depth='line'))),
         'a line item passes at one row per beat and is flagged with wider beats'),
        (not flag(_item(FLAT, ['def check'], depth='verbose')) and 'must be one of' in ' '.join(item_lint('x', {'depth': 'verbose'})),
         'an unknown depth is reported by the lint but not counted as coarse'),
        ('1 beats cover more than 3 lines or 1 decision (widest 5 lines, 1 decisions)' in ' '.join(flag(_item(BODY, ['def h', 'if a:', 'return 0'], depth='deep')))
         and flag(_item(BODY, ['def h', 'if a:', 'z = 3', 'return 0'], depth='deep')) == [],
         'one beat per decision is not enough when the branch body has 4 statements: it is flagged with its cause, and clean once split in two'),
        ('depth normal only if the code is truly flat' in ' '.join(flag(_item(BRANCHY, ['def f']))), 'the complexity finding offers normal only for truly flat code'),
        (complexity({'lines': [[' ', 'n = total // size if size else 0']]}, python=True)[1:] == (1, 1)
         and complexity({'lines': [[' ', 'if a:  // why']]})[1:] == (1, 1), 'python floor division is not a comment, a trailing // comment in C-like code is'),
        (complexity({'lines': [[' ', t] for t in ['/*', ' if a then b', ' for c', ' */', 'x = 1']]})[1:] == (0, 1)
         and complexity({'lines': [[' ', t] for t in ['* if a, for b', '*/', 'x = 1']]})[1:] == (0, 1), 'block-comment lines are not code, also when the /* is not in the excerpt'),
        (complexity_hint(_item(BRANCHY, [])['snippet']) == 'complexity: high (5 decisions, 10 lines) -> depth deep'
         and complexity_hint(_item(FLAT, [])['snippet']) == 'complexity: low -> depth normal', 'the hint names the complexity and the depth'),
        (complexity(_changed_rows(['-    if old:', '-    for x in y:', '-    while z:', '-    return 1', '+    return 2']))[1:] == (0, 1),
         'change mode: removed rows are not code the reader follows, so their decisions and lines are not counted'),
        (complexity(_changed_rows([GAP[0] + '    if a:', '+    return 2']))[1:] == (0, 1),
         'change mode: the fold row is not a meaningful row even when it carries decision-like text'),
        (complexity({'lines': [[' ', t] for t in ['# if x then y?', '// for each case while we wait', '/* try this || that */', ' * if not, see why?', '-- or else?', 'x = 1']]})[1:] == (0, 1),
         'comment-only rows with if, for or ? are not decisions'),
        (complexity({'lines': [[' ', t] for t in ['x = a?.b?.c', 'y = s as String?', 'url = "what? if so, for you"', 'z = 1  # why? if not', 'w = 2  // while or for?']]})[1:] == (0, 5),
         'optional chaining, nullable types, `?` in strings and trailing comments are not decisions'),
        (complexity({'lines': [[' ', 'x = a ? b : c']]})[1:] == (1, 1), 'a real ternary counts as one decision'),
    ]
