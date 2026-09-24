import { hasRole, requireStaff } from "@/src/lib/staff-access";
import { db } from "@/src/lib/db";
import { PrismaVehicleRepository } from "@/src/modules/vehicles/prisma-repository";
import { listDuplicateVehicleGroups, searchVehicles } from "@/src/modules/vehicles/service";
import { VehicleListScreen } from "@/src/modules/vehicles/vehicle-list-screen";

export default async function VehiclesPage({ searchParams }: { searchParams?: Promise<{ q?: string }> }) {
  const staff = await requireStaff();

  const params = await searchParams;
  const query = typeof params?.q === "string" ? params.q.trim().slice(0, 120) : "";
  const repository = new PrismaVehicleRepository(db);
  const [vehicles, duplicateGroups] = await Promise.all([
    searchVehicles(repository, { query }),
    listDuplicateVehicleGroups(repository),
  ]);

  return (
    <VehicleListScreen
      duplicateGroups={duplicateGroups}
      query={query}
      canManageWorkshop={hasRole(staff, "ADMIN")}
      signedInUserName={staff.displayName}
      vehicles={vehicles}
    />
  );
}
