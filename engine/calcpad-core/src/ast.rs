//! Stable, Jabr-owned data-transfer types for parser inspection.
//!
//! These DTOs deliberately do not mirror private Calcpad compiler types. The
//! inspection adapter lowers the real Calcpad parser output into these types.
//! Tokenizer records and rendered HTML are never promoted to AST nodes.

use serde_json::{json, Map, Value};

pub const AST_SCHEMA_VERSION: u32 = 1;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DocumentNodeKind {
    Text,
    Code,
    Math,
}

impl DocumentNodeKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Text => "text",
            Self::Code => "code",
            Self::Math => "math",
        }
    }
}

/// Half-open UTF-8 byte range in the exact source string.
/// Line and column values are zero-based; columns are UTF-8 byte columns.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SourceSpan {
    pub start_byte: usize,
    pub end_byte: usize,
    pub start_line: usize,
    pub start_column_byte: usize,
    pub end_line: usize,
    pub end_column_byte: usize,
}

impl SourceSpan {
    pub fn to_json(&self) -> Value {
        json!({
            "startByte": self.start_byte,
            "endByte": self.end_byte,
            "startLine": self.start_line,
            "startColumnByte": self.start_column_byte,
            "endLine": self.end_line,
            "endColumnByte": self.end_column_byte
        })
    }
}

/// Exact provenance retained from the parser. A derived node can have
/// non-contiguous source fragments; `span` on AstNode is only their envelope.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum AstNodeOrigin {
    Source(SourceSpan),
    Derived(Vec<SourceSpan>),
    Synthetic { anchor_byte: usize },
}

impl AstNodeOrigin {
    pub fn to_json(&self) -> Value {
        match self {
            Self::Source(span) => json!({
                "kind": "source",
                "spans": [span.to_json()]
            }),
            Self::Derived(spans) => json!({
                "kind": "derived",
                "spans": spans.iter().map(SourceSpan::to_json).collect::<Vec<_>>()
            }),
            Self::Synthetic { anchor_byte } => json!({
                "kind": "synthetic",
                "anchorByte": anchor_byte
            }),
        }
    }
}

/// A normalized syntax node. Attributes contain kind-specific semantic data;
/// children preserve parser/compiler operand order. Evaluation results are not stored.
#[derive(Clone, Debug, PartialEq)]
pub struct AstNode {
    pub id: String,
    pub kind: String,
    /// Bounding span for navigation. Use `origin` for exact multi-fragment provenance.
    pub span: Option<SourceSpan>,
    pub origin: Option<AstNodeOrigin>,
    pub attributes: Map<String, Value>,
    pub children: Vec<AstNode>,
}

impl AstNode {
    pub fn new(id: impl Into<String>, kind: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            kind: kind.into(),
            span: None,
            origin: None,
            attributes: Map::new(),
            children: Vec::new(),
        }
    }

    pub fn with_span(mut self, span: SourceSpan) -> Self {
        self.span = Some(span.clone());
        self.origin = Some(AstNodeOrigin::Source(span));
        self
    }

    pub fn to_json(&self) -> Value {
        let mut node = Map::new();
        node.insert("id".into(), Value::String(self.id.clone()));
        node.insert("kind".into(), Value::String(self.kind.clone()));
        node.insert(
            "span".into(),
            self.span.as_ref().map(SourceSpan::to_json).unwrap_or(Value::Null),
        );
        node.insert(
            "origin".into(),
            self.origin.as_ref().map(AstNodeOrigin::to_json).unwrap_or(Value::Null),
        );
        node.insert("attributes".into(), Value::Object(self.attributes.clone()));
        node.insert(
            "children".into(),
            Value::Array(self.children.iter().map(AstNode::to_json).collect()),
        );
        Value::Object(node)
    }
}

/// Structured, parse-only diagnostic.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AstDiagnostic {
    pub code: Option<String>,
    pub message: String,
    pub span: Option<SourceSpan>,
}

impl AstDiagnostic {
    pub fn to_json(&self) -> Value {
        json!({
            "code": self.code,
            "message": self.message,
            "span": self.span.as_ref().map(SourceSpan::to_json)
        })
    }
}

/// Inspection is a parse-only result. It must not execute worksheet calculations.
#[derive(Clone, Debug, PartialEq)]
pub struct AstInspection {
    pub source: String,
    pub document_node: DocumentNodeKind,
    pub ast: Option<AstNode>,
    pub diagnostics: Vec<AstDiagnostic>,
    pub is_partial: bool,
}

impl AstInspection {
    pub fn to_json(&self) -> Value {
        json!({
            "schemaVersion": AST_SCHEMA_VERSION,
            "source": self.source,
            "sourceOffsetEncoding": "utf8-bytes",
            "sourceLineColumnBase": 0,
            "sourceColumnEncoding": "utf8-bytes",
            "documentNode": self.document_node.as_str(),
            "ast": self.ast.as_ref().map(AstNode::to_json),
            "diagnostics": self.diagnostics.iter().map(AstDiagnostic::to_json).collect::<Vec<_>>(),
            "isPartial": self.is_partial
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_a_versioned_math_ast_with_utf8_spans() {
        let span = SourceSpan {
            start_byte: 0,
            end_byte: 5,
            start_line: 0,
            start_column_byte: 0,
            end_line: 0,
            end_column_byte: 5,
        };
        let mut root = AstNode::new("n1", "binary_expression").with_span(span);
        root.attributes.insert("operator".into(), Value::String("add".into()));
        root.children.push(AstNode::new("n2", "number"));
        let result = AstInspection {
            source: "2 + 4".into(),
            document_node: DocumentNodeKind::Math,
            ast: Some(root),
            diagnostics: Vec::new(),
            is_partial: false,
        }.to_json();

        assert_eq!(result["schemaVersion"], AST_SCHEMA_VERSION);
        assert_eq!(result["documentNode"], "math");
        assert_eq!(result["sourceOffsetEncoding"], "utf8-bytes");
        assert_eq!(result["ast"]["children"][0]["kind"], "number");
        assert_eq!(result["ast"]["span"]["endByte"], 5);
        assert_eq!(result["ast"]["origin"]["kind"], "source");
    }

    #[test]
    fn represents_text_nodes_without_fabricating_math_ast() {
        let result = AstInspection {
            source: "A design note".into(),
            document_node: DocumentNodeKind::Text,
            ast: None,
            diagnostics: Vec::new(),
            is_partial: false,
        }.to_json();

        assert_eq!(result["documentNode"], "text");
        assert!(result["ast"].is_null());
    }

    #[test]
    fn retains_non_contiguous_derived_origin_separately_from_envelope() {
        let first = SourceSpan {
            start_byte: 1, end_byte: 2, start_line: 0, start_column_byte: 1,
            end_line: 0, end_column_byte: 2,
        };
        let second = SourceSpan {
            start_byte: 8, end_byte: 9, start_line: 1, start_column_byte: 2,
            end_line: 1, end_column_byte: 3,
        };
        let mut node = AstNode::new("n1", "vector_literal");
        node.span = Some(SourceSpan {
            start_byte: 1, end_byte: 9, start_line: 0, start_column_byte: 1,
            end_line: 1, end_column_byte: 3,
        });
        node.origin = Some(AstNodeOrigin::Derived(vec![first, second]));
        let json = node.to_json();
        assert_eq!(json["span"]["startByte"], 1);
        assert_eq!(json["span"]["endByte"], 9);
        assert_eq!(json["origin"]["spans"].as_array().unwrap().len(), 2);
    }
}
