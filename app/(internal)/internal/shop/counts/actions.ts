"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { formString, formValues } from "@/src/lib/form-data";
import { requireStaff } from "@/src/lib/staff-access";
import { stockCounts } from "@/src/lib/composition";
import { InventoryError } from "@/src/modules/shop/inventory-service";

export async function openStockCountAction(formData: FormData) {
  const { userId } = await requireStaff();
  let countId: string;
  try {
    countId = (await stockCounts.openStockCount(formValues(formData), userId)).id;
  } catch (error) {
    redirect(`/internal/shop/counts?${new URLSearchParams({ error: failureMessage(error) })}`);
  }
  revalidatePath("/internal/shop/counts");
  redirect(`/internal/shop/counts/${countId}`);
}

export async function recordCountedQuantityAction(formData: FormData) {
  const { userId } = await requireStaff();
  const values = formValues(formData);
  await runOnCount(values.countId, formString(formData, "view"), () => stockCounts.recordCountedQuantity(values, userId), "Cantidad guardada.");
}

export async function recountStockCountLineAction(formData: FormData) {
  await requireStaff();
  const values = formValues(formData);
  await runOnCount(values.countId, formString(formData, "view"), () => stockCounts.recountStockCountLine(values), "Base actualizada: contalo de nuevo.");
}

export async function applyStockCountAction(formData: FormData) {
  const { userId } = await requireStaff();
  const values = formValues(formData);
  await runOnCount(values.countId, "", async () => {
    await stockCounts.applyStockCount(values, userId);
    revalidatePath("/internal/shop");
    revalidatePath("/internal/shop/inventory");
  }, "Conteo aplicado. Los ajustes quedaron en el historial de cada repuesto.");
}

export async function cancelStockCountAction(formData: FormData) {
  const { userId } = await requireStaff();
  const values = formValues(formData);
  await runOnCount(values.countId, "", () => stockCounts.cancelStockCount(values, userId), "Conteo cancelado. El stock no cambió.");
}

/** Ejecuta la operacion y vuelve al conteo con el resultado; la pagina relee todo de la base. */
async function runOnCount(countId: string | undefined, view: string, operation: () => Promise<unknown>, success: string): Promise<never> {
  const id = (countId ?? "").slice(0, 128);
  const params = new URLSearchParams(["pending", "diff", "review"].includes(view) ? { view } : {});
  try {
    await operation();
    params.set("notice", success);
  } catch (error) {
    params.set("error", failureMessage(error));
  }
  revalidatePath(`/internal/shop/counts/${id}`);
  revalidatePath("/internal/shop/counts");
  redirect(`/internal/shop/counts/${encodeURIComponent(id)}?${params}`);
}

function failureMessage(error: unknown) {
  if (error instanceof InventoryError) return error.message;
  if (error instanceof ZodError) return error.issues[0]?.message ?? "Revisá los datos ingresados.";
  console.error("stock count action failed", error);
  return "No se pudo guardar. Probá nuevamente.";
}
