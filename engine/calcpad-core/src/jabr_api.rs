//! Stable Jabr-owned facade over the vendored Calcpad worksheet engine.
//! This layer intentionally exposes no Calcpad parser, AST, VarRef or WASM types.
use crate::parsers::expression_parser::ExpressionParser;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct EngineInfo { pub api_version: u32, pub engine_version: &'static str }
impl Default for EngineInfo { fn default()->Self { Self { api_version:1, engine_version:env!("CARGO_PKG_VERSION") } } }
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct EvaluateRequest { pub document_id:String, pub request_id:String, pub source_revision:u64, pub source:String }
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Diagnostic { pub source_line:i32, pub output_line:i32, pub message:String }
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum EvaluationOutcome { Completed, CompletedWithDiagnostics }
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct EvaluateResponse { pub document_id:String, pub request_id:String, pub source_revision:u64, pub outcome:EvaluationOutcome, pub html:String, pub diagnostics:Vec<Diagnostic> }

/// Evaluate a worksheet using an isolated parser instance. The revision is echoed, never
/// mutated: persistence and assignment commits belong to the Kernel adapter.
pub fn evaluate(request: EvaluateRequest) -> EvaluateResponse {
    let mut parser=ExpressionParser::new();
    parser.debug=true;
    parser.capture_values=true;
    parser.parse(&request.source,true);
    let diagnostics=parser.errors_list.iter().map(|e|Diagnostic{source_line:e.source_line,output_line:e.output_line,message:e.message.clone()}).collect::<Vec<_>>();
    let outcome=if diagnostics.is_empty(){EvaluationOutcome::Completed}else{EvaluationOutcome::CompletedWithDiagnostics};
    EvaluateResponse{document_id:request.document_id,request_id:request.request_id,source_revision:request.source_revision,outcome,html:parser.html_result,diagnostics}
}
