import { inflateRawSync } from "node:zlib";

const MAX_EXPANDED_BYTES = 20 * 1024 * 1024;
const MAX_ENTRIES = 200;

/** Check ZIP metadata before ExcelJS inflates it. Only ordinary bounded OOXML archives are accepted. */
export function validateXlsxArchive(input: ArrayBuffer): void {
  const bytes = Buffer.from(input);
  const reject = () => { throw new Error("El Excel contiene un archivo no permitido o supera el tamaño descomprimido permitido (20 MB)."); };
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (bytes.readUInt32LE(i) === 0x06054b50 && i + 22 + bytes.readUInt16LE(i + 20) === bytes.length) { end = i; break; }
  }
  if (end < 0) return reject();
  const count = bytes.readUInt16LE(end + 10);
  const size = bytes.readUInt32LE(end + 12);
  let offset = bytes.readUInt32LE(end + 16);
  if (!count || count > MAX_ENTRIES || bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6) || bytes.readUInt16LE(end + 8) !== count || offset + size !== end) return reject();
  let expanded = 0;
  const names = new Set<string>();
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || bytes.readUInt32LE(offset) !== 0x02014b50) return reject();
    const flags = bytes.readUInt16LE(offset + 8);
    const method = bytes.readUInt16LE(offset + 10);
    const compressed = bytes.readUInt32LE(offset + 20);
    const uncompressed = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const localOffset = bytes.readUInt32LE(offset + 42);
    const next = offset + 46 + nameLength + extraLength + commentLength;
    if (next > end || flags & 1 || ![0, 8].includes(method) || compressed === 0xffffffff || uncompressed === 0xffffffff || localOffset + 30 > offset) return reject();
    const name = bytes.toString("utf8", offset + 46, offset + 46 + nameLength);
    if (names.has(name) || name.includes("..") || /[\\\u0000]/u.test(name) || name.startsWith("/") || /(?:vbaproject|externallinks|embeddings|activex)|\.(?:bin|exe|js|vbs)$/iu.test(name)) return reject();
    names.add(name);
    // ExcelJS reads the local entries: prevent central/local metadata discrepancies.
    if (bytes.readUInt32LE(localOffset) !== 0x04034b50 || bytes.readUInt16LE(localOffset + 6) !== flags || bytes.readUInt16LE(localOffset + 8) !== method) return reject();
    const localNameLength = bytes.readUInt16LE(localOffset + 26);
    const dataStart = localOffset + 30 + localNameLength + bytes.readUInt16LE(localOffset + 28);
    if (bytes.toString("utf8", localOffset + 30, localOffset + 30 + localNameLength) !== name || dataStart + compressed > bytes.readUInt32LE(end + 16)) return reject();
    if (!(flags & 8) && (bytes.readUInt32LE(localOffset + 18) !== compressed || bytes.readUInt32LE(localOffset + 22) !== uncompressed)) return reject();
    expanded += uncompressed;
    if (expanded > MAX_EXPANDED_BYTES) return reject();
    const compressedData = bytes.subarray(dataStart, dataStart + compressed);
    // Never trust advertised sizes alone: a forged archive may expand beyond its directory entry.
    const data = method === 8 ? inflateRawSync(compressedData, { maxOutputLength: Math.max(1, uncompressed) }) : compressedData;
    if (data.length !== uncompressed) return reject();
    if (/^xl\/worksheets\/[^/]+\.xml$/u.test(name)) {
      const xml = data.toString("utf8");
      const rows = [...xml.matchAll(/<row\b[^>]*\br="(\d+)"/gu)];
      if (rows.length > 1010 || rows.some((row) => Number(row[1]) > 1010)) return reject();
      for (const cell of xml.matchAll(/<c\b[^>]*\br="([A-Z]+)(\d+)"/gu)) {
        const column = [...cell[1]].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0);
        if (column > 128 || Number(cell[2]) > 1010) return reject();
      }
    }
    offset = next;
  }
  if (offset !== end || !names.has("[Content_Types].xml") || !names.has("xl/workbook.xml")) return reject();
}
