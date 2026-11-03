#!/usr/bin/env python3
"""Local Kokoro voicing worker for demo-video (free, CPU). Run by scripts/lib/kokoro.mjs, not by hand.

  kokoro_tts.py --jobs-file JOBS.json --result RESULT.json [--model-dir ~/.cache/kokoro] [--workers N]

JOBS.json is a list of {id, voice, speed, out, clauses: [{text, pause_after}]}. Each clause is voiced on its own
(so its edges in the take are exact), the clauses are joined with their pauses, and one mono 44.1 kHz mp3 is
written to `out`. RESULT.json maps each id to {clauses: [{seconds, weights}]}: the audio length of every clause
and, per word, a weight (its phoneme count, or its letter count when it cannot be phonemized) that the caller
uses to estimate word times inside the clause. Pause lengths and alignment live in the caller; the worker only
voices and measures.

Setup once: python -m pip install --user kokoro-onnx, and put kokoro-v1.0.int8.onnx + voices-v1.0.bin (kokoro-onnx GitHub
release "model-files-v1.0") in the model dir. Needs ffmpeg on PATH.
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile

import numpy as np

LANG = 'en-us'
MP3_SAMPLE_RATE = 44100
MP3_BITRATE = '128k'
MAX_WORKERS = 4
CORES_PER_WORKER = 4  # each worker holds a model copy (about 500 MB of RAM) and keeps one or two cores busy
MODEL_FILE = 'kokoro-v1.0.int8.onnx'
VOICES_FILE = 'voices-v1.0.bin'


def default_workers():
    return max(1, min(MAX_WORKERS, (os.cpu_count() or 4) // CORES_PER_WORKER))


def word_weights(tts, text):
    """One weight per whitespace-separated word: phoneme count, else letter count, never below 1."""
    weights = []
    for word in text.split():
        try:
            phonemes = len(tts.tokenizer.phonemize(word, LANG).strip())
        except Exception:  # a token the phonemizer rejects still takes time to say
            phonemes = 0
        weights.append(max(1, phonemes or len(word)))
    return weights


def encode_mp3(samples, rate, out):
    """Writes through a .part file so a killed run never leaves a half-written take that looks finished."""
    part = out + '.part'
    try:
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'f32le', '-ar', str(rate), '-ac', '1', '-i', '-',
                        '-ar', str(MP3_SAMPLE_RATE), '-b:a', MP3_BITRATE, '-f', 'mp3', part],
                       input=samples.astype('float32').tobytes(), check=True)
        os.replace(part, out)
    finally:
        if os.path.exists(part):
            os.remove(part)


def voice_job(tts, job):
    pieces, measured, rate = [], [], None
    clauses = job['clauses']
    for n, clause in enumerate(clauses):
        samples, rate = tts.create(clause['text'], voice=job['voice'], speed=job['speed'], lang=LANG, trim=True)
        pieces.append(samples)
        measured.append({'seconds': len(samples) / rate, 'weights': word_weights(tts, clause['text'])})
        if n < len(clauses) - 1 and clause['pause_after'] > 0:
            pieces.append(np.zeros(int(round(clause['pause_after'] * rate)), dtype=np.float32))
    encode_mp3(np.concatenate(pieces), rate, job['out'])
    return {'clauses': measured}


def load_model(model_dir, threads):
    import onnxruntime as rt
    from kokoro_onnx import Kokoro
    opts = rt.SessionOptions()
    if threads:
        opts.intra_op_num_threads = threads
    session = rt.InferenceSession(os.path.join(model_dir, MODEL_FILE), opts, providers=['CPUExecutionProvider'])
    return Kokoro.from_session(session, os.path.join(model_dir, VOICES_FILE))


def run_shard(a, jobs):
    tts = load_model(a.model_dir, a.threads)
    results = {}
    for n, job in enumerate(jobs, 1):
        results[job['id']] = voice_job(tts, job)
        print('  voiced %s (%d/%d)' % (job['id'], n, len(jobs)), flush=True)
    return results


def run_parallel(a, jobs, workers):
    """Interleaved shards (job k, k+n, ...), so takes arrive in script order. Shard results are merged and the
    temporary shard files removed on every path."""
    threads = max(2, (os.cpu_count() or 4) // workers // 2)
    with tempfile.TemporaryDirectory(prefix='kokoro-shards-') as tmp:
        procs = []
        try:
            for k in range(workers):
                part = os.path.join(tmp, 'shard%d.json' % k)
                cmd = [sys.executable, os.path.abspath(__file__), '--jobs-file', a.jobs_file, '--result', part,
                       '--model-dir', a.model_dir, '--threads', str(threads), '--shard', '%d/%d' % (k, workers)]
                procs.append((part, subprocess.Popen(cmd)))
            failed = [p for _, p in procs if p.wait() != 0]
        finally:
            for _, p in procs:  # never leave a shard running if the parent is interrupted
                if p.poll() is None:
                    p.kill()
        if failed:
            sys.exit('kokoro_tts: %d of %d voicing processes failed; rerun narrate' % (len(failed), workers))
        merged = {}
        for part, _ in procs:
            with open(part, encoding='utf-8') as f:
                merged.update(json.load(f))
        return merged


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    ap = argparse.ArgumentParser()
    ap.add_argument('--jobs-file', required=True)
    ap.add_argument('--result', required=True)
    ap.add_argument('--model-dir', default=os.path.expanduser('~/.cache/kokoro'))
    ap.add_argument('--workers', type=int, default=default_workers(), help='parallel voicing processes')
    ap.add_argument('--shard', help=argparse.SUPPRESS)
    ap.add_argument('--threads', type=int, default=0, help=argparse.SUPPRESS)
    a = ap.parse_args()

    for name in (MODEL_FILE, VOICES_FILE):
        if not os.path.exists(os.path.join(a.model_dir, name)):
            sys.exit('kokoro_tts: missing %s in %s (run `demo.mjs setup` for the fix)' % (name, a.model_dir))
    with open(a.jobs_file, encoding='utf-8') as f:
        jobs = json.load(f)
    if a.shard:
        k, n = (int(x) for x in a.shard.split('/'))
        jobs = jobs[k::n]
    workers = 1 if a.shard else max(1, min(a.workers, len(jobs)))
    results = run_shard(a, jobs) if workers == 1 else run_parallel(a, jobs, workers)
    with open(a.result, 'w', encoding='utf-8') as f:
        json.dump(results, f)


if __name__ == '__main__':
    main()
