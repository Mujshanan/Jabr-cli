//! Internal source provenance carried by Calcpad parser tokens.
//!
//! Coordinates are half-open UTF-8 byte ranges into the exact input string.
//! Character-indexed parser code must convert at the boundary with
//! `SourceSpan::from_char_range`; transformed tokens retain their origin.

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub(crate) struct SourceSpan {
    pub(crate) start_byte: usize,
    pub(crate) end_byte: usize,
}

impl SourceSpan {
    pub(crate) fn from_byte_range(source: &str, start_byte: usize, end_byte: usize) -> Option<Self> {
        if start_byte > end_byte
            || end_byte > source.len()
            || !source.is_char_boundary(start_byte)
            || !source.is_char_boundary(end_byte)
        {
            return None;
        }
        Some(Self { start_byte, end_byte })
    }

    pub(crate) fn from_char_range(source: &str, start_char: usize, end_char: usize) -> Option<Self> {
        SourceMap::new(source).span_from_chars(start_char, end_char)
    }

    pub(crate) fn merge(self, other: Self) -> Self {
        Self {
            start_byte: self.start_byte.min(other.start_byte),
            end_byte: self.end_byte.max(other.end_byte),
        }
    }

    pub(crate) fn slice<'a>(self, source: &'a str) -> Option<&'a str> {
        source.get(self.start_byte..self.end_byte)
    }
}

/// Precomputed character-boundary map for one immutable source revision.
/// Build once per parser invocation so mapping every token is O(1), not O(source_len).
#[derive(Clone, Debug)]
pub(crate) struct SourceMap {
    char_to_byte: Vec<usize>,
}

impl SourceMap {
    pub(crate) fn new(source: &str) -> Self {
        let mut char_to_byte: Vec<usize> = source.char_indices().map(|(byte, _)| byte).collect();
        char_to_byte.push(source.len());
        Self { char_to_byte }
    }

    pub(crate) fn span_from_chars(&self, start_char: usize, end_char: usize) -> Option<SourceSpan> {
        if start_char > end_char {
            return None;
        }
        Some(SourceSpan {
            start_byte: *self.char_to_byte.get(start_char)?,
            end_byte: *self.char_to_byte.get(end_char)?,
        })
    }
}

/// Provenance for tokens introduced or changed by parser transformations.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum SourceOrigin {
    /// A token that corresponds directly to one source range.
    Source(SourceSpan),
    /// A token synthesized from multiple source constructs (for example, an
    /// implicit multiplication operator or a vector/matrix RPN node).
    Derived(Vec<SourceSpan>),
    /// A generated token with no source text, anchored at a source byte offset.
    Synthetic { anchor_byte: usize },
}

impl SourceOrigin {
    pub(crate) fn primary_span(&self) -> Option<SourceSpan> {
        match self {
            Self::Source(span) => Some(*span),
            Self::Derived(spans) => spans.iter().copied().reduce(SourceSpan::merge),
            Self::Synthetic { .. } => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_character_ranges_to_utf8_byte_ranges() {
        let source = "α + β";
        let span = SourceSpan::from_char_range(source, 4, 5).unwrap();
        assert_eq!(span, SourceSpan { start_byte: 5, end_byte: 7 });
        assert_eq!(span.slice(source), Some("β"));
    }

    #[test]
    fn accepts_empty_span_at_end_of_unicode_source() {
        let source = "力";
        let span = SourceSpan::from_char_range(source, 1, 1).unwrap();
        assert_eq!(span, SourceSpan { start_byte: 3, end_byte: 3 });
    }

    #[test]
    fn rejects_invalid_ranges_and_non_character_boundaries() {
        let source = "力x";
        assert!(SourceSpan::from_byte_range(source, 1, 2).is_none());
        assert!(SourceSpan::from_byte_range(source, 0, 5).is_none());
        assert!(SourceSpan::from_char_range(source, 2, 1).is_none());
        assert!(SourceSpan::from_char_range(source, 3, 3).is_none());
    }

    #[test]
    fn merges_provenance_without_losing_the_original_extent() {
        let source = "a + β";
        let a = SourceSpan::from_char_range(source, 0, 1).unwrap();
        let beta = SourceSpan::from_char_range(source, 4, 5).unwrap();
        assert_eq!(a.merge(beta), SourceSpan { start_byte: 0, end_byte: 6 });
    }
}
