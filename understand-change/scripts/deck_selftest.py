#!/usr/bin/env python3
"""Checks for the Brief deck, shared by both skills' selftest.py: a build without deck.json must not show it anywhere,
and a build with one must carry it, report it, lint code-like words (but not product names) and refuse unknown actors.
"""
import copy
import json
import os

from deck import code_like, reveal_steps


def sample_deck(scenario_id, ref, code_mode):
    """A small valid deck; in code mode it has no before_after slide."""
    slides = [
        {'type': 'title', 'title': 'Greet people safely', 'subtitle': 'Every greeting now refuses an empty name.', 'notes': 'Open with the point.',
         'stats': [{'value': '3', 'label': 'rules enforced', 'source': 'unit tests'}]},
        {'type': 'value', 'title': 'Why it matters', 'notes': 'The value.', 'cards': [
            {'icon': 'quality', 'head': 'Fewer odd messages', 'text': 'Users no longer see a greeting with no name.', 'note': 'First card.'},
            {'icon': 'support', 'head': 'Clear errors', 'text': 'Callers learn at once what went wrong.', 'note': 'Second card.'}]},
        {'type': 'before_after', 'title': 'What changes', 'notes': 'Before and after.', 'note_after': 'Now it refuses.',
         'before': {'head': 'Before', 'points': ['An empty name gave an odd greeting.']}, 'after': {'head': 'Now', 'points': ['An empty name is refused.']}},
        {'type': 'system', 'title': 'The big picture', 'notes': 'Three parts.', 'blocks': [
            {'id': 'caller', 'name': 'Caller', 'status': 'external', 'text': 'Asks for a greeting.', 'note': 'Who asks.'},
            {'id': 'app', 'name': 'Greeter', 'status': 'changed', 'text': 'Checks the name first.', 'note': 'What changed.'},
            {'id': 'log', 'name': 'Audit trail', 'status': 'existing', 'text': 'Keeps a record.', 'note': 'Untouched.'}],
         'links': [{'from': 'caller', 'to': 'app', 'label': 'asks'}, {'from': 'app', 'to': 'log', 'label': 'records'}]},
        {'type': 'flow', 'title': 'Use case: an empty name', 'scenario': scenario_id, 'notes': 'The main case.', 'result': 'The caller gets a clear refusal.',
         'actors': [{'id': 'caller', 'name': 'Caller', 'icon': 'user'}, {'id': 'app', 'name': 'Greeter', 'icon': 'app'}],
         'steps': [{'from': 'caller', 'to': 'app', 'label': 'asks', 'text': 'The caller asks for a greeting.', 'note': 'Step one.'},
                   {'from': 'app', 'to': 'caller', 'label': 'refuses', 'text': 'The greeter refuses at once.', 'fail': True, 'note': 'Step two.'}]},
        {'type': 'risk', 'title': 'Risk and release', 'notes': 'Risk.', 'level': 'low', 'reason': 'Small change with tests behind it.',
         'areas': [{'name': 'Greetings', 'impact': 2}], 'mitigations': [{'text': 'Unit tests cover the new rule.', 'ref': ref}],
         'rollout': 'Ship with the next release.', 'rollback': 'Revert the change.', 'watch': ['Support tickets about greetings.'],
         'step_notes': ['Low risk.', 'One area.', 'Tests back it.', 'Easy to undo.', 'Watch support.']},
        {'type': 'takeaways', 'title': 'To remember', 'notes': 'Close.', 'points': ['Empty names are refused.', 'Callers see a clear error.'], 'step_notes': ['First point.', 'Second point.']}]
    return {'title': 'Greet people safely', 'slides': [s for s in slides if not (code_mode and s['type'] == 'before_after')]}


def deck_checks(work, repo, build, scenario_id, ref, code_mode, report, data):
    """[(ok, name)]. `build(out)` runs the builder on `work` into `out`; `report` and `data` are from the build without a deck."""
    checks = [('\ndeck:' not in '\n' + report and 'deck' not in data, 'without deck.json the page data and the build output carry no deck')]
    path, out = os.path.join(work, 'deck.json'), os.path.join(work, 'out_deck.html')

    def build_with(deck):
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(deck, f)
        done = build(out)
        text = done.stdout + done.stderr
        lint = open(os.path.join(work, 'lint.txt'), encoding='utf-8').read() if os.path.exists(os.path.join(work, 'lint.txt')) else ''
        return done, text, lint

    deck = sample_deck(scenario_id, ref, code_mode)
    done, text, lint = build_with(deck)
    page = open(out, encoding='utf-8').read() if os.path.exists(out) else ''
    payload = json.loads(page.split('<script type="application/json" id="data">', 1)[1].split('</script>', 1)[0].replace('<\\/', '</')) if page else {}
    steps = sum(reveal_steps(s) for s in deck['slides'])
    checks += [
        (done.returncode == 0, 'a build with a deck exits 0 and its mitigation ref resolves'),
        ('deck: %d slides (1 flows), %d reveal steps; 0 lint' % (len(deck['slides']), steps) in text, 'the build prints the deck summary line'),
        ((payload.get('deck') or {}).get('slides') == deck['slides'], 'the deck is embedded in the page data'),
        ('deck' in payload and 'deck' not in data, 'only the deck build puts a deck in the page data (the Brief tab shows when it is there)'),
        ('reads as code' not in lint, 'a deck in business words has no jargon lint'),
    ]
    jargon = copy.deepcopy(deck)
    jargon['slides'][1]['cards'][0]['text'] = 'Calls src/app/greet.py now; labOS, PostgreSQL and iPhone stay plain.'
    _, _, lint = build_with(jargon)
    checks += [('card text "src/app/greet.py" reads as code' in lint and 'labOS' not in lint and 'PostgreSQL' not in lint and 'iPhone' not in lint,
                'jargon lint flags a file path and leaves product names alone')]
    bad = copy.deepcopy(deck)
    next(s for s in bad['slides'] if s['type'] == 'flow')['steps'][0]['to'] = 'nobody'
    done, text, _ = build_with(bad)
    checks += [(done.returncode == 3 and 'malformed' in text and 'nobody' in text, 'a flow step naming an unknown actor is a malformed input')]
    linked = copy.deepcopy(deck)
    next(s for s in linked['slides'] if s['type'] == 'system')['links'][0]['to'] = 'ghost'
    done, text, _ = build_with(linked)
    checks += [(done.returncode == 3 and 'malformed' in text and 'ghost' in text, 'a system link naming an unknown block is a malformed input')]
    stale = copy.deepcopy(deck)
    next(s for s in stale['slides'] if s['type'] == 'risk')['mitigations'][0]['ref'] = 'app/greet.py → no_such_symbol'
    done, text, _ = build_with(stale)
    checks += [(done.returncode == 2 and ' 1 unresolved' in text, 'a mitigation ref to code that is not there is an unresolved ref')]
    gaps = copy.deepcopy(deck)
    gaps['slides'] = [s for s in gaps['slides'] if s['type'] != 'risk']
    next(s for s in gaps['slides'] if s['type'] == 'flow')['scenario'] = 'no-such-scenario'
    del gaps['slides'][0]['stats'][0]['source']
    _, _, lint = build_with(gaps)
    checks += [('deck: no risk slide' in lint, 'a deck without a risk slide is linted'),
               ('scenario "no-such-scenario" is not in scenarios.json' in lint, 'a flow naming a scenario that does not exist is linted'),
               ('stat "rules enforced" has no source' in lint, 'a title stat without a source is linted')]
    quiet = copy.deepcopy(deck)
    next(s for s in quiet['slides'] if s['type'] == 'risk').pop('step_notes')
    next(s for s in quiet['slides'] if s['type'] == 'takeaways')['step_notes'] = ['Only one.']
    _, _, lint = build_with(quiet)
    checks += [('step_notes has 0 of 5 notes' in lint, 'a risk slide without step_notes is linted'), ('step_notes has 1 of 2 notes' in lint, 'a takeaways slide with too few step_notes is linted')]
    for name, broken in (('null', None), ('a list', [1, 2]), ('a slide that is not an object', {'slides': ['x']}),
                         ('a step that is not an object', {'slides': [{'type': 'flow', 'actors': [], 'steps': ['x']}]}),
                         ('a mitigation that is not an object', {'slides': [{'type': 'risk', 'mitigations': ['x']}]})):
        done, text, _ = build_with(broken)
        checks.append((done.returncode == 3 and 'malformed' in text and 'Traceback' not in text, 'deck.json with %s is malformed, not a traceback' % name))
    os.remove(path)
    checks += [
        (code_like('labOS PostgreSQL iPhone GitHub JavaScript Node.js', set()) == [], 'product names are not code'),
        (code_like('uses print_queue and run() in a/b.go at 3f2a9c1 via a::b', set()) != [], 'identifiers, call syntax, paths and hashes are code'),
        (code_like('the retryCount rule', set()) == [] and code_like('the retryCount rule', {'retryCount'}) == ['retryCount'], 'camelCase counts only when it is a known symbol'),
    ]
    return checks
