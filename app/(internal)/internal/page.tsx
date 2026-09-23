import { db } from "@/src/lib/db";
import { appointmentRepository, settleOverdueDepositsAfterResponse, workshopSettingsRepository } from "@/src/lib/composition";
import { hasRole, requireStaff } from "@/src/lib/staff-access";
import { workshopDate } from "@/src/lib/workshop-date";
import { listPaidUnconfirmedDeposits } from "@/src/modules/payments/prisma-repository";
import { calendarDateSchema } from "@/src/modules/settings/business-settings";
import {
  InternalAgendaScreen,
  internalFeedbackCodes,
  type InternalFeedbackCode,
  type InternalSection,
} from "@/src/modules/internal/internal-agenda-screen";
import { datesForWeek, parseAgendaView } from "@/src/modules/appointments/agenda-navigation";
import { getInternalAgendas } from "@/src/modules/appointments/operations";

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
  const staff = await requireStaff();
  const canManageWorkshop = hasRole(staff, "ADMIN");

  const params = await searchParams;
  // A hand-edited or stale link falls back to today instead of failing the whole panel.
  const today = workshopDate(new Date());
  const date = calendarDateSchema.safeParse(params?.date).data ?? today;
  // Overdue deposit holds are released after the response, so the agenda never waits on Mercado Pago;
  // the next load shows them settled. The cron sweep does the same on a schedule.
  settleOverdueDepositsAfterResponse();
  const appointments = appointmentRepository();
  const workshop = workshopSettingsRepository();
  const [weekAgendas, settings, services, vehicleTypes, schedule, exceptions, paidUnconfirmedDeposits] = await Promise.all([
    getInternalAgendas(appointments, { dates: datesForWeek(date) }),
    workshop.getWorkshopSettings(),
    workshop.listServices(),
    workshop.listVehicleTypes(),
    workshop.getWeeklySchedule(),
    workshop.listDateExceptions(exceptionRange(date)),
    listPaidUnconfirmedDeposits(db),
  ]);
  const agenda = weekAgendas.find((item) => item.date === date) ?? { date, appointments: [] };
  const capacityConflicts = await appointments.getCapacityConflicts(settings.capacity);
  return (
    <InternalAgendaScreen
      agenda={agenda}
      canManageWorkshop={canManageWorkshop}
      capacityConflicts={capacityConflicts}
      paidUnconfirmedDeposits={paidUnconfirmedDeposits}
      exceptions={exceptions}
      feedback={parseFeedback(params?.feedback)}
      schedule={schedule}
      section={canManageWorkshop ? parseSection(params?.section) : "agenda"}
      services={services}
      vehicleTypes={vehicleTypes}
      settings={settings}
      signedInUserName={staff.displayName}
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
