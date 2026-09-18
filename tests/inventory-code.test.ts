import { describe, expect, it } from "vitest";
import { compactInventoryCode, inventoryCodeCandidates, normalizeScannedCode } from "@/src/modules/shop/inventory-code";

describe("normalizeScannedCode", () => {
  it("conserva ceros iniciales y quita espacios y saltos que agrega el lector", () => {
    expect(normalizeScannedCode(" 0071234567890\r\n")).toBe("0071234567890");
    expect(normalizeScannedCode("REP 12\t3")).toBe("REP123");
  });

  it("descarta valores vacíos, no textuales o demasiado largos", () => {
    expect(normalizeScannedCode("   ")).toBeNull();
    expect(normalizeScannedCode(undefined)).toBeNull();
    expect(normalizeScannedCode(123)).toBeNull();
    expect(normalizeScannedCode("9".repeat(129))).toBeNull();
    expect(normalizeScannedCode("9".repeat(128))).toHaveLength(128);
  });
});

describe("inventoryCodeCandidates", () => {
  it("trata UPC-A y su EAN-13 con cero inicial como el mismo código", () => {
    expect(inventoryCodeCandidates("071234567890")).toEqual(["071234567890", "0071234567890"]);
    expect(inventoryCodeCandidates("0071234567890")).toEqual(["0071234567890", "071234567890"]);
  });

  it("no inventa equivalencias para otros códigos", () => {
    expect(inventoryCodeCandidates("7791234567890")).toEqual(["7791234567890"]);
    expect(inventoryCodeCandidates("rep-00012")).toEqual(["REP00012"]);
  });

  it("compara sin separadores ni caracteres invisibles", () => {
    expect(inventoryCodeCandidates("7 791234 567890")).toEqual(["7791234567890"]);
    expect(inventoryCodeCandidates("0-71234-56789-0")).toEqual(["071234567890", "0071234567890"]);
    expect(inventoryCodeCandidates("---")).toEqual([]);
  });
});

describe("compactInventoryCode", () => {
  it("deja solo letras y números en mayúsculas", () => {
    expect(compactInventoryCode(" 779.1234-567 890​")).toBe("7791234567890");
    expect(compactInventoryCode("abc-12")).toBe("ABC12");
  });
});
