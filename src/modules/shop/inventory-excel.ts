import { createHash, randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { z } from "zod";
import { createInventoryProductSchema } from "@/src/modules/shop/inventory-schemas";

const MAX_FILE_BYTES = 3 * 1024 * 1024;
const MAX_ROWS = 1_000;
const headers = [
  ["sku", "SKU"],
  ["barcode", "Código de barras"],
  ["name", "Nombre"],
  ["category", "Categoría"],
  ["brand", "Marca"],
  ["compatibility", "Compatibilidad"],
  ["description", "Descripción"],
  ["priceArs", "Precio ARS"],
  ["initialStock", "Stock inicial"],
  ["minimumStock", "Stock mínimo"],
  ["location", "Ubicación"],
  ["isActive", "Activo"],
] as const;

export class InventoryExcelError extends Error {
  constructor(message: string, readonly issues: string[] = []) {
    super(message);
    this.name = "InventoryExcelError";
  }
}

export async function parseInventoryExcel(file: File): Promise<z.input<typeof createInventoryProductSchema>[]> {
  if (!(file instanceof File) || file.size === 0) throw new InventoryExcelError("Seleccioná un archivo Excel para importar.");
  if (file.size > MAX_FILE_BYTES) throw new InventoryExcelError("El archivo no puede superar 3 MB.");
  if (!file.name.toLowerCase().endsWith(".xlsx")) throw new InventoryExcelError("Usá un archivo .xlsx basado en la plantilla.");

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    throw new InventoryExcelError("No pudimos leer el Excel. Descargá la plantilla y volvé a intentarlo.");
  }

  const sheet = workbook.getWorksheet("Carga") ?? workbook.worksheets[0];
  if (!sheet) throw new InventoryExcelError("El Excel no contiene una hoja para importar.");
  const headerRowNumber = findHeaderRow(sheet);
  if (!headerRowNumber) throw new InventoryExcelError("No encontramos los encabezados de la plantilla en la hoja Carga.");

  const columnByKey = new Map<string, number>();
  const headerRow = sheet.getRow(headerRowNumber);
  headerRow.eachCell({ includeEmpty: false }, (cell, column) => {
    const key = headers.find(([, label]) => normalizeHeader(label) === normalizeHeader(cellText(cell.value)))?.[0];
    if (key && columnByKey.has(key)) throw new InventoryExcelError(`La columna ${cellText(cell.value)} está repetida.`);
    if (key) columnByKey.set(key, column);
  });
  const missing = headers.filter(([key]) => !columnByKey.has(key)).map(([, label]) => label);
  if (missing.length) throw new InventoryExcelError(`Faltan columnas obligatorias de la plantilla: ${missing.join(", ")}.`);

  const populatedRows: Array<{ rowNumber: number; values: Record<string, unknown> }> = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowNumber) return;
    const values = Object.fromEntries(headers.map(([key]) => [key, cellValue(row.getCell(columnByKey.get(key)!))]));
    if (Object.values(values).every((value) => value === null || (typeof value === "string" && value.trim() === ""))) return;
    populatedRows.push({ rowNumber, values });
  });
  if (!populatedRows.length) throw new InventoryExcelError("El Excel no contiene productos para importar.");
  if (populatedRows.length > MAX_ROWS) throw new InventoryExcelError(`Podés importar hasta ${MAX_ROWS.toLocaleString("es-AR")} productos por archivo.`);

  const issues: string[] = [];
  const parsed: z.input<typeof createInventoryProductSchema>[] = [];
  for (const { rowNumber, values } of populatedRows) {
    const active = parseActive(values.isActive);
    const result = createInventoryProductSchema.safeParse({ ...values, isActive: active, requestKey: randomUUID() });
    if (!result.success) {
      for (const issue of result.error.issues) {
        const label = headers.find(([key]) => key === String(issue.path[0]))?.[1];
        issues.push(`Fila ${rowNumber}${label ? ` · ${label}` : ""}: ${issue.message}`);
      }
    } else {
      // Keep blank-SKU Excel rows stable across uploads, including reordered rows.
      // Otherwise uploading the same file twice would generate new products.
      const { sku, requestKey, ...content } = result.data;
      const importSku = typeof values.sku === "string" && values.sku.trim()
        ? sku
        : `REP-${createHash("sha256").update(JSON.stringify(content)).digest("hex").slice(0, 24).toUpperCase()}`;
      // The service validates again and converts ARS to cents exactly once.
      parsed.push({ ...content, sku: importSku, requestKey, priceArs: (result.data.priceArs / 100).toFixed(2) });
    }
  }
  if (issues.length) throw new InventoryExcelError(
    `Encontramos ${issues.length} ${issues.length === 1 ? "error" : "errores"}. No se importó ningún producto.`,
    issues.slice(0, 25),
  );
  return parsed;
}

function findHeaderRow(sheet: ExcelJS.Worksheet): number | null {
  for (let rowNumber = 1; rowNumber <= Math.min(sheet.rowCount, 10); rowNumber += 1) {
    const labels = sheet.getRow(rowNumber).values;
    if (Array.isArray(labels) && headers.every(([, label]) => labels.some((value) => normalizeHeader(cellText(value)) === normalizeHeader(label)))) return rowNumber;
  }
  return null;
}

function cellValue(cell: ExcelJS.Cell): unknown {
  const value = cell.value;
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if ("result" in value) return value.result ?? null;
  if ("richText" in value) return value.richText.map((part) => part.text).join("");
  if ("text" in value) return value.text;
  return cell.text;
}

function cellText(value: ExcelJS.CellValue | unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && "text" in value && typeof value.text === "string") return value.text;
  if (typeof value === "object" && "richText" in value && Array.isArray(value.richText)) return value.richText.map((part: { text: string }) => part.text).join("");
  if (typeof value === "object" && "result" in value) return String(value.result ?? "");
  return "";
}

function normalizeHeader(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").trim().toLowerCase();
}

function parseActive(value: unknown): boolean | unknown {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1 ? true : value === 0 ? false : value;
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["si", "sí", "true", "1", "activo"].includes(normalized)) return true;
  if (["no", "false", "0", "inactivo"].includes(normalized)) return false;
  return value;
}
