import { z } from "zod";
import type { DateExceptionImportSummary, ImportedHoliday, InternalScheduleRepository } from "@/src/modules/internal/maintenance";

/** Public booking never calls the provider; only this explicit import does. */
export type HolidayProvider = {
  fetchHolidays(year: number): Promise<unknown>;
};

export type HolidayImportResult =
  | { accepted: true; year: number; summary: DateExceptionImportSummary }
  | {
      accepted: false;
      reason: "VALIDATION_FAILED" | "PROVIDER_UNAVAILABLE" | "PROVIDER_RESPONSE_INVALID";
      message: string;
    };

const yearSchema = z.coerce.number().int().min(2000).max(2100);

const providerPayloadSchema = z
  .array(
    z.object({
      fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
      nombre: z.string().trim().min(1),
      tipo: z.string().optional(),
    }),
  )
  .min(1);

export async function importArgentineHolidays(
  repository: InternalScheduleRepository,
  provider: HolidayProvider,
  input: { year: number | string },
): Promise<HolidayImportResult> {
  const year = yearSchema.safeParse(input.year);
  if (!year.success) {
    return { accepted: false, reason: "VALIDATION_FAILED", message: "Elegi un ano entre 2000 y 2100." };
  }

  let payload: unknown;
  try {
    payload = await provider.fetchHolidays(year.data);
  } catch {
    return {
      accepted: false,
      reason: "PROVIDER_UNAVAILABLE",
      message: "No pudimos consultar los feriados. Los datos guardados siguen vigentes.",
    };
  }

  const parsed = providerPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      accepted: false,
      reason: "PROVIDER_RESPONSE_INVALID",
      message: "La respuesta de feriados no tiene el formato esperado. No se modifico ninguna fecha.",
    };
  }

  const holidays = dedupeByDate(
    parsed.data
      .filter((holiday) => holiday.fecha.startsWith(`${year.data}-`))
      .map((holiday) => ({ date: holiday.fecha, label: holiday.nombre })),
  );

  return { accepted: true, year: year.data, summary: await repository.upsertImportedDateExceptions(holidays) };
}

function dedupeByDate(holidays: ImportedHoliday[]): ImportedHoliday[] {
  return [...new Map(holidays.map((holiday) => [holiday.date, holiday])).values()].sort((a, b) => a.date.localeCompare(b.date));
}
