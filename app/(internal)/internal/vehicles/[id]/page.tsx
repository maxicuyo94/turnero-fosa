import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { auth, getInternalSessionDisplayName, isInternalSession } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import { signOutAction } from "@/app/(internal)/internal/actions";
import { mergeVehiclesAction, saveVehicleAction } from "@/app/(internal)/internal/vehicles/actions";
import { PrismaVehicleRepository } from "@/src/modules/vehicles/prisma-repository";
import { getVehicleRecord, listDuplicateVehicleGroups } from "@/src/modules/vehicles/service";
import { VehicleRecordScreen } from "@/src/modules/vehicles/vehicle-record-screen";

export default async function VehicleRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ feedback?: string }>;
}) {
  const session = await auth();
  if (!isInternalSession(session)) redirect("/internal/login");

  const { id } = await params;
  const repository = new PrismaVehicleRepository(db);
  const vehicle = await getVehicleRecord(repository, { vehicleId: id });
  if (!vehicle) notFound();

  const [groups, vehicleTypes] = await Promise.all([
    listDuplicateVehicleGroups(repository),
    db.vehicleType.findMany({ where: { isActive: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }] }),
  ]);
  const duplicates = groups
    .find((group) => group.plateNormalized === vehicle.plateNormalized)
    ?.vehicles.filter((candidate) => candidate.id !== vehicle.id) ?? [];

  return (
    <VehicleRecordScreen
      duplicates={duplicates}
      feedback={(await searchParams)?.feedback ?? null}
      mergeAction={mergeVehiclesAction}
      mergeRequestKey={randomUUID()}
      onSignOut={signOutAction}
      saveAction={saveVehicleAction}
      signedInUserName={getInternalSessionDisplayName(session)}
      vehicle={vehicle}
      vehicleTypes={vehicleTypes.map((vehicleType) => ({ id: vehicleType.id, name: vehicleType.name }))}
    />
  );
}
