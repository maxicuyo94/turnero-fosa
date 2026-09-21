import { describe, expect, it } from "vitest";
import { normalizeLicensePlate, normalizePhone } from "@/src/modules/customers/identity";

describe("license plate normalization", () => {
  it("resolves the same unit regardless of spacing, punctuation or case", () => {
    expect(normalizeLicensePlate("ab 123 cd")).toBe("AB123CD");
    expect(normalizeLicensePlate("AB-123-CD")).toBe("AB123CD");
    expect(normalizeLicensePlate("  Ab123Cd  ")).toBe("AB123CD");
    expect(normalizeLicensePlate("a.b/123 cd")).toBe("AB123CD");
  });

  it("returns null when there is nothing left to identify a unit by", () => {
    expect(normalizeLicensePlate(undefined)).toBeNull();
    expect(normalizeLicensePlate(null)).toBeNull();
    expect(normalizeLicensePlate("")).toBeNull();
    expect(normalizeLicensePlate("   ")).toBeNull();
    expect(normalizeLicensePlate("- - -")).toBeNull();
  });

  it("keeps digits and letters from older plate formats", () => {
    expect(normalizeLicensePlate("123 ABC")).toBe("123ABC");
    expect(normalizeLicensePlate("A 001 BCD")).toBe("A001BCD");
  });
});

describe("phone normalization", () => {
  it("keeps only digits so formatting never splits a customer", () => {
    expect(normalizePhone("+54 9 11 1234-5678")).toBe("5491112345678");
    expect(normalizePhone("(011) 1234 5678")).toBe("01112345678");
  });

  it("returns null when no digit remains", () => {
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("sin telefono")).toBeNull();
  });
});
