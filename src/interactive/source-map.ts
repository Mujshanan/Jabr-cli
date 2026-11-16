import type { AstSourceSpan } from "./ast-renderer";

export interface Utf8ByteSpan {
  readonly startByte: number;
  readonly endByte: number;
}

export interface SourceOffsetMap {
  /** Convert an exact UTF-8 code-point boundary to a UTF-16 code-unit offset. */
  toUtf16(byteOffset: number): number;
  /** Convert an end-exclusive UTF-8 byte span to the AST explorer's UI span. */
  toUtf16Span(span: Utf8ByteSpan): AstSourceSpan;
}

/**
 * Build a source-specific offset map without treating UTF-8 bytes, Unicode
 * scalar values, and JavaScript UTF-16 code units as interchangeable.
 *
 * Offsets inside a multi-byte UTF-8 sequence are rejected rather than rounded.
 */
export function createSourceOffsetMap(source: string): SourceOffsetMap {
  const byteLength = Array.from(source).reduce((total, character) => {
    const point = character.codePointAt(0)!;
    return total + (point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4);
  }, 0);
  const byteToUtf16 = new Int32Array(byteLength + 1);
  byteToUtf16.fill(-1);

  let byteOffset = 0;
  let utf16Offset = 0;
  byteToUtf16[0] = 0;

  for (const character of source) {
    const point = character.codePointAt(0)!;
    const bytes = point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
    byteOffset += bytes;
    utf16Offset += character.length;
    byteToUtf16[byteOffset] = utf16Offset;
  }

  function toUtf16(offset: number): number {
    if (!Number.isInteger(offset) || offset < 0 || offset >= byteToUtf16.length) {
      throw new RangeError("UTF-8 byte offset is outside the source.");
    }
    const mapped = byteToUtf16[offset]!;
    if (mapped < 0) throw new RangeError("UTF-8 byte offset splits a multi-byte character.");
    return mapped;
  }

  return {
    toUtf16,
    toUtf16Span(span) {
      const start = toUtf16(span.startByte);
      const end = toUtf16(span.endByte);
      if (end < start) throw new RangeError("UTF-8 source span end precedes its start.");
      return { start, end, unit: "utf16" };
    },
  };
}
