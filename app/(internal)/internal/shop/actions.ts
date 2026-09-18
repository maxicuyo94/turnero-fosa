"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { auth, getInternalSessionUserId, isInternalSession } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import {
  InventoryError,
  createInventoryProduct,
  importInventoryProducts,
  recordInventoryMovement,
  updateInventoryProduct,
} from "@/src/modules/shop/inventory-service";
import { InventoryExcelError, parseInventoryExcel } from "@/src/modules/shop/inventory-excel";
import type { ShopActionState } from "@/src/modules/shop/inventory-action-state";

export async function createInventoryProductAction(
  _previous: ShopActionState,
  formData: FormData,
): Promise<ShopActionState> {
  const actorId = await requireShopAccess();
  const values = formValues(formData);
  try {
    const product = await createInventoryProduct(db, {
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
  const actorId = await requireShopAccess();
  try {
    const file = formData.get("file");
    if (!(file instanceof File)) return { status: "error", message: "Seleccioná un archivo Excel para importar." };
    const products = await parseInventoryExcel(file);
    const result = await importInventoryProducts(db, products, actorId);
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
  await requireShopAccess();
  const values = formValues(formData);
  try {
    const product = await updateInventoryProduct(db, {
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
  const actorId = await requireShopAccess();
  const values = formValues(formData);
  try {
    const product = await recordInventoryMovement(db, {
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

async function requireShopAccess(): Promise<string> {
  const session = await auth();
  const actorId = getInternalSessionUserId(session);
  if (!isInternalSession(session) || !actorId) redirect("/internal/login");
  return actorId;
}

function formValues(formData: FormData): Record<string, string> {
  return Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [key, typeof value === "string" ? value : ""]));
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
