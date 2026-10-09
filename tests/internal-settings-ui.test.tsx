import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/(internal)/internal/actions", () => ({
  signOutAction: async () => undefined,
}));

vi.mock("@/app/(internal)/internal/settings/actions", () => ({
  updateContactSettingsAction: async () => undefined,
  updateBookingSettingsAction: async () => undefined,
  updateServiceVisibilityAction: async () => undefined,
  updateServiceDurationAction: async () => undefined,
  createVehicleTypeAction: async () => undefined,
  updateVehicleTypeVisibilityAction: async () => undefined,
  updateWeeklyScheduleAction: async () => undefined,
  saveDateExceptionAction: async () => undefined,
  deleteDateExceptionAction: async () => undefined,
  importHolidaysAction: async () => undefined,
}));

import { DateExceptionsCard, WeeklyScheduleCard } from "@/src/modules/internal/schedule-settings";
import { SettingsShell } from "@/src/modules/internal/settings-screen";
import { workshopSeedConfig } from "@/src/modules/settings/defaults";

describe("Configuración", () => {
  it("submits edited and collapsed weekdays together", () => {
    const { container } = render(<WeeklyScheduleCard agendaDate="2026-07-06" schedule={{ schedules: workshopSeedConfig.schedules, breaks: workshopSeedConfig.breaks }} />);
    const monday = screen.getByLabelText("Lunes: abre").closest("details")!;
    fireEvent.click(monday.querySelector("summary")!);
    fireEvent.change(screen.getByLabelText("Lunes: abre"), { target: { value: "10:00" } });
    fireEvent.change(screen.getByLabelText("Lunes: descanso 1 desde"), { target: { value: "13:30" } });
    fireEvent.click(monday.querySelector("summary")!);
    expect(monday).not.toHaveAttribute("open");
    expect(monday.querySelector("summary")).toHaveTextContent("10:00–19:00 · descanso 13:30–15:00");
    const data = new FormData(container.querySelector("form")!);
    expect(data.get("opensAt-MONDAY")).toBe("10:00");
    expect(data.get("break-MONDAY-0-startsAt")).toBe("13:30");
    expect(data.get("opensAt-TUESDAY")).toBe("09:00");
    expect([...data.keys()].filter((name) => name.startsWith("opensAt-"))).toHaveLength(7);
  });
  it("renders editable opening hours and breaks for every weekday", () => {
    render(
      <WeeklyScheduleCard
        agendaDate="2026-07-06"
        schedule={{ schedules: workshopSeedConfig.schedules, breaks: workshopSeedConfig.breaks }}
      />,
    );

    expect(screen.getByLabelText("Lunes: abre")).toHaveValue("09:00");
    expect(screen.getByLabelText("Lunes: cierra")).toHaveValue("19:00");
    expect(screen.getByLabelText("Lunes: abierto")).toBeChecked();
    expect(screen.getByLabelText("Domingo: abierto")).not.toBeChecked();
    expect(screen.getByLabelText("Lunes: descanso 1 desde")).toHaveValue("13:00");
    expect(screen.getByLabelText("Lunes: descanso 1 hasta")).toHaveValue("15:00");
    expect(screen.getByRole("button", { name: "Guardar horarios" })).toBeInTheDocument();
  });

  it("lists persisted date exceptions with their origin and a way to remove them", () => {
    render(
      <DateExceptionsCard
        agendaDate="2026-07-06"
        exceptions={[
          { date: "2026-07-09", label: "Dia de la Independencia", source: "IMPORTED", manualOverride: false, isOpen: false, opensAt: null, closesAt: null },
          { date: "2026-12-08", label: "Abrimos igual", source: "MANUAL", manualOverride: true, isOpen: true, opensAt: "10:00", closesAt: "13:00" },
        ]}
      />,
    );

    expect(screen.getByText("Dia de la Independencia")).toBeInTheDocument();
    expect(screen.getByText("Cerrado")).toBeInTheDocument();
    expect(screen.getByText("Abre 10:00 a 13:00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eliminar la excepción del 2026-07-09" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar excepción" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Importar feriados" })).toBeInTheDocument();
  });

  it("reports the outcome of the last maintenance action", () => {
    render(<SettingsShell active="schedule" feedback="holidays-unavailable">contenido</SettingsShell>);

    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos consultar los feriados");
  });

  it("splits Configuración in pages and marks the active one", () => {
    render(<SettingsShell active="catalog">contenido</SettingsShell>);

    const nav = screen.getByRole("navigation", { name: "Secciones de configuración" });
    expect(within(nav).getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["General", "/internal/settings"],
      ["Reservas y señas", "/internal/settings/booking"],
      ["Catálogo", "/internal/settings/catalog"],
      ["Horarios", "/internal/settings/schedule"],
    ]);
    expect(within(nav).getByRole("link", { name: "Catálogo" })).toHaveAttribute("aria-current", "page");
  });
});
