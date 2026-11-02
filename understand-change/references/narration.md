# Writing the narration script

The narrator is a senior developer walking a teammate through the flow while the simulator plays. They
understand the system, so they explain it; they do not read the cards. The card on screen already shows
the exact values; the voice says what is going on and why.

Write it into `scenarios.json`: `say_intro` and `say_end` on each scenario, `say` on each step.

## The voice

- **Explain, don't read.** "The gateway has never seen this printer, so before it can print it has to find
  out what the printer speaks" — not "Printer service. Analyzer asks printer over IPP."
- **Simple technical language.** Name real things (queue, IPP, CUPS, allowlist, Kerberos ticket), but explain
  each one in plain words the first time it matters. No jargon chains.
- **Connect the steps.** Each line picks up from the previous one: "Now that…", "Because…", "So…". A listener
  with eyes closed should still follow the story.
- **Say why.** The reason behind a step is worth more than its mechanics. One "why" per step at most.
- **Point at what matters.** When a step is the interesting fork (a cache hit, a fallback, a refusal), say so:
  "This is the important part."
- **Don't speak IDs.** No hashes, queue names, file paths, function names, env-var names or JSON keys. Say "a
  queue named after the printer's address", "the auto-provision setting". Numbers are fine when they matter
  ("five seconds", "port 631") and are written the way they are spoken.
- **Short.** A step is one to three sentences, about 20-45 words (12-20 seconds). Intro and end, two to four
  sentences each.

## Intro, steps, end

- `say_intro`: the first sentence names the flow and its purpose ("This is the first print to a new printer: it
  shows how the gateway creates a queue on the fly."), then the situation the system is in, then what to
  watch. It is shown as a caption and spoken before the first step, so the listener knows which flow this is
  before it runs. "This is the repeat print to the same printer. The interesting question is what the gateway
  skips now that the queue already exists."
- `say` per step: what this component is doing for the request right now, in plain words, and why.
- `say_end`: what came back, what was left behind (a queue, a cached verdict, nothing), and the one thing to
  remember from this run.

## Beats: narration that walks the code (walkthrough items)

In the walkthrough, an item's narration is split into `beats`, so the line marker follows the voice:

```json
"beats": [
  { "say": "This step only exists so two requests can't build the same queue at once.", "code": "func (p *Provisioner) ensure(" },
  { "say": "First it takes a lock for this queue name, so a second request waits here instead of racing.", "code": "p.locks.lock(name)" },
  { "say": "Then it checks the cap, and refuses with a clear error once the gateway owns too many queues.", "code": "p.autoQueues >= p.maxAutoQueues", "to": "return ErrQueueCap" }
]
```

The first beat anchors on the first shown line (the doc comment or signature) and runs on to the next beat; a
`null` first beat would leave that head uncovered.

- **Beats cover every shown line, top to bottom.** Each beat is 1-2 sentences (8-35 words) and explains a whole
  block as one unit, so long code needs few beats: a beat marks its first line with `code` and runs to the line
  before the next beat's first line (the last beat runs to the end). `"to": "<text on its last line>"` ends the
  range earlier; a list of anchors marks exactly those lines (plus the run after the last). The build resolves
  each range against the excerpt and lists in `WORK/lint.txt` any stretch no beat covers; leave none.
- `code` and `to` are exact substrings of a shown line. A beat's search starts at the previous beat's first line,
  so repeated text (`return err`) lands on the right line; quote more of the line to be unambiguous.
- The first beat is the unit's core intention: why it exists and what it guarantees. In change mode, for a modified
  unit shown trimmed, it is one clause on what the unit is for, then what this change does to it. The last ties it back to the
  bigger picture or the maintenance note. `code: null` marks no line, so use it only for a closing beat (a null first beat leaves the head of the unit uncovered).
- Explain what the line does and why, in plain words; never read the code aloud ("it locks the name", not "p dot
  locks dot lock").

## Example

Card: *CUPS queues · No queue yet: start setup · Resolve runs lpstat -v within the 10 s control budget; queue
missing, so ensure takes its name lock and reserves a slot.*

Bad (reading): "CUPS queues. No queue yet, start setup. Resolve runs lpstat dash v within the ten seconds
control budget."

Good (explaining): "Now the gateway asks CUPS whether a print queue for this printer already exists. It
doesn't, because this is the first time we see it, so the gateway reserves the name, so that two requests
arriving at once don't both try to create the same queue."
