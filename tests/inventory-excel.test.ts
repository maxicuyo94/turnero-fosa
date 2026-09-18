// @vitest-environment node
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { InventoryExcelError, parseInventoryExcel } from "@/src/modules/shop/inventory-excel";

describe("inventory Excel import", () => {
  it("generates stable distinct SKUs for blank cells without treating zero as blank", async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile("public/plantilla-carga-inventario.xlsx");
    const sheet = workbook.getWorksheet("Carga")!;
    sheet.getRow(5).values = ["", "", "Filtro", "Filtros", "", "", "", 10, 2, 1, "", "Sí"];
    sheet.getRow(6).values = ["  ", "", "Cadena", "Transmisión", "", "", "", 20, 3, 1, "", "Sí"];
    const file = async () => new File([await workbook.xlsx.writeBuffer()], "inventario.xlsx");
    const first = await parseInventoryExcel(await file());
    const second = await parseInventoryExcel(await file());
    expect(first[0].sku).toMatch(/^REP-[A-F0-9]{24}$/u);
    expect(first[0].sku).not.toBe(first[1].sku);
    expect(second.map((product) => product.sku)).toEqual(first.map((product) => product.sku));
    const firstRow = sheet.getRow(5).values;
    sheet.getRow(5).values = sheet.getRow(6).values;
    sheet.getRow(6).values = firstRow;
    expect((await parseInventoryExcel(await file())).map((product) => product.sku))
      .toEqual([first[1].sku, first[0].sku]);
    sheet.getRow(5).getCell(1).value = "0";
    expect((await parseInventoryExcel(await file()))[0].sku).toBe("0");
  });

  it("reads the published template and preserves typed identifiers and numbers", async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile("public/plantilla-carga-inventario.xlsx");
    const sheet = workbook.getWorksheet("Carga")!;
    sheet.getRow(5).values = [" rep-001 ", "000123", "Filtro de aceite", "Filtros", "Honda", "Wave 110", "Filtro original", 1250.5, 3, 1, "A-2", "Sí"];
    const buffer = await workbook.xlsx.writeBuffer();

    const rows = await parseInventoryExcel(new File([buffer], "inventario.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    expect(rows).toEqual([expect.objectContaining({
      sku: "REP-001",
      barcode: "000123",
      name: "Filtro de aceite",
      priceArs: "1250.50",
      initialStock: 3,
      minimumStock: 1,
      isActive: true,
    })]);
  });

  it("reports the Excel row and rejects the entire file when data is invalid", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Carga");
    sheet.addRow(["SKU", "Código de barras", "Nombre", "Categoría", "Marca", "Compatibilidad", "Descripción", "Precio ARS", "Stock inicial", "Stock mínimo", "Ubicación", "Activo"]);
    sheet.addRow(["REP-2", "", "", "Filtros", "", "", "", 0, -1, 1, "", "Tal vez"]);
    const buffer = await workbook.xlsx.writeBuffer();

    await expect(parseInventoryExcel(new File([buffer], "inventario.xlsx"))).rejects.toMatchObject({
      message: expect.stringContaining("No se importó ningún producto"),
      issues: expect.arrayContaining([expect.stringMatching(/^Fila 2/u)]),
    } satisfies Partial<InventoryExcelError>);
  });

  it("rejects files without the official headers", async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Productos").addRow(["Producto", "Cantidad"]);
    const buffer = await workbook.xlsx.writeBuffer();
    await expect(parseInventoryExcel(new File([buffer], "inventario.xlsx"))).rejects.toThrow("No encontramos los encabezados");
  });

  it("reads rows after gaps and reports their real row number", async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile("public/plantilla-carga-inventario.xlsx");
    const sheet = workbook.getWorksheet("Carga")!;
    sheet.getRow(5).values = [];
    sheet.getRow(900).values = ["GAP-1", "00001", "Filtro", "Filtros", "", "", "", 10.01, 0, 0, "", "No"];
    const file = () => workbook.xlsx.writeBuffer().then((buffer) => new File([buffer], "inventario.xlsx"));
    await expect(parseInventoryExcel(await file())).resolves.toEqual([
      expect.objectContaining({ sku: "GAP-1", priceArs: "10.01", isActive: false, initialStock: 0 }),
    ]);
    sheet.getRow(900).getCell(9).value = -1;
    await expect(parseInventoryExcel(await file())).rejects.toMatchObject({ issues: expect.arrayContaining([expect.stringContaining("Fila 900")]) });
  });

  it("rejects empty, oversized, incorrect-format and damaged files", async () => {
    await expect(parseInventoryExcel(new File([], "empty.xlsx"))).rejects.toThrow("Seleccioná");
    await expect(parseInventoryExcel(new File([new Uint8Array(3 * 1024 * 1024 + 1)], "large.xlsx"))).rejects.toThrow("3 MB");
    await expect(parseInventoryExcel(new File(["csv"], "data.csv"))).rejects.toThrow(".xlsx");
    await expect(parseInventoryExcel(new File(["broken"], "data.xlsx"))).rejects.toThrow("No pudimos leer");
  });

  it("rejects an empty template and more than 1000 products", async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile("public/plantilla-carga-inventario.xlsx");
    workbook.getWorksheet("Carga")!.getRow(5).values = [];
    const file = () => workbook.xlsx.writeBuffer().then((buffer) => new File([buffer], "inventario.xlsx"));
    await expect(parseInventoryExcel(await file())).rejects.toThrow("no contiene productos");
    for (let index = 0; index < 1001; index += 1) {
      workbook.getWorksheet("Carga")!.getRow(index + 5).values = [`SKU-${index}`, "", "Filtro", "Filtros", "", "", "", 1, 0, 0, "", "Sí"];
    }
    await expect(parseInventoryExcel(await file())).rejects.toThrow("1.000 productos");
  });
});
