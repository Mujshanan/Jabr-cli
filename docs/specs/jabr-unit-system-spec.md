# Jabr Unit System Specification

**Status:** M0 architecture draft — revised for Architecture A  
**Owner:** Jabr Math  
**Target contract:** `quantity-v1`  
**Implementation boundary:** Jabr Math owns all numeric, quantity, unit and dimensional semantics  
**Freeze rule:** This document is a proposal until reviewed and explicitly accepted.

## 1. Purpose and ownership

Jabr Math requires a runtime unit system for user-authored engineering expressions. Users enter unit symbols dynamically, combine units algebraically and evaluate expressions whose unit structure is not known at Rust compile time.

**All mathematical quantity semantics belong to Jabr Math.** Kernel and Jabr Engine must treat Math values as opaque payloads. Kernel does not define dimensions, quantities, unit registries, conversion factors or mathematical diagnostics. Engine resolves worksheet references and stores/publishes opaque Math result payloads; it does not reinterpret their mathematical meaning.

The system must support:
- Seven SI base dimensions and units.
- SI derived units and the complete SI prefix set.
- Conventional metric, US customary, Imperial and engineering units.
- Runtime parsing and normalization of compound units.
- Exact and approximate numeric values.
- Dimensional analysis and unit-aware arithmetic.
- Linear and affine conversions.
- Absolute temperature versus temperature intervals.
- Stable serialization and deterministic evaluation.
- Display-unit preferences that do not alter physical values.

## 2. Numeric representation

The numeric model is independent of units. V1 should use a tagged scalar representation that preserves exact values where practical and makes approximation explicit.

Proposed conceptual model:

```rust
pub enum Scalar {
    ExactInt(i128),
    Rational { numerator: i128, denominator: i128 },
    Real(f64),
}
```

Rules:
- Rational denominators are non-zero and normalized to a positive denominator.
- Rational construction and arithmetic use checked operations; overflow must never wrap.
- Overflow policy must be explicit: return a typed numeric diagnostic or promote through a documented exact/approximate path. Silent precision loss is forbidden.
- Integer division promotes to Rational when exact representation is possible.
- Operations that inherently require approximation (for example general trigonometric/logarithmic functions or irrational roots) return tagged approximate values.
- No intermediate rounding is performed for display purposes.
- Non-finite Real values are rejected or represented through explicit diagnostics; they are not silently serialized as JSON numbers.
- Exact values serialize with tagged integer/rational fields, not as JSON floating-point values.

Big decimal and symbolic algebra are deferred unless a concrete engineering requirement demonstrates that Rational/Real is insufficient. Decimal source-literal preservation remains an open Math-language decision and must not be confused with a general-purpose arbitrary-precision decimal engine.

### 2.1 Equality and comparison

Do not define all expression equality using a universal relative tolerance. V1 must distinguish:
- exact equality for exact integer/rational values;
- approximate numeric comparison for explicitly approximate values;
- dimensional compatibility before comparing quantities;
- a separately documented tolerance policy for engineering comparison functions.

The language's `==` semantics must be frozen in the Math language specification. A tolerance such as 1e-12 may be a candidate for an explicit approximate-comparison function or configurable policy, but must not silently redefine exact equality.

## 3. Dimension model

Use the seven SI base dimensions:

| Dimension | Base unit | Symbol |
|---|---|---|
| Length | metre | m |
| Mass | kilogram | kg |
| Time | second | s |
| Electric current | ampere | A |
| Thermodynamic temperature | kelvin | K |
| Amount of substance | mole | mol |
| Luminous intensity | candela | cd |

A dimension is a seven-component exponent vector. V1 must define exponent representation and bounds. Integer exponents are mandatory; rational exponents may be supported where the Math language permits roots/fractional powers. Exponent overflow must return a diagnostic, never wrap.

Dimension multiplication adds exponents; division subtracts them; exponentiation multiplies them.

Angle is dimensionless in SI dimensional analysis but retains semantic information for degree/radian conversion and trigonometric functions. Plain scalars, percentages, ratios and angles must not be conflated in parsing, function semantics or formatting.

## 4. Quantity model

The following types are conceptual, not frozen Rust signatures:

```rust
pub struct Quantity {
    pub value: Scalar,
    pub dimension: Dimension,
    pub kind: QuantityKind,
    pub canonical_value: CanonicalValue,
    pub preferred_display_unit: Option<UnitExpression>,
}

pub enum QuantityKind {
    Linear,
    AbsoluteTemperature,
    TemperatureInterval,
    Angle,
    DimensionlessRatio,
    Percentage,
}
```

The implementation may choose a different internal representation, but it must preserve these semantic distinctions.

Physical value and preferred display unit are separate. Changing a display preference must not change the represented physical quantity or invalidate unrelated mathematical dependencies.

## 5. Unit definitions and registry

A unit definition must contain:
- Stable Math-owned UnitId.
- Canonical symbol and explicit aliases.
- Dimension and semantic kind.
- Exact or approximate scale to canonical representation.
- Offset where affine conversion is applicable.
- Unit family/system metadata.
- Prefix policy.
- Definition provenance and exactness classification.

The registry is data-driven. Conversion constants must not be scattered through evaluator branches.

### 5.1 SI base and derived units

Include seven SI base units and named derived units required for engineering/science, including Hz, N, Pa, J, W, C, V, ohm, F, Wb, T, H, lm and lx. Named derived units retain preferred symbols while resolving to canonical dimensions and scale.

### 5.2 SI prefixes

Support the complete current SI prefix set with exact powers of ten and case-sensitive symbols. Prefix application is controlled by the registry:
- no ambiguous repeated prefixes;
- kg is handled as the canonical base mass unit;
- prefix eligibility is explicit per unit;
- micro, middle dot, degree and superscript input may be normalized at the input boundary while retaining original source for diagnostics/editing.

### 5.3 Non-SI and engineering units

V1 registry coverage should include commonly used:
- conventional metric units;
- US customary units;
- Imperial units;
- engineering force and stress units.

At minimum, distinguish mass from force and include kg, g, tonne, lbm, slug, N, kN, MN, kgf, lbf and kip. Include length units such as mm, cm, m, km, inch, foot, yard and mile; pressure/stress units such as Pa, kPa, MPa, GPa, bar, psi and ksi; and common volume/area/time units.

Each definition must record whether its conversion factor is exact by definition or an approximation/conventional value. Avoid describing all legacy customary conversions as inherently inexact: some are exact by definition (for example inch-to-metre and pound-mass-to-kilogram international definitions).

## 6. Compound-unit grammar

The runtime unit parser must support:

| Form | Example |
|---|---|
| Unit after numeric value | `5 m` |
| Multiplication | `kg*m/s^2` |
| Middle-dot multiplication | `kN·m` |
| Division | `m/s` |
| Integer powers | `m^2`, `s^-2` |
| Parentheses | `kg/(m*s^2)` |
| Nested compounds | `N*m/kg` |
| Prefixes | `mm/s`, `kN/m` |
| Rational powers | `m^(1/2)`, if supported by the Math grammar |

The parser must distinguish unit expressions from variable identifiers using explicit lexical/parser context. An unknown identifier must not silently become a unit, and a known unit symbol must not be silently treated as a variable where unit syntax is expected.

Symbols are case-sensitive. Aliases are explicit registry entries, not fuzzy matching. Normalization must preserve source text for editing and diagnostics.

Equivalent unit expressions must normalize to comparable dimension/scale representations without erasing the user's preferred display expression. For example, N/m² and kg/(m·s²) are dimensionally equivalent even though their display forms differ.

## 7. Linear, affine and semantic units

### 7.1 Linear units

Linear units use scale-only conversion. Multiplication, division, powers and compound expressions are allowed subject to dimensional rules.

### 7.2 Affine temperature units

Celsius and Fahrenheit absolute-temperature scales require scale and offset. They are valid only for absolute temperature quantities, not as ordinary factors in compound units.

The model must distinguish:
- absolute temperature, e.g. 20 °C;
- temperature interval, e.g. a difference of 20 K;
- Kelvin absolute temperature and Kelvin interval semantics.

Required arithmetic:
- absolute temperature minus absolute temperature produces a temperature interval;
- absolute temperature plus an interval produces an absolute temperature;
- interval plus interval produces an interval;
- adding two absolute temperatures is invalid;
- multiplying/dividing an absolute temperature is invalid;
- conversion between Celsius/Fahrenheit/Kelvin preserves the physical absolute temperature;
- interval conversion uses scale only, without affine offset.

### 7.3 Other dimensionless semantics

Radians, degrees, percentages and ppm are dimensionless in the SI dimension vector but retain semantic/display metadata. Trigonometric functions must define accepted angle inputs and conversion behavior. Percentage scaling must be explicit (for example 50% represents ratio 0.5), not merely a decorative label.

## 8. Arithmetic and dimensional diagnostics

The evaluator must validate dimensions and quantity kinds for addition, subtraction, comparison, multiplication, division, powers and supported functions.

Minimum Math-owned diagnostic categories:
- `math.unit.unknown`
- `math.unit.dimension_mismatch`
- `math.unit.affine_in_product`
- `math.unit.affine_sum`
- `math.unit.expected`
- `math.unit.invalid_conversion`
- `math.unit.exponent_overflow`
- `math.numeric.rational_overflow`
- `math.numeric.division_by_zero`
- `math.numeric.non_finite`

Kernel supplies only a generic diagnostic envelope. Engine may transport/store these diagnostics as opaque Math payloads; it must not invent or reinterpret their mathematical meaning.

## 9. Display and formatting

- Default display precision is a configurable significant-figure policy; six significant figures is a proposed initial default, not a calculation precision.
- Formatting never mutates the underlying quantity.
- A user-selected display unit must be dimensionally and semantically compatible.
- Unit conversion occurs before formatting and preserves exactness when the conversion factor is exact and the scalar operation remains representable.
- Engineering notation and unit-symbol spacing/case rules belong to the Math formatter.
- A display-unit-only change should update presentation without forcing unrelated worksheet recalculation.

## 10. Serialization and inter-engine boundary

Math owns the serialized representation of `Scalar`, `Dimension`, `Quantity`, `UnitExpression` and Math diagnostics.

Requirements:
- Use tagged representations for ExactInt, Rational and Real.
- Never serialize i128 values as JSON numbers if the receiving JavaScript/runtime cannot preserve their full range; use decimal strings.
- Define stable field names and payload version.
- Define finite-value policy for Real.
- Include enough metadata to reconstruct quantity kind and preferred display unit.
- Preserve unknown/future version behavior explicitly.
- Engine and Kernel treat the serialized Math payload as opaque. Kernel does not need to depend on the Math crate or understand the quantity schema.

## 11. Required verification fixtures

Minimum conversion/dimension fixtures:
- 1 m = 1000 mm.
- 1 in = 25.4 mm exactly.
- 1 ft = 12 in exactly.
- 1 MPa = 1000 kPa.
- 1 bar = 100000 Pa.
- 1 kip ≈ 4.4482216152605 kN (with documented exactness/rounding basis).
- kN·m has moment dimension.
- N/mm² has pressure/stress dimension and equals MPa.
- 3 m + 2 s returns dimension mismatch.
- Compound-unit cancellation, e.g. (m/s)·s -> m.
- Celsius/Fahrenheit/Kelvin absolute conversions.
- Absolute temperature subtraction produces interval.
- Absolute temperature addition and affine multiplication return diagnostics.
- kg and kgf remain different dimensions/quantities.
- Rational overflow and zero denominator return explicit diagnostics.
- Native and WASM paths produce matching normalized results.

## 12. Implementation phases

- **U0:** scalar representation, checked rational arithmetic and dimension foundation.
- **U1:** seven SI base dimensions and units.
- **U2:** SI derived units and complete prefix registry.
- **U3:** runtime compound-unit parser and normalization.
- **U4:** conventional metric, US customary, Imperial and engineering unit registry.
- **U5:** dimensional arithmetic and diagnostics.
- **U6:** conversion and display formatting.
- **U7:** affine temperature, angle and dimensionless semantic rules.
- **U8:** user-defined/custom units, deferred until built-in registry and serialization are stable.

Evaluate `uom` only through a focused proof of concept. It may serve as an implementation aid or reference oracle, but must not define the public Jabr Math API or become the sole runtime unit model. Evaluate runtime unit parsing, rational/exact scalar compatibility, affine temperature, WASM support and build cost before adding any dependency.

## 13. Open decisions before freeze

1. Whether dimension exponents are bounded integers in V1 or rational exponents from the start.
2. Whether decimal source literals preserve exact decimal form or normalize to Rational/Real.
3. Exact scalar overflow behavior: typed error only versus a documented promotion to approximate Real.
4. Full minimum unit registry list and provenance source.
5. Language-level equality and approximate comparison semantics.
6. Angle and percentage parsing/formatting behavior.
7. Exact serialized Math value schema and compatibility policy.

## 14. Explicit non-goals

- Kernel-owned dimensions, units, quantities or conversion logic.
- Engine-owned mathematical interpretation or evaluation.
- Compile-time-only units as the sole runtime model.
- Arbitrary-precision symbolic algebra in V1.
- Silent floating-point rounding or silent rational overflow.
- Custom unit definition before the built-in registry is stable.
