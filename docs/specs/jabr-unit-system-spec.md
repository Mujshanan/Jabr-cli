# Jabr Unit System Specification

**Status:** Architecture specification draft for review  
**Owner:** Jabr Math  
**Scope:** Runtime units, quantities, dimensional analysis, conversion, precision, and display semantics

## 1. Goals

Jabr Math requires a runtime unit system for user-authored engineering expressions. Users must be able to enter units dynamically in worksheet source and combine them algebraically; the system cannot rely exclusively on Rust compile-time quantity types.

The unit system must support:

- The seven SI base dimensions and SI base units.
- SI derived units and the complete SI prefix set.
- Conventional metric, US customary, Imperial, and common engineering units.
- Runtime parsing and normalization of compound units.
- Exact and approximate numeric values.
- Dimensional analysis and unit-aware arithmetic.
- Linear and affine conversions.
- Absolute temperature versus temperature intervals.
- Stable serialization and deterministic evaluation.
- Display-unit preferences that do not alter the physical value.

The implementation belongs to Jabr Math. Kernel stores only opaque generic payloads; it does not own unit definitions, dimensions, or quantity semantics.

## 2. Core design decisions

### 2.1 Runtime-first, dimensionally typed model

The parser must accept unit expressions at runtime, for example:

~~~text
L = 6000 mm
F = 20 kN
M = F * 3 m
sigma = 100 kN / 2000 mm^2
E = 200 GPa
~~~

Internally, each quantity has a numeric value, physical dimension, semantic kind where required, and a preferred display-unit expression.

Rust compile-time unit libraries may be evaluated as implementation aids or reference oracles, but they cannot be the sole quantity model because worksheet expressions and unit symbols are not known at Rust compile time.

### 2.2 One canonical dimension system

Use the seven SI base dimensions as the canonical physical dimension basis:

| Dimension | Base unit | Symbol |
|---|---|---|
| Length | metre | m |
| Mass | kilogram | kg |
| Time | second | s |
| Electric current | ampere | A |
| Thermodynamic temperature | kelvin | K |
| Amount of substance | mole | mol |
| Luminous intensity | candela | cd |

A dimension is a seven-component exponent vector. Exponents must support the operations required by the language, including negative and rational exponents where mathematically valid.

Angle is dimensionless in SI dimensional analysis, but the language should preserve angle semantics sufficiently to convert degrees/radians and validate trigonometric inputs. Dimensionless quantities, plain scalars, percentages, and angles must not be conflated in formatting or function semantics.

### 2.3 Numeric precision is independent of units

The unit system must not force all values to f64.

Use the Math numeric model:

- Exact integer and rational values where possible.
- Exact decimal values where the source or unit definition is decimal-exact.
- Tagged approximate values for floating-point or numerically approximate results.
- Explicit precision/rounding metadata for display only.

Conversion factors and offsets should be represented exactly when their definitions permit. Do not round intermediate values merely because the user selected a display unit. Rounding belongs to formatting unless a calculation operation explicitly requests rounding.

## 3. Internal model

The following types describe the required concepts. They are conceptual contracts, not final Rust signatures.

### 3.1 Dimension

~~~rust
pub struct Dimension {
    pub length: RationalExponent,
    pub mass: RationalExponent,
    pub time: RationalExponent,
    pub current: RationalExponent,
    pub temperature: RationalExponent,
    pub amount: RationalExponent,
    pub luminous_intensity: RationalExponent,
}
~~~

Dimension multiplication adds exponents; division subtracts them; exponentiation multiplies them. The implementation must define supported exponent bounds and reject overflow rather than wrap.

### 3.2 Unit definition

A registered unit definition should contain:

- Stable namespaced UnitId.
- Canonical symbol and accepted aliases.
- Physical dimension.
- Linear scale to the canonical base representation, or an affine transform where applicable.
- Unit category and unit-system metadata.
- Prefix policy.
- Quantity semantic kind, where required.
- Definition provenance and exactness.

A unit registry is data-driven. The evaluator must not contain scattered conversion constants or symbol-specific conversion branches.

### 3.3 Unit expression

A UnitExpression is a normalized product of registered unit factors and rational exponents.

~~~rust
pub struct UnitFactor {
    pub unit_id: UnitId,
    pub exponent: RationalExponent,
}

pub struct UnitExpression {
    pub factors: Vec<UnitFactor>,
    pub dimension: Dimension,
    pub scale: ExactOrApproximate,
}
~~~

Canonicalization must make equivalent expressions comparable without losing the user's preferred display form. For example, N/m² and kg/(m·s²) are dimensionally and physically equivalent, even if the preferred display is different.

### 3.4 Quantity

~~~rust
pub struct Quantity {
    pub value: NumericValue,
    pub dimension: Dimension,
    pub kind: QuantityKind,
    pub display_unit: Option<UnitExpression>,
}
~~~

The physical value and display preference are separate. Changing a display unit must not change the represented physical quantity.

## 4. Unit-expression grammar

The runtime parser must support:

| Form | Example |
|---|---|
| Unit following a value | 5 m |
| Explicit multiplication | kg*m/s^2 |
| Middle-dot multiplication | kN·m |
| Division | m/s |
| Positive and negative powers | m^2, s^-2 |
| Parentheses | kg/(m*s^2) |
| Nested compounds | N*m/kg |
| Prefixes | mm/s, kN/m |
| Rational powers where supported | m^(1/2) |

The grammar must distinguish a unit expression from a variable/expression identifier using parser context and explicit tokenization rules. It must not silently reinterpret an unknown identifier as a unit or a known unit symbol as a variable.

### 4.1 Symbol and prefix rules

- Symbols are case-sensitive: m and M are not interchangeable.
- Prefixes are resolved only where the registry permits them.
- Prefix parsing must not accept ambiguous repeated prefixes.
- kg is the base mass unit; prefix handling must not accidentally reinterpret it as an ordinary prefixed gram without a canonical rule.
- Unicode micro, middle dot, degree, and superscript input may be normalized at the input boundary, but original source text must remain available for editing and diagnostics.
- Aliases are explicit registry entries, not fuzzy matching.

## 5. Unit families and minimum coverage

### 5.1 SI base and derived units

Include the seven SI base units and named derived units needed by engineering and science, including Hz, N, Pa, J, W, C, V, ohm, F, Wb, T, H, lm, and lx.

Named derived units retain preferred symbols but resolve to canonical dimensions and scale.

### 5.2 SI prefixes

Support the complete current SI prefix set, with case-sensitive symbols and exact powers of ten. Prefix support must be data-driven and tested at both large and small magnitudes.

### 5.3 Conventional metric units

At minimum evaluate and support common engineering usage such as:

- Length: mm, cm, km.
- Area: mm², cm², hectare.
- Volume: litre and common submultiples.
- Mass: gram and metric tonne.
- Pressure: bar and other accepted conventional units.
- Force: kilogram-force and tonne-force, explicitly distinct from mass.

### 5.4 US customary and Imperial units

The initial registry should cover common engineering units:

- Length: inch, foot, yard, mile.
- Area: square inch, square foot, acre.
- Volume: cubic inch, cubic foot, US gallon, Imperial gallon.
- Mass: pound mass (lbm), ounce, slug, short ton, long ton.
- Force: pound-force (lbf), kip, kilogram-force, tonne-force.
- Pressure: psi, ksi, standard atmosphere, bar, and supported mercury-column units.
- Energy/moment: ft·lbf, in·lbf, and SI torque/moment units.
- Power: horsepower variants only when the exact definition is named.

US customary and Imperial units must remain distinguishable where definitions differ. Do not use ambiguous symbols such as ton or gallon without a named variant or an explicit default documented by the registry.

### 5.5 Engineering units

Prioritize structural and civil engineering usage:

- Force: N, kN, MN, lbf, kip.
- Stress/pressure: Pa, kPa, MPa, GPa, psi, ksi.
- Distributed load: N/m, kN/m, lbf/ft, kip/ft.
- Moment: N·m, kN·m, lbf·ft, kip·ft.
- Density: kg/m³, t/m³, lbm/ft³.
- Unit weight: kN/m³, lbf/ft³.
- Section properties: mm², cm², m², in², mm⁴, cm⁴, in⁴, ft⁴.

Engineering names are aliases or named derived units over the same canonical dimensional model, not separate dimension systems.

## 6. Compound units and dimensional algebra

Compound units are generated dynamically from registered units. Do not maintain an exhaustive list of every possible compound unit.

Required operations:

- Multiplication and division of units.
- Integer and supported rational powers.
- Negative powers.
- Parenthesized products and quotients.
- Prefix application to eligible units.
- Canonical dimension and scale computation.
- Preferred display preservation.

Examples:

~~~text
N/m^2       -> pressure dimension
kN*m        -> moment/energy dimension
kg/(m*s^2)  -> pressure dimension
mm^4        -> fourth power of length
kN/m        -> distributed force dimension
~~~

A compound expression is valid only if all factors are valid linear units. Affine units such as degrees Celsius and degrees Fahrenheit cannot be multiplied, divided, exponentiated, or embedded directly in a compound unit.

The engine must distinguish quantities that share dimensions but have different semantic roles where the language requires it, such as energy and torque, or absolute temperature and temperature interval.

## 7. Conversion model

### 7.1 Linear units

For a linear unit:

~~~text
canonical_value = displayed_value * scale
displayed_value = canonical_value / scale
~~~

All intermediate calculations retain the exact/approximate tag of the numeric model.

### 7.2 Affine units

For an affine unit:

~~~text
canonical_value = displayed_value * scale + offset
displayed_value = (canonical_value - offset) / scale
~~~

Affine conversion is required for absolute temperature.

### 7.3 Temperature semantics

The model must distinguish:

- Absolute temperature.
- Temperature interval/difference.

Required arithmetic rules:

| Operation | Result |
|---|---|
| Absolute temperature + interval | Absolute temperature |
| Absolute temperature − interval | Absolute temperature |
| Absolute temperature − absolute temperature | Temperature interval |
| Interval + interval | Temperature interval |
| Absolute temperature + absolute temperature | Error |
| Multiplication/division of absolute temperature | Error unless a separately defined operation explicitly permits it |

Support kelvin, degrees Celsius, and degrees Fahrenheit. Conversion constants must be exact where defined. Do not treat Celsius/Fahrenheit as ordinary multiplicative units.

### 7.4 Angle semantics

Radians are the coherent SI unit for angle and are dimensionless in the dimension vector. Degrees and other supported angular units convert to radians. Trigonometric functions must document their angle policy; Jabr's default should be radians, with explicit degree conversion available.

## 8. Arithmetic and validation rules

| Operation | Rule |
|---|---|
| Addition/subtraction | Compatible dimensions and compatible quantity kinds |
| Multiplication | Multiply dimensions and scales |
| Division | Divide dimensions and scales; reject division by zero |
| Power | Multiply dimension exponents by the power |
| Root | Resulting exponents must be representable |
| Comparison | Compatible dimensions and quantity kinds |
| Conversion | Same physical dimension and compatible semantic kind |
| Trigonometric functions | Dimensionless/angle input under documented angle semantics |
| Logarithms/exponentials | Dimensionless input |

Examples:

~~~text
5 m + 3 m       valid -> 8 m
10 m / 2 s      valid -> 5 m/s
5 m + 3 kg      invalid -> dimensional mismatch
100 kN/2000 mm² valid -> 50 MPa
~~~

The evaluator must return structured diagnostics with stable Math-owned codes and source spans. It must never silently discard units to make an expression evaluate.

## 9. Display and formatting

- Preserve the authored expression and its unit spelling.
- Preserve a preferred display unit separately from the canonical physical value.
- Allow a result to display in a compatible unit selected by the user or document.
- A display-unit change must not alter the source expression or physical result.
- Do not round stored values when formatting.
- Apply significant figures, decimal places, scientific notation, and unit spacing only in the formatter.
- Keep unit symbol formatting consistent: multiplication dots, superscripts, negative exponents, parentheses, and spacing.
- If a preferred unit is incompatible, show a diagnostic and retain the physical value; do not silently fall back to an unrelated unit.

## 10. Serialization and reproducibility

Define versioned Math-owned DTOs for:

- UnitDefinition references.
- UnitExpression.
- Dimension.
- Quantity.
- NumericValue.
- QuantityKind.
- Display-unit preference.

Requirements:

- Stable unit IDs; symbols and aliases may change only through a documented compatibility migration.
- Exact integers/rationals/decimals serialize as tagged strings or numerator/denominator structures, never as JSON floating-point values.
- Approximate values serialize with an explicit approximate tag and documented numeric representation.
- The registry version is recorded when a serialized document depends on registry-defined units.
- Unknown unit IDs or unsupported registry versions produce explicit diagnostics.
- Native and WASM adapters produce equivalent normalized results.
- Display formatting must not be the only persisted representation of a quantity.

## 11. Rust-library evaluation policy

Jabr must own its runtime unit and quantity contract. A compile-time unit crate alone is insufficient for dynamic worksheet source.

Evaluate \`uom\` as the first candidate for dimensional-algebra reference and possible internal reuse. Compare it with a small Jabr-owned runtime prototype. Do not adopt a dependency until the proof of concept demonstrates:

1. Runtime unit-expression support or a clean adapter path.
2. Non-SI and compound-unit coverage.
3. Compatibility with exact rational/decimal values.
4. Affine temperature behavior.
5. WASM compatibility and acceptable binary/compile-time cost.
6. Stable serialization and no leakage of third-party types into the Jabr public API.

The decision record must state whether the library is adopted, used only as a reference/test oracle, or rejected. The public Jabr Math API remains independent of that decision.

## 12. Implementation phases and gates

| Phase | Deliverable | Exit criteria |
|---|---|---|
| U0 | Numeric and dimension foundation | Exact/approximate model, dimension algebra, serialization tests |
| U1 | SI base units | Seven dimensions and base-unit tests |
| U2 | Derived units and prefixes | Named derived units and complete prefix resolution |
| U3 | Runtime compound-unit parser | Grammar, normalization, invalid-token diagnostics |
| U4 | Non-SI registry | Metric conventional, US customary, Imperial and engineering fixtures |
| U5 | Quantity arithmetic | Dimensional rules and operation tests |
| U6 | Conversion and formatting | Linear conversion, display preferences and precision behavior |
| U7 | Affine temperature and angle semantics | Absolute/differential temperature and angular tests |
| U8 | Custom units (deferred) | User-defined registry extensions with namespace and persistence rules |

### U0 acceptance gate

- Dimension vector algebra is tested independently of the parser.
- Exact rational and decimal factors round-trip without loss.
- Approximate values remain explicitly tagged.
- Quantity and UnitExpression DTOs have versioned serialization tests.
- No dependency on Kernel implementation or UI.

### End-to-end engineering fixture

~~~text
L = 6000 mm
b = 300 mm
h = 600 mm
A = b*h
I = b*h^3/12
E = 200 GPa
w = 25 kN/m
~~~

The fixture must verify values, dimensions, conversion, preferred display units, and deterministic serialization.

## 13. Required test matrix

At minimum:

| Input/conversion | Expected behavior |
|---|---|
| 1 m → mm | 1000 mm |
| 1 in → mm | 25.4 mm |
| 1 ft → in | 12 in |
| 1 MPa → kPa | 1000 kPa |
| 1 bar → Pa | 100000 Pa |
| 1 lbf → N | Exact defined conversion |
| 1 kip → kN | Exact defined conversion |
| N/mm² → MPa | Equivalent dimensions and scale |
| kN/m × m | Force |
| kN × m | Moment/energy dimension; semantic role retained where available |
| m/s × s | Length |
| m + kg | Dimensional error |
| °C ↔ °F | Correct affine conversion |
| absolute °C − absolute °C | Temperature interval |
| absolute °C + absolute °C | Error |
| degree → radian | Correct angular conversion |
| mm^4 → m^4 | Correct fourth-power scale |
| unknown unit symbol | Source-spanned diagnostic |
| ambiguous US/Imperial unit | Explicit variant required |

Add property-based tests for conversion round trips, compound-unit normalization, dimensional identities, and serialization reproducibility.

## 14. Explicit non-goals for the first unit-system milestone

- User-defined units and arbitrary user registries (U8).
- Automatic guessing of unknown unit symbols.
- Locale-dependent reinterpretation of unit symbols.
- Treating every dimensionally equal quantity as semantically interchangeable.
- Forcing all values into f64.
- Using report HTML as the source of structured values.
- Moving units or quantities into Kernel.
