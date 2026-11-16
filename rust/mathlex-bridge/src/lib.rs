use wasm_bindgen::prelude::*;

fn serialize_expression(expression: mathlex::Expression) -> Result<String, String> {
    serde_json::to_string(&expression)
        .map_err(|error| format!("Could not serialize AST: {error}"))
}

fn parse_math_json(input: &str) -> Result<String, String> {
    let expression = mathlex::parse(input).map_err(|error| error.to_string())?;
    serialize_expression(expression)
}

fn parse_latex_json(input: &str) -> Result<String, String> {
    let expression = mathlex::parse_latex(input).map_err(|error| error.to_string())?;
    serialize_expression(expression)
}

/// Parse a plain-text mathematical expression and return its Mathlex JSON AST.
#[wasm_bindgen]
pub fn parse_math(input: &str) -> Result<String, JsValue> {
    parse_math_json(input).map_err(|error| JsValue::from_str(&error))
}

/// Parse a LaTeX mathematical expression and return its Mathlex JSON AST.
#[wasm_bindgen]
pub fn parse_latex(input: &str) -> Result<String, JsValue> {
    parse_latex_json(input).map_err(|error| JsValue::from_str(&error))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn assert_mathlex_wire_format(json: &str) {
        let ast: serde_json::Value =
            serde_json::from_str(json).expect("parser should return valid JSON");

        assert!(
            ast.get("kind").and_then(serde_json::Value::as_str).is_some(),
            "each Mathlex AST node must expose a string kind"
        );
        assert!(
            ast.get("value").is_some(),
            "each Mathlex AST node must expose a value payload"
        );
    }

    #[test]
    fn parses_plain_text_to_mathlex_json_ast() {
        let json = parse_math_json("2*x + sin(y)^2").expect("expression should parse");
        let ast: serde_json::Value =
            serde_json::from_str(&json).expect("parser should return valid JSON");

        assert_eq!(ast["kind"], "Binary");
        assert_eq!(ast["value"]["op"]["kind"], "Add");
        assert_mathlex_wire_format(&json);
    }

    #[test]
    fn parses_latex_to_mathlex_json_ast() {
        let json = parse_latex_json(r"\frac{1}{2}").expect("LaTeX expression should parse");
        assert_mathlex_wire_format(&json);
    }

    #[test]
    fn reports_invalid_plain_text_input() {
        assert!(parse_math_json("2 + * 3").is_err());
    }
}
