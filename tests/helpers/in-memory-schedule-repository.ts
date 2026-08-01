import type {
  DateExceptionImportSummary,
  ImportedHoliday,
  InternalScheduleRepository,
  InternalWeeklyScheduleRecord,
} from "@/src/modules/internal/maintenance";
import { workshopSeedConfig } from "@/src/modules/settings/defaults";
import type { ScheduleDateException } from "@/src/modules/settings/schemas";

export class InMemoryScheduleRepository implements InternalScheduleRepository {
  schedule: InternalWeeklyScheduleRecord = { schedules: workshopSeedConfig.schedules, breaks: workshopSeedConfig.breaks };
  exceptions: ScheduleDateException[] = [];
  replacements = 0;
  imports: ImportedHoliday[][] = [];

  async getWeeklySchedule() {
    return this.schedule;
  }

  async replaceWeeklySchedule(input: InternalWeeklyScheduleRecord) {
    this.replacements += 1;
    this.schedule = input;
    return this.schedule;
  }

  async listDateExceptions(range: { from: string; to: string }) {
    return this.exceptions
      .filter((exception) => exception.date >= range.from && exception.date <= range.to)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async saveDateException(input: Omit<ScheduleDateException, "source" | "manualOverride">) {
    const exception: ScheduleDateException = { ...input, source: "MANUAL", manualOverride: true };
    this.exceptions = [...this.exceptions.filter((item) => item.date !== input.date), exception];
    return exception;
  }

  async deleteDateException(date: string) {
    this.exceptions = this.exceptions.filter((exception) => exception.date !== date);
  }

  async upsertImportedDateExceptions(holidays: ImportedHoliday[]): Promise<DateExceptionImportSummary> {
    this.imports.push(holidays);
    const summary: DateExceptionImportSummary = { imported: holidays.length, created: 0, updated: 0, preserved: 0 };

    for (const holiday of holidays) {
      const current = this.exceptions.find((exception) => exception.date === holiday.date);
      if (current?.manualOverride) {
        summary.preserved += 1;
        continue;
      }

      const exception: ScheduleDateException = {
        date: holiday.date,
        label: holiday.label,
        source: "IMPORTED",
        manualOverride: false,
        isOpen: false,
        opensAt: null,
        closesAt: null,
      };
      this.exceptions = [...this.exceptions.filter((item) => item.date !== holiday.date), exception];
      summary[current ? "updated" : "created"] += 1;
    }

    return summary;
  }
}
