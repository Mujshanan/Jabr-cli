import { describe, expect, it } from "vitest";
import { createSourceOffsetMap } from "./source-map";

describe("createSourceOffsetMap", () => {
  it("maps UTF-8 byte boundaries to UTF-16 code-unit offsets", () => {
    const source = "Aé𝄞e\u0301Z";
    const offsets = createSourceOffsetMap(source);
    expect(offsets.toUtf16(0)).toBe(0);
    expect(offsets.toUtf16(1)).toBe(1);
    expect(offsets.toUtf16(3)).toBe(2);
    expect(offsets.toUtf16(7)).toBe(4);
    expect(offsets.toUtf16(8)).toBe(5);
    expect(offsets.toUtf16Span({ startByte: 1, endByte: 7 })).toEqual({
      start: 1,
      end: 4,
      unit: "utf16",
    });
  });

  it("rejects offsets inside a multibyte UTF-8 character", () => {
    const offsets = createSourceOffsetMap("éx");
    expect(() => offsets.toUtf16(1)).toThrow(/splits a multi-byte character/);
  });

  it("rejects offsets outside the source and reversed spans", () => {
    const offsets = createSourceOffsetMap("abc");
    expect(() => offsets.toUtf16(4)).toThrow(/outside the source/);
    expect(() => offsets.toUtf16Span({ startByte: 2, endByte: 1 })).toThrow(/precedes its start/);
  });
});
