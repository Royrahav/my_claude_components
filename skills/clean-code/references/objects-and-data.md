# Objects and data structures `[OBJ]`

Source: *Clean Code* ch. 6 + ch. 17 heuristics on feature envy and transitive navigation.
**Load when** writing or reviewing data carriers (DTOs, records, structs, entities, Active
Record models), getters and setters, or call chains like `a.getB().getC().doD()`.

Core idea: objects hide their data and expose behaviour; data structures expose their data and
have no meaningful behaviour. Both are legitimate. The mistake is to blur them.

**OBJ-1 Abstract the data, don't just wrap it** `[M]` — Hiding implementation means offering an
interface that expresses the *essence* of the data, not putting a getter and setter on every
field. Prefer `storageUsedRatio()` over `getQuotaBytes()` + `getUsedBytes()`, and
`temperatureIn(Unit.F)` over exposing a raw Celsius field. Detect: a class where every private
field has a public get/set pair; it is really a data structure in disguise.

**OBJ-2 Data/object anti-symmetry** `[—]` — Procedural code over data structures makes it easy
to add new *functions* without touching the data, but hard to add new *types*. Object-oriented
code makes it easy to add new *types* without touching existing functions, but hard to add new
*functions* (every class changes). Choose based on the change you expect: new kinds of things
favour objects and polymorphism; new operations over a stable set of types favour data
structures with functions (or a Visitor). "Everything is an object" is a myth.

**OBJ-3 Law of Demeter** `[M]` — A method should call methods only on: its own object, objects
it created, its parameters, and objects held in its object's fields. It should not call methods
on objects *returned* by those calls. Talk to friends, not strangers. The law applies to objects;
reaching into a plain data structure's public fields is not a violation.

**OBJ-4 No train wrecks** `[M]` — Detect: `order.getCustomer().getAccount().getWallet().debit(x)`.
Splitting the chain into local variables improves readability, but it's still a Demeter
violation if these are objects. Fix: ask *why* the caller needs the thing at the end of the
chain, and tell the nearest object to do that job (`order.chargeCustomer(x)`), hiding the
structure.
Fluent APIs, builders and stream pipelines that return the same abstraction are not train wrecks.

**OBJ-5 No hybrids** `[M]` — A class that is half object, half data structure: it has real
behaviour *and* public fields or accessors that expose internals, so other code manipulates it
procedurally. You get the worst of both (hard to add functions and hard to add types). Decide
which one it is.

**OBJ-6 DTOs and Active Records are data structures** `[M]` — Plain data-transfer objects (public
fields or simple records) are the right tool at boundaries: databases, messages, sockets. Active
Record models (data plus `save()`/`find()`) are data structures too. Don't put business rules in
them; put the rules in separate objects that hide their data (which may use the record
internally).

**OBJ-7 Feature envy** `[M]` — A method more interested in another class's data than its own
(many `other.getX()` calls to compute something about `other`). Move it to the class whose data it
uses, unless that would drag an unrelated concern (formatting, persistence) into that class, in
which case the envy is the lesser evil.

## Don't over-apply
- Records, structs and dataclasses in data-oriented or functional code are data structures by
  design. That's fine as long as they don't also pretend to be objects.
- Configuration objects, DTOs at API boundaries and serialisation models may expose fields.
- Demeter is about knowledge of *structure*. `list.stream().map(...).filter(...)` and
  `builder.withX().withY()` don't count.
