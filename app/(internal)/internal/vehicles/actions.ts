"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/src/lib/db";
import { formString } from "@/src/lib/form-data";
import { requireStaff } from "@/src/lib/staff-access";
import { PrismaVehicleRepository } from "@/src/modules/vehicles/prisma-repository";
import { mergeVehicles, updateVehicleDetails } from "@/src/modules/vehicles/service";

export async function saveVehicleAction(formData: FormData) {
  await requireStaff();
  const vehicleId = formString(formData, "vehicleId");
  const result = await updateVehicleDetails(new PrismaVehicleRepository(db), {
    vehicleId,
    vehicleTypeId: formString(formData, "vehicleTypeId"),
    brand: formString(formData, "brand"),
    model: formString(formData, "model"),
    year: formString(formData, "year"),
    vin: formString(formData, "vin"),
    engineNumber: formString(formData, "engineNumber"),
    color: formString(formData, "color"),
    notes: formString(formData, "notes"),
  });
  if (result.accepted) revalidatePath("/", "layout");
  redirect(`/internal/vehicles/${vehicleId}?feedback=${result.accepted ? "vehicle-saved" : "vehicle-invalid"}`);
}

export async function mergeVehiclesAction(formData: FormData) {
  const { userId: mergedById } = await requireStaff();
  const targetVehicleId = formString(formData, "targetVehicleId");
  const result = await mergeVehicles(new PrismaVehicleRepository(db), {
    sourceVehicleId: formString(formData, "sourceVehicleId"),
    targetVehicleId,
    requestKey: formString(formData, "requestKey"),
    mergedById,
  });
  if (result.accepted) revalidatePath("/", "layout");
  const feedback = !result.accepted ? "merge-invalid" : result.repeated ? "merge-repeated" : "merge-done";
  redirect(`/internal/vehicles/${targetVehicleId}?feedback=${feedback}`);
}
