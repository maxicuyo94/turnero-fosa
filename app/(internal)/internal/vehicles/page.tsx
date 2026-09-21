import { redirect } from "next/navigation";
import { auth, getInternalSessionDisplayName, isInternalSession } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import { signOutAction } from "@/app/(internal)/internal/actions";
import { PrismaVehicleRepository } from "@/src/modules/vehicles/prisma-repository";
import { listDuplicateVehicleGroups, searchVehicles } from "@/src/modules/vehicles/service";
import { VehicleListScreen } from "@/src/modules/vehicles/vehicle-list-screen";

export default async function VehiclesPage({ searchParams }: { searchParams?: Promise<{ q?: string }> }) {
  const session = await auth();
  if (!isInternalSession(session)) redirect("/internal/login");

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
      onSignOut={signOutAction}
      query={query}
      signedInUserName={getInternalSessionDisplayName(session)}
      vehicles={vehicles}
    />
  );
}
