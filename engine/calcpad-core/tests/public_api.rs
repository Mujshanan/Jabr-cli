use calcpad_core::{
    evaluate, Diagnostic, EngineInfo, Envelope, EvaluateRequest, EvaluateResponse,
    EvaluationOutcome, Severity,
};

// This integration test compiles against only the crate's public facade. It is deliberately
// unable to name internal Calcpad parser/AST/value implementation types.
#[test]
fn public_api_uses_kernel_envelope_and_diagnostics() {
    let info = EngineInfo::default();
    assert_eq!(info.api_version, 1);

    let request = EvaluateRequest {
        document_id: "doc-1".into(),
        request_id: "req-1".into(),
        source_revision: 42,
        source: "2 + 2".into(),
    };
    let response: Envelope<EvaluateResponse> = evaluate(request);

    let result = response.result.expect("evaluation result should be present");
    assert_eq!(result.document_id, "doc-1");
    assert_eq!(result.request_id, "req-1");
    assert_eq!(result.source_revision, 42);
    assert!(matches!(
        result.outcome,
        EvaluationOutcome::Completed | EvaluationOutcome::CompletedWithDiagnostics
    ));

    let _: Vec<Diagnostic> = response.diagnostics;
}

#[test]
fn invalid_source_uses_kernel_diagnostic_shape() {
    let response = evaluate(EvaluateRequest {
        document_id: "doc-1".into(),
        request_id: "req-invalid".into(),
        source_revision: 43,
        source: "2 + * 3".into(),
    });

    assert!(!response.diagnostics.is_empty());
    let diagnostic = &response.diagnostics[0];
    assert_eq!(diagnostic.code, "math.calcpad.error");
    assert_eq!(diagnostic.severity, Severity::Error);
    // The current parser reports line numbers, not exact UTF-8 byte spans.
    assert!(diagnostic.span.is_none());
    assert!(diagnostic.message.contains("source line"));
}
