#!/usr/bin/env python3
"""Voice the change map's simulator with Kokoro (free, local, CPU), one MP3 clip per step.

  narrate.py --dir WORK [--voice af_heart] [--speed 1.05] [--model-dir ~/.cache/kokoro] [--jobs N]

Reads WORK/scenarios.json (+ inventory/layout for module names). A step speaks its own `say` field, or else
a line built from its module, title, `does` and `decision`. Clips are cached by text+voice in
~/.cache/kokoro/clips, so a rerun only voices what changed. Writes WORK/narration.json; build_prmap.py embeds it.
Setup once: pip install --user kokoro-onnx, and put kokoro-v1.0.int8.onnx + voices-v1.0.bin (from the
kokoro-onnx GitHub release "model-files-v1.0") in the model dir. Needs ffmpeg on PATH.
"""
import argparse
import hashlib
import json
import os
import re
import subprocess
import sys

CLEAN = [
    (r'`', ''), (r'\s*(?:→|->)\s*', ' to '), (r'\be\.g\.', 'for example'), (r'\bi\.e\.', 'that is'),
    (r'(\d+)\s?ms\b', r'\1 milliseconds'), (r'(\d+)\s?s\b', r'\1 seconds'), (r'\s*≈\s*', ' about '),
    (r'\s+', ' '),
]


def clean(text):
    text = str(text or '')
    for pattern, repl in CLEAN:
        text = re.sub(pattern, repl, text)
    return text.strip()


def sentence(text):
    text = clean(text)
    return text if not text or text[-1] in '.!?' else text + '.'


def module_names(work):
    names = {}
    for name in ('inventory.json', 'layout.json'):
        path = os.path.join(work, name)
        if not os.path.exists(path):
            continue
        with open(path, encoding='utf-8') as f:
            doc = json.load(f)
        for m in doc.get('modules', []):
            names[m['id']] = m.get('name', m['id'])
        for nid, spec in (doc.get('nodes') or {}).items():
            if spec.get('name'):
                names[nid] = spec['name']
    return names


def _load(work, name):
    path = os.path.join(work, name)
    if not os.path.exists(path):
        return {}
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def _join(*parts):
    return ' '.join(p for p in parts if p)


def script_lines(work):
    """[(key, written script or None, fallback read from the cards)] for the simulator and the walkthrough."""
    names = module_names(work)
    lines = []
    for sc in _load(work, 'scenarios.json').get('scenarios', []):
        lines.append(('%s:intro' % sc['id'], sc.get('say_intro'), _join(sentence(sc['title']), sentence(sc.get('purpose') or sc.get('teaches')))))
        for i, st in enumerate(sc.get('steps', [])):
            lines.append(('%s:%d' % (sc['id'], i), st.get('say'), _join(
                sentence(names.get(st['node'], st['node'])), sentence(st.get('title')), sentence(st.get('does')),
                sentence('Decision: ' + st['decision']) if st.get('decision') else '')))
        r = sc.get('result') or {}
        effects = r.get('side_effects') or []
        lines.append(('%s:end' % sc['id'], sc.get('say_end'), _join(
            'The response is HTTP %s.' % r.get('status', ''), sentence(effects[0]) if effects else '')))
    story = _load(work, 'story.json')
    if story:
        lines.append(('story:intro', story.get('say_intro'), sentence(story.get('intro'))))
        for p in story.get('problems', []):
            lines.append(('p:%s' % p['id'], p.get('say'), _join(sentence(p['title']), sentence(p.get('problem')), sentence(p.get('solution')))))
            for it in p.get('items', []):
                if it.get('beats'):
                    for n, beat in enumerate(it['beats']):
                        lines.append(('i:%s:%d' % (it['id'], n), beat.get('say'), sentence(beat.get('say'))))
                else:
                    lines.append(('i:%s' % it['id'], it.get('say'), _join(sentence(it['title']), sentence(it.get('why')))))
    return lines


def narration_items(work):
    """[(key, text)] in play order: the written script where there is one, else a line read from the cards."""
    return [(key, script or fallback) for key, script, fallback in script_lines(work)]


SPOKEN_ID = [(r'`', 'backtick'), (r'\S+/\S+', 'path'), (r'\b(?=[a-f]*\d)[0-9a-f]{6,}\b', 'hex id'),
             (r'\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b', 'env/const name'), (r'→|->', 'arrow')]


def lint(work):
    """Lines that would make the narrator read the page: missing script, IDs, too long."""
    problems, scripted, total = [], 0, 0
    for key, text, _ in script_lines(work):
        total += 1
        if not text:
            continue
        scripted += 1
        words = len(text.split())
        if words > 75:
            problems.append('%s: %d words' % (key, words))
        for pattern, what in SPOKEN_ID:
            if re.search(pattern, text):
                problems.append('%s: speaks a %s' % (key, what))
    return scripted, total, problems


def default_jobs():
    """Kokoro keeps only one or two cores busy per line, so lines are voiced by parallel processes (each about
    750 MB of RAM, so capped at 4)."""
    return max(1, min(4, (os.cpu_count() or 4) // 4))


def voice_shard(model, voices, lines, voice, speed, threads):
    import onnxruntime as rt
    from kokoro_onnx import Kokoro
    opts = rt.SessionOptions()
    opts.intra_op_num_threads = threads
    tts = Kokoro.from_session(rt.InferenceSession(model, opts, providers=['CPUExecutionProvider']), voices)
    for n, (key, text, out) in enumerate(lines, 1):
        samples, rate = tts.create(text, voice=voice, speed=speed, lang='en-us')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'f32le', '-ar', str(rate), '-ac', '1', '-i', '-',
                        '-b:a', '32k', out + '.part.mp3'], input=samples.astype('float32').tobytes(), check=True)
        os.replace(out + '.part.mp3', out)  # a killed run never leaves a half-written clip that looks cached
        if n % 10 == 0 or n == len(lines):
            print('  voiced %d/%d' % (n, len(lines)), flush=True)


def voice_parallel(a, missing):
    """Interleaved shards, so clips arrive in play order across the whole script and a partial publish is useful."""
    threads = max(2, (os.cpu_count() or 4) // a.jobs // 2)
    base = [sys.executable, os.path.abspath(__file__), '--dir', a.dir, '--voice', a.voice, '--speed', str(a.speed),
            '--model-dir', a.model_dir, '--threads', str(threads)]
    procs = [subprocess.Popen(base + ['--shard', '%d/%d' % (k, a.jobs)]) for k in range(a.jobs)]
    if any(p.wait() for p in procs):
        sys.exit('narrate: a voicing process failed; rerun to voice what is left (recorded clips are kept)')


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    ap = argparse.ArgumentParser()
    ap.add_argument('--dir', required=True)
    ap.add_argument('--voice', default='af_heart')
    ap.add_argument('--speed', type=float, default=1.05)
    ap.add_argument('--model-dir', default=os.path.expanduser('~/.cache/kokoro'))
    ap.add_argument('--manifest-only', action='store_true', help='write narration.json from clips already recorded, voice nothing')
    ap.add_argument('--jobs', type=int, default=default_jobs(), help='parallel voicing processes')
    ap.add_argument('--shard', help=argparse.SUPPRESS)
    ap.add_argument('--threads', type=int, default=0, help=argparse.SUPPRESS)
    a = ap.parse_args()

    model = os.path.join(a.model_dir, 'kokoro-v1.0.int8.onnx')
    voices = os.path.join(a.model_dir, 'voices-v1.0.bin')
    for path in (model, voices):
        if not os.path.exists(path):
            sys.exit('narrate: missing %s (see the setup note at the top of this script)' % path)
    clips = os.path.join(a.model_dir, 'clips')
    os.makedirs(clips, exist_ok=True)

    items = narration_items(a.dir)
    todo = [(k, t, os.path.join(clips, hashlib.sha1(('%s|%s|%s' % (a.voice, a.speed, t)).encode('utf-8')).hexdigest() + '.mp3')) for k, t in items]
    missing = [x for x in todo if not os.path.exists(x[2])]
    if a.shard:
        k, n = (int(x) for x in a.shard.split('/'))
        return voice_shard(model, voices, missing[k::n], a.voice, a.speed, a.threads)
    scripted, total, problems = lint(a.dir)
    print('narrate: %d of %d lines have a written script (see references/narration.md); the rest read the card' % (scripted, total))
    for p in problems[:10]:
        print('  warn: ' + p)
    print('narrate: %d lines, %d cached, %d to voice (%s, %d jobs)' % (len(todo), len(todo) - len(missing), len(missing), a.voice, a.jobs), flush=True)
    if missing and not a.manifest_only:
        if a.jobs > 1:
            voice_parallel(a, missing)
        else:
            voice_shard(model, voices, missing, a.voice, a.speed, a.threads or (os.cpu_count() or 4) // 2)
    manifest = {k: {'text': t, 'file': p} for k, t, p in todo}
    with open(os.path.join(a.dir, 'narration.json'), 'w', encoding='utf-8') as f:
        json.dump({'voice': a.voice, 'engine': 'Kokoro', 'clips': manifest}, f, indent=1, ensure_ascii=False)
    total = sum(os.path.getsize(p) for _, _, p in todo if os.path.exists(p))
    print('narrate: wrote narration.json, %d clips, %.1f MB of audio' % (len(todo), total / 1e6))


if __name__ == '__main__':
    main()
