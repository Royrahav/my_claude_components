# Writing scenes.json

Contents: story spines, writing rules, scene fields, cues, the 14 templates (fields + a tested example each).

## Story spines

Pick the spine that fits, drop scenes the facts can't fill, and keep one idea per scene. Every
spine ends with recap -> close.

**Feature (3-5 min):** title (hook) -> split (the problem before) -> options (the decision, if
alternatives were weighed) -> pipeline (architecture at a glance) -> 2-4 of decision / steps /
code (inside the key parts, one per scene) -> cards (turning it on, rollback) -> states (a
switch: today vs later) -> metrics (proof) -> bullets (what you get) -> statement (availability)
-> recap -> close.

**Bug fix (1.5-3 min):** title (the symptom as a headline) -> split (what users saw, impact) ->
pipeline or decision (where in the flow it broke, root cause) -> steps or code (the fix) ->
metrics or states (verified before/after) -> statement (shipped in, who is affected, any action
needed) -> recap -> close.

**Teaser (60-90 s):** title -> split -> pipeline -> metrics or bullets -> recap -> close.

**Short how-to (60-90 s, engineers or support):** title -> split (before/after) -> cards (how to
set it) -> decision or steps (how it behaves) -> bullets (checklist or gotchas) -> recap -> close.

## Words and timing

About 2.3 spoken words per second at speed 1.0, plus 2-4 s of hold and transition per scene:
90 s is about 160 words over 6-7 scenes, 3 min about 350 words over 10-12 scenes, and 5 min
about 600 words over 16-20 scenes. Keep each scene to 8-20 s (20-45 words). Split a longer idea into
two scenes. `D plan .` estimates from a typical rate until `narrate` measures the voice; real
rates vary from about 2.0 to 2.5 words per second with the text.

## Writing rules

- Write for the ear: short sentences (under 20 words), active voice, concrete nouns. Hook within
  the first 5 seconds; never open with "In this video".
- For mixed audiences, gloss each technical name once in plain words ("CUPS, the standard print
  system of Linux and macOS"), then use it consistently.
- On-screen text is labels, not sentences: titles up to 6 words, chips up to 4, card text up to 10.
  Never put the narration on screen; the captions already show it.
- Only claims from FACTS.md. Write each number the way it should be heard ("about sixty
  milliseconds"), show digits on screen, and keep its caveat in the metrics footnote.
- Exact status words: optional vs required, shipped vs planned, emulated vs real.
- No em or en dashes anywhere (build warns). Use commas, periods or a plain hyphen.
- Respell names the voice gets wrong in pronunciations.json (`{"display": "labOS", "spoken": "lab O S"}`,
  `{"display": "5.44", "spoken": "five forty-four"}`). Captions show the display form.
- The close tagline is 2-3 short phrases, and they are spoken too.

## scenes.json

```json
{ "scenes": [ { "type": "title", "say": "...", "data": { } } ] }
```

Scene fields:
- `type` (required): a template below, a project template (`<project>/scenes/<type>.mjs`), or
  `custom` (see custom-scene.md).
- `say`: the narration. Leave it empty for a silent scene and set `duration` instead.
- `data`: the template's fields. Every field marked `?` is optional.
- `chapter?`: a small tag at the top right ("The problem"). Title and close scenes don't show it.
- `id?`: defaults to s01, s02 ... by position. `--only` takes ids.
- `hold?`: seconds held after the speech (defaults: title 3, close 4, metrics 2.2, statement and
  recap 2, options and states 1.8, decision 1.6, others 1.4).
- `transition?`: how this scene enters: `push` (default), `zoom`, `fade` or `cut`. The last scene
  fades in by default.

## Cues (`at`)

Every element that matters should land on the word that names it:
- `"word"`: the first match after the previous cue (case and punctuation ignored, display form).
- `"word#2"`: the second occurrence in the scene. `"word+0.4"` / `"word-0.2"`: an offset in seconds.
- a number: seconds from the scene start. Omitted: spread evenly over the narration.

An unmatched cue falls back to automatic timing and `build` warns. Fix every warning.

Icons: printer container server gate queue cloud check cross lock unlock search arrow gear doc
user users database shield bolt chart code globe mail clock warning plug key cpu layers flag
rocket refresh phone monitor star.
Chip tones: accent (default), good, navy, bad, neutral, plain.

## Templates

### title: the opening
Kicker words punch in, then the logo + title lockup.
`kicker?` [string | {text, at}] (up to 3 items of 1-2 words each), `title`, `subtitle?`, `lockup_at?`, `logo?` (false hides it).
A `lockup_at` too early for the kickers is delayed until they have played.
```json
{ "type": "title", "say": "Reports. Forms. Distribution. labOS now prints from containers, through one central service.",
  "data": { "kicker": [{ "text": "Reports", "at": "Reports" }, { "text": "Forms", "at": "Forms" }, { "text": "Distribution", "at": "Distribution" }],
            "title": "Print Gateway", "subtitle": "Printing for the container era", "lockup_at": "central" } }
```

### split: before/after, problem/consequence
`title?`, `left` and `right` {label, tone?, at?, items: [{text, icon?, tone?: good | bad | navy | plain, at?}]}
(2-4 items each), `footer?` [{text, icon?, tone?, at?}]. Items without an icon get a check (good)
or a cross (bad).
```json
{ "type": "split", "chapter": "The problem", "say": "Before, each server printed through its own spooler. Containers have no spooler, so printing failed.",
  "data": { "left": { "label": "Before", "items": [{ "text": "Windows spooler", "icon": "server", "at": "spooler" }, { "text": "SumatraPDF", "icon": "doc" }] },
            "right": { "label": "In containers", "items": [{ "text": "No local spooler", "tone": "bad", "at": "Containers" }, { "text": "HTML printing failed", "tone": "bad", "at": "failed" }] },
            "footer": [{ "text": "Accepts PDF", "icon": "printer", "at": "printing" }] } }
```

### options: the decision among alternatives
Cards in a row. On `decide_at` the chosen one glides left and grows, and the others dim into a column.
`options` [{title, icon?, note?, chosen?: true, at?}] (2-5), `decide_at`, `headline?`, `headline_at?`,
`drops?` [{text, at?}] (shown as "No <text>"), `arrow?` {label?, icon?, at?}.
```json
{ "type": "options", "chapter": "The decision", "say": "We weighed three routes. The decision: one central service built on CUPS.",
  "data": { "options": [{ "title": "Raw port 9100", "icon": "plug", "at": "weighed" }, { "title": "Windows print server", "icon": "server", "at": "three" }, { "title": "CUPS + IPP", "icon": "queue", "chosen": true, "at": "routes" }],
            "decide_at": "decision", "headline": "One central service", "headline_at": "central", "drops": [{ "text": "Windows spooler", "at": "built" }] } }
```

### pipeline: architecture at a glance
2-5 stations left to right with labelled links. At the end a packet travels the whole path.
`title?`, `stations` [{title, icon?, chips?: [..], code?, hero?: true, at?}],
`links?` [{label?, mono?: true, at?}] (one per gap), `helpers?` [{text, link?: gap index from 0 | under?: station index, at?}]
(dashed side components), `packet?` (false hides the packet).
```json
{ "type": "pipeline", "chapter": "Architecture", "say": "labOS sends a PDF to the gateway, the gateway hands it to CUPS, and CUPS prints over IPP.",
  "data": { "title": "The whole picture",
            "stations": [{ "title": "labOS", "icon": "cloud", "chips": ["Screens"], "at": "labOS" }, { "title": "Print Gateway", "icon": "gate", "hero": true, "code": "POST /print", "at": "gateway" }, { "title": "CUPS server", "icon": "queue", "at": "CUPS" }, { "title": "Printers", "icon": "printer", "at": "prints" }],
            "links": [{ "label": "HTTP" }, { "label": "lp", "mono": true }, { "label": "IPP", "at": "IPP" }],
            "helpers": [{ "text": "ippfix (setup aid)", "link": 2 }] } }
```

### decision: a code-path branch
A source asks one question (a diamond). "Yes" runs through 1-3 nodes into a detail card; "no" keeps the old behavior.
`source` {title, icon?, at?}, `question`, `at?`, `conditions?` [{text, at?}], `yes` [{text, doc?: true, badge?, note?, at?}],
`yes_label?`, `yes_at?`, `detail?` {title, at?, arrow_label?, sections: [{label, chips?: [..], rows?: [{code, tag?, note?, at?}]}]},
`no?` {text, tag?, label?, tone?, at?}. `yes_label` relabels the "Yes" link and `no.label` the "No" link.
`no.tone` sets the no box's icon: `bad` a cross (a failure, such as a refusal), `good` a check, any other tone none.
`detail.arrow_label` labels the arrow into the detail card (no label by default).
```json
{ "type": "decision", "chapter": "Inside labOS", "say": "HtmlPrinter asks one question: is the gateway configured? If yes, it renders a PDF and uploads it. If not, nothing changes.",
  "data": { "source": { "title": "HtmlPrinter", "icon": "cloud", "at": "HtmlPrinter" }, "question": "Gateway configured?", "at": "question",
            "conditions": [{ "text": "Containerized site", "at": "configured" }],
            "yes": [{ "text": "HTML", "doc": true, "at": "yes" }, { "text": "HTML to PDF service", "at": "renders" }, { "text": "PDF", "doc": true, "badge": "%PDF ok", "at": "PDF" }],
            "detail": { "title": "POST /print", "at": "uploads", "sections": [{ "label": "Form fields", "chips": ["printer", "file", "copies"] }, { "label": "Headers", "rows": [{ "code": "X-Labos-Print-Token", "tag": "optional for now" }] }] },
            "no": { "text": "Existing print path", "tag": "unchanged", "at": "nothing" } } }
```

### steps: inside one component
The component card stays pinned left while a step rail lights up. An optional code card types in, then a result chip returns.
`component` {title, icon?}, `input?` {label, at?}, `steps` [{text, state?: ok | off | pending, note?, at?}] (2-6),
`code?` {label?, lines: [..], at?, args?: [{text, at?}]}, `result?` {text, at?}, `footnote?` {text, at?}.
```json
{ "type": "steps", "chapter": "Inside the gateway", "say": "The gateway caps the size, writes a temp file, runs one lp command, and replies submitted.",
  "data": { "component": { "title": "labOS Print Gateway", "icon": "gate" }, "input": { "label": "PDF", "at": "gateway" },
            "steps": [{ "text": "Size cap", "at": "caps" }, { "text": "Token check", "state": "off", "note": "off by default" }, { "text": "Temp file", "at": "temp" }, { "text": "Submitted", "at": "submitted" }],
            "code": { "label": "One command", "lines": ["lp -d <queue> -t <title>", "   -o media=A4 [-n <copies>]"], "at": "command", "args": [{ "text": "printer queue" }, { "text": "paper size" }] },
            "result": { "text": "200 submitted", "at": "replies" }, "footnote": { "text": "Also accepts: file_url, s3_key" } } }
```

### cards: setup steps, features, enablement
2-4 cards in a row. `title?`, `cards` [{num? or icon?, title, text?, toggle?: true, toggle_label?, code?: [..], tags?: [..], at?}],
`footer?` {text, at?}.
```json
{ "type": "cards", "chapter": "Turning it on", "say": "Turning it on is configuration: a containerized site, a gateway address, and one queue per printer.",
  "data": { "title": "Configuration, not code",
            "cards": [{ "num": "1", "title": "Containerized site", "toggle": true, "code": ["CONTAINERIZED = true"], "at": "containerized" },
                      { "num": "2", "title": "Gateway address", "code": ["PDF_PRINTER_ADDRESS = host:port", "PDF_PRINTER_TOKEN = optional"], "tags": ["Autolims.cfg"], "at": "address" },
                      { "num": "3", "title": "One queue per printer", "text": "Named like the printer labOS already uses.", "at": "queue" }],
            "footer": { "text": "Rollback: configuration only" } } }
```

### states: one setting, two states
The current state on the left; then the right card flips its toggle on.
`subject` (the setting), `title?`, `from` {label?, on?, tag?, at?}, `to` {label?, lock?: true, text?, note?, at?},
`chips?` [{text, tone?, at?}].
```json
{ "type": "states", "chapter": "Security", "say": "The access token is optional today. Enforce it later, and only token holders can send print jobs.",
  "data": { "subject": "Token enforcement", "from": { "label": "Today", "tag": "Optional today", "at": "optional" },
            "to": { "label": "When enforced", "lock": true, "text": "Only token holders can send print jobs", "note": "switch on + give each labOS component the token", "at": "Enforce" } } }
```

### metrics: proof
`badge?` {text, icon?, at?}, `stats` [{value, label, sub?, hero?, prefix?, suffix?, decimals?, count?: false, at?}] (2-4; numbers count up),
`bars?` [{title, at?, rows: [{label, value, display, tone?}]}] (1-2 groups, one scale per group),
`chips?` [{text containing {n}, count, at?}], `footnote` {text, at?}. The footnote appears with the first bar, so keep the caveat there.
```json
{ "type": "metrics", "chapter": "Proof", "say": "On the test bench: seven hundred jobs, zero failures, and about sixty milliseconds to accept a job.",
  "data": { "badge": { "text": "Real paper, real office printer" },
            "stats": [{ "value": 700, "label": "jobs", "at": "seven" }, { "value": 15, "label": "emulated printers", "sub": "5 needing rendering" }, { "value": 0, "label": "failures", "hero": true, "at": "zero" }],
            "bars": [{ "title": "Average time to accept a job", "at": "sixty", "rows": [{ "label": "CUPS + IPP", "value": 62.1, "display": "62.1 ms" }, { "label": "Windows spooler + SumatraPDF", "value": 3360, "display": "3.36 s" }] }],
            "chips": [{ "text": "{n} lines of tests", "count": 8504 }],
            "footnote": { "text": "Test bench: 15 emulated printers. Time to accept a job, not print time." } } }
```

### code: a developer beat
At most 12 short lines type in, and lines highlight on their cues. Show only what the narration explains.
`title?`, `file?` (label above the code), `lines` [..], `highlights?` [{line (from 1), at?}], `note?` {text, at?}, `at?`.
```json
{ "type": "code", "chapter": "Under the hood", "say": "Under the hood it is a single command, with the queue, the title and the paper size.",
  "data": { "title": "One command does the printing", "file": "internal/cups/lp.go", "lines": ["lp -d <queue>", "   -t <title>", "   -o media=A4", "   [-n <copies>]"],
            "highlights": [{ "line": 1, "at": "queue" }, { "line": 3, "at": "paper" }] } }
```

### bullets: key points or general fallback
`title?`, `items` [{icon?, title, text?, at?}] (2-6, in a row or a 2-row grid).
```json
{ "type": "bullets", "chapter": "Key points", "say": "One service, every PDF printer, and full traceability in Kibana.",
  "data": { "title": "What you get", "items": [{ "icon": "gate", "title": "One service", "text": "Printing leaves the app containers.", "at": "service" },
            { "icon": "printer", "title": "PDF or not", "text": "CUPS renders when needed.", "at": "printer" }, { "icon": "search", "title": "Traceable", "text": "One job ID across logs.", "at": "traceability" }] } }
```

### statement: availability or status
`eyebrow?`, `big`, `sub?`, `icon?`, `at?`, `chips?` [{text, tone?: good | neutral | bad, at?}].
```json
{ "type": "statement", "chapter": "Availability", "say": "It ships in labOS 5.44 for containerized deployments. Other sites stay unchanged.",
  "data": { "eyebrow": "Ships in", "big": "labOS 5.44", "sub": "Containerized deployments", "icon": "container", "at": "ships",
            "chips": [{ "text": "Other sites: unchanged", "at": "Other" }, { "text": "Label printing: not included", "tone": "neutral" }] } }
```

### recap: the summary (always second to last, right before close)
The key takeaways, each with one real-life example. Rows appear one by one; each example fades in under its title.
`title?` (default "What to remember"), `items` [{title, example, icon?, who?, at?, example_at?}]
(2-4: title up to 6 words, example a short phrase of up to 12 words), `footer?` {text, at?} (a bottom-line chip).
A row shows a number badge (or its `icon`), the title, an "e.g." example, and a `who` chip (the role it matters to).
`at` names the title, `example_at` the example (default: 0.6 s after the row). Narrate 25-45 words, and speak each example.
```json
{ "type": "recap", "chapter": "Recap", "say": "To remember: one central service prints every PDF. For example, a report from a container site just prints. It is traceable, so support finds a job by its ID. And it is configuration only, so rollback is one setting.",
  "data": { "items": [{ "title": "One central service", "example": "A container site's report just prints", "who": "Developers", "at": "central", "example_at": "report" },
                      { "title": "Traceable end to end", "example": "Support finds a job by its ID", "who": "Support", "at": "traceable", "example_at": "support" },
                      { "title": "Rollback is configuration", "example": "Switch one setting to go back", "who": "PMs", "at": "configuration", "example_at": "setting" }] } }
```
Strategies (pick one, and examples may only apply facts from FACTS.md):
- Takeaways plus examples (default): 2-4 things to remember, each with a concrete example from the audience's own work.
- Bug fix: before/after, then what to do now.
- Mixed audience: one takeaway per role (developers, PMs, support), each with its `who` chip.

### close: the final scene (always last)
Logo, title and tagline phrases (the last in accent, underlined), then a fade out.
`title`, `tagline` [string | {text, at}] (2-3), `ref?` (a small line, such as the ticket), `logo?` (false hides it).
```json
{ "type": "close", "say": "labOS Print Gateway. One service. PDF or not. No spooler.",
  "data": { "title": "Print Gateway", "tagline": [{ "text": "One service.", "at": "One" }, { "text": "PDF or not.", "at": "PDF" }, { "text": "No spooler.", "at": "No" }], "ref": "Ref: LAB-16894" } }
```
