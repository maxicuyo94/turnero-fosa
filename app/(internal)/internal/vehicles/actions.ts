"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth, isInternalSession } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import { PrismaVehicleRepository } from "@/src/modules/vehicles/prisma-repository";
import { mergeVehicles, updateVehicleDetails } from "@/src/modules/vehicles/service";

async function requireInternalUserId(): Promise<string | null> {
  const session = await auth();
  if (!isInternalSession(session)) redirect("/internal/login");
  return session?.user?.id ?? null;
}

export async function saveVehicleAction(formData: FormData) {
  await requireInternalUserId();
  const vehicleId = stringValue(formData, "vehicleId");
  const result = await updateVehicleDetails(new PrismaVehicleRepository(db), {
    vehicleId,
    vehicleTypeId: stringValue(formData, "vehicleTypeId"),
    brand: stringValue(formData, "brand"),
    model: stringValue(formData, "model"),
    year: stringValue(formData, "year"),
    vin: stringValue(formData, "vin"),
    engineNumber: stringValue(formData, "engineNumber"),
    color: stringValue(formData, "color"),
    notes: stringValue(formData, "notes"),
  });
  if (result.accepted) revalidatePath("/", "layout");
  redirect(`/internal/vehicles/${vehicleId}?feedback=${result.accepted ? "vehicle-saved" : "vehicle-invalid"}`);
}

export async function mergeVehiclesAction(formData: FormData) {
  const mergedById = await requireInternalUserId();
  const targetVehicleId = stringValue(formData, "targetVehicleId");
  const result = await mergeVehicles(new PrismaVehicleRepository(db), {
    sourceVehicleId: stringValue(formData, "sourceVehicleId"),
    targetVehicleId,
    requestKey: stringValue(formData, "requestKey"),
    mergedById,
  });
  if (result.accepted) revalidatePath("/", "layout");
  const feedback = !result.accepted ? "merge-invalid" : result.repeated ? "merge-repeated" : "merge-done";
  redirect(`/internal/vehicles/${targetVehicleId}?feedback=${feedback}`);
}

function stringValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}
