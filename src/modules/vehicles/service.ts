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

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null));

const vehicleDetailsSchema = z.object({
  vehicleTypeId: z.string().trim().min(1, "Elegí un tipo de vehículo."),
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
 * anyone noticing. It is corrected on its own, through `correctVehiclePlate`.
 */
export async function updateVehicleDetails(
  repository: VehicleRepository,
  input: { vehicleId: string } & Record<string, unknown>,
) {
  const parsed = vehicleDetailsSchema.safeParse(input);
  if (!parsed.success) {
    return rejection(z.flattenError(parsed.error).fieldErrors.year
      ? "El año debe estar entre 1900 y 2100."
      : "Revisá los datos del vehículo.");
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

export type VehiclePlateChangeEntry = {
  id: string;
  previousPlate: string | null;
  newPlate: string | null;
  changedByName: string | null;
  changedAt: Date;
};

export type VehicleOwnerChangeEntry = {
  id: string;
  previousOwnerName: string | null;
  newOwnerName: string;
  reason: string;
  changedAt: Date;
};

export type VehicleRecord = VehicleSummary & {
  vehicleTypeId: string;
  vin: string | null;
  engineNumber: string | null;
  color: string | null;
  notes: string | null;
  appointments: VehicleAppointmentEntry[];
  ownerChanges: VehicleOwnerChangeEntry[];
  plateChanges: VehiclePlateChangeEntry[];
};

export type PlateChangeInput = { vehicleId: string; licensePlate: string | null; plateNormalized: string | null; changedById: string | null };
/** CHANGED wrote a new plate, UNCHANGED means it already had it, TAKEN names the unit that holds it. */
export type PlateChangeOutcome =
  | { status: "CHANGED" }
  | { status: "UNCHANGED" }
  | { status: "TAKEN"; otherVehicleId: string }
  | { status: "MISSING" };

export type VehiclePlateRepository = { changePlate(input: PlateChangeInput): Promise<PlateChangeOutcome> };

export type VehicleHistoryRepository = VehicleRepository & {
  findVehicleRecord(vehicleId: string): Promise<VehicleRecord | null>;
} & VehiclePlateRepository;

export async function getVehicleRecord(
  repository: VehicleHistoryRepository,
  input: { vehicleId: string },
): Promise<VehicleRecord | null> {
  return repository.findVehicleRecord(input.vehicleId);
}

const MAX_PLATE_LENGTH = 20;

/**
 * Corrects a wrongly loaded plate. The plate identifies the unit, so the new one must not belong to
 * another unit: that case is reported, never merged, and the workshop decides what to do. An empty
 * field clears the plate. Every change is recorded with who made it.
 */
export async function correctVehiclePlate(
  repository: VehiclePlateRepository,
  input: { vehicleId: string; licensePlate: string; changedById: string | null },
): Promise<{ accepted: true; changed: boolean } | VehicleRejection | { accepted: false; reason: "PLATE_TAKEN"; otherVehicleId: string; message: string }> {
  const licensePlate = input.licensePlate.trim();
  if (licensePlate.length > MAX_PLATE_LENGTH) return rejection(`La patente no puede superar ${MAX_PLATE_LENGTH} caracteres.`);
  const plateNormalized = normalizeLicensePlate(licensePlate);
  if (licensePlate && !plateNormalized) return rejection("La patente tiene que tener letras o números.");

  const outcome = await repository.changePlate({
    vehicleId: input.vehicleId,
    licensePlate: licensePlate || null,
    plateNormalized,
    changedById: input.changedById,
  });
  if (outcome.status === "MISSING") return rejection("La unidad ya no existe.");
  if (outcome.status === "TAKEN") {
    return { accepted: false, reason: "PLATE_TAKEN", otherVehicleId: outcome.otherVehicleId, message: "Esa patente ya es de otra unidad." };
  }
  return { accepted: true, changed: outcome.status === "CHANGED" };
}
