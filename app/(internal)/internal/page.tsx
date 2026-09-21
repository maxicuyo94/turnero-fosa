import { redirect } from "next/navigation";
import { auth, getInternalSessionDisplayName, isInternalSession } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import { workshopDate } from "@/src/lib/workshop-date";
import { listPaidUnconfirmedDeposits } from "@/src/modules/payments/prisma-repository";
import { settleOverdueDeposits } from "@/src/modules/payments/reconciliation";
import { calendarDateSchema } from "@/src/modules/settings/business-settings";
import {
  InternalAgendaScreen,
  internalFeedbackCodes,
  type InternalFeedbackCode,
  type InternalSection,
} from "@/src/modules/internal/internal-agenda-screen";
import { datesForWeek, parseAgendaView } from "@/src/modules/internal/agenda-navigation";
import { getInternalAgenda } from "@/src/modules/internal/operations";
import { PrismaInternalRepository } from "@/src/modules/internal/prisma-repository";

export default async function InternalPage({
  searchParams,
}: {
  searchParams?: Promise<{
    date?: string;
    feedback?: string;
    section?: string;
    view?: string;
  }>;
}) {
  const session = await auth();
  if (!isInternalSession(session)) redirect("/internal/login");

  const params = await searchParams;
  // A hand-edited or stale link falls back to today instead of failing the whole panel.
  const today = workshopDate(new Date());
  const date = calendarDateSchema.safeParse(params?.date).data ?? today;
  // The agenda must not show reservations whose deposit deadline already passed as still pending.
  await settleOverdueDeposits(db);
  const repository = new PrismaInternalRepository(db);
  const weekDates = datesForWeek(date);
  const [weekAgendas, settings, services, vehicleTypes, schedule, exceptions, paidUnconfirmedDeposits] = await Promise.all([
    Promise.all(weekDates.map((weekDate) => getInternalAgenda(repository, { date: weekDate }))),
    repository.getWorkshopSettings(),
    repository.listServices(),
    repository.listVehicleTypes(),
    repository.getWeeklySchedule(),
    repository.listDateExceptions(exceptionRange(date)),
    listPaidUnconfirmedDeposits(db),
  ]);
  const agenda = weekAgendas.find((item) => item.date === date) ?? await getInternalAgenda(repository, { date });
  const capacityConflicts = await repository.getCapacityConflicts(settings.capacity);
  return (
    <InternalAgendaScreen
      agenda={agenda}
      capacityConflicts={capacityConflicts}
      paidUnconfirmedDeposits={paidUnconfirmedDeposits}
      exceptions={exceptions}
      feedback={parseFeedback(params?.feedback)}
      schedule={schedule}
      section={parseSection(params?.section)}
      services={services}
      vehicleTypes={vehicleTypes}
      settings={settings}
      signedInUserName={getInternalSessionDisplayName(session)}
      today={today}
      view={parseAgendaView(params?.view)}
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

