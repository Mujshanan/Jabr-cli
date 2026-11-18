//! Stable, Jabr-owned data-transfer types for parser inspection.
//!
//! These DTOs deliberately do not mirror the private Calcpad compiler types. The parser
//! adapter will populate them from the real Calcpad parse/compiler output. In particular,
//! tokenizer records must never be promoted to AST nodes.
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

/// Half-open UTF-8 byte range in the original Rust source string.
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

/// A normalized syntax node. Attributes contain kind-specific semantic data
/// (operator, literal, variable/function name, unit, etc.); children preserve
/// source/compiler order. Evaluation results are intentionally not stored here.
#[derive(Clone, Debug, PartialEq)]
pub struct AstNode {
    pub id: String,
    pub kind: String,
    pub span: Option<SourceSpan>,
    pub attributes: Map<String, Value>,
    pub children: Vec<AstNode>,
}

impl AstNode {
    pub fn new(id: impl Into<String>, kind: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            kind: kind.into(),
            span: None,
            attributes: Map::new(),
            children: Vec::new(),
        }
    }

    pub fn with_span(mut self, span: SourceSpan) -> Self {
        self.span = Some(span);
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
        node.insert("attributes".into(), Value::Object(self.attributes.clone()));
        node.insert(
            "children".into(),
            Value::Array(self.children.iter().map(AstNode::to_json).collect()),
        );
        Value::Object(node)
    }
}

/// Inspection is a parse-only result. It must not execute worksheet calculations.
#[derive(Clone, Debug, PartialEq)]
pub struct AstInspection {
    pub source: String,
    pub document_node: DocumentNodeKind,
    pub ast: Option<AstNode>,
    pub diagnostics: Vec<Value>,
    pub is_partial: bool,
}

impl AstInspection {
    pub fn to_json(&self) -> Value {
        json!({
            "schemaVersion": AST_SCHEMA_VERSION,
            "source": self.source,
            "sourceOffsetEncoding": "utf8-bytes",
            "documentNode": self.document_node.as_str(),
            "ast": self.ast.as_ref().map(AstNode::to_json),
            "diagnostics": self.diagnostics,
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
        let mut root = AstNode::new("n1", "binary").with_span(span);
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
}
