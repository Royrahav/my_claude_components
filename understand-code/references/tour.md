# The walkthrough: every piece of the code, with its reason

The reader has to own or work in code they did not write: a class, a library, an area. They need to connect
each piece to the job it does, see how it fits the whole, and know what they must keep working. The walkthrough
tells the code as a set of **topics** (the jobs the code does) and under each topic the **pieces** of code that
do it, each with its real excerpt and a narrated explanation.

The JSON is the same as understand-change's `story.json` (schema in `story.md` beside this file),
read with these meanings, because the engine is the same:

| Key | In code mode |
|---|---|
| `problems[]` | topics: the jobs the code does, 4-8 of them |
| `problem` | what the code must handle here, 1-2 sentences, from its user's or operator's side ("Callers pass printer strings in five formats, some with credentials") |
| `solution` | how the code handles it, one sentence |
| `items[]` | pieces: the code units that carry the design |
| `why` | why it is built this way: the constraint, failure or trade-off it answers |
| `intro` | what this code is for, who uses it and how it is shaped, 2-4 sentences |
| `depth` | how finely the beats explain the piece: `normal`, `deep` or `line` (see "Depth" below) |

## Choosing topics and pieces

- **Topics** in the order a new owner should learn them: first the main job and its entry point, then the core
  data and state, then the key decisions or algorithms, then how it talks to its neighbours, then failure
  handling and edge cases, then configuration, extension points and tooling. Name each as the capability a
  user would recognise ("Turn any printer string into one target"), not as a file or class name.
- **Pieces** are the code units that carry the design: a type with its state, a function with a decision in it,
  a lock, a cache, a config switch, a retry, a script. 3-8 per topic, 15-40 in total depending on size. Skip
  trivial getters and plumbing unless a maintainer would trip over them. Tests are not pieces; name in
  `maintain` the test that guards the behavior.
- **A piece explains one whole unit, and the page never shows a line it does not explain.** Ref a function or
  method (`file → Func`, `file → Type.Method`, C++ `File.cpp → ClOwner::Method`) and it is shown in full; the beats
  must cover every line (the build lists any stretch no beat explains in `WORK/lint.txt`; leave none). A class is
  its declaration (struct, class body or header: fields and interface) plus every method, each its own piece. A
  unit over about 60 lines is split into consecutive parts with `"span": ["first line text", "last line text"]`,
  titled "Name (2 of 5): what this part does", and the parts together cover the whole unit (preview a part with
  `show_snippet.py --span`). `focus` is deprecated and highlights nothing.
- Cover the whole scope: every module and every file that matters belongs to some piece; the reader should
  never meet code in scope that no piece explained.

## Depth: explain the complicated pieces with patience

Simple, flat pieces (an accessor, wiring, a few straight steps, a constant, a table) keep block beats: `"depth": "normal"`.
Set `"depth": "deep"` on every complex function (many branches, loops, locks, error paths) and on the one or two most
important pieces of each topic, the ones the topic hinges on, even if `show_snippet.py`'s `complexity:` line says low.
In a deep item, no beat covers more than 3 code lines or more than 1 decision (if, loop, case, catch, `&&`, ternary); braces, logging and plain assignments may share a beat only within that limit. `"depth": "line"` (one beat per meaningful line) is only for when the user asked; the orchestrator passes it as
`{DEPTH_LINE}`. A long unit split with `span` takes its depth per part. Full rules and examples: `story.md` "Choosing
depth", `narration.md` "Beats".

## Writing the explanations

- `why` is the heart: name the concrete constraint this design answers ("the printer can be slow to answer, so
  the lookup has a timeout instead of blocking the request thread"). Take the real reason from comments, tests,
  docs, commit messages and history; if you infer it, say "probably" or "most likely".
- `picture` connects it: who calls it, what it calls, which scenario passes through it.
- `maintain` is practical: the invariant, the limit, the trap, the test that guards it.
- The spoken `say` and the beats follow `narration.md` beside this file: explain, don't read; no
  IDs, paths or function names spoken; connect to the previous piece; say why. The first beat of a piece is its core
  intention; the beats then follow its depth (above), top to bottom.
