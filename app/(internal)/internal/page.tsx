import { redirect } from "next/navigation";
import { auth, getInternalSessionDisplayName, isInternalSession } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import {
  InternalAgendaScreen,
  internalFeedbackCodes,
  type InternalFeedbackCode,
} from "@/src/modules/internal/internal-agenda-screen";
import { getInternalAgenda } from "@/src/modules/internal/operations";
import { PrismaInternalRepository } from "@/src/modules/internal/prisma-repository";

export default async function InternalPage({
  searchParams,
}: {
  searchParams?: Promise<{ date?: string; feedback?: string }>;
}) {
  const session = await auth();
  if (!isInternalSession(session)) redirect("/internal/login");

  const params = await searchParams;
  const date = params?.date ?? localDate(new Date());
  const repository = new PrismaInternalRepository(db);
  const [agenda, settings, services, schedule, exceptions] = await Promise.all([
    getInternalAgenda(repository, { date }),
    repository.getWorkshopSettings(),
    repository.listServices(),
    repository.getWeeklySchedule(),
    repository.listDateExceptions(exceptionRange(date)),
  ]);

  return (
    <InternalAgendaScreen
      agenda={agenda}
      exceptions={exceptions}
      feedback={parseFeedback(params?.feedback)}
      schedule={schedule}
      services={services}
      settings={settings}
      signedInUserName={getInternalSessionDisplayName(session)}
    />
  );
}

/** The panel shows the exceptions the workshop can still act on: the current and next calendar year. */
function exceptionRange(date: string): { from: string; to: string } {
  const year = Number(date.slice(0, 4));
  return { from: `${year}-01-01`, to: `${year + 1}-12-31` };
}

function parseFeedback(value: string | undefined): InternalFeedbackCode | null {
  return internalFeedbackCodes.find((code) => code === value) ?? null;
}

function localDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(date);
}
