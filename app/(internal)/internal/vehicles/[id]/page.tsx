import { notFound } from "next/navigation";
import { hasRole, requireStaff } from "@/src/lib/staff-access";
import { db } from "@/src/lib/db";
import { saveVehicleAction } from "@/app/(internal)/internal/vehicles/actions";
import { PrismaVehicleRepository } from "@/src/modules/vehicles/prisma-repository";
import { getVehicleRecord } from "@/src/modules/vehicles/service";
import { VehicleRecordScreen } from "@/src/modules/vehicles/vehicle-record-screen";

export default async function VehicleRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ feedback?: string }>;
}) {
  const staff = await requireStaff();

  const { id } = await params;
  const repository = new PrismaVehicleRepository(db);
  const vehicle = await getVehicleRecord(repository, { vehicleId: id });
  if (!vehicle) notFound();

  const vehicleTypes = await db.vehicleType.findMany({ where: { isActive: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }] });

  return (
    <VehicleRecordScreen
      feedback={(await searchParams)?.feedback ?? null}
      saveAction={saveVehicleAction}
      canManageWorkshop={hasRole(staff, "ADMIN")}
      signedInUserName={staff.displayName}
      vehicle={vehicle}
      vehicleTypes={vehicleTypes.map((vehicleType) => ({ id: vehicleType.id, name: vehicleType.name }))}
    />
  );
}
