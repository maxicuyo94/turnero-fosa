import { z } from "zod";
import { normalizeLicensePlate } from "@/src/modules/customers/identity";

export type VehicleSummary = {
  id: string;
  typeName: string;
  brand: string;
  model: string;
  licensePlate: string | null;
  plateNormalized: string | null;
  year: number | null;
  ownerName: string;
  ownerPhone: string;
  appointmentCount: number;
  lastVisitAt: Date | null;
};

export type VehicleDuplicateGroup = {
  plateNormalized: string;
  vehicles: VehicleSummary[];
};

export type VehicleRepository = {
  listVehicles(): Promise<VehicleSummary[]>;
  updateVehicle(vehicleId: string, data: Record<string, unknown>): Promise<unknown>;
};

export type VehicleRejection = { accepted: false; reason: "VALIDATION_FAILED"; message: string };

function rejection(message: string): VehicleRejection {
  return { accepted: false, reason: "VALIDATION_FAILED", message };
}

/**
 * Searches across plate, brand, model and owner. The plate is compared on its normalized form too,
 * so staff can type what is printed on the unit instead of guessing how it was loaded.
 */
export async function searchVehicles(
  repository: VehicleRepository,
  input: { query?: string },
): Promise<VehicleSummary[]> {
  const vehicles = await repository.listVehicles();
  const query = (input.query ?? "").trim().toLocaleLowerCase("es-AR");
  if (!query) return vehicles;

  const plateQuery = normalizeLicensePlate(query);
  return vehicles.filter((vehicle) => {
    const haystack = [vehicle.brand, vehicle.model, vehicle.licensePlate ?? "", vehicle.ownerName, vehicle.ownerPhone]
      .join(" ")
      .toLocaleLowerCase("es-AR");
    const plateMatches = plateQuery !== null && vehicle.plateNormalized === plateQuery;
    return plateMatches || haystack.includes(query);
  });
}

/**
 * Reports units that share a plate. It only proposes: every booking made before the plate became an
 * identity key created its own unit, and which of those rows is the real one is a judgement the
 * workshop makes, not something to guess from the data.
 */
export async function listDuplicateVehicleGroups(repository: VehicleRepository): Promise<VehicleDuplicateGroup[]> {
  const vehicles = await repository.listVehicles();
  const byPlate = new Map<string, VehicleSummary[]>();

  for (const vehicle of vehicles) {
    // A unit without a plate has nothing to be matched on, so it is never proposed as a duplicate.
    if (!vehicle.plateNormalized) continue;
    const group = byPlate.get(vehicle.plateNormalized) ?? [];
    group.push(vehicle);
    byPlate.set(vehicle.plateNormalized, group);
  }

  return [...byPlate.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([plateNormalized, group]) => ({ plateNormalized, vehicles: group }));
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null));

const vehicleDetailsSchema = z.object({
  vehicleTypeId: z.string().trim().min(1, "Elegi un tipo de vehiculo."),
  brand: z.string().trim().min(1, "La marca es obligatoria.").max(60),
  model: z.string().trim().min(1, "El modelo es obligatorio.").max(60),
  year: z
    .union([z.string().trim().length(0), z.coerce.number().int().min(1900).max(2100)])
    .optional()
    .transform((value) => (typeof value === "number" ? value : null)),
  vin: optionalText(40),
  engineNumber: optionalText(40),
  color: optionalText(30),
  notes: optionalText(1_000),
});

/**
 * Saves the record's descriptive fields. The license plate is absent on purpose: it identifies the
 * unit, so editing it here could split one history in two or pull another unit's history in without
 * anyone noticing. A wrong plate is corrected by merging.
 */
export async function updateVehicleDetails(
  repository: VehicleRepository,
  input: { vehicleId: string } & Record<string, unknown>,
) {
  const parsed = vehicleDetailsSchema.safeParse(input);
  if (!parsed.success) {
    return rejection(z.flattenError(parsed.error).fieldErrors.year
      ? "El año debe estar entre 1900 y 2100."
      : "Revisa los datos del vehiculo.");
  }

  return { accepted: true as const, vehicle: await repository.updateVehicle(input.vehicleId, parsed.data) };
}

export type VehicleAppointmentEntry = {
  id: string;
  publicCode: string;
  serviceName: string;
  startAt: Date;
  endAt: Date;
  status: string;
  notes: string | null;
};

export type VehicleOwnerChangeEntry = {
  id: string;
  previousOwnerName: string | null;
  newOwnerName: string;
  reason: string;
  changedAt: Date;
};

export type VehicleMergeEntry = {
  id: string;
  sourceLabel: string;
  movedAppointments: number;
  mergedByName: string | null;
  mergedAt: Date;
};

export type VehicleRecord = VehicleSummary & {
  vehicleTypeId: string;
  vin: string | null;
  engineNumber: string | null;
  color: string | null;
  notes: string | null;
  appointments: VehicleAppointmentEntry[];
  ownerChanges: VehicleOwnerChangeEntry[];
  merges: VehicleMergeEntry[];
};

/** APPLIED merged now, REPEATED means this request key already ran, MISSING means a unit is gone. */
export type VehicleMergeOutcome =
  | { status: "APPLIED"; movedAppointments: number }
  | { status: "REPEATED"; movedAppointments: number }
  | { status: "MISSING" };

export type VehicleHistoryRepository = VehicleRepository & {
  findVehicleRecord(vehicleId: string): Promise<VehicleRecord | null>;
  applyMerge(input: {
    sourceVehicleId: string;
    targetVehicleId: string;
    requestKey: string;
    mergedById: string | null;
  }): Promise<VehicleMergeOutcome>;
};

export async function getVehicleRecord(
  repository: VehicleHistoryRepository,
  input: { vehicleId: string },
): Promise<VehicleRecord | null> {
  return repository.findVehicleRecord(input.vehicleId);
}

/**
 * Merges a duplicate into the unit that survives. Deliberately explicit: nothing here runs on its
 * own, because a merge deletes a row and moves history, and a wrong one cannot be undone from the
 * panel.
 */
export async function mergeVehicles(
  repository: VehicleHistoryRepository,
  input: { sourceVehicleId: string; targetVehicleId: string; requestKey: string; mergedById: string | null },
) {
  if (input.sourceVehicleId === input.targetVehicleId) {
    return rejection("Elegi dos unidades distintas para fusionar.");
  }
  if (!input.requestKey.trim()) {
    return rejection("Falta la clave de la operacion.");
  }

  const outcome = await repository.applyMerge(input);
  if (outcome.status === "MISSING") {
    return rejection("Alguna de las unidades ya no existe.");
  }

  return {
    accepted: true as const,
    repeated: outcome.status === "REPEATED",
    movedAppointments: outcome.movedAppointments,
  };
}
