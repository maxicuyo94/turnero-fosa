import { describe, expect, it } from "vitest";
import {
  correctVehiclePlate,
  searchVehicles,
  updateVehicleDetails,
  type PlateChangeInput,
  type PlateChangeOutcome,
  type VehicleRepository,
  type VehicleSummary,
} from "@/src/modules/vehicles/service";

describe("vehicle search", () => {
  it("finds a unit by plate, brand, model or owner", async () => {
    const repository = new InMemoryVehicleRepository([
      summary({ id: "v1", brand: "Honda", model: "XR150", licensePlate: "AB123CD", ownerName: "Ana Perez" }),
      summary({ id: "v2", brand: "Yamaha", model: "FZ25", licensePlate: "XY987ZW", ownerName: "Beto Lopez" }),
    ]);

    expect(await idsOf(searchVehicles(repository, { query: "ab123cd" }))).toEqual(["v1"]);
    expect(await idsOf(searchVehicles(repository, { query: "yamaha" }))).toEqual(["v2"]);
    expect(await idsOf(searchVehicles(repository, { query: "XR150" }))).toEqual(["v1"]);
    expect(await idsOf(searchVehicles(repository, { query: "beto" }))).toEqual(["v2"]);
  });

  it("matches a plate typed with spacing or dashes", async () => {
    const repository = new InMemoryVehicleRepository([
      summary({ id: "v1", brand: "Honda", model: "XR150", licensePlate: "AB123CD", ownerName: "Ana" }),
    ]);

    expect(await idsOf(searchVehicles(repository, { query: "ab 123 cd" }))).toEqual(["v1"]);
    expect(await idsOf(searchVehicles(repository, { query: "AB-123-CD" }))).toEqual(["v1"]);
  });

  it("returns every unit when nothing is typed", async () => {
    const repository = new InMemoryVehicleRepository([
      summary({ id: "v1", brand: "Honda", model: "XR150", licensePlate: "AB123CD", ownerName: "Ana" }),
      summary({ id: "v2", brand: "Yamaha", model: "FZ25", licensePlate: "XY987ZW", ownerName: "Beto" }),
    ]);

    expect(await idsOf(searchVehicles(repository, { query: "  " }))).toEqual(["v1", "v2"]);
  });
});

describe("vehicle record editing", () => {
  it("saves the internal identification fields", async () => {
    const repository = new InMemoryVehicleRepository([
      summary({ id: "v1", brand: "Honda", model: "XR150", licensePlate: "AB123CD", ownerName: "Ana" }),
    ]);

    const result = await updateVehicleDetails(repository, {
      vehicleId: "v1",
      vehicleTypeId: "type-moto",
      brand: "Honda",
      model: "XR 150 Bros",
      year: "2022",
      vin: "9C2KD0810MR000001",
      engineNumber: "KD08E1000001",
      color: "Rojo",
      notes: "Cliente pide revisar cadena.",
    });

    expect(result).toMatchObject({
      accepted: true,
      vehicle: { model: "XR 150 Bros", vin: "9C2KD0810MR000001", engineNumber: "KD08E1000001", color: "Rojo", year: 2022 },
    });
  });

  it("rejects an invalid year without saving anything", async () => {
    const repository = new InMemoryVehicleRepository([
      summary({ id: "v1", brand: "Honda", model: "XR150", licensePlate: "AB123CD", ownerName: "Ana" }),
    ]);

    const result = await updateVehicleDetails(repository, {
      vehicleId: "v1",
      vehicleTypeId: "type-moto",
      brand: "Honda",
      model: "XR150",
      year: "1492",
    });

    expect(result.accepted).toBe(false);
    expect(repository.updates).toEqual([]);
  });

  it("rejects an empty brand or model", async () => {
    const repository = new InMemoryVehicleRepository([
      summary({ id: "v1", brand: "Honda", model: "XR150", licensePlate: "AB123CD", ownerName: "Ana" }),
    ]);

    const result = await updateVehicleDetails(repository, {
      vehicleId: "v1",
      vehicleTypeId: "type-moto",
      brand: "  ",
      model: "XR150",
    });

    expect(result.accepted).toBe(false);
    expect(repository.updates).toEqual([]);
  });

  it("never writes the license plate, which identifies the unit", async () => {
    const repository = new InMemoryVehicleRepository([
      summary({ id: "v1", brand: "Honda", model: "XR150", licensePlate: "AB123CD", ownerName: "Ana" }),
    ]);

    await updateVehicleDetails(repository, {
      vehicleId: "v1",
      vehicleTypeId: "type-moto",
      brand: "Honda",
      model: "XR150",
      // A caller that smuggles a plate in must not get it persisted.
      licensePlate: "ZZ999ZZ",
    } as Parameters<typeof updateVehicleDetails>[1]);

    expect(repository.updates[0]).not.toHaveProperty("licensePlate");
    expect(repository.updates[0]).not.toHaveProperty("plateNormalized");
  });
});

describe("license plate correction", () => {
  it("stores the plate as typed and matches on its normalized form", async () => {
    const repository = new PlateRepository({ status: "CHANGED" });

    const result = await correctVehiclePlate(repository, { vehicleId: "v1", licensePlate: " ab-123 cd ", changedById: "staff" });

    expect(result).toEqual({ accepted: true, changed: true });
    expect(repository.changes).toEqual([{ vehicleId: "v1", licensePlate: "ab-123 cd", plateNormalized: "AB123CD", changedById: "staff" }]);
  });

  it("clears the plate when the field is left empty", async () => {
    const repository = new PlateRepository({ status: "CHANGED" });

    await correctVehiclePlate(repository, { vehicleId: "v1", licensePlate: "  ", changedById: null });

    expect(repository.changes[0]).toMatchObject({ licensePlate: null, plateNormalized: null });
  });

  it("rejects a plate without letters or digits, or too long, without writing", async () => {
    const repository = new PlateRepository({ status: "CHANGED" });

    expect((await correctVehiclePlate(repository, { vehicleId: "v1", licensePlate: "--", changedById: null })).accepted).toBe(false);
    expect((await correctVehiclePlate(repository, { vehicleId: "v1", licensePlate: "A".repeat(21), changedById: null })).accepted).toBe(false);
    expect(repository.changes).toEqual([]);
  });

  it("reports which unit already holds the plate", async () => {
    const result = await correctVehiclePlate(new PlateRepository({ status: "TAKEN", otherVehicleId: "v2" }), { vehicleId: "v1", licensePlate: "AB123CD", changedById: null });

    expect(result).toMatchObject({ accepted: false, reason: "PLATE_TAKEN", otherVehicleId: "v2" });
  });
});

class PlateRepository {
  changes: PlateChangeInput[] = [];
  constructor(private readonly outcome: PlateChangeOutcome) {}
  async changePlate(input: PlateChangeInput) {
    this.changes.push(input);
    return this.outcome;
  }
}

function summary(overrides: Partial<VehicleSummary> & { id: string; brand: string; model: string; licensePlate: string | null; ownerName: string }): VehicleSummary {
  return {
    typeName: "Moto",
    plateNormalized: overrides.licensePlate ? overrides.licensePlate.toUpperCase().replace(/[^A-Z0-9]/gu, "") : null,
    year: null,
    ownerPhone: "1111",
    appointmentCount: 0,
    lastVisitAt: null,
    ...overrides,
  };
}

async function idsOf(result: Promise<VehicleSummary[]>) {
  return (await result).map((vehicle) => vehicle.id);
}

class InMemoryVehicleRepository implements VehicleRepository {
  updates: Record<string, unknown>[] = [];

  constructor(private vehicles: VehicleSummary[]) {}

  async listVehicles() {
    return this.vehicles;
  }

  async updateVehicle(vehicleId: string, data: Record<string, unknown>) {
    this.updates.push(data);
    const found = this.vehicles.find((vehicle) => vehicle.id === vehicleId);
    if (!found) throw new Error("Unknown vehicle.");
    return { ...found, ...data } as VehicleSummary & Record<string, unknown>;
  }
}
