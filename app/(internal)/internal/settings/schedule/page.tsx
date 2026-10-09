import { workshopSettingsRepository } from "@/src/lib/composition";
import { workshopDate } from "@/src/lib/workshop-date";
import { calendarDateSchema } from "@/src/modules/settings/business-settings";
import { SettingsShell } from "@/src/modules/internal/settings-screen";
import { DateExceptionsCard, WeeklyScheduleCard } from "@/src/modules/internal/schedule-settings";
import { loadSettingsShell, type SettingsSearchParams } from "@/app/(internal)/internal/settings/shell-data";

export default async function ScheduleSettingsPage({ searchParams }: { searchParams?: SettingsSearchParams }) {
  const { params, shell } = await loadSettingsShell(searchParams);
  // A hand-edited or stale link falls back to today instead of failing the page.
  const date = calendarDateSchema.safeParse(params?.date).data ?? workshopDate(new Date());
  const workshop = workshopSettingsRepository();
  const [schedule, exceptions] = await Promise.all([workshop.getWeeklySchedule(), workshop.listDateExceptions(exceptionRange(date))]);
  return (
    <SettingsShell active="schedule" {...shell}>
      <WeeklyScheduleCard agendaDate={date} schedule={schedule} />
      <DateExceptionsCard agendaDate={date} exceptions={exceptions} />
    </SettingsShell>
  );
}

/** The page shows the exceptions the workshop can still act on: the current and next calendar year. */
function exceptionRange(date: string): { from: string; to: string } {
  const year = Number(date.slice(0, 4));
  return { from: `${year}-01-01`, to: `${year + 1}-12-31` };
}
