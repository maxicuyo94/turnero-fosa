import { describe, expect, it } from "vitest";
import { importArgentineHolidays, type HolidayProvider } from "@/src/modules/internal/holiday-import";
import { InMemoryScheduleRepository } from "@/tests/helpers/in-memory-schedule-repository";

const payload = [
  { fecha: "2026-01-01", tipo: "inamovible", nombre: "Año Nuevo" },
  { fecha: "2026-07-09", tipo: "inamovible", nombre: "Día de la Independencia" },
];

describe("importArgentineHolidays", () => {
  it("stores every holiday of the requested year as a closed date exception", async () => {
    const repository = new InMemoryScheduleRepository();

    const result = await importArgentineHolidays(repository, provider(payload), { year: 2026 });

    expect(result).toEqual({
      accepted: true,
      year: 2026,
      summary: { imported: 2, created: 2, updated: 0, preserved: 0 },
    });
    expect(repository.exceptions).toEqual([
      expect.objectContaining({ date: "2026-01-01", label: "Año Nuevo", source: "IMPORTED", isOpen: false }),
      expect.objectContaining({ date: "2026-07-09", label: "Día de la Independencia", source: "IMPORTED", isOpen: false }),
    ]);
  });

  it("preserves a manual override for an imported holiday", async () => {
    const repository = new InMemoryScheduleRepository();
    await repository.saveDateException({ date: "2026-07-09", label: "Abrimos igual", isOpen: true, opensAt: "10:00", closesAt: "13:00" });

    const result = await importArgentineHolidays(repository, provider(payload), { year: 2026 });

    expect(result).toMatchObject({ accepted: true, summary: { created: 1, updated: 0, preserved: 1 } });
    expect(repository.exceptions).toContainEqual(
      expect.objectContaining({ date: "2026-07-09", label: "Abrimos igual", isOpen: true, manualOverride: true }),
    );
  });

  it("keeps persisted exceptions untouched when the provider is unavailable", async () => {
    const repository = new InMemoryScheduleRepository();
    await repository.saveDateException({ date: "2026-07-09", label: "Feriado", isOpen: false, opensAt: null, closesAt: null });

    const result = await importArgentineHolidays(
      repository,
      { async fetchHolidays() { throw new Error("network down"); } },
      { year: 2026 },
    );

    expect(result).toMatchObject({ accepted: false, reason: "PROVIDER_UNAVAILABLE" });
    expect(repository.imports).toHaveLength(0);
    expect(repository.exceptions).toHaveLength(1);
  });

  it("rejects a payload that does not match the expected holiday shape", async () => {
    const repository = new InMemoryScheduleRepository();

    const malformed = await importArgentineHolidays(repository, provider([{ fecha: "01/01/2026", nombre: "Año Nuevo" }]), { year: 2026 });
    const notAList = await importArgentineHolidays(repository, provider({ error: "not found" }), { year: 2026 });

    expect(malformed).toMatchObject({ accepted: false, reason: "PROVIDER_RESPONSE_INVALID" });
    expect(notAList).toMatchObject({ accepted: false, reason: "PROVIDER_RESPONSE_INVALID" });
    expect(repository.imports).toHaveLength(0);
  });

  it("ignores holidays that do not belong to the requested year", async () => {
    const repository = new InMemoryScheduleRepository();

    const result = await importArgentineHolidays(
      repository,
      provider([...payload, { fecha: "2027-01-01", tipo: "inamovible", nombre: "Año Nuevo" }]),
      { year: 2026 },
    );

    expect(result).toMatchObject({ accepted: true, summary: { imported: 2, created: 2 } });
    expect(repository.exceptions.map((exception) => exception.date)).toEqual(["2026-01-01", "2026-07-09"]);
  });

  it("rejects a year outside the supported range before calling the provider", async () => {
    const repository = new InMemoryScheduleRepository();
    let calls = 0;

    const result = await importArgentineHolidays(
      repository,
      { async fetchHolidays() { calls += 1; return payload; } },
      { year: 1800 },
    );

    expect(result).toMatchObject({ accepted: false, reason: "VALIDATION_FAILED" });
    expect(calls).toBe(0);
  });
});

function provider(response: unknown): HolidayProvider {
  return { async fetchHolidays() { return response; } };
}
