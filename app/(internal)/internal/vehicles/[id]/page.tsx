import { notFound } from "next/navigation";
import { hasRole, requireStaff } from "@/src/lib/staff-access";
import { vehicleRepository } from "@/src/lib/composition";
import { correctVehiclePlateAction, saveVehicleAction } from "@/app/(internal)/internal/vehicles/actions";
import { getVehicleRecord } from "@/src/modules/vehicles/service";
import { VehicleRecordScreen } from "@/src/modules/vehicles/vehicle-record-screen";

export default async function VehicleRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ feedback?: string; other?: string }>;
}) {
  const staff = await requireStaff();

  const { id } = await params;
  const repository = vehicleRepository();
  const vehicle = await getVehicleRecord(repository, { vehicleId: id });
  if (!vehicle) notFound();
  const search = await searchParams;

  const vehicleTypes = await repository.listActiveVehicleTypes();

  return (
    <VehicleRecordScreen
      feedback={search?.feedback ?? null}
      plateAction={correctVehiclePlateAction}
      plateHolderId={search?.feedback === "plate-taken" ? search.other?.slice(0, 128) ?? null : null}
      saveAction={saveVehicleAction}
      canManageWorkshop={hasRole(staff, "ADMIN")}
      signedInUserName={staff.displayName}
      vehicle={vehicle}
      vehicleTypes={vehicleTypes}
    />
  );
}
