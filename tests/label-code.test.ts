// @vitest-environment node
import { BarcodeDetector } from "barcode-detector/ponyfill";
import { describe, expect, it } from "vitest";
import { code128Patterns, code128Widths, labelCodeFor } from "@/src/modules/shop/label-code";

// Node no trae las clases del DOM que el decodificador usa para entrada y resultado.
class NodeImageData {
  readonly colorSpace = "srgb";
  readonly [Symbol.toStringTag] = "ImageData";
  constructor(readonly data: Uint8ClampedArray, readonly width: number, readonly height: number) {}
}
globalThis.ImageData ??= NodeImageData as unknown as typeof ImageData;
globalThis.DOMRectReadOnly ??= class { constructor(readonly x = 0, readonly y = 0, readonly width = 0, readonly height = 0) {} } as unknown as typeof DOMRectReadOnly;

/** Imagen RGBA de una matriz de modulos con zona de silencio, para el mismo decodificador del escaner. */
function render(rows: boolean[][], moduleSize = 3) {
  const quiet = 10 * moduleSize;
  const width = rows[0].length * moduleSize + quiet * 2;
  const height = rows.length * moduleSize + quiet * 2;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  rows.forEach((row, rowIndex) => row.forEach((dark, column) => {
    if (!dark) return;
    for (let dy = 0; dy < moduleSize; dy += 1) {
      const offset = ((quiet + rowIndex * moduleSize + dy) * width + quiet + column * moduleSize) * 4;
      for (let dx = 0; dx < moduleSize; dx += 1) data.fill(0, offset + dx * 4, offset + dx * 4 + 3);
    }
  }));
  return new ImageData(data, width, height);
}

function barRows(widths: number[], height = 20) {
  const row = widths.flatMap((width, index) => Array<boolean>(width).fill(index % 2 === 0));
  return Array.from({ length: height }, () => row);
}

async function decode(rows: boolean[][], format: string) {
  const [result] = await new BarcodeDetector({ formats: [format as "qr_code"] }).detect(render(rows));
  return result?.rawValue;
}

describe("Code 128", () => {
  it("tiene 107 patrones distintos de 11 módulos, y el stop de 13", () => {
    expect(code128Patterns).toHaveLength(107);
    expect(new Set(code128Patterns).size).toBe(107);
    code128Patterns.forEach((pattern, index) => {
      const modules = [...pattern].reduce((sum, digit) => sum + Number(digit), 0);
      expect(modules, `símbolo ${index}`).toBe(index === 106 ? 13 : 11);
    });
  });

  it.each(["REP-0001", "FIL-ACEITE-10W40", "a b/c.d+e%", "0071234567890"])("el decodificador del escáner lee %s", async (text) => {
    const widths = code128Widths(text);
    expect(widths).not.toBeNull();
    expect(await decode(barRows(widths!), "code_128")).toBe(text);
  });

  it("rechaza lo que no entra en una etiqueta o no es ASCII imprimible", () => {
    expect(code128Widths("")).toBeNull();
    expect(code128Widths("PIÑÓN")).toBeNull();
    expect(code128Widths("A".repeat(21))).toBeNull();
  });
});

describe("código de la etiqueta", () => {
  it("usa Code 128 para un SKU corto", () => {
    expect(labelCodeFor("FIL-ACEITE-10W40")?.kind).toBe("code128");
  });

  it("usa un QR legible para el SKU automático de 36 caracteres", async () => {
    const sku = "REP-3F2504E04F8911D39A0C0305E82C3301";
    const code = labelCodeFor(sku);
    expect(code?.kind).toBe("qr");
    expect(await decode(code!.kind === "qr" ? code!.modules : [], "qr_code")).toBe(sku);
  });

  it("no imprime un código que el escáner leería distinto", () => {
    expect(labelCodeFor("PIÑÓN-TRASERO")).toBeNull();
  });
});
