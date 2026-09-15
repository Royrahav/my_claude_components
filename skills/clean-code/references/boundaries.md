# Boundaries — third-party and not-yet-written code `[BND]`

Source: *Clean Code* ch. 8. **Load when** using, wrapping or upgrading a third-party library,
SDK or external API, or coding against a component whose API doesn't exist yet.

Core idea: providers of an API aim for broad applicability; users want a narrow interface for
their needs. Keep foreign code at the edges of the system, behind interfaces you control, so a
change on the other side touches one place.

**BND-1 Don't pass boundary types around** `[M]` — Don't hand broad third-party types (a raw
`Map`/`dict`, an SDK client, an ORM session or entity, an HTTP response object) through many
modules or return them from public APIs. They offer operations you don't want callers to use,
and any change to them ripples everywhere. Fix: wrap the type in a class that exposes only what
the application needs (`FeatureFlags.isOn(name)` hiding the SDK client), and keep the wrapper
private to one module or a small family of classes.

**BND-2 Learning tests** `[L]` — When adopting a third-party API, write small tests that call it
the way you intend to use it. They are controlled experiments that check your understanding
before any production code depends on it. They cost nothing extra (you had to learn the API
anyway), and they document what you rely on.

**BND-3 Boundary tests guard upgrades** `[M]` — Keep a set of tests that exercise the external
API the way production does. When the vendor releases a new version, run them and any behaviour
change shows up immediately. Without them, teams stay on old versions longer than they should.

**BND-4 Code against the interface you wish you had** `[L]` — When the other side isn't built yet
(or its API is unknown), define the interface *you* want from your side of the boundary, code to
it, and write an Adapter to the real API when it arrives. This keeps your code clean, gives you a
seam for a fake in tests, and confines the translation to one place.

**BND-5 Depend on what you control** `[M]` — Good boundaries let very few places in the code
refer to a third-party API directly: wrappers and adapters. When the vendor changes, only those
change. Convert the vendor's exceptions, nulls and odd types into your own at that line (ERR-5,
ERR-7).

## Don't over-apply
- Stable standard-library types (`String`, `List`, `Duration`) don't need wrapping. Neither does
  a map used entirely inside one class.
- Don't build an adapter for a dependency used in one place that is unlikely to change. Wrap it
  when a second use or an upgrade appears (EMG-5).
- A framework chosen as the application's architecture is a deliberate dependency. Keep the
  *domain* free of it instead (`systems.md`, SYS-6).
