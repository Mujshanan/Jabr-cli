use wasm_bindgen::prelude::*;

fn parse_math_json(input: &str) -> Result<String, String> {
    let expression = mathlex::parse(input).map_err(|error| error.to_string())?;
    serde_json::to_string(&expression)
        .map_err(|error| format!("Could not serialize AST: {error}"))
}

#[wasm_bindgen]
pub fn parse_math(input: &str) -> Result<String, JsValue> {
    parse_math_json(input).map_err(|error| JsValue::from_str(&error))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_expression_to_json_ast() {
        let json = parse_math_json("2*x + sin(y)^2").expect("expression should parse");
        let ast: serde_json::Value =
            serde_json::from_str(&json).expect("parser should return valid JSON");

        assert_eq!(ast["kind"], "Binary");
        assert_eq!(ast["value"]["op"]["kind"], "Add");
    }

    #[test]
    fn reports_invalid_input() {
        assert!(parse_math_json("2 + * 3").is_err());
    }
}
