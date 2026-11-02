"""Code references `path/from/repo/root → Symbol`: parse them and check they point at real code."""
import os
import re

SKIP_DIRS = {'.git', 'node_modules', 'vendor', '.venv', '__pycache__', 'dist', 'build'}
SEARCH_BUDGET = 30000


def split_ref(ref):
    parts = re.split(r'\s*(?:→|->)\s*', ref.strip(), maxsplit=1)
    symbol = parts[1].strip() if len(parts) == 2 else ''
    return parts[0].strip(), re.sub(r'\(\)$', '', symbol)


def method_in(symbol, body):
    """Accept Type.Method for a Go/Java/C#-style method declared inside or on Type."""
    if '.' not in symbol:
        return False
    owner, _, name = symbol.rpartition('.')
    owner = owner.split('.')[-1]
    return owner in body and re.search(r'\b%s\s*\(' % re.escape(name), body) is not None


class Resolver:
    """Finds a cited file (directly, or by path suffix) and checks the symbol or literal occurs in it."""

    def __init__(self, repo, snapshot=None):
        self.repo = repo
        self.snapshot = snapshot
        self.cache = {}
        self.index = None

    def _find(self, rel):
        if self.snapshot:
            pinned = os.path.join(self.snapshot, 'new', rel)
            if os.path.isfile(pinned):
                return pinned
        direct = os.path.join(self.repo, rel)
        if os.path.isfile(direct):
            return direct
        if self.index is None:
            self.index, seen = {}, 0
            for root, dirs, files in os.walk(self.repo):
                dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
                for name in files:
                    seen += 1
                    self.index.setdefault(name, []).append(os.path.join(root, name))
                if seen > SEARCH_BUDGET:
                    break
        tail = rel.replace('\\', '/')
        for cand in self.index.get(os.path.basename(rel), []):
            if cand.replace('\\', '/').endswith(tail):
                return cand
        return None

    def text(self, rel):
        if rel not in self.cache:
            path = self._find(rel)
            self.cache[rel] = None
            if path:
                with open(path, encoding='utf-8', errors='replace') as f:
                    self.cache[rel] = f.read()
        return self.cache[rel]

    def check(self, ref, literal=None):
        """None if the ref resolves, else a short reason."""
        file, symbol = split_ref(ref)
        body = self.text(file)
        if body is None:
            return 'file not found'
        if symbol and symbol not in body and not method_in(symbol, body):
            return 'symbol not in file'
        if literal and literal not in body:
            return 'literal text not in file'
        return None
