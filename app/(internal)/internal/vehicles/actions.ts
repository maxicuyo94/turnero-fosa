"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/src/lib/db";
import { formString } from "@/src/lib/form-data";
import { requireStaff } from "@/src/lib/staff-access";
import { PrismaVehicleRepository } from "@/src/modules/vehicles/prisma-repository";
import { updateVehicleDetails } from "@/src/modules/vehicles/service";

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
