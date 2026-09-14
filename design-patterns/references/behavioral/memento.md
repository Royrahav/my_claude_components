# Memento

## Intent
Capture and externalize an object's internal state so it can be restored later, without violating encapsulation by exposing that state to the outside.

## Also known as
Snapshot

## Problem
Implementing undo, rollback, or "save a checkpoint" functionality requires capturing an object's state at a point in time. But grabbing that state from outside the object usually means exposing private fields publicly, which breaks encapsulation, couples external code tightly to the object's internal representation, and makes that representation harder to change safely later.

## Solution
Let the object whose state needs saving (the **Originator**) create its own snapshot — since it's the one with legitimate access to its own private fields. That snapshot is stored in a **Memento** object, which exposes little or nothing to outside code except perhaps metadata (like a timestamp or label); only the Originator itself is trusted to read a memento's full contents to restore from it. A **Caretaker** holds onto mementos (e.g. in a stack) and decides when to request or restore one, but never inspects or modifies their contents.

## Structure
- **Originator** — the object whose state needs saving/restoring; creates mementos of itself and can restore itself from one
- **Memento** — an (ideally immutable) snapshot object; exposes minimal metadata externally, full state only to the Originator
- **Caretaker** — stores mementos (often as a history stack) and triggers save/restore, without reading or altering memento contents

## Code example
```typescript
// Memento: an opaque snapshot; only DocumentEditor (the Originator) unpacks it fully
class DocumentSnapshot {
  constructor(private readonly content: string, public readonly savedAt: Date) {}
  // Package-private in spirit: only DocumentEditor is meant to call this.
  getContent(): string { return this.content; }
}

class DocumentEditor {
  private content = "";

  type(text: string) { this.content += text; }

  save(): DocumentSnapshot {
    return new DocumentSnapshot(this.content, new Date());
  }

  restore(snapshot: DocumentSnapshot) {
    this.content = snapshot.getContent();
  }

  getContent() { return this.content; }
}

// Caretaker: manages history, never reads/modifies snapshot internals directly
class EditHistory {
  private stack: DocumentSnapshot[] = [];
  push(snapshot: DocumentSnapshot) { this.stack.push(snapshot); }
  popLast(): DocumentSnapshot | undefined { return this.stack.pop(); }
}

const editor = new DocumentEditor();
const history = new EditHistory();

editor.type("Hello");
history.push(editor.save()); // checkpoint
editor.type(", world!");
editor.restore(history.popLast()!); // rolls back to "Hello"
```

## When to use
- Implementing undo/redo by capturing state before an operation runs
- Rolling back a multi-step transaction if a later step fails
- Producing state snapshots without exposing an object's implementation details to the code managing those snapshots

## When NOT to use / pitfalls
- Frequent snapshotting of large objects can consume significant memory — each memento is a full (or deep-enough) copy of state
- Caretakers must actively discard old/unneeded mementos, or memory grows unbounded across a long session
- In dynamically typed/duck-typed contexts (including loosely-typed TypeScript with `any`), true immutability/encapsulation of a memento's contents can't be fully enforced by the language — discipline (or a `private`-only accessor pattern) is needed
- Not worth the ceremony for state that's cheap to reconstruct from other sources instead of snapshotting

## Relations to other patterns
- **Command + Memento** is the standard combination for undo: a command captures a memento of state before executing, and restores it if undone
- **Iterator + Memento**: an iterator's position/traversal state can itself be captured in a memento to pause and resume later
- **Prototype** is a simpler alternative when the object being copied has no encapsulated/private state to protect and no external resource references to manage
