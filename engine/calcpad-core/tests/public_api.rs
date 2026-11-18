use calcpad_core::{evaluate, MathDiagnostic, EngineInfo, EvaluateRequest, EvaluateResponse, EvaluationOutcome};

// This integration test compiles against only the crate's public facade. It is deliberately
// unable to name internal Calcpad parser/AST/value implementation types.
#[test]
fn public_api_is_constructible_and_revision_preserving() {
    let info = EngineInfo::default();
    assert_eq!(info.api_version, 1);
    let request = EvaluateRequest { document_id:"doc-1".into(), request_id:"req-1".into(), source_revision:42, source:"2 + 2".into() };
    let response: EvaluateResponse = evaluate(request);
    assert_eq!(response.document_id, "doc-1");
    assert_eq!(response.request_id, "req-1");
    assert_eq!(response.source_revision, 42);
    assert!(matches!(response.outcome, EvaluationOutcome::Completed | EvaluationOutcome::CompletedWithMathDiagnostics));
    let _: Vec<MathDiagnostic> = response.diagnostics;
}
