# Test Structure and Naming

Examples below use Jest/Vitest-style syntax (`describe`/`it`/`expect`), since that's the most
common modern JavaScript/TypeScript convention. The pattern generalizes directly to any
xUnit-style framework — JUnit (`@Nested`/`@Test` + `@DisplayName`), pytest (`class`/`def
test_...` + docstrings), .NET (`[Fact]`/`[Theory]` + method names), Go (`t.Run` subtests):
the mechanics differ, but "one behavior per test, named for scenario and outcome, arranged
Arrange-Act-Assert" applies everywhere.

## Bad: vague names, unclear structure, multiple behaviors per test

```ts
describe('DiscountCalculator', () => {
  it('test1', () => {
    const calc = new DiscountCalculator();
    expect(calc.apply(100, 'PERCENT10')).toBe(90);
    expect(calc.apply(100, 'FLAT10')).toBe(90);
    const calc2 = new DiscountCalculator();
    calc2.setMinimumOrder(50);
    expect(calc2.apply(40, 'PERCENT10')).toBe(40);
    expect(() => calc2.apply(-5, 'PERCENT10')).toThrow();
  });

  it('testCalculate2', () => {
    const calc = new DiscountCalculator();
    expect(calc.apply(0, 'PERCENT10')).toBe(0);
  });
});
```

Problems:

- `test1` / `testCalculate2` describe nothing — a failure gives no idea what broke without
  opening the file and reading every line.
- The first test checks four unrelated behaviors (percent discount, flat discount, minimum
  order threshold, negative-input error). A failure anywhere in this test only says "test1
  failed," not which of the four behaviors regressed.
- No visible Arrange/Act/Assert separation — setup, action, and assertions for different
  scenarios are interleaved, so a reader has to trace state changes line by line.
- Reusing `calc` across assertions with different inputs risks hidden coupling if the class
  has any internal state.

## Good: one behavior per test, scenario-based names, clear structure

```ts
describe('DiscountCalculator', () => {
  describe('percentage discounts', () => {
    it('reduces price by the given percentage', () => {
      // Arrange
      const calc = new DiscountCalculator();

      // Act
      const result = calc.apply(100, 'PERCENT10');

      // Assert
      expect(result).toBe(90);
    });

    it('returns zero when applied to a zero price', () => {
      const calc = new DiscountCalculator();

      const result = calc.apply(0, 'PERCENT10');

      expect(result).toBe(0);
    });
  });

  describe('flat discounts', () => {
    it('subtracts the flat amount from the price', () => {
      const calc = new DiscountCalculator();

      const result = calc.apply(100, 'FLAT10');

      expect(result).toBe(90);
    });
  });

  describe('minimum order threshold', () => {
    it('does not apply a discount when order is below the minimum', () => {
      // Arrange
      const calc = new DiscountCalculator();
      calc.setMinimumOrder(50);

      // Act
      const result = calc.apply(40, 'PERCENT10');

      // Assert
      expect(result).toBe(40);
    });
  });

  describe('invalid input', () => {
    it('throws when the price is negative', () => {
      const calc = new DiscountCalculator();

      expect(() => calc.apply(-5, 'PERCENT10')).toThrow(/negative/i);
    });
  });
});
```

Why this is better:

- Each `it` name reads as a sentence: "DiscountCalculator > minimum order threshold > does
  not apply a discount when order is below the minimum." A failing test name alone tells you
  the broken scenario, before you open the file.
- Each test asserts one outcome. A regression in flat-discount logic fails exactly the flat-
  discount test, not a bundle of unrelated checks.
- `describe` blocks are organized by **scenario/behavior category** (percentage discounts,
  flat discounts, minimum order threshold, invalid input), not by internal method name or
  implementation detail. This groups related edge cases together and makes gaps obvious —
  e.g., it's visually clear there's no test yet for a flat discount larger than the price.
- Arrange/Act/Assert is either explicit via comments (for tests with several arrange steps)
  or simply left as visually separated blank-line groups (for short tests) — consistently
  enough that a reader always knows which line is "the action being tested."

## Naming conventions that work well

Pick one convention per codebase and apply it consistently:

- **Sentence style:** `it('throws InsufficientFundsError when withdrawal exceeds balance')`
- **Given-When-Then style:** `it('given a balance of 0, when withdrawing any amount, then throws InsufficientFundsError')`
- **should-style (older but still common):** `it('should throw InsufficientFundsError when withdrawal exceeds balance')`

All three convey scenario + expected outcome. What to avoid regardless of style:

- Names that restate the method call instead of the behavior: `it('calls apply')`.
- Names with no outcome: `it('handles negative price')` — handles it *how*?
- Numbered or generic names: `it('test1')`, `it('edge case')`, `it('works')`.

## Organizing `describe`/`context` blocks

- Top-level `describe` = the unit under test (class, function, module).
- Nested `describe` = a scenario category or a specific method/entry point when the unit has
  several independent public operations.
- Leaf `it` = one specific scenario within that category, named for input shape and expected
  outcome.
- Group happy-path, edge-case, and error-path scenarios into their own nested blocks (e.g.,
  `describe('when input is valid')`, `describe('when input is empty')`,
  `describe('when the dependency fails')`) so the test file itself documents the contract's
  shape and any missing category jumps out visually.
