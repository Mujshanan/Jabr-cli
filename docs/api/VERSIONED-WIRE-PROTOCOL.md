# Jabr Math Versioned Wire Protocol — v1

**Status:** Proposed wire contract for review. The current Rust facade and legacy Calcpad WASM convert API do not yet implement this protocol. Neither current API is the v1 wire format.

## 1. One contract for native and WASM

Native and WASM expose the same Jabr-owned request/response DTOs and the same JSON encoding. Target-specific wrappers may differ in initialization and panic containment only. They must not define different field names, numeric encodings, diagnostic shapes, or version rules.

The outer response is Kernel Envelope<T> with ENVELOPE_SCHEMA_VERSION = 1. The payload is Math-owned. Enable the Kernel crate's serde feature. Do not create a second Math envelope or copy Kernel's schema-version logic.

The current legacy WASM convert response (html, errors, files and optional export fields) remains a separate compatibility API until the UI migrates. Do not silently change the legacy response shape.

## 2. Request

The request JSON has this shape:

    {
      "schema_version": 1,
      "request": {
        "operation": "evaluate_blocks",
        "request_id": "req-000042",
        "document_id": "doc-001",
        "source_revision": "18446744073709551614",
        "blocks": [
          {
            "block_id": 42,
            "source": "L = 6 m\nA = 2 m^2\nq = 12 kN/m"
          }
        ],
        "inputs": []
      }
    }

- schema_version is the request schema version and currently equals 1.
- request_id and document_id are opaque correlation strings.
- source_revision is a decimal string representing the full unsigned 64-bit range. Never encode it as a JSON number.
- block_id is a Kernel NodeId, serialized as a nonzero safe JSON integer no greater than 2^53 - 1.
- Blocks are supplied in worksheet visual reading order. Math preserves request order in its response; Engine owns worksheet layout and ordering semantics.
- inputs is an explicit read-only Math value environment supplied by Engine. It is not persistent state owned by Math.

The request schema is separately versioned from the response. In v1, request validation failures use the same response envelope with result: null and structured diagnostics.

## 3. Response

The response JSON has this shape:

    {
      "schema_version": 1,
      "result": {
        "payload_schema_version": 1,
        "operation": "evaluate_blocks",
        "request_id": "req-000042",
        "document_id": "doc-001",
        "source_revision": "18446744073709551614",
        "blocks": [
          {
            "block_id": 42,
            "status": "completed",
            "value": {
              "kind": "real",
              "number": { "kind": "finite", "encoding": "f64", "value": "6.0" },
              "unit": {
                "symbol": "m",
                "dimensions": [0, 1, 0, 0, 0, 0, 0, 0, 0],
                "scale_to_base": "1"
              }
            },
            "definitions": [],
            "reads": [],
            "diagnostics": []
          }
        ]
      },
      "diagnostics": []
    }

The response's outer schema_version belongs to Kernel's envelope. payload_schema_version belongs to Math's payload. They are separate compatibility boundaries. A response must echo all request correlation fields exactly.

The example values illustrate field structure; actual block values, definitions, reads, and diagnostics come from Math evaluation.

## 4. Diagnostic shape

Use Kernel Diagnostic and Severity directly. A diagnostic is represented as:

    {
      "code": "math.parse.invalid",
      "severity": "error",
      "message": "Expected an expression",
      "span": { "start": 12, "end": 13 }
    }

- Codes are stable and namespaced by the emitting owner.
- Consumers do not parse the human-readable message.
- span is optional and uses UTF-8 byte offsets into the exact source block text.
- If the vendored parser cannot provide an exact byte range, serialize span: null; never infer a byte offset from a line number.
- The current Kernel Diagnostic type has no separate line/output-line fields. Preserve legacy line-only metadata internally until a precise span exists; do not create a competing public diagnostic DTO.

## 5. Numeric and value encoding

Follow STRUCTURED-BLOCK-RESULTS.md:

- finite binary64 values are shortest-round-trip decimal strings tagged as f64;
- NaN and positive/negative infinity use explicit tags;
- complex values preserve both components;
- units carry symbol, normalized dimension powers, and conversion scale;
- vectors/matrices carry explicit shape and ordered typed elements;
- errors use Kernel diagnostics;
- HTML is never a typed value and is not part of the v1 calculation payload.

All number strings must be locale-independent, use . as the decimal separator, and have no grouping separators. Do not rely on JSON floating-point parsing to preserve non-finite or exact binary64 values.

## 6. Version rules

- Kernel envelope schema_version 1 is accepted; unsupported versions are rejected.
- Math payload payload_schema_version 1 is accepted; unsupported versions are rejected by Math.
- Unknown value kind tags are rejected as unsupported values, not interpreted as strings.
- Additive optional fields may be introduced only when old readers can safely ignore them and the contract tests prove that behavior.
- Removing/renaming fields, changing numeric encoding, changing symbol identity semantics, or changing the meaning of an existing variant requires a new payload major version.
- Keep the Kernel envelope version independent from Math payload version and Math engine implementation version.

## 7. Shared golden fixtures

Store protocol fixtures once under tests/fixtures/wire-v1/. Native tests and WASM tests consume the exact same files; do not duplicate fixture JSON under target-specific directories.

Minimum fixture set:

| Fixture | Expected behavior |
| --- | --- |
| success-real-unit.json | Valid envelope, real quantity, unit dimensions and scale |
| success-complex.json | Both complex components preserved |
| success-vector-matrix.json | Shape and element ordering preserved |
| diagnostic-span.json | Stable Math code, severity, UTF-8 byte span |
| diagnostic-no-span.json | Line-only legacy diagnostic does not invent offsets |
| large-source-revision.json | Full u64 decimal string round-trips exactly |
| non-finite-values.json | NaN and infinities retain tagged forms |
| unsupported-envelope-version.json | Kernel rejects schema version other than 1 |
| unsupported-payload-version.json | Math rejects unsupported payload schema |
| invalid-node-id.json | Zero and IDs above JavaScript-safe maximum are rejected |

For each valid fixture:
1. Deserialize and validate the same bytes in native Rust.
2. Run the WASM adapter against the same bytes and compare the canonical JSON response.
3. Compare semantic JSON values (object key order is not significant); arrays remain order-sensitive.
4. Assert exact request/document/revision echo.
5. Assert no target-specific fields or error shapes appear.

For invalid fixtures, both targets must reject with the same stable error code/category. Do not compare panic strings or platform-specific stack traces.

## 8. Adapter contract

The native and WASM adapters call the same Jabr Math facade functions. The WASM adapter must not implement a second parser, serializer, or value conversion path.

Suggested API shape:

- Rust: evaluate_blocks(request: EvaluateBlocksRequest) -> Envelope<EvaluateBlocksResult>.
- WASM: evaluate_blocks_json(request_json: &str) -> String, parsing the request DTO and serializing the exact same response DTO.
- Any validation failure is represented as an envelope failure with Kernel diagnostics, not a thrown string error.
- Panics are contained at the WASM boundary and mapped to a stable math.internal.panic diagnostic; panic details are not exposed to the browser.

## 9. Compatibility with current APIs

The current Rust facade returns EvaluateResponse with HTML and MathDiagnostic; it is not v1. The current WASM convert method implements the older CalcpadCE HTML conversion protocol. Both remain unchanged until the v1 adapter is implemented and the consuming UI migrates.

The v1 rollout is additive:
1. Add Kernel dependency pinned to the released Kernel 0.1 commit with serde enabled.
2. Add the Math DTOs and shared fixture-driven native tests.
3. Add the WASM JSON adapter using the same DTOs and fixtures.
4. Verify native/WASM parity in CI.
5. Migrate clients to v1; retain legacy convert API during the transition.
