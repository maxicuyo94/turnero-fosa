import type { HolidayProvider } from "@/src/modules/internal/holiday-import";

const defaultBaseUrl = "https://api.argentinadatos.com/v1/feriados";

export class ArgentinaDatosHolidayProvider implements HolidayProvider {
  constructor(
    private readonly baseUrl: string = defaultBaseUrl,
    private readonly timeoutMs: number = 8_000,
  ) {}

  async fetchHolidays(year: number): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}/${year}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`ArgentinaDatos responded with status ${response.status}.`);
    }

    return response.json();
  }
}
