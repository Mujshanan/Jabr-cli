//! Parse-only AST inspection built from Calcpad's actual RPN parser output.
//!
//! This deliberately does not call the evaluator/compiler's constant-folding path.
//! RPN is produced by MathParser::parse after the authoritative Calcpad tokenizer,
//! syntax analyser, operator ordering, and shunting-yard conversion have run.

use std::cell::RefCell;
use std::rc::Rc;

use serde_json::Value;

use crate::ast::{
    AstDiagnostic, AstInspection, AstNode, AstNodeOrigin, DocumentNodeKind, SourceSpan,
};
use crate::calculator::NEG_STR;
use crate::parsers::math_parser::tokens::{Rpn, TokenKind, TokenRef, TokenTypes};
use crate::parsers::math_parser::MathParser;
use crate::settings::MathSettings;
use crate::source_span::{SourceOrigin, SourceSpan as InternalSourceSpan};

/// Inspect one mathematical expression without evaluating it.
///
/// The supplied string is the source-coordinate authority for every returned span.
/// Worksheet-level directives and multi-line block assembly are intentionally handled
/// by a later block-analysis layer.
pub fn inspect_expression(source: &str) -> AstInspection {
    let parser = MathParser::new(Rc::new(RefCell::new(MathSettings::default())));
    match parser.parse(source, true) {
        Err(error) => AstInspection {
            source: source.to_string(),
            document_node: DocumentNodeKind::Math,
            ast: None,
            diagnostics: vec![AstDiagnostic {
                code: error.code.map(str::to_string),
                message: error.message,
                span: error.source_span.and_then(|span| public_span(source, span)),
            }],
            is_partial: false,
        },
        Ok(()) => {
            let rpn = parser.rpn.borrow().clone();
            match rpn {
                Some(rpn) if !rpn.is_empty() => match lower_rpn(&parser, &rpn, source) {
                    Ok(ast) => AstInspection {
                        source: source.to_string(),
                        document_node: DocumentNodeKind::Math,
                        ast: Some(ast),
                        diagnostics: Vec::new(),
                        is_partial: false,
                    },
                    Err(message) => AstInspection {
                        source: source.to_string(),
                        document_node: DocumentNodeKind::Math,
                        ast: None,
                        diagnostics: vec![AstDiagnostic { code: Some("AST_LOWERING_FAILED".into()), message, span: None }],
                        is_partial: false,
                    },
                },
                Some(_) => AstInspection {
                    source: source.to_string(),
                    document_node: DocumentNodeKind::Math,
                    ast: None,
                    diagnostics: vec![AstDiagnostic {
                        code: Some("EMPTY_EXPRESSION".into()),
                        message: "The parser produced no expression nodes.".into(),
                        span: None,
                    }],
                    is_partial: false,
                },
                None => AstInspection {
                    source: source.to_string(),
                    document_node: DocumentNodeKind::Math,
                    ast: None,
                    diagnostics: vec![AstDiagnostic {
                        code: Some("NON_EXPRESSION_PARSE".into()),
                        message: "The parser accepted a function definition, but it does not produce a single expression RPN tree.".into(),
                        span: None,
                    }],
                    is_partial: false,
                },
            }
        }
    }
}

fn lower_rpn(parser: &MathParser, rpn: &Rpn, source: &str) -> Result<AstNode, String> {
    let line_starts = source_line_starts(source);
    let mut stack: Vec<AstNode> = Vec::with_capacity(rpn.len());
    let mut next_id = 0usize;

    for token_ref in rpn.iter() {
        let (ttype, content, index, kind, origin, parameter_count, is_function_token, argument_count) = {
            let token = token_ref.borrow();
            (
                token.ttype,
                token.content.clone(),
                token.index,
                token.kind.clone(),
                token.source_origin.clone(),
                token.parameter_count(),
                token.is_function_token(),
                token.argument_map().map(|map| map.len()),
            )
        };

        let mut node = match ttype {
            TokenTypes::Constant => {
                let mut node = new_node(&mut next_id, "number", origin, source, &line_starts);
                node.attributes.insert("literal".into(), Value::String(content.clone()));
                node
            }
            TokenTypes::Variable => {
                let mut node = new_node(&mut next_id, "variable", origin, source, &line_starts);
                node.attributes.insert("name".into(), Value::String(content.clone()));
                node
            }
            TokenTypes::Unit => {
                let mut node = new_node(&mut next_id, "unit", origin, source, &line_starts);
                node.attributes.insert("unitText".into(), Value::String(content.clone()));
                node
            }
            TokenTypes::Input => {
                let mut node = new_node(&mut next_id, "input", origin, source, &line_starts);
                node.attributes.insert("inputText".into(), Value::String(content.clone()));
                node
            }
            TokenTypes::Solver => {
                let mut node = new_node(&mut next_id, "solver_block", origin, source, &line_starts);
                node.attributes.insert("solverIndex".into(), Value::from(index));
                node
            }
            TokenTypes::Vector | TokenTypes::RowDivisor
                if matches!(&kind, TokenKind::Vector(_)) =>
            {
                let count = index.max(0) as usize;
                let children = pop_children(&mut stack, count)?;
                let mut node = new_node(
                    &mut next_id,
                    if ttype == TokenTypes::RowDivisor { "vector_row" } else { "vector_literal" },
                    origin,
                    source,
                    &line_starts,
                );
                node.children = children;
                node
            }
            TokenTypes::Matrix if matches!(&kind, TokenKind::Matrix(_)) => {
                let count = (index / crate::vector::MAX_LENGTH) as usize;
                let children = pop_children(&mut stack, count)?;
                let mut node = new_node(&mut next_id, "matrix_literal", origin, source, &line_starts);
                node.children = children;
                node
            }
            TokenTypes::Vector | TokenTypes::Matrix | TokenTypes::Array => {
                let mut node = new_node(&mut next_id, "variable", origin, source, &line_starts);
                node.attributes.insert("name".into(), Value::String(content.clone()));
                node.attributes.insert("valueCategory".into(), Value::String(format!("{:?}", ttype)));
                node
            }
            TokenTypes::Operator => {
                let arity = if content == NEG_STR { 1 } else { 2 };
                let children = pop_children(&mut stack, arity)?;
                let (kind, operator) = if content == NEG_STR {
                    ("unary_expression", "negate")
                } else if content == "=" || content == "\u{2190}" {
                    ("assignment", "assign")
                } else {
                    ("binary_expression", operator_name(&content))
                };
                let mut node = new_node(&mut next_id, kind, origin, source, &line_starts);
                node.attributes.insert("operator".into(), Value::String(operator.into()));
                node.attributes.insert("operatorText".into(), Value::String(content.clone()));
                node.children = children;
                if kind == "assignment" {
                    if let Some(target) = node.children.first_mut() {
                        target.attributes.insert("role".into(), Value::String("assignment_target".into()));
                    }
                }
                node
            }
            TokenTypes::VectorIndex => {
                let children = pop_children(&mut stack, 2)?;
                let mut node = new_node(&mut next_id, "vector_index", origin, source, &line_starts);
                node.children = children;
                node
            }
            TokenTypes::MatrixIndex => {
                let children = pop_children(&mut stack, 3)?;
                let mut node = new_node(&mut next_id, "matrix_index", origin, source, &line_starts);
                node.children = children;
                node
            }
            TokenTypes::Function
            | TokenTypes::Function2
            | TokenTypes::Function3
            | TokenTypes::MultiFunction
            | TokenTypes::Interpolation
            | TokenTypes::VectorFunction
            | TokenTypes::VectorFunction2
            | TokenTypes::VectorFunction3
            | TokenTypes::VectorMultiFunction
            | TokenTypes::MatrixFunction
            | TokenTypes::MatrixFunction2
            | TokenTypes::MatrixFunction3
            | TokenTypes::MatrixFunction4
            | TokenTypes::MatrixFunction5
            | TokenTypes::MatrixIterativeFunction
            | TokenTypes::MatrixOptionalFunction
            | TokenTypes::MatrixMultiFunction
            | TokenTypes::CustomFunction => {
                let arity = function_arity(
                    parser,
                    ttype,
                    index,
                    parameter_count,
                    is_function_token,
                    argument_count,
                ).ok_or_else(|| format!("The parser emitted a function token with unknown arity: {content}"))?;
                let children = pop_children(&mut stack, arity)?;
                let mut node = new_node(&mut next_id, "function_call", origin, source, &line_starts);
                node.attributes.insert("functionName".into(), Value::String(content.clone()));
                node.attributes.insert("functionCategory".into(), Value::String(format!("{:?}", ttype)));
                node.attributes.insert("functionIndex".into(), Value::from(index));
                node.children = children;
                node
            }
            other => return Err(format!("AST inspection does not yet support parser token type {:?}.", other)),
        };

        node.attributes.insert("parserTokenType".into(), Value::String(format!("{:?}", ttype)));
        if !content.is_empty() {
            node.attributes.entry("parserTokenText".into()).or_insert(Value::String(content));
        }
        stack.push(node);
    }

    if stack.len() != 1 {
        return Err(format!("The parser produced {} AST roots; exactly one was expected.", stack.len()));
    }
    Ok(stack.pop().expect("one AST root was checked"))
}

fn function_arity(
    parser: &MathParser,
    ttype: TokenTypes,
    index: i64,
    parameter_count: i32,
    is_function_token: bool,
    argument_count: Option<usize>,
) -> Option<usize> {
    use TokenTypes::*;
    match ttype {
        Function | VectorFunction | MatrixFunction | MatrixOptionalFunction => Some(1),
        Function2 | VectorFunction2 | MatrixFunction2 | MatrixIterativeFunction => Some(2),
        Function3 | VectorFunction3 | MatrixFunction3 => Some(3),
        MatrixFunction4 => Some(4),
        MatrixFunction5 => Some(5),
        MultiFunction | Interpolation | VectorMultiFunction | MatrixMultiFunction => {
            Some(parameter_count.max(0) as usize)
        }
        CustomFunction if is_function_token => Some(parameter_count.max(0) as usize),
        CustomFunction => argument_count.or_else(|| {
            parser.functions.borrow().get(index).map(|function| function.parameter_count())
        }),
        _ => None,
    }
}

fn pop_children(stack: &mut Vec<AstNode>, count: usize) -> Result<Vec<AstNode>, String> {
    if stack.len() < count {
        return Err(format!(
            "The parser RPN stack underflowed: needed {} operands but had {}.",
            count,
            stack.len()
        ));
    }
    Ok(stack.split_off(stack.len() - count))
}

fn new_node(
    next_id: &mut usize,
    kind: &str,
    origin: Option<SourceOrigin>,
    source: &str,
    line_starts: &[usize],
) -> AstNode {
    let id = format!("n{}", *next_id);
    *next_id += 1;
    let mut node = AstNode::new(id, kind);
    if let Some(origin) = origin {
        let public_origin = public_origin(source, &origin, line_starts);
        node.span = origin.primary_span().and_then(|span| public_span_with_lines(source, span, line_starts));
        node.origin = public_origin;
    }
    node
}

fn public_origin(
    source: &str,
    origin: &SourceOrigin,
    line_starts: &[usize],
) -> Option<AstNodeOrigin> {
    match origin {
        SourceOrigin::Source(span) => public_span_with_lines(source, *span, line_starts)
            .map(AstNodeOrigin::Source),
        SourceOrigin::Derived(spans) => {
            if spans.is_empty() {
                return None;
            }
            let mapped = spans.iter()
                .map(|span| public_span_with_lines(source, *span, line_starts))
                .collect::<Option<Vec<_>>>()?;
            Some(AstNodeOrigin::Derived(mapped))
        }
        SourceOrigin::Synthetic { anchor_byte } => {
            if *anchor_byte <= source.len() && source.is_char_boundary(*anchor_byte) {
                Some(AstNodeOrigin::Synthetic { anchor_byte: *anchor_byte })
            } else {
                None
            }
        }
    }
}

fn public_span(
    source: &str,
    span: InternalSourceSpan,
) -> Option<SourceSpan> {
    public_span_with_lines(source, span, &source_line_starts(source))
}

fn public_span_with_lines(
    source: &str,
    span: InternalSourceSpan,
    line_starts: &[usize],
) -> Option<SourceSpan> {
    if span.start_byte > span.end_byte
        || span.end_byte > source.len()
        || !source.is_char_boundary(span.start_byte)
        || !source.is_char_boundary(span.end_byte)
    {
        return None;
    }
    let (start_line, start_column_byte) = line_column(line_starts, span.start_byte);
    let (end_line, end_column_byte) = line_column(line_starts, span.end_byte);
    Some(SourceSpan {
        start_byte: span.start_byte,
        end_byte: span.end_byte,
        start_line,
        start_column_byte,
        end_line,
        end_column_byte,
    })
}

fn source_line_starts(source: &str) -> Vec<usize> {
    let mut starts = vec![0];
    for (index, byte) in source.bytes().enumerate() {
        if byte == b'\n' {
            starts.push(index + 1);
        }
    }
    starts
}

fn line_column(line_starts: &[usize], byte: usize) -> (usize, usize) {
    let line = line_starts.partition_point(|start| *start <= byte).saturating_sub(1);
    (line, byte - line_starts[line])
}

fn operator_name(content: &str) -> &'static str {
    match content {
        "+" => "add",
        "-" => "subtract",
        "*" => "multiply",
        "/" | "\u{00F7}" => "divide",
        "%" | "\u{29BC}" => "remainder",
        "<" => "less_than",
        ">" => "greater_than",
        "\u{2264}" => "less_than_or_equal",
        "\u{2265}" => "greater_than_or_equal",
        "\u{2261}" => "equal",
        "\u{2260}" => "not_equal",
        "\u{2227}" => "and",
        "\u{2228}" => "or",
        "\u{2295}" => "xor",
        "^" => "power",
        "=" | "\u{2190}" => "assign",
        _ => "operator",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn find_node<'a>(node: &'a AstNode, kind: &str) -> Option<&'a AstNode> {
        if node.kind == kind {
            return Some(node);
        }
        node.children.iter().find_map(|child| find_node(child, kind))
    }

    #[test]
    fn preserves_operator_tree_instead_of_constant_folding() {
        let result = inspect_expression("2 + 3 * 4");
        let root = result.ast.expect("AST");
        assert_eq!(root.kind, "binary_expression");
        assert_eq!(root.attributes["operator"], "add");
        assert_eq!(root.children.len(), 2);
        assert_eq!(root.children[0].kind, "number");
        assert_eq!(root.children[1].kind, "binary_expression");
        assert_eq!(root.children[1].attributes["operator"], "multiply");
    }

    #[test]
    fn exposes_assignment_target_and_rhs_reference_separately() {
        let result = inspect_expression("x = x + 1");
        let root = result.ast.expect("AST");
        assert_eq!(root.kind, "assignment");
        assert_eq!(root.children[0].attributes["role"], "assignment_target");
        assert_eq!(root.children[0].attributes["name"], "x");
        assert_eq!(root.children[1].kind, "binary_expression");
        assert_eq!(root.children[1].children[0].attributes["name"], "x");
    }

    #[test]
    fn carries_utf8_byte_spans_from_parser_tokens() {
        let source = "α + 2";
        let result = inspect_expression(source);
        let root = result.ast.expect("AST");
        let first = &root.children[0];
        let span = first.span.as_ref().expect("token span");
        assert_eq!(source.get(span.start_byte..span.end_byte), Some("α"));
        assert_eq!((span.start_byte, span.end_byte), (0, 2));
        assert_eq!((span.start_line, span.start_column_byte), (0, 0));
    }

    #[test]
    fn parser_errors_are_returned_as_structured_diagnostics() {
        let result = inspect_expression("2 + @");
        assert!(result.ast.is_none());
        assert_eq!(result.diagnostics.len(), 1);
        assert!(result.diagnostics[0].span.is_some());
    }

    #[test]
    fn function_calls_retain_name_and_argument_order() {
        let result = inspect_expression("sin(2)");
        let root = result.ast.expect("AST");
        assert_eq!(root.kind, "function_call");
        assert_eq!(root.attributes["functionName"], "sin");
        assert_eq!(root.children.len(), 1);
        assert_eq!(root.children[0].attributes["literal"], "2");
    }
}
