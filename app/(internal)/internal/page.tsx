import { redirect } from "next/navigation";
import { auth, getInternalSessionDisplayName, isInternalSession } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import { InternalAgendaScreen } from "@/src/modules/internal/internal-agenda-screen";
import { getInternalAgenda } from "@/src/modules/internal/operations";
import { PrismaInternalRepository } from "@/src/modules/internal/prisma-repository";

export default async function InternalPage({ searchParams }: { searchParams?: Promise<{ date?: string }> }) {
  const session = await auth();
  if (!isInternalSession(session)) redirect("/internal/login");

  const params = await searchParams;
  const date = params?.date ?? localDate(new Date());
  const repository = new PrismaInternalRepository(db);
  const [agenda, settings, services] = await Promise.all([
    getInternalAgenda(repository, { date }),
    repository.getWorkshopSettings(),
    repository.listServices(),
  ]);
  return <InternalAgendaScreen agenda={agenda} services={services} settings={settings} signedInUserName={getInternalSessionDisplayName(session)} />;
}

function localDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(date);
}
