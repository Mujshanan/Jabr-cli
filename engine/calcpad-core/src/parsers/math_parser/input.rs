//! Port of Parsers/MathParser/MathParser.Input.cs (tokenizer, operator ordering, RPN).
use std::rc::Rc;

use super::solve_block::{get_solver_type, SolverBlock, SolverTypes};
use super::tokens::{Token, TokenKind, TokenRef, TokenTypes, DEFAULT_ORDER};
use super::{MathParser, VarDict};
use crate::base_types::complex_value::ComplexValue;
use crate::base_types::real_value::RealValue;
use crate::base_types::unit::Unit;
use crate::base_types::value::Value;
use crate::base_types::variable::Variable;
use crate::calculator::{self, NEG_STR, OPERATOR_ORDER, UNIT_MULT_ORDER};
use crate::exceptions;
use crate::extension_methods::{is_letter as char_is_letter, trim};
use crate::math_parser_exception::{CResult, MathParserException};
use crate::parsers::units_parser;
use crate::source_span::{SourceMap, SourceOrigin, SourceSpan};
use crate::validator;

/// `TextSpan` over a char array.
#[derive(Clone, Copy, Default)]
struct Span {
    start: usize,
    end: usize,
}

impl Span {
    fn is_empty(&self) -> bool {
        self.start == self.end
    }
    fn reset(&mut self, i: usize) {
        self.start = i;
        self.end = i;
    }
    fn expand(&mut self) {
        self.end += 1;
    }
    fn get(&self, ex: &[char]) -> String {
        ex[self.start..self.end].iter().collect()
    }
}

fn source_error(error: MathParserException, source_map: &SourceMap, start_char: usize, end_char: usize) -> MathParserException {
    error.with_source_span(source_map.span_from_chars(start_char, end_char))
}

fn set_source_span(token: &TokenRef, source_map: &SourceMap, start_char: usize, end_char: usize) {
    if let Some(span) = source_map.span_from_chars(start_char, end_char) {
        token.borrow_mut().source_origin = Some(SourceOrigin::Source(span));
    }
}

fn set_derived_span(token: &TokenRef, spans: Vec<SourceSpan>) {
    if !spans.is_empty() {
        token.borrow_mut().source_origin = Some(SourceOrigin::Derived(spans));
    }
}

fn token_source_spans(token: &TokenRef) -> Vec<SourceSpan> {
    match &token.borrow().source_origin {
        Some(SourceOrigin::Source(span)) => vec![*span],
        Some(SourceOrigin::Derived(spans)) => spans.clone(),
        Some(SourceOrigin::Synthetic { .. }) | None => Vec::new(),
    }
}

fn char_type(c: char, is_complex: bool) -> TokenTypes {
    if (c as u32) < 127 {
        return match c {
            '0'..='9' | '.' => TokenTypes::Constant,
            '\t' | ' ' => TokenTypes::None,
            '$' => TokenTypes::Solver,
            '?' => TokenTypes::Input,
            ';' => TokenTypes::Divisor,
            '(' => TokenTypes::BracketLeft,
            ')' => TokenTypes::BracketRight,
            '[' => TokenTypes::SquareBracketLeft,
            ']' => TokenTypes::SquareBracketRight,
            '|' => TokenTypes::RowDivisor,
            '_' | ',' => TokenTypes::Unit,
            '!' => TokenTypes::Function,
            c if validator::is_letter(c) => TokenTypes::Unit,
            c if calculator::is_operator(c) => TokenTypes::Operator,
            _ => TokenTypes::Error,
        };
    }
    match c {
        '\u{2261}' | '\u{2260}' | '\u{2190}' | '\u{2264}' | '\u{2265}' | '\u{00F7}' | '\u{29BC}' | '\u{2227}'
        | '\u{2228}' | '\u{2295}' => TokenTypes::Operator,
        '\u{2220}' if is_complex => TokenTypes::Operator,
        _ => {
            if validator::is_letter(c) {
                TokenTypes::Unit
            } else {
                TokenTypes::Error
            }
        }
    }
}

impl MathParser {
    pub(crate) fn add_local_variables(&self, variables: VarDict) {
        self.local_variables.borrow_mut().push(variables);
    }

    pub(crate) fn remove_local_variables(&self) {
        self.local_variables.borrow_mut().pop();
    }

    fn top_local_variables(&self) -> VarDict {
        self.local_variables.borrow().last().unwrap().clone()
    }

    /// `Input.GetInput`
    pub(crate) fn get_input(&self, expression: &str, allow_assignment: bool) -> CResult<Vec<TokenRef>> {
        let ex: Vec<char> = expression.chars().collect();
        let source_map = SourceMap::new(expression);
        let is_complex = self.settings.borrow().is_complex;
        let mut tokens: Vec<TokenRef> = Vec::with_capacity(ex.len());
        let mut pt = TokenTypes::None;
        let mut st = SolverTypes::None;
        let mut is_solver = false;
        let mut is_input = false;
        let mut is_subscript = false;
        let mut bracket_counter = 0i32;
        let mut paren_depth = 0i32;
        let mut token_literal = Span::default();
        let mut units_literal = Span::default();
        let mut text_span = Span::default();
        let mut solver_start = 0usize;
        let mut input_start = None;
        self.assignment_index.set(0);
        let mut t: Option<TokenRef> = None;
        let n = self.get_target_units(&ex).map_err(|e| source_error(e, &source_map, 0, expression.chars().count()))?;
        let mut i = 0usize;
        while i <= n {
            let c = if i == n { ' ' } else { ex[i] };
            let mut tt = char_type(c, is_complex);
            if pt == TokenTypes::Unit || pt == TokenTypes::Variable {
                if c == '_' {
                    is_subscript = true;
                } else if tt == TokenTypes::Error && is_subscript && char_is_letter(c) {
                    tt = pt;
                }
            } else {
                is_subscript = false;
            }

            // InputSolver
            if !is_input {
                if tt == TokenTypes::Solver && !is_solver {
                    if !token_literal.is_empty() {
                        return Err(source_error(exceptions::InvalidMacro(&token_literal.get(&ex)), &source_map, token_literal.start, token_literal.end));
                    }
                    text_span.reset(i);
                    solver_start = i;
                    is_solver = true;
                }
                if is_solver {
                    match c {
                        '{' => {
                            if bracket_counter == 0 {
                                let s = text_span.get(&ex);
                                st = get_solver_type(&s);
                                if st == SolverTypes::Error {
                                    return Err(source_error(exceptions::InvalidSolver(&s), &source_map, text_span.start, text_span.end));
                                }
                                text_span.reset(i + 1);
                            } else {
                                text_span.expand();
                            }
                            bracket_counter += 1;
                        }
                        '}' => {
                            bracket_counter -= 1;
                            if bracket_counter == 0 {
                                let script = text_span.get(&ex);
                                let index = self.add_solver(&script, st).map_err(|e| source_error(e, &source_map, solver_start, i + 1))?;
                                let mut tok = Token::new("", TokenTypes::Solver);
                                tok.index = index as i64;
                                let tok = tok.into_ref();
                                set_source_span(&tok, &source_map, solver_start, i + 1);
                                tokens.push(tok.clone());
                                t = Some(tok);
                                st = SolverTypes::None;
                                is_solver = false;
                            } else {
                                text_span.expand();
                            }
                        }
                        _ => text_span.expand(),
                    }
                    i += 1;
                    continue;
                }
            }

            // InputInput
            {
                let mut handled = false;
                if c == '{' && pt == TokenTypes::Input {
                    token_literal.reset(i + 1);
                    is_input = true;
                    handled = true;
                } else if c == '}' && is_input {
                    if !token_literal.is_empty() {
                        let content = token_literal.get(&ex);
                        if let Some(tok) = &t {
                            let mut tm = tok.borrow_mut();
                            tm.content = content.clone();
                            if self.is_enabled.get() {
                                let v = parse_double_invariant(&content).ok_or_else(|| {
                                    source_error(MathParserException::unexpected(format!(
                                        "The input string '{}' was not in a correct format.",
                                        content
                                    )), &source_map, input_start.unwrap_or(token_literal.start), i + 1)
                                })?;
                                tm.set_value(Value::Real(RealValue::num(v)));
                            }
                        }
                        if let (Some(tok), Some(start)) = (&t, input_start) {
                            set_source_span(tok, &source_map, start, i + 1);
                        }
                        input_start = None;
                        token_literal.reset(i);
                        is_input = false;
                        tt = TokenTypes::Input;
                    }
                    handled = true;
                } else if is_input {
                    if !self.is_enabled.get() {
                        token_literal.expand();
                    } else if c == '-' && pt == TokenTypes::Input
                        || (tt == TokenTypes::Constant || c == 'i' && is_complex)
                            && (pt == TokenTypes::Input || pt == TokenTypes::Constant)
                    {
                        token_literal.expand();
                        if c == 'i' {
                            pt = TokenTypes::Unit;
                        }
                    } else if c != ' ' || !token_literal.is_empty() {
                        return Err(source_error(exceptions::InvalidSymbol(c), &source_map, i, i + 1));
                    }
                    handled = true;
                }
                if handled {
                    // `continue` in C# skips the trailing `pt = tt` update.
                    i += 1;
                    continue;
                }
            }

            if tt == TokenTypes::Error {
                return Err(source_error(exceptions::InvalidSymbol(c), &source_map, i, i + 1));
            }

            if tt == TokenTypes::Constant && units_literal.is_empty()
                || tt == TokenTypes::Unit
                || tt == TokenTypes::Variable
            {
                if pt == TokenTypes::Unit || pt == TokenTypes::Variable {
                    let first = ex.get(token_literal.start).copied().unwrap_or('\0');
                    tt = if validator::is_unit_char(first) {
                        TokenTypes::Unit
                    } else {
                        TokenTypes::Variable
                    };
                    if c == '.' && tt == TokenTypes::Variable {
                        if is_complex {
                            return Err(source_error(exceptions::ComplexVectorsAndMatricesNotSupported(), &source_map, i, i + 1));
                        }
                        let s = token_literal.get(&ex);
                        let tok = match self.make_vector_or_matrix_token(&s) {
                            Some(t) => t,
                            None => {
                                let mut t = Token::variable(s.clone(), None);
                                t.ttype = TokenTypes::Array;
                                t
                            }
                        };
                        let ttype = tok.ttype;
                        let tok = tok.into_ref();
                        set_source_span(&tok, &source_map, token_literal.start, i);
                        tokens.push(tok.clone());
                        t = Some(tok);
                        token_literal.reset(i);
                        tt = match ttype {
                            TokenTypes::Vector => TokenTypes::VectorIndex,
                            TokenTypes::Matrix => TokenTypes::MatrixIndex,
                            _ => TokenTypes::ArrayIndex,
                        };
                        let index_token = Token::new(s, tt).into_ref();
                        if let Some(span) = token_source_spans(&tokens[tokens.len() - 1]).first().copied() {
                            set_derived_span(&index_token, vec![span]);
                        }
                        tokens.push(index_token);
                    } else {
                        token_literal.expand();
                    }
                } else if c == 'i' && is_complex && pt == TokenTypes::Constant && units_literal.is_empty() {
                    let j = i + 1;
                    if j < n && ex[j] == 'n' {
                        units_literal.reset(i);
                        units_literal.expand();
                        tt = TokenTypes::Constant;
                    } else {
                        let tok = make_imaginary_value_token(&token_literal.get(&ex)).map_err(|e| source_error(e, &source_map, token_literal.start, i + 1))?.into_ref();
                        set_source_span(&tok, &source_map, token_literal.start, i + 1);
                        tokens.push(tok.clone());
                        t = Some(tok);
                        token_literal.reset(i);
                    }
                } else if pt == TokenTypes::Constant && tt == TokenTypes::Unit {
                    if units_literal.is_empty() {
                        units_literal.reset(i);
                    }
                    units_literal.expand();
                    tt = TokenTypes::Constant;
                } else {
                    if tt == TokenTypes::Unit && !validator::is_var_starting_char(c) {
                        return Err(source_error(exceptions::InvalidCharacter(c), &source_map, i, i + 1));
                    }
                    if tt != pt {
                        token_literal.reset(i);
                    }
                    token_literal.expand();
                }
            } else {
                if !(token_literal.is_empty() && units_literal.is_empty()) {
                    if pt == TokenTypes::Constant {
                        if token_literal.get(&ex) == "." && !units_literal.is_empty() {
                            let s = units_literal.get(&ex);
                            let force = Unit::exists(&s) || !tokens.is_empty();
                            let tok = self.make_unit_token(&s, force).map_err(|e| source_error(e, &source_map, units_literal.start, units_literal.end))?.into_ref();
                            set_source_span(&tok, &source_map, units_literal.start, units_literal.end);
                            tokens.push(tok.clone());
                            t = Some(tok);
                            token_literal.reset(i);
                            units_literal.reset(i);
                        } else {
                            let tok = make_real_value_token(&token_literal.get(&ex)).map_err(|e| source_error(e, &source_map, token_literal.start, token_literal.end))?.into_ref();
                            set_source_span(&tok, &source_map, token_literal.start, token_literal.end);
                            tokens.push(tok.clone());
                            t = Some(tok);
                            token_literal.reset(i);
                            if !units_literal.is_empty() {
                                let s = units_literal.get(&ex);
                                let unit_tok = self.make_unit_token(&s, true).map_err(|e| source_error(e, &source_map, units_literal.start, units_literal.end))?.into_ref();
                                set_source_span(&unit_tok, &source_map, units_literal.start, units_literal.end);
                                let multiply = Token::with_order("*", TokenTypes::Operator, UNIT_MULT_ORDER).into_ref();
                                let mut origins = token_source_spans(&tokens[tokens.len() - 1]);
                                origins.extend(token_source_spans(&unit_tok));
                                set_derived_span(&multiply, origins);
                                tokens.push(multiply);
                                tokens.push(unit_tok.clone());
                                t = Some(unit_tok);
                                units_literal.reset(i);
                            }
                        }
                    } else {
                        let s = token_literal.get(&ex);
                        if tt == TokenTypes::BracketLeft {
                            let must_exist = self.is_calculation.get() && !tokens.is_empty();
                            let tok = self.make_function_token(&s, must_exist).map_err(|e| source_error(e, &source_map, token_literal.start, token_literal.end))?;
                            if is_complex {
                                use TokenTypes::*;
                                let ends_units = tok.content.to_lowercase().ends_with("units");
                                let bad = match tok.ttype {
                                    VectorFunction | VectorFunction2 | VectorFunction3 | VectorMultiFunction => true,
                                    MatrixFunction | MatrixFunction2 => !ends_units,
                                    MatrixFunction3
                                    | MatrixFunction4
                                    | MatrixFunction5
                                    | MatrixOptionalFunction
                                    | MatrixIterativeFunction
                                    | MatrixMultiFunction
                                    | Array => true,
                                    _ => false,
                                };
                                if bad {
                                    return Err(source_error(exceptions::ComplexVectorsAndMatricesNotSupported(), &source_map, i, i + 1));
                                }
                            }
                            let tok = tok.into_ref();
                            set_source_span(&tok, &source_map, token_literal.start, i);
                            t = Some(tok);
                        } else {
                            let prev_is_input_or_const = t.as_ref().is_some_and(|x| {
                                let x = x.borrow();
                                x.ttype == TokenTypes::Input || x.ttype == TokenTypes::Constant
                            });
                            if prev_is_input_or_const {
                                let multiply = Token::with_order("*", TokenTypes::Operator, UNIT_MULT_ORDER).into_ref();
                                let mut origins = t.as_ref().map(token_source_spans).unwrap_or_default();
                                if let Some(span) = source_map.span_from_chars(token_literal.start, i) { origins.push(span); }
                                set_derived_span(&multiply, origins);
                                tokens.push(multiply);
                                if !token_literal.is_empty() {
                                    let unit_tok = self.make_unit_token(&s, true).map_err(|e| source_error(e, &source_map, token_literal.start, token_literal.end))?.into_ref();
                                    set_source_span(&unit_tok, &source_map, token_literal.start, i);
                                    t = Some(unit_tok);
                                }
                            } else if s.chars().next().is_some_and(validator::is_unit_char) {
                                let unit_tok = self.make_unit_token(&s, true).map_err(|e| source_error(e, &source_map, token_literal.start, token_literal.end))?.into_ref();
                                set_source_span(&unit_tok, &source_map, token_literal.start, i);
                                t = Some(unit_tok);
                            } else {
                                let variable_tok = Token::variable(s.clone(), None).into_ref();
                                set_source_span(&variable_tok, &source_map, token_literal.start, i);
                                t = Some(variable_tok);
                            }
                        }
                        let tok = t.clone().unwrap();
                        if tok.borrow().source_origin.is_none() {
                            set_source_span(&tok, &source_map, token_literal.start, i);
                        }
                        tokens.push(tok.clone());
                        if tok.borrow().ttype == TokenTypes::Array {
                            let content = tok.borrow().content.clone();
                            let index_token = Token::new(content, TokenTypes::ArrayIndex).into_ref();
                            let origins = token_source_spans(&tok);
                            set_derived_span(&index_token, origins);
                            tokens.push(index_token);
                        }
                        token_literal.reset(i);
                    }
                }
                if tt != TokenTypes::None {
                    if let Some(x) = &t {
                        pt = x.borrow().ttype;
                    }
                    let new_tok: Token;
                    if c == '-'
                        && matches!(
                            pt,
                            TokenTypes::BracketLeft
                                | TokenTypes::SquareBracketLeft
                                | TokenTypes::RowDivisor
                                | TokenTypes::Divisor
                                | TokenTypes::Operator
                                | TokenTypes::None
                        )
                    {
                        let mut tok = Token::new(NEG_STR, TokenTypes::Operator);
                        tok.index = calculator::NEG_FUNCTION_INDEX;
                        new_tok = tok;
                    } else if c == '!' {
                        if matches!(
                            pt,
                            TokenTypes::Constant
                                | TokenTypes::BracketRight
                                | TokenTypes::SquareBracketRight
                                | TokenTypes::Variable
                        ) {
                            let mut tok = Token::new("!", TokenTypes::Function);
                            tok.index = calculator::FACT_FUNCTION_INDEX;
                            new_tok = tok;
                        } else {
                            return Err(source_error(exceptions::MissingOperand(), &source_map, i, i + 1));
                        }
                    } else if tt == TokenTypes::Input {
                        self.has_input_fields.set(true);
                        input_start = Some(i);
                        let mut tok = Token::value(Value::Real(RealValue::ZERO));
                        tok.index = self.line.get() as i64;
                        tok.ttype = TokenTypes::Input;
                        tok.content = c.to_string();
                        new_tok = tok;
                    } else {
                        if tt == TokenTypes::BracketLeft {
                            paren_depth += 1;
                        } else if tt == TokenTypes::BracketRight {
                            paren_depth -= 1;
                        }
                        if tt == TokenTypes::Operator {
                            if (c == '=' || c == '\u{2190}') && paren_depth == 0 {
                                if !allow_assignment || self.assignment_index.get() > 0 {
                                    return Err(source_error(exceptions::ImproperAssignment(), &source_map, i, i + 1));
                                }
                                let count = tokens.len();
                                if count == 1 {
                                    let token = tokens[0].clone();
                                    let is_var = token.borrow().is_variable_token();
                                    if is_var {
                                        if c == '\u{2190}' {
                                            self.get_variable_for(&token, true).map_err(|e| e.with_source_span(token_source_spans(&token).first().copied()))?;
                                        } else {
                                            self.create_variable(&token);
                                        }
                                        let v = token.borrow().variable_ref().unwrap();
                                        if v.is_read_only.get() {
                                            return Err(exceptions::CannotModifyConstant(&token.borrow().content).with_source_span(token_source_spans(&token).first().copied()));
                                        }
                                        v.is_read_only.set(self.is_const.get());
                                    }
                                }
                                self.assignment_index.set(count);
                            }
                        } else if tt == TokenTypes::SquareBracketLeft && is_complex {
                            return Err(source_error(exceptions::ComplexVectorsAndMatricesNotSupported(), &source_map, i, i + 1));
                        }
                        new_tok = Token::new(c.to_string(), tt);
                    }
                    let tok = new_tok.into_ref();
                    set_source_span(&tok, &source_map, i, i + 1);
                    tokens.push(tok.clone());
                    t = Some(tok);
                }
            }
            if pt != TokenTypes::Input || tt != TokenTypes::None {
                pt = tt;
            }
            i += 1;
        }
        self.get_variables(&tokens);
        if !is_solver {
            return Ok(tokens);
        }
        if st == SolverTypes::None {
            return Err(source_error(exceptions::MissingLeftSolverBracket(), &source_map, solver_start, ex.len()));
        }
        Err(source_error(exceptions::MissingRightSolverBracket(), &source_map, solver_start, ex.len()))
    }

    /// `GetTargetUnits`: returns the index where the expression ends.
    pub(crate) fn get_target_units(&self, ex: &[char]) -> CResult<usize> {
        let len = ex.len();
        let bar = ex.iter().rposition(|&c| c == '|');
        if let Some(n) = bar {
            let unit: String = ex[n + 1..].iter().collect();
            if unit.contains(']') {
                *self.target_units.borrow_mut() = None;
                return Ok(len);
            }
            if trim(&unit) == "base" {
                *self.target_units.borrow_mut() = Some(Unit::get_formatting_unit(crate::base_types::unit::BASE_TARGET));
                return Ok(n);
            }
            let units = self.units.borrow().clone();
            let u = units_parser::parse(trim(&unit), Some(&units), self.is_us.get())?;
            *self.target_units.borrow_mut() = u;
            return Ok(n);
        }
        let colon = ex.iter().rposition(|&c| c == ':');
        if let Some(n) = colon {
            let unit: String = ex[n..].iter().collect();
            if unit.contains('}') {
                *self.target_units.borrow_mut() = None;
                return Ok(len);
            }
            let fs: String = ex[n + 1..].iter().collect();
            if validator::is_valid_format_string(&fs) {
                *self.target_units.borrow_mut() = Some(Unit::get_formatting_unit(&unit));
            } else {
                *self.target_units.borrow_mut() = None;
                return Err(exceptions::InvalidFormatString(&fs));
            }
            return Ok(n);
        }
        *self.target_units.borrow_mut() = None;
        Ok(len)
    }

    fn make_function_token(&self, s: &str, must_exist: bool) -> CResult<Token> {
        if let Some(i) = calculator::function_index(s) {
            let mut t = Token::new(s, TokenTypes::Function);
            t.index = i as i64;
            return Ok(t);
        }
        if let Some(i) = calculator::function2_index(s) {
            let mut t = Token::new(s, TokenTypes::Function2);
            t.index = i as i64;
            return Ok(t);
        }
        if let Some(i) = calculator::function3_index(s) {
            let mut t = Token::new(s, TokenTypes::Function3);
            t.index = i as i64;
            return Ok(t);
        }
        if let Some(i) = calculator::multi_function_index(s) {
            let mut t = Token::function(s);
            t.index = i as i64;
            return Ok(t);
        }
        if let Some(i) = calculator::interpolation_index(s) {
            let mut t = Token::function(s);
            t.index = i as i64;
            t.ttype = TokenTypes::Interpolation;
            return Ok(t);
        }
        use crate::calculator::{matrix_calculator as mc, vector_calculator as vc};
        let lookups: [(fn(&str) -> Option<i64>, TokenTypes, bool); 11] = [
            (vc::function_index, TokenTypes::VectorFunction, false),
            (vc::function2_index, TokenTypes::VectorFunction2, false),
            (vc::function3_index, TokenTypes::VectorFunction3, false),
            (vc::multi_function_index, TokenTypes::VectorMultiFunction, true),
            (mc::function_index, TokenTypes::MatrixFunction, false),
            (mc::function2_index, TokenTypes::MatrixFunction2, false),
            (mc::function3_index, TokenTypes::MatrixFunction3, false),
            (mc::function4_index, TokenTypes::MatrixFunction4, false),
            (mc::function5_index, TokenTypes::MatrixFunction5, false),
            (mc::iterative_function_index, TokenTypes::MatrixIterativeFunction, false),
            (mc::multi_function_index, TokenTypes::MatrixMultiFunction, true),
        ];
        for (lookup, tt, is_multi) in lookups {
            if let Some(i) = lookup(s) {
                let mut t = if is_multi {
                    Token::function(s)
                } else {
                    Token::new(s, tt)
                };
                t.ttype = tt;
                t.index = i;
                return Ok(t);
            }
        }
        let index = self.functions.borrow().index_of(s);
        if index < 0 {
            if must_exist {
                if let Some(stripped) = s.strip_suffix('.') {
                    let mut t = Token::variable(stripped, None);
                    t.ttype = TokenTypes::Array;
                    return Ok(t);
                }
                return Err(exceptions::InvalidFunction(s));
            }
            if !self.is_calculation.get() {
                let mut t = Token::function(s);
                t.ttype = TokenTypes::CustomFunction;
                return Ok(t);
            }
        }
        let mut t = Token::new(s, TokenTypes::CustomFunction);
        t.index = index;
        Ok(t)
    }

    /// `MakeVectorOrMatrixToken(string s)`
    fn make_vector_or_matrix_token(&self, s: &str) -> Option<Token> {
        let stack: Vec<VarDict> = self.local_variables.borrow().iter().rev().cloned().collect();
        for vars in stack {
            let found = vars.borrow().get(s).cloned();
            if let Some(v) = found {
                return match v.value() {
                    Some(Value::Vector(_)) => {
                        let mut t = Token::variable(s, Some(v));
                        t.ttype = TokenTypes::Vector;
                        Some(t)
                    }
                    Some(Value::Matrix(_)) => {
                        let mut t = Token::variable(s, Some(v));
                        t.ttype = TokenTypes::Matrix;
                        Some(t)
                    }
                    None if !self.is_enabled.get() || !Rc::ptr_eq(&vars, &self.variables) => {
                        let mut t = Token::variable(s, None);
                        t.ttype = TokenTypes::Array;
                        Some(t)
                    }
                    _ => None,
                };
            }
        }
        None
    }

    fn create_variable(&self, vt: &TokenRef) {
        let s = vt.borrow().content.clone();
        let top = self.top_local_variables();
        let existing = top.borrow().get(&s).cloned();
        // Deviation D12: a block nested in another block (a `$While` or `$Repeat` inside a `$Block`)
        // that assigns a name the enclosing block already holds updates that variable instead of
        // making a private one, so a loop can accumulate. The worksheet's own variables (the
        // bottom of the stack) are not reached: a block never assigns to those.
        let enclosing = if existing.is_none() {
            let stack = self.local_variables.borrow();
            let n = stack.len();
            stack
                .iter()
                .take(n.saturating_sub(1))
                .skip(1)
                .rev()
                .find_map(|d| d.borrow().get(&s).cloned())
        } else {
            None
        };
        let v = match existing.or(enclosing) {
            Some(v) => v,
            None => {
                let v = Variable::new();
                top.borrow_mut().insert(s.clone(), v.clone());
                v
            }
        };
        vt.borrow_mut().set_variable(Some(v));
        self.defined_variables.borrow_mut().insert(s);
    }

    fn get_variables(&self, tokens: &[TokenRef]) {
        for token in tokens {
            let needs = {
                let t = token.borrow();
                matches!(t.kind, TokenKind::Variable(None))
            };
            if needs {
                let _ = self.get_variable_for(token, false);
            }
        }
    }

    fn get_variable_for(&self, vt: &TokenRef, must_exist: bool) -> CResult<()> {
        let s = vt.borrow().content.clone();
        let stack: Vec<VarDict> = self.local_variables.borrow().iter().rev().cloned().collect();
        for vars in stack {
            let found = vars.borrow().get(&s).cloned();
            if let Some(v) = found {
                vt.borrow_mut().set_variable(Some(v));
                return Ok(());
            }
        }
        if must_exist {
            return Err(exceptions::VariableNotExist(&s));
        }
        let top = self.top_local_variables();
        let nv = Variable::new();
        top.borrow_mut().insert(s, nv.clone());
        vt.borrow_mut().set_variable(Some(nv));
        Ok(())
    }

    fn make_unit_token(&self, s: &str, force: bool) -> CResult<Token> {
        let existing = self.units.borrow().get(s).cloned();
        if let Some(Some(u)) = existing {
            let mut t = Token::value(Value::Real(RealValue::unit(Some(u))));
            t.content = s.to_string();
            t.ttype = TokenTypes::Unit;
            return Ok(t);
        }
        if force {
            return self.make_unit_value_token(s);
        }
        if existing.is_some() {
            return Err(MathParserException::unexpected(format!(
                "An item with the same key has already been added. Key: {}",
                s
            )));
        }
        self.units.borrow_mut().insert(s.to_string(), None);
        let mut t = Token::value(Value::Real(RealValue::num(0.0)));
        t.content = s.to_string();
        t.ttype = TokenTypes::Unit;
        Ok(t)
    }

    fn make_unit_value_token(&self, units: &str) -> CResult<Token> {
        match Unit::try_get(units, self.is_us.get()) {
            Some(unit) => {
                let mut t = Token::value(Value::Real(RealValue::unit(Some(unit))));
                t.content = format!("<i>{}</i>", units);
                t.ttype = TokenTypes::Unit;
                Ok(t)
            }
            None => Err(exceptions::ErrorParsingUnits(units)),
        }
    }

    /// `Input.OrderOperators`
    pub(crate) fn order_operators(
        &self,
        input: &[TokenRef],
        is_definition: bool,
        assignment_index: usize,
    ) -> CResult<()> {
        let index_error = || MathParserException::unexpected("Index was outside the bounds of the array.");
        let mut is_unit = false;
        let mut pt: Option<TokenRef> = None;
        for (i, tr) in input.iter().enumerate() {
            {
                let mut t = tr.borrow_mut();
                if t.ttype == TokenTypes::Operator {
                    if t.content == NEG_STR {
                        t.order = 1;
                    } else {
                        t.index = calculator::operator_index(t.first_char())
                            .map(|x| x as i64)
                            .unwrap_or(-1);
                        if t.order < 0 {
                            t.order = OPERATOR_ORDER[t.index as usize];
                        }
                    }
                }
            }
            let convert = {
                let t = tr.borrow();
                !is_definition
                    && i >= assignment_index
                    && t.ttype == TokenTypes::Variable
                    && !self.defined_variables.borrow().contains(&t.content)
            };
            if convert {
                let content = tr.borrow().content.clone();
                if let Some(u) = Unit::try_get(&content, self.is_us.get()) {
                    let mut t = tr.borrow_mut();
                    t.ttype = TokenTypes::Unit;
                    if let Some(v) = t.variable_ref() {
                        v.set_unit_value(Some(u));
                    }
                }
            }
            let (tt, content_empty, c0) = {
                let t = tr.borrow();
                (t.ttype, t.content.is_empty(), t.first_char())
            };
            if tt == TokenTypes::Unit {
                if is_unit {
                    if let Some(p) = &pt {
                        if p.borrow().content.is_empty() {
                            return Err(index_error());
                        }
                        let pc = p.borrow().first_char();
                        if pc == '*' || pc == '/' || pc == '\u{00F7}' {
                            p.borrow_mut().order = UNIT_MULT_ORDER - 1;
                        }
                    }
                } else {
                    is_unit = true;
                }
            } else if is_unit {
                let cond = if tt != TokenTypes::Constant {
                    true
                } else {
                    let p = pt.as_ref().unwrap();
                    if p.borrow().content.is_empty() {
                        return Err(index_error());
                    }
                    p.borrow().first_char() != '^'
                };
                if cond {
                    if content_empty {
                        return Err(index_error());
                    }
                    if c0 != '*' && c0 != '/' && c0 != '\u{00F7}' && c0 != '^' {
                        is_unit = false;
                    }
                }
            }
            pt = Some(tr.clone());
        }
        Ok(())
    }

    fn add_solver(&self, script: &str, st: SolverTypes) -> CResult<usize> {
        self.is_solver.set(self.is_solver.get() + 1);
        let sb = SolverBlock::new(script, st, self);
        self.is_solver.set(self.is_solver.get() - 1);
        let sb = sb?;
        let mut blocks = self.solve_blocks.borrow_mut();
        blocks.push(sb);
        Ok(blocks.len() - 1)
    }
}

pub fn out_of_scope(what: &str) -> MathParserException {
    MathParserException::new(format!(
        "{} is not supported by calcpad-rs yet (out of scope for phase 1).",
        what
    ))
}

fn make_real_value_token(value: &str) -> CResult<Token> {
    let number = super::number_parser::parse(value)?;
    let mut t = Token::value(Value::Real(RealValue::num(number)));
    t.content = value.to_string();
    t.ttype = TokenTypes::Constant;
    Ok(t)
}

fn make_imaginary_value_token(value: &str) -> CResult<Token> {
    let number = super::number_parser::parse(value)?;
    let mut t = Token::value(Value::Complex(ComplexValue::new(0.0, number, None)));
    t.content = value.to_string();
    t.ttype = TokenTypes::Constant;
    Ok(t)
}

/// `double.Parse(s, CultureInfo.InvariantCulture)` for input field values.
pub fn parse_double_invariant(s: &str) -> Option<f64> {
    let t = trim(s);
    if t.is_empty() {
        return None;
    }
    let ok = t
        .chars()
        .all(|c| c.is_ascii_digit() || matches!(c, '.' | '-' | '+' | 'e' | 'E' | ','));
    if !ok {
        return None;
    }
    t.replace(',', "").parse::<f64>().ok()
}

fn is_index(t: &Token) -> bool {
    t.ttype == TokenTypes::VectorIndex || t.ttype == TokenTypes::MatrixIndex
}

/// `Input.GetRpn` (shunting yard)
pub fn get_rpn(input: &[TokenRef]) -> Vec<TokenRef> {
    let mut output: Vec<TokenRef> = Vec::with_capacity(input.len());
    let mut stack: Vec<TokenRef> = Vec::with_capacity(20);
    let mut vector_stack = [0i64; 64];
    let mut matrix_stack = [0i64; 64];
    let mut vector_open_spans: [Option<SourceSpan>; 64] = [None; 64];
    let mut function_stack = [0i64; 64];
    let mut tovs = 0usize;
    let mut tofs = 0usize;
    for tr in input {
        let tt = tr.borrow().ttype;
        match tt {
            TokenTypes::Constant
            | TokenTypes::Unit
            | TokenTypes::Variable
            | TokenTypes::Vector
            | TokenTypes::Matrix
            | TokenTypes::Solver
            | TokenTypes::Input => output.push(tr.clone()),
            TokenTypes::VectorIndex | TokenTypes::MatrixIndex | TokenTypes::Operator => {
                let (content, order) = {
                    let t = tr.borrow();
                    (t.content.clone(), t.order)
                };
                if content != NEG_STR {
                    while let Some(next) = stack.last() {
                        let brk = {
                            let n = next.borrow();
                            let t = tr.borrow();
                            n.ttype == TokenTypes::Operator && (n.order > order || n.order == order && content == "^")
                                || is_index(&n) && is_index(&t)
                                || n.ttype == TokenTypes::BracketLeft
                                || n.ttype == TokenTypes::SquareBracketLeft
                        };
                        if brk {
                            break;
                        }
                        output.push(stack.pop().unwrap());
                    }
                }
                stack.push(tr.clone());
            }
            TokenTypes::Function => {
                if tr.borrow().content == "!" {
                    while let Some(next) = stack.last() {
                        let nt = next.borrow().ttype;
                        if nt == TokenTypes::Operator || nt == TokenTypes::BracketLeft {
                            break;
                        }
                        output.push(stack.pop().unwrap());
                    }
                    output.push(tr.clone());
                } else {
                    stack.push(tr.clone());
                }
            }
            TokenTypes::VectorFunction
            | TokenTypes::MatrixFunction
            | TokenTypes::Function2
            | TokenTypes::Function3
            | TokenTypes::MultiFunction
            | TokenTypes::Interpolation
            | TokenTypes::VectorFunction2
            | TokenTypes::VectorFunction3
            | TokenTypes::VectorMultiFunction
            | TokenTypes::MatrixFunction2
            | TokenTypes::MatrixFunction3
            | TokenTypes::MatrixFunction4
            | TokenTypes::MatrixFunction5
            | TokenTypes::MatrixIterativeFunction
            | TokenTypes::MatrixOptionalFunction
            | TokenTypes::MatrixMultiFunction
            | TokenTypes::CustomFunction => stack.push(tr.clone()),
            TokenTypes::BracketLeft => {
                tofs += 1;
                if tofs < function_stack.len() {
                    function_stack[tofs] = vector_stack[tovs];
                }
                stack.push(tr.clone());
            }
            TokenTypes::SquareBracketLeft => {
                tovs += 1;
                if tovs < vector_open_spans.len() {
                    vector_open_spans[tovs] = tr.borrow().source_origin.as_ref().and_then(SourceOrigin::primary_span);
                }
                if tovs < vector_stack.len() {
                    vector_stack[tovs] = 1;
                    matrix_stack[tovs] = 1;
                }
                stack.push(tr.clone());
            }
            TokenTypes::BracketRight
            | TokenTypes::SquareBracketRight
            | TokenTypes::Divisor
            | TokenTypes::RowDivisor => {
                while let Some(next) = stack.last().cloned() {
                    let nt = next.borrow().ttype;
                    if nt == TokenTypes::BracketLeft {
                        if tt == TokenTypes::BracketRight {
                            stack.pop();
                        }
                        break;
                    } else if nt == TokenTypes::SquareBracketLeft {
                        if tt == TokenTypes::SquareBracketRight || tt == TokenTypes::RowDivisor {
                            let mut vt = Token::new("", TokenTypes::Vector);
                            vt.kind = TokenKind::Vector(None);
                            vt.index = vector_stack[tovs];
                            let vt = vt.into_ref();
                            if let (Some(open), Some(close)) = (vector_open_spans.get(tovs).copied().flatten(), tr.borrow().source_origin.as_ref().and_then(SourceOrigin::primary_span)) {
                                set_derived_span(&vt, vec![open, close]);
                            }
                            output.push(vt.clone());
                            if tt == TokenTypes::SquareBracketRight {
                                stack.pop();
                                if matrix_stack[tovs] > 1 {
                                    let mut mt = Token::new("", TokenTypes::Matrix);
                                    mt.kind = TokenKind::Matrix(None);
                                    mt.index = matrix_stack[tovs] * crate::vector::MAX_LENGTH;
                                    let mt = mt.into_ref();
                                    if let (Some(open), Some(close)) = (vector_open_spans.get(tovs).copied().flatten(), tr.borrow().source_origin.as_ref().and_then(SourceOrigin::primary_span)) {
                                        set_derived_span(&mt, vec![open, close]);
                                    }
                                    output.push(mt);
                                    vt.borrow_mut().ttype = TokenTypes::RowDivisor;
                                }
                            } else {
                                vt.borrow_mut().ttype = TokenTypes::RowDivisor;
                                vector_stack[tovs] = 1;
                                matrix_stack[tovs] += 1;
                            }
                        }
                        break;
                    }
                    output.push(stack.pop().unwrap());
                }
                if tt == TokenTypes::BracketRight {
                    vector_stack[tovs] = function_stack[tofs];
                    tofs = tofs.saturating_sub(1);
                } else if tt == TokenTypes::Divisor {
                    vector_stack[tovs] += 1;
                }
            }
            _ => {}
        }
    }
    while let Some(t) = stack.pop() {
        output.push(t);
    }
    let _ = DEFAULT_ORDER;
    let _ = Rc::new(());
    output
}


#[cfg(test)]
mod source_span_tests {
    use super::*;
    use crate::settings::MathSettings;
    use std::cell::RefCell;

    fn parser() -> MathParser {
        MathParser::new(Rc::new(RefCell::new(MathSettings::default())))
    }

    #[test]
    fn tokenizer_records_utf8_spans_for_unicode_prefixed_expression() {
        let source = "α + 2";
        let tokens = parser().get_input(source, false).unwrap();
        let spans: Vec<SourceSpan> = tokens
            .iter()
            .flat_map(token_source_spans)
            .collect();

        assert_eq!(spans.len(), 3);
        assert_eq!(spans[0].slice(source), Some("α"));
        assert_eq!(spans[1].slice(source), Some("+"));
        assert_eq!(spans[2].slice(source), Some("2"));
        assert_eq!(spans[0].start_byte, 0);
        assert_eq!(spans[0].end_byte, 2);
    }

    #[test]
    fn rpn_reordering_keeps_the_original_token_spans() {
        let source = "α + 2 * 3";
        let tokens = parser().get_input(source, false).unwrap();
        let before: Vec<Vec<SourceSpan>> = tokens.iter().map(token_source_spans).collect();
        let rpn = get_rpn(&tokens);
        let after: Vec<Vec<SourceSpan>> = rpn.iter().map(token_source_spans).collect();

        let mut expected = before;
        expected.sort_by_key(|spans| spans.first().map(|span| span.start_byte).unwrap_or(usize::MAX));
        let mut actual = after;
        actual.sort_by_key(|spans| spans.first().map(|span| span.start_byte).unwrap_or(usize::MAX));
        assert_eq!(actual, expected);
    }

    #[test]
    fn invalid_character_error_retains_its_original_unicode_aware_span() {
        let source = "α + @";
        let error = parser().get_input(source, false).unwrap_err();
        let span = error.source_span.expect("invalid character should have a source span");

        assert_eq!(span.start_byte, 5);
        assert_eq!(span.end_byte, 6);
        assert_eq!(span.slice(source), Some("@"));
    }
}
