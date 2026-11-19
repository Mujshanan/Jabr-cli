//! Occurrence-level name analysis over Jabr-owned syntax AST nodes.
//!
//! This pass never reparses source and never evaluates expressions. It consumes
//! the AST and its preserved source spans; worksheet-wide visibility and
//! cross-block binding remain responsibilities of Jabr-Engine.

use serde_json::{json, Value};
use crate::ast::{AstDiagnostic, AstInspection, AstNode, SourceSpan};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NameDefinition {
    pub order: usize,
    pub node_id: String,
    pub name: String,
    pub span: Option<SourceSpan>,
    pub definition_kind: String,
}
impl NameDefinition {
    pub fn to_json(&self) -> Value {
        json!({"order":self.order,"nodeId":self.node_id,"name":self.name,
            "span":self.span.as_ref().map(SourceSpan::to_json),"definitionKind":self.definition_kind})
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NameReference {
    pub order: usize,
    pub node_id: String,
    pub name: String,
    pub span: Option<SourceSpan>,
}
impl NameReference {
    pub fn to_json(&self) -> Value {
        json!({"order":self.order,"nodeId":self.node_id,"name":self.name,
            "span":self.span.as_ref().map(SourceSpan::to_json)})
    }
}

/// Occurrence-level names for one already-parsed AST. Occurrences are not deduplicated.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NameAnalysis {
    pub definitions: Vec<NameDefinition>,
    pub references: Vec<NameReference>,
    pub diagnostics: Vec<AstDiagnostic>,
}
impl NameAnalysis {
    pub fn to_json(&self) -> Value {
        json!({
            "definitions":self.definitions.iter().map(NameDefinition::to_json).collect::<Vec<_>>(),
            "references":self.references.iter().map(NameReference::to_json).collect::<Vec<_>>(),
            "diagnostics":self.diagnostics.iter().map(AstDiagnostic::to_json).collect::<Vec<_>>()
        })
    }
}

#[derive(Clone)]
enum OccurrenceKind { Definition(String), Reference }
#[derive(Clone)]
struct Occurrence {
    traversal_order: usize,
    node_id: String,
    name: String,
    span: Option<SourceSpan>,
    kind: OccurrenceKind,
}

/// Analyze an existing AST without reparsing or evaluating it.
/// Assignment targets are definitions; RHS names remain reads, including x = x + 1.
/// Indexed assignment defines the base collection and reads its index expressions.
pub fn analyze_names(inspection: &AstInspection) -> NameAnalysis {
    let mut occurrences=Vec::new();
    let mut diagnostics=inspection.diagnostics.clone();
    let mut traversal_order=0usize;
    if let Some(ast)=inspection.ast.as_ref() {
        visit_node(ast,&mut occurrences,&mut diagnostics,&mut traversal_order);
    }
    occurrences.sort_by_key(|o|(o.span.as_ref().map(|s|s.start_byte).unwrap_or(usize::MAX),o.traversal_order));
    let mut definitions=Vec::new();
    let mut references=Vec::new();
    for (order,o) in occurrences.into_iter().enumerate() {
        match o.kind {
            OccurrenceKind::Definition(definition_kind)=>definitions.push(NameDefinition {
                order,node_id:o.node_id,name:o.name,span:o.span,definition_kind
            }),
            OccurrenceKind::Reference=>references.push(NameReference {
                order,node_id:o.node_id,name:o.name,span:o.span
            })
        }
    }
    NameAnalysis {definitions,references,diagnostics}
}

fn visit_node(node:&AstNode, occurrences:&mut Vec<Occurrence>, diagnostics:&mut Vec<AstDiagnostic>, traversal_order:&mut usize) {
    if node.kind=="assignment" {
        if let Some(target)=node.children.first() {
            visit_assignment_target(target,"assignment",occurrences,diagnostics,traversal_order);
        } else {
            diagnostics.push(AstDiagnostic {code:Some("MISSING_ASSIGNMENT_TARGET".into()),
                message:"The AST assignment node has no target operand.".into(),span:node.span.clone()});
        }
        for child in node.children.iter().skip(1) {
            visit_node(child,occurrences,diagnostics,traversal_order);
        }
        return;
    }
    if node.kind=="variable" {
        push_occurrence(node,OccurrenceKind::Reference,occurrences,traversal_order);
        return;
    }
    for child in &node.children {
        visit_node(child,occurrences,diagnostics,traversal_order);
    }
}

fn visit_assignment_target(target:&AstNode, definition_kind:&str, occurrences:&mut Vec<Occurrence>,
    diagnostics:&mut Vec<AstDiagnostic>, traversal_order:&mut usize) {
    match target.kind.as_str() {
        "variable"=>push_occurrence(target,OccurrenceKind::Definition(definition_kind.into()),occurrences,traversal_order),
        "vector_index"|"matrix_index"=>{
            if let Some(base)=target.children.first() {
                if base.kind=="variable" {
                    push_occurrence(base,OccurrenceKind::Definition("indexed_assignment".into()),occurrences,traversal_order);
                } else {
                    diagnostics.push(AstDiagnostic {code:Some("UNSUPPORTED_ASSIGNMENT_TARGET".into()),
                        message:"The indexed assignment base is not a variable node.".into(),span:target.span.clone()});
                    visit_node(base,occurrences,diagnostics,traversal_order);
                }
            } else {
                diagnostics.push(AstDiagnostic {code:Some("MISSING_ASSIGNMENT_TARGET".into()),
                    message:"The indexed assignment has no base expression.".into(),span:target.span.clone()});
            }
            for index in target.children.iter().skip(1) {
                visit_node(index,occurrences,diagnostics,traversal_order);
            }
        }
        _=>{
            diagnostics.push(AstDiagnostic {code:Some("UNSUPPORTED_ASSIGNMENT_TARGET".into()),
                message:format!("Name analysis does not support assignment target node kind '{}'.",target.kind),
                span:target.span.clone()});
            visit_node(target,occurrences,diagnostics,traversal_order);
        }
    }
}

fn push_occurrence(node:&AstNode,kind:OccurrenceKind,occurrences:&mut Vec<Occurrence>,traversal_order:&mut usize) {
    if let Some(name)=node.attributes.get("name").and_then(Value::as_str) {
        occurrences.push(Occurrence {traversal_order:*traversal_order,node_id:node.id.clone(),
            name:name.to_string(),span:node.span.clone(),kind});
        *traversal_order+=1;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ast_inspection::inspect_expression;

    #[test]
    fn assignment_target_is_definition_and_rhs_is_reference() {
        let a=analyze_names(&inspect_expression("x = y + 1"));
        assert_eq!(a.definitions.iter().map(|x|x.name.as_str()).collect::<Vec<_>>(),vec!["x"]);
        assert_eq!(a.references.iter().map(|x|x.name.as_str()).collect::<Vec<_>>(),vec!["y"]);
        assert!(a.diagnostics.is_empty());
    }

    #[test]
    fn read_modify_write_and_repeated_reads_are_not_deduplicated() {
        let a=analyze_names(&inspect_expression("x = x + x"));
        assert_eq!(a.definitions.len(),1);
        assert_eq!(a.references.iter().map(|x|x.name.as_str()).collect::<Vec<_>>(),vec!["x","x"]);
        assert_eq!(a.definitions[0].order,0);
        assert_eq!(a.references[0].order,1);
        assert_eq!(a.references[1].order,2);
    }

    #[test]
    fn shared_order_is_source_order_not_ast_postorder() {
        let a=analyze_names(&inspect_expression("a = b + c"));
        let mut all=a.definitions.iter().map(|x|(x.order,x.name.as_str()))
            .chain(a.references.iter().map(|x|(x.order,x.name.as_str()))).collect::<Vec<_>>();
        all.sort_by_key(|x|x.0);
        assert_eq!(all.iter().map(|x|x.1).collect::<Vec<_>>(),vec!["a","b","c"]);
    }

    #[test]
    fn repeated_reads_keep_distinct_node_ids_and_spans() {
        let a=analyze_names(&inspect_expression("a + a + a"));
        assert!(a.definitions.is_empty());
        assert_eq!(a.references.len(),3);
        assert!(a.references.windows(2).all(|p|p[0].node_id!=p[1].node_id
            && p[0].span.as_ref().unwrap().start_byte<p[1].span.as_ref().unwrap().start_byte));
    }

    #[test]
    fn parse_failures_do_not_create_speculative_names() {
        let a=analyze_names(&inspect_expression("a +"));
        assert!(a.definitions.is_empty() && a.references.is_empty());
        assert!(!a.diagnostics.is_empty());
    }

    #[test]
    fn unicode_byte_spans_are_inherited_from_ast() {
        let a=analyze_names(&inspect_expression("π = β + β"));
        assert_eq!(a.definitions[0].name,"π");
        assert_eq!(a.definitions[0].span.as_ref().unwrap().start_byte,0);
        assert_eq!(a.references[0].span.as_ref().unwrap().start_byte,5);
        assert_eq!(a.references[1].span.as_ref().unwrap().start_byte,10);
    }
}
