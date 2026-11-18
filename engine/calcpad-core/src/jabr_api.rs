//! Stable Jabr-owned facade over the vendored Calcpad worksheet engine.
//!
//! This layer intentionally exposes no Calcpad parser, AST, VarRef or WASM types.

use crate::parsers::expression_parser::ExpressionParser;

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
    /// Source revision evaluated by this request.
    pub source_revision: u64,
    /// Authored worksheet source.
    pub source: String,
}

/// A diagnostic emitted by the current Calcpad-backed Math facade.
///
/// This line-oriented representation is provisional and must be mapped to the
/// normalized cross-engine diagnostic DTO at the Engine/UI adapter boundary.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MathDiagnostic {
    /// Source line reported by the Calcpad parser.
    pub source_line: i32,
    /// Output line associated with the diagnostic.
    pub output_line: i32,
    /// Human-readable message.
    pub message: String,
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
    /// Diagnostics emitted by the Calcpad parser.
    pub diagnostics: Vec<MathDiagnostic>,
}

/// Evaluate a worksheet using an isolated parser instance.
///
/// The source revision is echoed, never mutated. Persistence, worksheet state
/// transitions and assignment commits belong to Jabr-engine.
pub fn evaluate(request: EvaluateRequest) -> EvaluateResponse {
    let mut parser = ExpressionParser::new();
    parser.debug = true;
    parser.capture_values = true;
    parser.parse(&request.source, true);

    let diagnostics = parser
        .errors_list
        .iter()
        .map(|error| MathDiagnostic {
            source_line: error.source_line,
            output_line: error.output_line,
            message: error.message.clone(),
        })
        .collect::<Vec<_>>();

    let outcome = if diagnostics.is_empty() {
        EvaluationOutcome::Completed
    } else {
        EvaluationOutcome::CompletedWithDiagnostics
    };

    EvaluateResponse {
        document_id: request.document_id,
        request_id: request.request_id,
        source_revision: request.source_revision,
        outcome,
        html: parser.html_result,
        diagnostics,
    }
}
