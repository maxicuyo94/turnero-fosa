import { describe, expect, it } from "vitest";
import {
  createInternalVehicleType,
  updateInternalVehicleTypeVisibility,
  type InternalVehicleTypeRecord,
  type InternalVehicleTypeRepository,
} from "@/src/modules/settings/maintenance";

describe("vehicle type catalog", () => {
  it("adds a type so it can be chosen without a deployment", async () => {
    const repository = new InMemoryVehicleTypeRepository([type({ id: "moto", name: "Moto", displayOrder: 1 })]);

    const result = await createInternalVehicleType(repository, { name: "Cuatriciclo" });

    expect(result).toMatchObject({ accepted: true, vehicleType: { name: "Cuatriciclo", isActive: true, displayOrder: 2 } });
    expect(await repository.listVehicleTypes()).toHaveLength(2);
  });

  it("rejects an empty name without touching the catalog", async () => {
    const repository = new InMemoryVehicleTypeRepository([type({ id: "moto", name: "Moto", displayOrder: 1 })]);

    const result = await createInternalVehicleType(repository, { name: "   " });

    expect(result.accepted).toBe(false);
    expect(await repository.listVehicleTypes()).toHaveLength(1);
  });

  it("rejects a name the catalog already has, ignoring case and spacing", async () => {
    const repository = new InMemoryVehicleTypeRepository([type({ id: "moto", name: "Moto", displayOrder: 1 })]);

    const result = await createInternalVehicleType(repository, { name: "  moto " });

    expect(result.accepted).toBe(false);
    expect(await repository.listVehicleTypes()).toHaveLength(1);
  });

  it("deactivates a type in use instead of losing the vehicles that reference it", async () => {
    const repository = new InMemoryVehicleTypeRepository([
      type({ id: "moto", name: "Moto", displayOrder: 1 }),
      type({ id: "auto", name: "Auto", displayOrder: 2 }),
    ]);

    const result = await updateInternalVehicleTypeVisibility(repository, { vehicleTypeId: "auto", isActive: false });

    expect(result).toMatchObject({ accepted: true, vehicleType: { id: "auto", isActive: false } });
    expect(await repository.listVehicleTypes()).toHaveLength(2);
  });

  it("refuses to deactivate the last active type, since booking needs one", async () => {
    const repository = new InMemoryVehicleTypeRepository([
      type({ id: "moto", name: "Moto", displayOrder: 1 }),
      type({ id: "auto", name: "Auto", displayOrder: 2, isActive: false }),
    ]);

    const result = await updateInternalVehicleTypeVisibility(repository, { vehicleTypeId: "moto", isActive: false });

    expect(result.accepted).toBe(false);
    expect((await repository.listVehicleTypes()).find((item) => item.id === "moto")?.isActive).toBe(true);
  });
});

function type(overrides: Partial<InternalVehicleTypeRecord> & { id: string; name: string; displayOrder: number }): InternalVehicleTypeRecord {
  return { isActive: true, ...overrides };
}

class InMemoryVehicleTypeRepository implements InternalVehicleTypeRepository {
  constructor(private vehicleTypes: InternalVehicleTypeRecord[]) {}

  async listVehicleTypes() {
    return [...this.vehicleTypes].sort((a, b) => a.displayOrder - b.displayOrder);
  }

  async createVehicleType(input: { name: string; displayOrder: number }) {
    const created = { id: `type_${this.vehicleTypes.length + 1}`, isActive: true, ...input };
    this.vehicleTypes.push(created);
    return created;
  }

  async updateVehicleTypeVisibility(vehicleTypeId: string, isActive: boolean) {
    const found = this.vehicleTypes.find((item) => item.id === vehicleTypeId);
    if (!found) throw new Error("Unknown vehicle type.");
    found.isActive = isActive;
    return found;
  }
}
