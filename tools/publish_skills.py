#!/usr/bin/env python3
"""Publish the demo-video, understand-code, understand-change and tools folders to GitHub.

Runs as a Stop hook after each Claude turn, and by hand. Each run:
  1. copies the shared understand engine from understand-change into understand-code (sync_understand_engine.py);
  2. commits any pending change in the four folders to the sync branch;
  3. pushes the sync branch to origin (never main, never a force push).

It only acts while the checkout is on SYNC_BRANCH, so switching branches stops the publishing.
A failure is printed to stderr and the script still exits 0, so it never blocks a Claude turn; the next run retries.
"""
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SYNC_BRANCH = 'add-demo-video-understand-tools'
PATHS = ['demo-video', 'understand-code', 'understand-change', 'tools']
TRAILER = 'Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>'


def git(*args, stdin=None, timeout=60):
    return subprocess.run(['git', '-C', ROOT, *args], input=stdin, capture_output=True, text=True, timeout=timeout)


def say(msg):
    print('publish_skills: ' + msg, file=sys.stderr)


def pending_paths():
    return git('status', '--porcelain', '--', *PATHS).stdout.strip().splitlines()


def commit_pending(changes):
    names = sorted({line[3:].strip().strip('"') for line in changes})
    shown = '\n'.join('- ' + n for n in names[:30]) + ('\n- ...' if len(names) > 30 else '')
    msg = 'Sync demo-video, understand and tools folders\n\nChanged:\n%s\n\n%s\n' % (shown, TRAILER)
    git('add', '-A', '--', *PATHS)
    result = git('commit', '-F', '-', stdin=msg)
    if result.returncode != 0:
        say('commit failed: ' + (result.stderr or result.stdout).strip())
        return False
    say('committed %d changed path(s)' % len(names))
    return True


def push():
    result = git('push', '-u', 'origin', 'HEAD:refs/heads/' + SYNC_BRANCH, timeout=120)
    if result.returncode != 0:
        say('push failed (will retry next run): ' + (result.stderr or result.stdout).strip())
        return False
    return True


def main():
    branch = git('rev-parse', '--abbrev-ref', 'HEAD').stdout.strip()
    if branch != SYNC_BRANCH:
        say('skipped, checkout is on %r, not %r' % (branch, SYNC_BRANCH))
        return 0
    try:
        sync = subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'sync_understand_engine.py')],
                              capture_output=True, text=True, timeout=60)
        if sync.returncode != 0:
            say('engine sync failed: ' + (sync.stderr or sync.stdout).strip())
            return 0
        changes = pending_paths()
        if changes and not commit_pending(changes):
            return 0
        push()
    except subprocess.TimeoutExpired as exc:
        say('timed out: %s' % exc.cmd)
    return 0


if __name__ == '__main__':
    sys.exit(main())
