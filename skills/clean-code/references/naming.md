# Naming `[NAM]`

Source: *Clean Code* ch. 2 + ch. 17 name heuristics. **Load when** introducing or renaming
variables, functions, classes, files or constants, or reviewing code whose names are unclear.

Core idea: a name is the cheapest documentation there is. It should answer why the thing exists,
what it does and how it is used, so the reader never has to open the implementation to find out.

**NAM-1 Reveal intent** `[L→M]` — If a name needs a comment to explain it, rename it.
Detect: `d`, `list1`, `data`, `tmp`, `val`, `flag`, `x` outside a tiny scope; a declaration with an
explanatory comment beside it. Fix: `elapsedDays`, `flaggedCells`, `pendingInvoices`. Raise to [M]
when the unclear name sits in core business logic.

**NAM-2 Name the magic values** `[M]` — Literals with domain meaning get a named constant, enum or
method. Detect: `if (cell[0] == 4)`, `* 86400`, `status == "X"`. Fix: `cell.isFlagged()`,
`SECONDS_PER_DAY`, `Status.EXPIRED`. Obvious literals (`0`, `1`, `2` in `half = n / 2`) are fine.

**NAM-3 Avoid disinformation** `[M]` — Don't use words with an established different meaning,
or type words that lie. Detect: `accountList` holding a set or map; platform or tool names reused
for something else; two names that differ only by a few characters in the middle; `l`/`O` as
names. Fix: `accounts`, `accountGroup`; make differences visible at the start of the name.

**NAM-4 Make meaningful distinctions** `[L]` — Names that differ must mean different things.
Detect: number series (`a1`, `a2`); noise words (`Info`, `Data`, `Object`, `the`, `variable`,
`string` inside the name); siblings like `getAccount` / `getAccounts` / `getAccountInfo` whose
difference the reader can't guess. Fix: name the actual difference (`source`, `destination`).

**NAM-5 Pronounceable, searchable, sized to scope** `[L]` — You should be able to say a name
aloud and grep for it. Name length grows with scope: a loop index may be `i`; a module-level
value needs a full name. Detect: `genymdhms`, `e` used across a long function, a bare `7` you
can't search for. Fix: `generationTimestamp`, `WORK_DAYS_PER_WEEK`.

**NAM-6 No encodings** `[L]` — No Hungarian or type prefixes (`strName`, `iCount`), no member
prefixes (`m_`, `f`, `_` purely to mark fields), no `I` prefix on interfaces when the language
doesn't expect it. If one side must be marked, mark the implementation (`ShapeFactoryImpl`).
Language conventions win: keep `IFoo` in C#, and `_private` where the language uses it to mark
visibility.

**NAM-7 No mental mapping** `[L]` — The reader shouldn't have to translate a name into the concept
it stands for. Clarity beats cleverness. Single letters are acceptable only for conventional
tiny-scope roles (`i`, `j`, `x`, `y` in math).

**NAM-8 Classes are nouns** `[L]` — Use a noun or noun phrase: `Customer`, `WikiPage`,
`AddressParser`. Avoid verbs and vague buckets (`Manager`, `Processor`, `Data`, `Info`, `Helper`,
`Util`) unless qualified and truly accurate (`OrderFulfillmentManager`). If you can't name it
concisely, it probably has too many responsibilities (CLS-3).

**NAM-9 Methods are verbs** `[L]` — `postPayment`, `deletePage`, `save`. Accessors, mutators and
predicates follow the language convention (`getX`/`setX`/`isX`, or properties). When there are
overloaded constructors, prefer static factories named for their argument
(`Temperature.fromCelsius(21.5)`) and consider making the constructors private.

**NAM-10 Don't be cute** `[L]` — No jokes, slang or culture references (`nuke()`, `yeet()`,
`holyHandGrenade()`). Say what you mean: `deleteAll()`, `abortTransfer()`.

**NAM-11 One word per concept** `[L→M]` — Pick one of fetch/retrieve/get, and one of
controller/manager/driver, then use it everywhere. Detect: `fetchUser`, `getOrder`,
`retrieveInvoice` doing the same kind of thing on sibling classes. Raise to [M] in public APIs.

**NAM-12 Don't pun** `[M]` — Don't use one word for two different meanings. If `add` means
"sum two values" in some classes, a method that inserts into a collection should be called
`insert` or `append`.

**NAM-13 Solution-domain vs problem-domain names** `[L]` — Your readers are programmers, so
use computer-science terms when one exists (`JobQueue`, `AccountVisitor`, `LruCache`). When
there is no programmer term, use the problem domain's term, so a maintainer can ask a domain
expert. Code that implements domain concepts should speak the team's ubiquitous language.

**NAM-14 Add meaningful context** `[L→M]` — A lone `state` or `number` is ambiguous. Give it
context through its enclosing class, function or namespace (`Address.state`), and use a prefix
only as a last resort. Detect: a function whose locals only make sense after you read all of
it. Fix: extract a small class that holds the related variables (e.g. `ShippingQuote` holding
`carrier`, `cost`, `etaDays`), which also shortens the function.

**NAM-15 No gratuitous context** `[L]` — Don't prefix every type with the application or module
abbreviation (`ACMEAccount`, `ACMECustomer`). It adds nothing and ruins autocomplete. `Address`
is a fine class name; use qualified *variable* names (`shippingAddress`) or, only when distinct
types are really needed, qualified class names (`MacAddress`, `Uri`).

**NAM-16 Name at the right level of abstraction** `[M]` — Name for the concept, not the
implementation. Detect: `dial()` on a connection that could be any transport; `hashMapOfUsers`;
`writeToMySql()` on a repository interface. Fix: `connect()`, `users`, `save()`.
Most important in interfaces and public APIs.

**NAM-17 Standard nomenclature** `[L]` — Reuse established vocabulary: pattern names
(`...Decorator`, `...Factory`), language conventions (`toString`, `__repr__`, `equals`), and the
project's own glossary. Consistency across the codebase beats personal taste.

**NAM-18 Names say everything, including side effects** `[M→H]` — A name must describe all that
the function does. Detect: `getSession()` that also creates one; `rename()` that also rewrites
references; `checkPassword()` that also initialises a session. Fix: `getOrCreateSession()`,
`renameAndUpdateReferences()`, or remove the side effect (FUN-12). Raise to [H] when the hidden
effect can cause misuse.

## How to work
- Choosing good names takes descriptive skill and shared culture. Ask: what would I call this if
  I were explaining it to a colleague?
- Rename freely when you find a better name. Refactoring tools make it safe, and names should
  evolve as understanding improves. Fear of renaming is inertia, not caution.
- A little effort on names pays back across every future read.

## Don't over-apply
- Language and ecosystem conventions override this file: Go's short names in small scopes and
  receivers, C#'s `I` interfaces, `snake_case` in Python, framework-mandated names.
- Math or scientific code may use standard notation that matches its source formulas.
- Universally known abbreviations (`id`, `url`, `http`, `api`, `db`) are fine.
- In a review, renaming an *untouched* public API is a breaking change: log it as a follow-up and
  don't block on it.
