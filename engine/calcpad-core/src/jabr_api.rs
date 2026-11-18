//! Stable Jabr-owned facade over the vendored Calcpad worksheet engine.
//!
//! This layer intentionally exposes no Calcpad parser, AST, VarRef or WASM types.
//! Shared diagnostics and operation envelopes come from Jabr Kernel 0.1.

use crate::parsers::expression_parser::ExpressionParser;
use jabr_kernel::{Diagnostic, Envelope, Severity};

/// Version and identity information for the Jabr Math facade.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct EngineInfo {
    /// Public facade API version.
    pub api_version: u32,
    /// Version of the vendored engine crate.
    pub engine_version: &'static str,
}

impl Default for EngineInfo {
    fn default() -> Self {
        Self {
            api_version: 1,
            engine_version: env!("CARGO_PKG_VERSION"),
        }
    }
}

/// A source-evaluation request.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct EvaluateRequest {
    /// Stable document identifier supplied by the caller.
    pub document_id: String,
    /// Caller-generated request identifier.
    pub request_id: String,
    /// Source revision evaluated by this request. This is correlation metadata,
    /// not a Kernel revision or persistent worksheet-state version.
    pub source_revision: u64,
    /// Authored worksheet source.
    pub source: String,
}

/// Outcome of a worksheet source evaluation.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum EvaluationOutcome {
    /// Evaluation completed without diagnostics.
    Completed,
    /// Evaluation completed and produced one or more diagnostics.
    CompletedWithDiagnostics,
}

/// Result returned by the current source-evaluation facade.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct EvaluateResponse {
    /// Document identifier echoed from the request.
    pub document_id: String,
    /// Request identifier echoed from the request.
    pub request_id: String,
    /// Source revision echoed from the request.
    pub source_revision: u64,
    /// Evaluation outcome.
    pub outcome: EvaluationOutcome,
    /// Calcpad report HTML. This is report output, not a structured value API.
    pub html: String,
}

/// Evaluate a worksheet using an isolated parser instance.
///
/// The source revision is echoed, never mutated. Persistence, worksheet state
/// transitions and assignment commits belong to Jabr Engine. The outer Kernel
/// envelope carries the shared diagnostic representation.
pub fn evaluate(request: EvaluateRequest) -> Envelope<EvaluateResponse> {
    let mut parser = ExpressionParser::new();
    parser.debug = true;
    parser.capture_values = true;
    parser.parse(&request.source, true);

    let diagnostics = parser
        .errors_list
        .iter()
        .map(|error| {
            // The current Calcpad error model supplies line numbers but not an
            // exact UTF-8 source byte range. Do not fabricate a Kernel Span.
            let message = format!(
                "{} (source line {}, output line {})",
                error.message, error.source_line, error.output_line
            );
            Diagnostic::new("math.calcpad.error", Severity::Error, message)
        })
        .collect::<Vec<_>>();

    let outcome = if diagnostics.is_empty() {
        EvaluationOutcome::Completed
    } else {
        EvaluationOutcome::CompletedWithDiagnostics
    };

    let response = EvaluateResponse {
        document_id: request.document_id,
        request_id: request.request_id,
        source_revision: request.source_revision,
        outcome,
        html: parser.html_result,
    };

    diagnostics
        .into_iter()
        .fold(Envelope::success(response), |envelope, diagnostic| {
            envelope.with_diagnostic(diagnostic)
        })
}
