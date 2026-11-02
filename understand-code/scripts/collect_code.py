"""Code mode: the files of an existing code scope (a class, a library, an area) with line counts, and its size."""
import collections
import os
import subprocess

from collect_change import DOC_RE, TEST_RE, area
from refs import SKIP_DIRS

BINARY_EXT = {'.exe', '.dll', '.lib', '.obj', '.pdb', '.ilk', '.exp', '.res', '.aps', '.ncb', '.sdf', '.suo', '.png', '.jpg',
              '.jpeg', '.gif', '.ico', '.bmp', '.cur', '.pdf', '.zip', '.gz', '.7z', '.docx', '.xlsx', '.pptx', '.mp3',
              '.mp4', '.wav', '.woff', '.woff2', '.ttf', '.so', '.a', '.class', '.jar', '.pyc', '.db', '.sqlite'}
MAX_FILE_BYTES = 1_500_000
# Above LARGE the narration alone runs for hours and the map stops being readable: narrow the scope instead.
SIZES = (('SMALL', 5, 1500), ('MEDIUM', 30, 10000), ('LARGE', 120, 40000))


def _text_lines(path):
    if os.path.splitext(path)[1].lower() in BINARY_EXT or os.path.getsize(path) > MAX_FILE_BYTES:
        return None
    with open(path, 'rb') as f:
        data = f.read()
    if b'\0' in data[:4096]:
        return None
    return data.count(b'\n') + (0 if data.endswith(b'\n') or not data else 1)


def collect_code(paths, root):
    """{repo-relative path: line count} for every text file under paths, skipping build output and binaries."""
    files = {}
    for p in paths:
        full = os.path.abspath(p)
        if not os.path.exists(full):
            raise SystemExit('prepare: no such path: %s' % p)
        walk = [(os.path.dirname(full), [], [os.path.basename(full)])] if os.path.isfile(full) else os.walk(full)
        for base, dirs, names in walk:
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith('.')]
            for name in names:
                path = os.path.join(base, name)
                lines = _text_lines(path)
                if lines is not None:
                    files[os.path.relpath(path, root).replace('\\', '/')] = lines
    return files


def code_size(files):
    """(size label, code file count, code line count); label is TOO LARGE above the LARGE limits."""
    code = {f: n for f, n in files.items() if not TEST_RE.search(f) and not DOC_RE.search(f)}
    lines = sum(code.values())
    label = next((name for name, max_files, max_lines in SIZES if len(code) <= max_files and lines <= max_lines), 'TOO LARGE')
    return label, len(code), lines


def digest(files):
    """A few lines on what the scope holds, so the frame is decided from facts."""
    size, n_code, n_lines = code_size(files)
    tests = [f for f in files if TEST_RE.search(f)]
    docs = [f for f in files if DOC_RE.search(f)]
    code = [f for f in files if f not in tests and f not in docs]
    areas = collections.Counter(area(f) for f in code)
    exts = collections.Counter(os.path.splitext(f)[1] or '(none)' for f in code)
    out = ['scope: %d files (%d code, %d test, %d doc), %d code lines -> %s' % (len(files), n_code, len(tests), len(docs), n_lines, size),
           'areas: ' + ', '.join('%s (%d)' % kv for kv in areas.most_common(6)),
           'languages: ' + ', '.join('%s (%d)' % kv for kv in exts.most_common(5)),
           'largest: ' + ', '.join('%s (%d)' % (f.split('/')[-1], files[f]) for f in sorted(code, key=lambda f: -files[f])[:6])]
    if tests:
        out.append('tests: ' + ', '.join(t.split('/')[-1] for t in tests[:8]) + (' ...' if len(tests) > 8 else ''))
    return size, out


def version_of(root, paths):
    """{sha, repo_url, version} for git; for Perforce only {version}: the newest synced CL under the scope."""
    def run(cmd):
        try:
            r = subprocess.run(cmd, cwd=root, capture_output=True, text=True, encoding='utf-8', errors='replace')
        except OSError:
            return None
        return r.stdout.strip() if r.returncode == 0 else None
    sha = run(['git', 'rev-parse', 'HEAD'])
    if sha:
        remote = run(['git', 'remote', 'get-url', 'origin']) or ''
        url = None
        if 'github.com' in remote:
            url = 'https://github.com/' + remote.split('github.com', 1)[1].lstrip(':/').removesuffix('.git')
        return {'sha': sha, 'repo_url': url, 'version': 'git ' + sha[:7]}
    specs = [os.path.join(os.path.abspath(p), '...') if os.path.isdir(p) else os.path.abspath(p) for p in paths]
    have = run(['p4', 'changes', '-m1'] + [s + '#have' for s in specs])
    return {'version': 'synced to CL ' + have.split()[1] if have and have.startswith('Change ') else None}
