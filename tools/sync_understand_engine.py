#!/usr/bin/env python3
"""Keep the understand-change / understand-code engine copies identical, so each skill folder installs on its own.

  sync_understand_engine.py           copy the engine from understand-change (the source) into understand-code
  sync_understand_engine.py --check   list engine files that differ; exit code 1 if any do

Edit the engine only in understand-change, then run this and both skills' scripts/selftest.py.
"""
import argparse
import filecmp
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE, COPIES = 'understand-change', ['understand-code']
ENGINE = ['scripts/build_prmap.py', 'scripts/collect_change.py', 'scripts/collect_code.py', 'scripts/explain.py',
          'scripts/narrate.py', 'scripts/prepare.py', 'scripts/refs.py', 'scripts/show_snippet.py', 'scripts/snippets.py',
          'scripts/deck.py', 'scripts/deck_selftest.py', 'assets/prmap.html', 'references/narration.md', 'references/prmap-schema.md', 'references/story.md',
          'references/deck.md']


def drift():
    """[(copy skill, engine path)] where the copy is missing or differs from the source."""
    return [(skill, rel) for skill in COPIES for rel in ENGINE
            if not os.path.exists(os.path.join(ROOT, skill, rel))
            or not filecmp.cmp(os.path.join(ROOT, SOURCE, rel), os.path.join(ROOT, skill, rel), shallow=False)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true')
    a = ap.parse_args()
    stale = drift()
    if a.check:
        for skill, rel in stale:
            print('differs: %s/%s' % (skill, rel))
        print('engine: %d of %d copied files differ' % (len(stale), len(ENGINE) * len(COPIES)))
        return 1 if stale else 0
    for skill, rel in stale:
        target = os.path.join(ROOT, skill, rel)
        os.makedirs(os.path.dirname(target), exist_ok=True)
        shutil.copy2(os.path.join(ROOT, SOURCE, rel), target)
        print('copied: %s/%s' % (skill, rel))
    print('engine: %d files updated' % len(stale))
    return 0


if __name__ == '__main__':
    sys.exit(main())
