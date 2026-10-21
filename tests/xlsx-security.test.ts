// @vitest-environment node
import { deflateRawSync } from "node:zlib";
import { expect, it } from "vitest";
import { validateXlsxArchive } from "@/src/lib/xlsx-security";

function archive(files: Array<{ name: string; data: string; declaredSize?: number }>): ArrayBuffer {
  const entries: Buffer[] = []; const directory: Buffer[] = []; let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name); const data = Buffer.from(file.data); const compressed = deflateRawSync(data);
    const header = Buffer.alloc(30); header.writeUInt32LE(0x04034b50); header.writeUInt16LE(8, 8);
    header.writeUInt32LE(compressed.length, 18); header.writeUInt32LE(file.declaredSize ?? data.length, 22); header.writeUInt16LE(name.length, 26);
    entries.push(header, name, compressed);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(8, 10);
    central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(file.declaredSize ?? data.length, 24);
    central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42); directory.push(central, name);
    offset += header.length + name.length + compressed.length;
  }
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(Buffer.concat(directory).length, 12); end.writeUInt32LE(offset, 16);
  const result = Buffer.concat([...entries, ...directory, end]);
  return Uint8Array.from(result).buffer;
}
const required = [{ name: "[Content_Types].xml", data: "types" }, { name: "xl/workbook.xml", data: "workbook" }];

it("rejects ZIP bombs even when central and local sizes both lie", () => {
  expect(() => validateXlsxArchive(archive([...required, { name: "xl/worksheets/sheet1.xml", data: "x".repeat(500000), declaredSize: 100 }]))).toThrow();
});
it("rejects macros, external links, embedded files and traversal paths", () => {
  for (const name of ["xl/vbaProject.bin", "xl/externalLinks/externalLink1.xml", "xl/embeddings/file.xml", "../file.xml"]) {
    expect(() => validateXlsxArchive(archive([...required, { name, data: "payload" }]))).toThrow();
  }
});
it("rejects sparse rows and columns that can force excessive worksheet allocation", () => {
  for (const data of ['<row r="1048576"><c r="A1048576"/></row>', '<row r="2"><c r="XFD2"/></row>']) {
    expect(() => validateXlsxArchive(archive([...required, { name: "xl/worksheets/sheet1.xml", data }]))).toThrow();
  }
  expect(() => validateXlsxArchive(archive([...required, { name: "xl/worksheets/sheet1.xml", data: '<row r="2"><c r="A2"/></row>' }]))).not.toThrow();
});
