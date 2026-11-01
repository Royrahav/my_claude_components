#!/usr/bin/env python3
"""Grade one understand-code eval run from its real outputs: rebuilds the page, reads its data, writes grading.json.

  grade.py RUN_DIR EVAL_ID REPO        RUN_DIR holds outputs/ (the work folder); writes RUN_DIR/grading.json
"""
import json
import os
import re
import subprocess
import sys

ENGINE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'understand-change', 'scripts')


def page_data(path):
    with open(path, encoding='utf-8') as f:
        page = f.read()
    return json.loads(page.split('<script type="application/json" id="data">', 1)[1].split('</script>', 1)[0].replace('<\\/', '</'))


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    run, eval_id, repo = sys.argv[1], int(sys.argv[2]), sys.argv[3]
    work = os.path.join(run, 'outputs')
    r = subprocess.run([sys.executable, os.path.join(ENGINE, 'build_prmap.py'), '--dir', work, os.path.join(work, 'out.html'), '--repo', repo],
                       capture_output=True, text=True, encoding='utf-8', errors='replace')
    report = r.stdout + r.stderr
    d = page_data(os.path.join(work, 'out.html'))
    items = [it for p in d['story']['problems'] for it in p['items']]
    scen = d['scenarios']
    scope = tuple(s.rstrip('/') + '/' if '.' not in s.split('/')[-1] else s for s in d['meta'].get('scope', []))
    cov = re.search(r'explain (\d+) of (\d+) in-scope code files; (\d+) of (\d+) code modules', report)
    files_ok = cov and int(cov.group(1)) == int(cov.group(2))
    files_80 = cov and int(cov.group(1)) >= 0.8 * int(cov.group(2))
    mods_ok = cov and cov.group(3) == cov.group(4)
    voice = re.search(r'voice: (\d+) of (\d+) lines', report)
    build_ok = r.returncode == 0 and ' 0 unresolved' in report
    beats_ok = 'not in the excerpt shown' not in report

    def ok(text, passed, evidence):
        return {'text': text, 'passed': bool(passed), 'evidence': evidence}

    E = []
    if eval_id in (1, 2, 3):
        E.append(ok('the build exits 0 with 0 unresolved refs', build_ok, report.splitlines()[0][:120] + ' | ' + next((l for l in report.splitlines() if l.startswith('refs:')), '')))
    if eval_id == 1:
        E.append(ok('prepare.py --code sized the scope (SMALL)', d['meta'].get('mode') == 'code', 'meta.mode=%s kind=%s' % (d['meta'].get('mode'), d['meta'].get('kind'))))
        E.append(ok('the walkthrough explains every in-scope code file and every code module', files_ok and mods_ok, cov.group(0) if cov else 'no coverage line'))
    if eval_id == 3:
        E.append(ok('the walkthrough explains at least 80% of in-scope code files and every code module', files_80 and mods_ok, cov.group(0) if cov else 'no coverage line'))
    if eval_id in (1, 3):
        E.append(ok('no beat anchor is missing from its excerpt', beats_ok, 'no anchor warnings' if beats_ok else 'anchor warnings present'))
    if eval_id == 1:
        entry = [sc['steps'][i]['ref'] for sc in scen for i in range(len(sc['steps'])) if sc['steps'][i].get('ref')][:1]
        outside = [sc['id'] for sc in scen if any(st.get('ref') and not st['ref'].startswith(scope) for st in sc['steps'][:3])]
        E.append(ok('2-4 scenarios, each entering from a real caller outside the package', 2 <= len(scen) <= 4 and len(outside) == len(scen),
                    '%d scenarios; entering from outside the scope: %s' % (len(scen), ', '.join(outside))))
        E.append(ok('the page is in code mode: meta.mode = code, no diff, no commits', d['meta'].get('mode') == 'code' and not d['meta'].get('diff_base') and not d['meta'].get('commits'),
                    'mode=%s diff_base=%s commits=%d' % (d['meta'].get('mode'), d['meta'].get('diff_base'), len(d['meta'].get('commits') or []))))
    if eval_id == 3:
        ids = ' '.join(sc['id'] for sc in scen)
        E.append(ok('4-8 scenarios covering the main path, the repeat and at least one failure',
                    4 <= len(scen) <= 8 and any(sc['result'].get('status', 200) >= 400 for sc in scen), '%d scenarios: %s' % (len(scen), ids)))
    if eval_id == 2:
        cpp = [it for it in items if '::' in it['ref']]
        bad = [it['id'] for it in cpp if not it.get('snippet') or it['ref'].split('→')[1].strip() not in it['snippet']['lines'][0][1] + ''.join(t for _, t in it['snippet']['lines'][:14])]
        E.append(ok('C++ refs use File.cpp → Class::Method and each excerpt starts at the definition', cpp and not bad,
                    '%d Class::Method items; not at definition: %s' % (len(cpp), ', '.join(bad) or 'none')))
        ctx = [m['id'] for m in d['modules'] if m.get('status') == 'context']
        edges = [e for e in d['edges'] if e['from'] in ctx or e['to'] in ctx]
        E.append(ok('callers outside the class appear as context modules with real edges', ctx and edges, 'context: %s; %d edges' % (', '.join(ctx), len(edges))))
        E.append(ok('meta.version names the synced CL; no diff_base', 'CL' in str(d['meta'].get('version')) and not d['meta'].get('diff_base'), 'version=%s' % d['meta'].get('version')))
        ut = [it['id'] for it in items if 'UT_SendByRest' in (it.get('maintain') or '') or 'unit test' in (it.get('maintain') or '').lower()]
        E.append(ok('the maintenance checklist names the guarding unit test where it applies', ut, 'items naming the test: %s' % ', '.join(ut[:6])))
    if eval_id in (1, 3):
        E.append(ok('every narration line has a recorded Kokoro clip', voice and voice.group(1) == voice.group(2), voice.group(0) if voice else 'no voice line'))
    passed = sum(e['passed'] for e in E)
    out = {'expectations': E, 'summary': {'passed': passed, 'failed': len(E) - passed, 'total': len(E), 'pass_rate': round(passed / len(E), 2)}}
    with open(os.path.join(run, 'grading.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
    print('eval %d: %d/%d' % (eval_id, passed, len(E)))
    for e in E:
        print('  %s %s -- %s' % ('PASS' if e['passed'] else 'FAIL', e['text'], e['evidence'][:110]))


if __name__ == '__main__':
    main()
