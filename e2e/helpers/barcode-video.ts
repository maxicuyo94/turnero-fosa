import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Video Y4M con un EAN-13 dibujado, para usarlo como camara falsa de Chromium
// (--use-file-for-fake-video-capture) y probar el lector de punta a punta.

const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const G = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
const R = L.map((code) => [...code].map((bit) => (bit === "0" ? "1" : "0")).join(""));
const PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

/** Completa 12 digitos con el digito verificador EAN-13. */
export function ean13(first12: string): string {
  if (!/^\d{12}$/u.test(first12)) throw new Error("EAN-13 needs 12 digits");
  const sum = [...first12].reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
  return `${first12}${(10 - (sum % 10)) % 10}`;
}

function ean13Modules(code: string): string {
  const digits = [...code].map(Number);
  const parity = PARITY[digits[0]];
  const left = digits.slice(1, 7).map((digit, index) => (parity[index] === "L" ? L : G)[digit]).join("");
  const right = digits.slice(7).map((digit) => R[digit]).join("");
  return `101${left}01010${right}101`;
}

/** Escribe el video en la carpeta temporal y devuelve su ruta. */
export function writeBarcodeVideo(code: string): string {
  const width = 640;
  const height = 480;
  const moduleWidth = 4;
  const modules = ean13Modules(code);
  const barsLeft = Math.floor((width - modules.length * moduleWidth) / 2);
  const barsTop = 140;
  const barsBottom = 340;

  const luma = Buffer.alloc(width * height, 235);
  for (let y = barsTop; y < barsBottom; y += 1) {
    for (let index = 0; index < modules.length; index += 1) {
      if (modules[index] !== "1") continue;
      luma.fill(16, y * width + barsLeft + index * moduleWidth, y * width + barsLeft + (index + 1) * moduleWidth);
    }
  }
  const chroma = Buffer.alloc((width / 2) * (height / 2), 128);
  const frame = Buffer.concat([Buffer.from("FRAME\n"), luma, chroma, chroma]);
  const header = Buffer.from(`YUV4MPEG2 W${width} H${height} F10:1 Ip A1:1 C420jpeg\n`);

  const path = join(tmpdir(), `turnero-barcode-${code}.y4m`);
  writeFileSync(path, Buffer.concat([header, frame, frame, frame]));
  return path;
}
