# Python engine checks

These tests exercise the **native CivilKit CLI** as a black-box system under test.
Python computes expected values independently and checks that those values appear
in the generated Calcpad HTML report.

## Run

From the repository root, build the native CLI first:

```bash
npm run engine:native
# or
bun run engine:native:bun
```

Then run:

```bash
python tests/python/run_civilkit_checks.py
```

No Python packages are required.

## Scope and limitations

- This is an initial smoke/regression harness, not yet a symbolic mathematics oracle.
- It currently checks scalar arithmetic, variable evaluation, operator precedence,
  and the existence of the Calcpad HTML report.
- It does not extract AST or LaTeX from HTML. Those need explicit engine-facing APIs.
- Future optional suites may use SymPy for symbolic comparisons and NumPy for
  numeric array/matrix comparisons. Their results must be treated as independent
  cross-checks, not as ground truth for every Calcpad feature.
