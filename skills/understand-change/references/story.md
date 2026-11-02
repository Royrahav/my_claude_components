# The walkthrough: every change, with its reason

The reader is the developer who now owns code an AI agent (or a colleague) wrote. They need to reconnect
each piece of code to the problem it solves, see how it fits the feature, and know what they must keep
working from now on. The walkthrough tells the change as a story of **problems**, and under each problem the
**changes** that solve it, each with its real diff snippet and a narrated explanation.

Written to `WORK/story.json`, or by several writers as `WORK/story_<part>.json` (merged in `layout.problem_order`); `build_prmap.py` extracts the diff snippet for every item itself (from git between
`meta.diff_base` and `meta.sha`, or from the file when there is no diff), so never paste code into the JSON.

## Schema

```jsonc
{
  "intro": "2-4 sentences: what the feature lets users do now that they could not before, in plain words",
  "say_intro": "spoken version of the intro, 3-5 sentences",
  "problems": [
    {
      "id": "address",                          // short id
      "title": "Print to an address, not a pre-made queue (max 9 words)",
      "problem": "What was missing or broken before, 1-2 sentences, from the user's or operator's side",
      "solution": "How this change solves it, in one sentence",
      "say": "spoken intro to this problem, 2-4 sentences",
      "items": [
        {
          "id": "address-parse",                // unique across the story
          "ref": "src/printgateway/internal/printer/address.go → Parse",   // the code unit; checked against the repo
          "span": ["optional: text on the part's first line", "text on its last line"],   // only for a unit split into parts, see below
          "whole": false,                       // change mode only: true shows the whole modified unit, see below
          "title": "Parse turns any printer string into one target (max 9 words)",
          "what": "What this code does, 1-2 sentences, plain technical language",
          "why": "Which part of the problem it solves and why it is built this way, 1-2 sentences",
          "picture": "Its role in the bigger flow: who calls it, what depends on it, 1 sentence",
          "maintain": "What the owner must keep true or watch when changing it, 1 sentence",
          "say": "spoken explanation, 2-4 sentences, 30-70 words",
          "beats": [ { "say": "...", "code": "text on the first line it explains", "to": "optional: text on its last line" } ]   // see narration.md
        }
      ]
    }
  ]
}
```

## Choosing problems and items

- **Problems** are the capabilities or fixes the change delivers, as a user or operator would name them
  ("Windows printers without storing a password", "Pick the right driver automatically"), 5-9 of them, in an
  order that builds: the core first, then what extends it, then hardening, then tooling.
- **Items** are the code units that carry the design: a new type, a function with a decision in it, a
  config switch, a script, a deploy rule. 3-8 per problem, 30-50 in total for a big change. Skip
  mechanical edits (renames, imports, plumbing) unless they matter to a maintainer. Tests are not items;
  mention in `maintain` which test guards the behavior.
- **The page never shows a line it does not explain.** The beats must cover every shown line (the build lists any
  stretch no beat explains in `WORK/lint.txt`; leave none).
- **Change mode: explain the change, not the whole function.** A modified unit is shown as its changed lines plus
  three lines of context around each run; longer unchanged stretches fold into one "⋯" row. Beats explain those
  changed lines; the first beat says in one clause what the unit is for, then what this change does to it. A new
  unit (every line added) is shown whole, since all of it is the change. Set `"whole": true` only when the change
  cannot be understood without walking the whole unit (say so in `why`). The build lists any changed line no excerpt
  shows. A trimmed excerpt still over about 60 lines is split into parts with `span`, as below (each part is
  trimmed the same way); the parts together must show every changed line.
- **Code mode: one item explains one whole unit.** The excerpt is the whole function or method, never a cut-down
  view, and the beats cover every line of it. A class is its declaration (struct, class body or
  header: the fields and the interface) plus every method, each as its own item. A unit over about 60 lines is
  split into consecutive parts with `span`, titled "Name (2 of 5): what this part does"; the parts together must
  cover the whole unit (the build warns about lines no part shows) and each part gets its own `why`/`what`.
  The last part ends with `null` as its second span text, so it runs to the unit's end: closing lines that are
  only braces cannot be anchored, because the text would match the first brace line.
- `focus` is deprecated: it no longer highlights anything. It only serves as the lookup text for a ref that names
  no symbol.
- Every item must point at a real symbol (`file → Symbol`, or `Type.Method`). For a non-code file use a
  unique string that occurs in it (a config key, a heading, a function name in a script).
- Cover the whole change: every module and every file that matters belongs to some item; the reader should
  never meet code in the repo that no item explained.

## Writing the explanations

- `why` is the heart: name the concrete problem this code removes ("without this, two requests for a new
  printer at the same moment would both try to create the queue"). Prefer the real reason from commit
  messages, comments, tests and review findings; if you infer it, say "probably" or "most likely".
- `picture` connects it: upstream caller, downstream effect, which scenario passes through it.
- `maintain` is practical: the invariant, the limit, the trap, the test that guards it.
- The spoken `say` follows `references/narration.md`: explain, don't read; no IDs, hashes, paths or function
  names spoken (say "the parse step", "the provisioner"); connect to the previous item; say why.
