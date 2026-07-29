import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";

vi.mock("@/app/(internal)/internal/actions", () => ({
  signOutAction: async () => undefined,
  updateAppointmentStatusAction: async () => undefined,
  updateServiceVisibilityAction: async () => undefined,
  updateWorkshopSettingsAction: async () => undefined,
}));

import { InternalAgendaScreen } from "@/src/modules/internal/internal-agenda-screen";

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
});
