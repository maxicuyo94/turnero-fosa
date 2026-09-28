"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { formValues } from "@/src/lib/form-data";
import { requireStaff } from "@/src/lib/staff-access";
import { inventory } from "@/src/lib/composition";
import { InventoryError } from "@/src/modules/shop/inventory-service";
import { InventoryExcelError, parseInventoryExcel } from "@/src/modules/shop/inventory-excel";
import type { ShopActionState } from "@/src/modules/shop/inventory-action-state";

export async function createInventoryProductAction(
  _previous: ShopActionState,
  formData: FormData,
): Promise<ShopActionState> {
  const { userId: actorId } = await requireStaff();
  const values = formValues(formData);
  try {
    const product = await inventory.createInventoryProduct({
      sku: values.sku,
      barcode: values.barcode,
      name: values.name,
      description: values.description,
      category: values.category,
      brand: values.brand,
      compatibility: values.compatibility,
      location: values.location,
      priceArs: values.priceArs,
      initialStock: values.initialStock,
      minimumStock: values.minimumStock,
      isActive: values.isActive === "true",
      requestKey: values.requestKey,
    }, actorId);
    revalidatePath("/internal/shop");
    revalidatePath("/internal/shop/inventory");
    return { status: "success", message: "Repuesto cargado correctamente.", productId: product.id };
  } catch (error) {
    return actionFailure(error, values);
  }
}

export async function importInventoryExcelAction(
  _previous: ShopActionState,
  formData: FormData,
): Promise<ShopActionState> {
  const { userId: actorId } = await requireStaff();
  try {
    const file = formData.get("file");
    if (!(file instanceof File)) return { status: "error", message: "Seleccioná un archivo Excel para importar." };
    const products = await parseInventoryExcel(file);
    const result = await inventory.importInventoryProducts(products, actorId);
    revalidatePath("/internal/shop");
    revalidatePath("/internal/shop/inventory");
    return {
      status: "success",
      message: `Importamos ${result.count} ${result.count === 1 ? "repuesto" : "repuestos"} y ${result.initialUnits.toLocaleString("es-AR")} unidades iniciales.`,
      importedCount: result.count,
    };
  } catch (error) {
    if (error instanceof InventoryExcelError) return { status: "error", message: error.message, issues: error.issues };
    return actionFailure(error, {});
  }
}

export async function updateInventoryProductAction(
  _previous: ShopActionState,
  formData: FormData,
): Promise<ShopActionState> {
  await requireStaff();
  const values = formValues(formData);
  try {
    const product = await inventory.updateInventoryProduct({
      id: values.id,
      version: values.version,
      sku: values.sku,
      barcode: values.barcode,
      name: values.name,
      description: values.description,
      category: values.category,
      brand: values.brand,
      compatibility: values.compatibility,
      location: values.location,
      priceArs: values.priceArs,
      minimumStock: values.minimumStock,
      isActive: values.isActive === "true",
    });
    revalidatePath("/internal/shop");
    revalidatePath("/internal/shop/inventory");
    revalidatePath(`/internal/shop/inventory/${product.id}`);
    return { status: "success", message: "Ficha actualizada." };
  } catch (error) {
    return actionFailure(error, values);
  }
}

export async function recordInventoryMovementAction(
  _previous: ShopActionState,
  formData: FormData,
): Promise<ShopActionState> {
  const { userId: actorId } = await requireStaff();
  const values = formValues(formData);
  try {
    const product = await inventory.recordInventoryMovement({
      productId: values.productId,
      kind: values.kind,
      quantity: values.quantity,
      reason: values.reason,
      reference: values.reference,
      version: values.version,
      requestKey: values.requestKey,
    }, actorId);
    revalidatePath("/internal/shop");
    revalidatePath("/internal/shop/inventory");
    revalidatePath(`/internal/shop/inventory/${product.id}`);
    return { status: "success", message: "Movimiento registrado." };
  } catch (error) {
    return actionFailure(error, values);
  }
}

export async function linkInventoryBarcodeAction(formData: FormData) {
  await requireStaff();
  const values = formValues(formData);
  let productId: string;
  try {
    productId = (await inventory.linkInventoryBarcode(values)).id;
  } catch (error) {
    const message = actionFailure(error, values).message ?? "No se pudo vincular el código.";
    redirect(`/internal/shop/inventory/code?${new URLSearchParams({ value: values.barcode ?? "", error: message })}`);
  }
  revalidatePath("/internal/shop/inventory");
  redirect(`/internal/shop/inventory/${productId}?linked=1`);
}

function actionFailure(error: unknown, values: Record<string, string>): ShopActionState {
  if (error instanceof InventoryError) return { status: "error", message: error.message, values };
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    return { status: "error", message: issue?.message ?? "Revisá los datos ingresados.", values };
  }
  console.error("shop inventory action failed", error);
  return { status: "error", message: "No se pudo guardar. Probá nuevamente.", values };
}
