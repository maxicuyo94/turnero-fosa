import { redirect } from "next/navigation";
import { auth, getInternalSessionDisplayName, isInternalSession } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import {
  InternalAgendaScreen,
  internalFeedbackCodes,
  type InternalFeedbackCode,
  type InternalSection,
} from "@/src/modules/internal/internal-agenda-screen";
import { getInternalAgenda } from "@/src/modules/internal/operations";
import { PrismaInternalRepository } from "@/src/modules/internal/prisma-repository";

export default async function InternalPage({
  searchParams,
}: {
  searchParams?: Promise<{
    date?: string;
    appointmentUpdated?: string;
    feedback?: string;
    message?: string;
    section?: string;
  }>;
}) {
  const session = await auth();
  if (!isInternalSession(session)) redirect("/internal/login");

  const params = await searchParams;
  const date = params?.date ?? localDate(new Date());
  const repository = new PrismaInternalRepository(db);
  const weekDates = datesForWeek(date);
  const [weekAgendas, settings, services, schedule, exceptions] = await Promise.all([
    Promise.all(weekDates.map((weekDate) => getInternalAgenda(repository, { date: weekDate }))),
    repository.getWorkshopSettings(),
    repository.listServices(),
    repository.getWeeklySchedule(),
    repository.listDateExceptions(exceptionRange(date)),
  ]);
  const agenda = weekAgendas.find((item) => item.date === date) ?? await getInternalAgenda(repository, { date });
  return (
    <InternalAgendaScreen
      agenda={agenda}
      appointmentUpdateOutcome={params?.message ? { accepted: params.appointmentUpdated === "1", message: params.message } : undefined}
      exceptions={exceptions}
      feedback={parseFeedback(params?.feedback)}
      schedule={schedule}
      section={parseSection(params?.section)}
      services={services}
      settings={settings}
      signedInUserName={getInternalSessionDisplayName(session)}
      weekAgendas={weekAgendas}
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

function parseSection(value: string | undefined): InternalSection {
  return value === "settings" ? "settings" : "agenda";
}

function datesForWeek(date: string): string[] {
  const selected = new Date(`${date}T12:00:00-03:00`);
  const day = selected.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  const monday = new Date(selected);
  monday.setUTCDate(selected.getUTCDate() - daysSinceMonday);

  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(monday);
    current.setUTCDate(monday.getUTCDate() + index);
    return current.toISOString().slice(0, 10);
  });
}

function localDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(date);
}
