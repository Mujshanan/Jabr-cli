use mathlex::latex::ToLatex;
use wasm_bindgen::prelude::*;

fn serialize_expression(expression: mathlex::Expression) -> Result<String, String> {
    serde_json::to_string(&expression)
        .map_err(|error| format!("Could not serialize AST: {error}"))
}

fn parse_math_expression(input: &str) -> Result<mathlex::Expression, String> {
    let config = mathlex::ParserConfig {
        implicit_multiplication: true,
        ..Default::default()
    };
    mathlex::parse_with_config(input, &config).map_err(|error| error.to_string())
}

fn parse_latex_expression(input: &str) -> Result<mathlex::Expression, String> {
    mathlex::parse_latex(input).map_err(|error| error.to_string())
}

fn parse_math_json(input: &str) -> Result<String, String> {
    serialize_expression(parse_math_expression(input)?)
}

fn parse_latex_json(input: &str) -> Result<String, String> {
    serialize_expression(parse_latex_expression(input)?)
}

fn math_to_latex_string(input: &str) -> Result<String, String> {
    Ok(parse_math_expression(input)?.to_latex())
}

fn latex_to_latex_string(input: &str) -> Result<String, String> {
    Ok(parse_latex_expression(input)?.to_latex())
}

/// Parse a plain-text mathematical expression and return its Mathlex JSON AST.
#[wasm_bindgen]
pub fn parse_math(input: &str) -> Result<String, JsValue> {
    console_error_panic_hook::set_once();
    parse_math_json(input).map_err(|error| JsValue::from_str(&error))
}

/// Parse a LaTeX mathematical expression and return its Mathlex JSON AST.
#[wasm_bindgen]
pub fn parse_latex(input: &str) -> Result<String, JsValue> {
    console_error_panic_hook::set_once();
    parse_latex_json(input).map_err(|error| JsValue::from_str(&error))
}

/// Parse plain-text mathematical notation and serialize the AST back to LaTeX.
#[wasm_bindgen]
pub fn math_to_latex(input: &str) -> Result<String, JsValue> {
    console_error_panic_hook::set_once();
    math_to_latex_string(input).map_err(|error| JsValue::from_str(&error))
}

/// Parse LaTeX notation and serialize the AST back to normalized LaTeX.
#[wasm_bindgen]
pub fn latex_to_latex(input: &str) -> Result<String, JsValue> {
    console_error_panic_hook::set_once();
    latex_to_latex_string(input).map_err(|error| JsValue::from_str(&error))
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
    fn accepts_implicit_multiplication_in_plain_text() {
        let json = parse_math_json("2x + 3").expect("implicit multiplication should parse");
        let ast: serde_json::Value =
            serde_json::from_str(&json).expect("parser should return valid JSON");

        assert_eq!(ast["kind"], "Binary");
        assert_eq!(ast["value"]["op"]["kind"], "Add");
    }

    #[test]
    fn parses_latex_to_mathlex_json_ast() {
        let json = parse_latex_json(r"\frac{1}{2}").expect("LaTeX expression should parse");
        assert_mathlex_wire_format(&json);
    }

    #[test]
    fn serializes_plain_text_expression_to_latex() {
        let latex = math_to_latex_string("2*x + 3").expect("expression should serialize");
        assert!(latex.contains(r"\cdot") || latex.contains("*") || latex.contains("2"));
        assert!(latex.contains("x"));
    }

    #[test]
    fn normalizes_latex_expression() {
        let latex = latex_to_latex_string(r"\frac{1}{2}").expect("LaTeX should serialize");
        assert!(latex.contains(r"\frac"));
    }

    #[test]
    fn reports_invalid_plain_text_input() {
        assert!(parse_math_json("2 + * 3").is_err());
        assert!(math_to_latex_string("2 + * 3").is_err());
    }
}
