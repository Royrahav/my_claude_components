#!/usr/bin/env python3
"""Checks for the Brief deck, shared by both skills' selftest.py: a build without deck.json must not show it anywhere,
and a build with one must carry it, report it, lint code-like words (but not product names or listed terms), lint a flow
without its "when", embed a brand logo, and refuse unknown actors or a bad logo.
"""
import base64
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
        {'type': 'flow', 'title': 'Use case: an empty name', 'scenario': scenario_id, 'notes': 'The main case.', 'when': 'A caller asks for a greeting without giving a name.', 'result': 'The caller gets a clear refusal.',
         'actors': [{'id': 'caller', 'name': 'Caller', 'icon': 'user'}, {'id': 'app', 'name': 'Greeter', 'icon': 'app'}],
         'steps': [{'from': 'caller', 'to': 'app', 'label': 'asks', 'text': 'The caller asks for a greeting.', 'note': 'Step one.'},
                   {'from': 'app', 'to': 'caller', 'label': 'refuses', 'text': 'The greeter refuses at once.', 'fail': True, 'note': 'Step two.'}]},
        {'type': 'risk', 'title': 'Risk and release', 'notes': 'Risk.', 'level': 'low', 'reason': 'Small change with tests behind it.',
         'areas': [{'name': 'Greetings', 'impact': 2, 'why': 'Every greeting passes through the changed check.'}], 'database': [{'table': 'greetings', 'use': 'new column', 'detail': 'No script in this change.'}],
         'mitigations': [{'text': 'Unit tests cover the new rule.', 'ref': ref}],
         'rollout': 'Ship with the next release.', 'rollback': 'Revert the change.', 'watch': ['Support tickets about greetings.'],
         'step_notes': ['Low risk.', 'One area.', 'Tests back it.', 'Easy to undo.', 'Watch support.']},
        {'type': 'takeaways', 'title': 'To remember', 'notes': 'Close.', 'points': ['Empty names are refused.', 'Callers see a clear error.'], 'step_notes': ['First point.', 'Second point.']}]
    return {'title': 'Greet people safely', 'terms': [{'term': 'Greeter', 'means': 'the part that builds the greeting text'}],
            'slides': [s for s in slides if not (code_mode and s['type'] == 'before_after')]}


def page_data(page):
    """The JSON the builder embeds in the page."""
    raw = page.split('<script type="application/json" id="data">', 1)[1].split('</script>', 1)[0]
    return json.loads(raw.replace('<\\/', '</'))


def read_text(path):
    """A file's text, or '' when it is not there."""
    if not os.path.exists(path):
        return ''
    with open(path, encoding='utf-8') as f:
        return f.read()


def read_page(work):
    return page_data(read_text(os.path.join(work, 'out_deck.html')))


def brand_checks(deck, build_with, work):
    """[(ok, name)] for the brand logo: the built-in one and a file are embedded as data URIs; a missing file or a non-image is malformed."""
    with open(os.path.join(work, 'mark.png'), 'wb') as f:
        f.write(base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='))
    checks = []
    for name, logo, prefix in (('the built-in labos logo', 'labos', 'data:image/svg+xml;base64,'), ('a logo file next to deck.json', 'mark.png', 'data:image/png;base64,')):
        branded = {**deck, 'brand': {'name': 'labOS', 'logo': logo}}
        done, _, _ = build_with(branded)
        brand = read_page(work)['deck'].get('brand') if done.returncode == 0 else {}
        checks.append((brand == {'name': 'labOS', 'src': brand.get('src')} and brand['src'].startswith(prefix) and 'logo' not in brand, 'the brand embeds %s as a data URI' % name))
    for name, logo in (('a missing logo file', 'nope.png'), ('a logo that is not an image', 'deck.json')):
        done, text, _ = build_with({**deck, 'brand': {'name': 'labOS', 'logo': logo}})
        checks.append((done.returncode == 3 and 'malformed' in text and logo in text, '%s is a malformed input' % name))
    os.remove(os.path.join(work, 'mark.png'))
    return checks


def term_and_when_checks(deck, build_with):
    """[(ok, name)] for the terms lint (missing meaning, long meaning, never used) and the flow "when" lint (missing, long)."""
    termed = copy.deepcopy(deck)
    termed['terms'] += [{'term': 'Silent'}, {'term': 'Wordy', 'means': 'a b c d e f g h i j k l m n o p'}, {'term': 'Ghost', 'means': 'never shown'}]
    termed['slides'][1]['cards'][0]['text'] = 'Silent and Wordy parts are explained here.'
    _, _, lint = build_with(termed)
    checks = [('term "Silent": no "means"' in lint and 'term "Wordy": means is 16 words (max 15)' in lint and 'term "Ghost": never used in the shown text' in lint
               and 'term "Greeter"' not in lint, 'terms lint: no meaning, a long meaning and a term never used; a good term is clean')]
    flow = lambda d: next(s for s in d['slides'] if s['type'] == 'flow')
    silent, wordy = copy.deepcopy(deck), copy.deepcopy(deck)
    del flow(silent)['when']
    flow(wordy)['when'] = ' '.join(['word'] * 21)
    checks += [('flow has no "when"' in build_with(silent)[2], 'a flow slide without "when" is linted'),
               ('when is 21 words (max 20)' in build_with(wordy)[2], 'a flow "when" over 20 words is linted')]
    return checks


def database_checks(deck, build_with):
    """[(ok, name)] for the database list lints: unknown use, long detail, schema change without detail, a changed block that mentions the database with no list."""
    risk = lambda d: next(s for s in d['slides'] if s['type'] == 'risk')
    rows = copy.deepcopy(deck)
    risk(rows)['database'] += [{'table': 'lab_orders', 'use': 'reads', 'detail': 'Reads lab_orders once per greeting.'}, {'table': 'a', 'use': 'drops'},
                               {'table': 'b', 'use': 'new table'}, {'table': 'c', 'use': 'writes', 'detail': ' '.join(['word'] * 13)}]
    _, _, lint = build_with(rows)
    checks = [('database use "drops" is unknown' in lint and 'database table "b" is a new table with no detail' in lint and 'database detail is 13 words (max 12)' in lint,
               'database lint: unknown use, schema change without detail, long detail'),
              ('lab_orders' not in lint and 'database table "greetings"' not in lint, 'a table name is never code-like and a schema change with a detail is clean')]
    flow = copy.deepcopy(deck)
    scene = next(s for s in flow['slides'] if s['type'] == 'flow')
    scene['actors'].append({'id': 'store', 'name': 'Greetings table', 'icon': 'db'})
    scene['steps'].append({'from': 'app', 'to': 'store', 'label': 'saves it', 'text': 'The greeter saves it.', 'note': 'Step three.'})
    unnamed = build_with(flow)[2]
    scene['steps'][-1]['label'] = 'saves it (greetings)'
    checks.append(('step 3 touches the database but names no table' in unnamed and 'step 3 touches the database' not in build_with(flow)[2],
                   'a flow step to a database actor must name a table of the database list'))
    whys = copy.deepcopy(deck)
    risk(whys)['areas'] += [{'name': 'Silent area', 'impact': 1}, {'name': 'Wordy area', 'impact': 1, 'why': ' '.join(['word'] * 21)}]
    lint = build_with(whys)[2]
    checks.append(('area "Silent area" has no why' in lint and 'area why is 21 words (max 20)' in lint and 'area "Greetings"' not in lint, 'area why lint: missing and over 20 words'))
    touched = copy.deepcopy(deck)
    risk(touched).pop('database')
    next(s for s in touched['slides'] if s['type'] == 'system')['blocks'][1]['text'] = 'Adds a column to the greetings table.'
    marker = 'database touched but no database list'
    checks.append((marker in build_with(touched)[2], 'a changed block that mentions the database with no database list is linted'))
    fresh, grid, actor = copy.deepcopy(touched), copy.deepcopy(touched), copy.deepcopy(touched)
    block = lambda d: next(s for s in d['slides'] if s['type'] == 'system')['blocks'][1]
    block(fresh).update(status='new', text='Keeps each hold in a new table.')
    block(grid)['text'] = 'Shows a new column in the results grid.'
    next(s for s in actor['slides'] if s['type'] == 'flow')['actors'].append({'id': 'store', 'name': 'Store', 'icon': 'db'})
    checks += [(marker in build_with(fresh)[2], 'a new block that adds a table is linted without a database list'),
               (marker not in build_with(grid)[2], 'a column in the results grid is not a database change'),
               (marker in build_with(actor)[2], 'a database actor with no database list is linted')]
    both = copy.deepcopy(touched)
    next(s for s in both['slides'] if s['type'] == 'system')['database'] = [{'table': 'x', 'use': 'drops'}]
    lint = build_with(both)[2]
    checks.append((marker in lint and 'database use "drops" is unknown' in lint, 'the touched warning does not hide the other database warnings'))
    return checks


def deck_checks(work, repo, build, scenario_id, ref, code_mode, report, data):
    """[(ok, name)]. `build(out)` runs the builder on `work` into `out`; `report` and `data` are from the build without a deck."""
    checks = [('\ndeck:' not in '\n' + report and 'deck' not in data, 'without deck.json the page data and the build output carry no deck')]
    path, out = os.path.join(work, 'deck.json'), os.path.join(work, 'out_deck.html')

    def build_with(deck):
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(deck, f)
        done = build(out)
        text = done.stdout + done.stderr
        lint = read_text(os.path.join(work, 'lint.txt'))
        return done, text, lint

    deck = sample_deck(scenario_id, ref, code_mode)
    done, text, lint = build_with(deck)
    page = read_text(out)
    payload = page_data(page) if page else {}
    steps = sum(reveal_steps(s) for s in deck['slides'])
    checks += [
        (done.returncode == 0, 'a build with a deck exits 0 and its mitigation ref resolves'),
        ('deck: %d slides (1 flows), %d reveal steps; 0 lint' % (len(deck['slides']), steps) in text, 'the build prints the deck summary line'),
        ((payload.get('deck') or {}).get('slides') == deck['slides'] and payload['deck'].get('terms') == deck['terms'], 'the deck and its terms are embedded in the page data'),
        ('brand' not in payload.get('deck', {}), 'a deck without a brand carries no logo'),
        (next(s for s in payload['deck']['slides'] if s['type'] == 'risk')['database'] == next(s for s in deck['slides'] if s['type'] == 'risk')['database'], 'the risk slide database list is embedded'),
        ('deck' in payload and 'deck' not in data, 'only the deck build puts a deck in the page data (the Brief tab shows when it is there)'),
        ('reads as code' not in lint, 'a deck in business words has no jargon lint'),
    ]
    jargon = copy.deepcopy(deck)
    jargon['slides'][1]['cards'][0]['text'] = 'Calls src/app/greet.py now; labOS, PostgreSQL and iPhone stay plain.'
    _, _, lint = build_with(jargon)
    checks += [('card text "src/app/greet.py" reads as code' in lint and 'labOS' not in lint and 'PostgreSQL' not in lint and 'iPhone' not in lint,
                'jargon lint flags a file path and leaves product names alone')]
    checks += brand_checks(deck, build_with, work)
    checks += term_and_when_checks(deck, build_with) + database_checks(deck, build_with)
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
                         ('a mitigation that is not an object', {'slides': [{'type': 'risk', 'mitigations': ['x']}]}),
                         ('terms that are not a list of objects', {**deck, 'terms': 'x'}), ('a term without its text', {**deck, 'terms': [{'means': 'y'}]}),
                         ('a brand that is not an object', {**deck, 'brand': 'labos'}), ('a brand without a name', {**deck, 'brand': {'logo': 'labos'}}),
                         ('a database list that is not a list of objects', {**deck, 'slides': [{'type': 'risk', 'database': 'x'}]}),
                         ('a brand logo that is not text', {**deck, 'brand': {'name': 'labOS', 'logo': 3}})):
        done, text, _ = build_with(broken)
        checks.append((done.returncode == 3 and 'malformed' in text and 'Traceback' not in text, 'deck.json with %s is malformed, not a traceback' % name))
    os.remove(path)
    checks += [
        (code_like('labOS PostgreSQL iPhone GitHub JavaScript Node.js', set()) == [], 'product names are not code'),
        (code_like('uses print_queue and run() in a/b.go at 3f2a9c1 via a::b', set()) != [], 'identifiers, call syntax, paths and hashes are code'),
        (code_like('the CleanStation rule', {'CleanStation'}) == ['CleanStation'] and code_like("the CleanStation's rule", {'CleanStation'}, ['CleanStation']) == [],
         'a listed term is exempt from the code-like lint (a product name in CamelCase)'),
        (code_like('the retryCount rule', set()) == [] and code_like('the retryCount rule', {'retryCount'}) == ['retryCount'], 'camelCase counts only when it is a known symbol'),
    ]
    return checks
