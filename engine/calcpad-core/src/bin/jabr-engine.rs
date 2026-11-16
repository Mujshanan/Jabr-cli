use std::env;
use std::fs;
use std::path::Path;

use calcpad_core::parsers::expression_parser::ExpressionParser;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().collect();
    if args.len() < 3 {
        eprintln!("Usage: jabr-engine <input.cpd> <output.html>");
        std::process::exit(2);
    }

    let source = fs::read_to_string(&args[1])?;
    let mut parser = ExpressionParser::new();
    parser.source_file_path = Some(Path::new(&args[1]).to_string_lossy().to_string());
    parser.parse(&source, true);
    fs::write(&args[2], parser.html_result.as_bytes())?;
    Ok(())
}
