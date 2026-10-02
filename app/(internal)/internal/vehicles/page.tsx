import { hasRole, requireStaff } from "@/src/lib/staff-access";
import { vehicleRepository } from "@/src/lib/composition";
import { VEHICLE_SEARCH_LIMIT, searchVehicles } from "@/src/modules/vehicles/service";
import { VehicleListScreen } from "@/src/modules/vehicles/vehicle-list-screen";

export default async function VehiclesPage({ searchParams }: { searchParams?: Promise<{ q?: string }> }) {
  const staff = await requireStaff();

  const params = await searchParams;
  const query = typeof params?.q === "string" ? params.q.trim().slice(0, 120) : "";
  const vehicles = await searchVehicles(vehicleRepository(), { query });

  return (
    <VehicleListScreen
      query={query}
      canManageWorkshop={hasRole(staff, "ADMIN")}
      signedInUserName={staff.displayName}
      truncated={vehicles.length >= VEHICLE_SEARCH_LIMIT}
      vehicles={vehicles}
    />
  );
}
