# Systems `[SYS]`

Source: *Clean Code* ch. 11 + ch. 17 environment and configuration heuristics. **Load when**
writing or reviewing startup and bootstrapping (`main`, app factories), dependency-injection
wiring, factories, configuration and defaults, framework integration, cross-cutting concerns
(logging, transactions, security, caching), or build scripts.

Core idea: a city works because it's modular, with separate concerns and the right level of
abstraction for each team. Software systems need the same thing at the architecture level:
clean functions and classes aren't enough if construction, infrastructure and domain logic are
tangled together.

**SYS-1 Separate construction from use** `[M]` — Building and wiring objects at startup is a
concern of its own. Detect: lazy initialisation inside business methods
(`if (repo == null) repo = new SqlRepo(cfg)`). It hard-codes a dependency, complicates tests,
mixes responsibilities, and when it's scattered nobody knows how the system is assembled.

**SYS-2 Construction lives in main** `[M]` — Put all construction in `main` (or modules called
from it). The application assumes everything is already built and wired. Dependencies point from
`main` *into* the application, never back.

**SYS-3 Factories when the app controls *when*** `[L]` — If the application must decide when an
object is created, give it an abstract factory interface. The app decides when; the details of
*how* stay on the `main` side.

**SYS-4 Dependency injection** `[M]` — Objects don't instantiate their dependencies; they receive
them (constructor preferred) from `main` or a DI container. Detect: service-locator or registry
lookups scattered through domain code; `new` of infrastructure inside domain objects. Lazy
creation, where needed, can live inside the container.

**SYS-5 Grow incrementally** `[—]` — Getting a system "right the first time" is a myth. Build
today's stories, then refactor and extend. Incremental growth works only if concerns stay
separated.

**SYS-6 Keep cross-cutting concerns out of the domain** `[M]` — Persistence, transactions,
security, logging and caching cut across many objects. Don't smear them through domain methods.
Modularise them with decorators or proxies, middleware or interceptors, declarative annotations,
or AOP. Keep domain objects plain (POJO/POCO-style), free of framework and infrastructure types.
Detect: the same logging, transaction or auth code repeated inside many business methods.

**SYS-7 Avoid invasive architecture** `[M]` — A framework that forces domain classes to extend its
base classes or carry its plumbing buries the domain logic and resists change. Keep the domain
framework-agnostic so the architecture can change without rewriting it.

**SYS-8 Test-drive the architecture** `[—]` — With decoupled plain domain objects you don't need
a big design up front. Start naively simple but well decoupled, deliver working stories, and add
infrastructure as scale demands. Test-driving the domain keeps that decoupling honest.

**SYS-9 Decide at the last responsible moment** `[—]` — Modularity lets decisions be made late,
with the most information, by the people closest to them. Premature decisions are made with the
least knowledge.

**SYS-10 Use standards wisely** `[L→M]` — Adopt a standard or heavyweight framework when it adds
*demonstrable* value, not because it's popular. Many teams have buried simple applications under
frameworks they didn't need.

**SYS-11 Domain-specific languages** `[L]` — Small internal DSLs and fluent APIs let the code read
like the domain, narrow the gap between the domain expert and the implementation, and raise the
level of abstraction.

**SYS-12 Keep configurable data at high levels** `[M]` — Defaults and configuration constants
belong at the top (config loading, `main`, argument parsing) and are passed down. Don't bury them
in low-level functions. Detect: a hard-coded port, timeout or path deep inside a utility.

**SYS-13 One-step build** `[M]` — Check out, then one command builds the system. There should be
no hunting for artefacts, manual steps or tribal knowledge. (For the one-step test run, see TST-15.)

## Don't over-apply
- Small scripts, CLIs and prototypes don't need a DI container. Passing dependencies by hand from
  `main` is DI.
- A framework can be the right architecture. The rule is to keep the *domain* independent of it,
  not to avoid frameworks.
- AOP and proxies add indirection. Use them for genuinely cross-cutting concerns, not for
  ordinary logic.
