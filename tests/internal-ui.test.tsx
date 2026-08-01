import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";

vi.mock("@/app/(internal)/internal/actions", () => ({
  signOutAction: async () => undefined,
  updateAppointmentStatusAction: async () => undefined,
  updateServiceVisibilityAction: async () => undefined,
  updateWorkshopSettingsAction: async () => undefined,
  updateWeeklyScheduleAction: async () => undefined,
  saveDateExceptionAction: async () => undefined,
  deleteDateExceptionAction: async () => undefined,
  importHolidaysAction: async () => undefined,
}));

import { InternalAgendaScreen } from "@/src/modules/internal/internal-agenda-screen";
import { workshopSeedConfig } from "@/src/modules/settings/defaults";

describe("InternalAgendaScreen", () => {
  it("renders the daily appointment agenda with status controls", () => {
    render(
      <InternalAgendaScreen
        agenda={{
          date: "2026-07-06",
          appointments: [
            {
              id: "appt_1",
              serviceName: "Service Esencial",
              customerName: "Ada Lovelace",
              customerPhone: "+5491112345678",
              customerEmail: "ada@example.com",
              motorcycleLabel: "Honda XR ABC123",
              startAt: new Date("2026-07-06T09:00:00-03:00"),
              endAt: new Date("2026-07-06T09:30:00-03:00"),
              status: "PENDING_CONFIRMATION",
              notes: "Customer prefers morning.",
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Agenda" })).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Service Esencial")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Actualizar" })).toBeInTheDocument();
  });

  it("renders an empty state for days without appointments", () => {
    render(<InternalAgendaScreen agenda={{ date: "2026-07-06", appointments: [] }} />);

    expect(screen.getByText("No hay turnos agendados para esta fecha.")).toBeInTheDocument();
  });

  it("renders editable opening hours and breaks for every weekday", () => {
    render(
      <InternalAgendaScreen
        agenda={{ date: "2026-07-06", appointments: [] }}
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
      <InternalAgendaScreen
        agenda={{ date: "2026-07-06", appointments: [] }}
        exceptions={[
          { date: "2026-07-09", label: "Dia de la Independencia", source: "IMPORTED", manualOverride: false, isOpen: false, opensAt: null, closesAt: null },
          { date: "2026-12-08", label: "Abrimos igual", source: "MANUAL", manualOverride: true, isOpen: true, opensAt: "10:00", closesAt: "13:00" },
        ]}
      />,
    );

    expect(screen.getByText("Dia de la Independencia")).toBeInTheDocument();
    expect(screen.getByText("Cerrado")).toBeInTheDocument();
    expect(screen.getByText("Abre 10:00 a 13:00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eliminar la excepcion del 2026-07-09" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar excepcion" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Importar feriados" })).toBeInTheDocument();
  });

  it("reports the outcome of the last maintenance action", () => {
    render(<InternalAgendaScreen agenda={{ date: "2026-07-06", appointments: [] }} feedback="holidays-unavailable" />);

    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos consultar los feriados");
  });
});
