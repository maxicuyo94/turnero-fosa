import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";

vi.mock("@/app/(internal)/internal/actions", () => ({
  signOutAction: async () => undefined,
  updateAppointmentStatusAction: async () => undefined,
  updateAppointmentDetailsAction: async () => undefined,
  rescheduleAppointmentAction: async () => undefined,
  previewAppointmentAvailabilityAction: async () => ({
    accepted: true,
    slots: [
      { startTime: "09:00", endTime: "09:30", remainingCapacity: 2 },
      { startTime: "09:30", endTime: "10:00", remainingCapacity: 2 },
    ],
  }),
}));

import { InternalAgendaScreen } from "@/src/modules/internal/internal-agenda-screen";

describe("InternalAgendaScreen", () => {
  it("renders the daily appointment agenda with contact actions and editing", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(
      <InternalAgendaScreen
        agenda={{
          date: "2026-07-06",
          appointments: [
            {
              id: "appt_1",
              publicCode: "ABCD234567",
              serviceName: "Service Esencial",
              serviceDurationMinutes: 30,
              customerName: "Ada Lovelace",
              customerPhone: "+5491112345678",
              customerEmail: "ada@example.com",
              contactEmail: null,
              customerUpdatedAt: new Date("2026-07-01T09:00:00-03:00"),
              customerDetailVersion: 0,
              vehicleId: "veh-test",
              vehicleLabel: "Honda XR ABC123",
              startAt: new Date("2026-07-06T09:00:00-03:00"),
              endAt: new Date("2026-07-06T09:30:00-03:00"),
              status: "PENDING_CONFIRMATION",
              notes: "Customer prefers morning.",
              updatedAt: new Date("2026-07-01T09:00:00-03:00"),
              detailVersion: 0,
              detailHistory: [],
              intervalHistory: [],
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Agenda" })).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getAllByText("Service Esencial")).not.toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: /Ada Lovelace/i }));
    expect(screen.getByRole("dialog", { name: "Detalle del turno" })).toBeInTheDocument();
    expect(screen.getByText("Código público")).toBeInTheDocument();
    expect(screen.getByText("ABCD234567")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copiar código" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copiar código" }));
    expect(await screen.findByText("Código copiado")).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith("ABCD234567");
    expect(screen.getByRole("link", { name: "Llamar" })).toHaveAttribute("href", "tel:+5491112345678");
    expect(screen.getByRole("link", { name: "Abrir WhatsApp" })).toHaveAttribute("href", "https://wa.me/5491112345678");
    expect(screen.getByRole("textbox", { name: "Nombre del cliente" })).toHaveValue("Ada Lovelace");
    expect(screen.getByRole("textbox", { name: "Notas del turno" })).toHaveValue("Customer prefers morning.");
    expect(screen.getByRole("button", { name: "Guardar contacto y notas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Actualizar estado" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nueva fecha")).toHaveValue("2026-07-06");
    expect(screen.getByLabelText(/Horario disponible/)).toHaveValue("09:00");
    expect(screen.getByRole("spinbutton", { name: /Duración total/i })).toHaveValue(30);
    expect(screen.getByText(/Intervalo final:/)).toHaveTextContent("2026-07-06 · 09:00–09:30");
    expect(screen.getByRole("button", { name: "Guardar reprogramación" })).toBeInTheDocument();
  });

  it("renders an empty state for days without appointments", () => {
    render(<InternalAgendaScreen agenda={{ date: "2026-07-06", appointments: [] }} />);

    expect(screen.getByText("No hay turnos agendados para esta fecha.")).toBeInTheDocument();
  });

  it("disables schedule editing for terminal appointments", () => {
    render(
      <InternalAgendaScreen
        agenda={{
          date: "2026-07-06",
          appointments: [{
            id: "appt_done",
            publicCode: "DONE234567",
            serviceName: "Service Esencial",
            serviceDurationMinutes: 30,
            customerName: "Turno Finalizado",
            customerPhone: "+5491112345678",
            customerEmail: null,
            contactEmail: null,
            customerUpdatedAt: new Date("2026-07-01T09:00:00-03:00"),
            customerDetailVersion: 0,
            vehicleId: "veh-test",
            vehicleLabel: "Honda XR",
            startAt: new Date("2026-07-06T09:00:00-03:00"),
            endAt: new Date("2026-07-06T09:30:00-03:00"),
            status: "COMPLETED",
            notes: null,
            updatedAt: new Date("2026-07-01T09:00:00-03:00"),
            detailVersion: 0,
            detailHistory: [],
            intervalHistory: [],
          }],
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Turno Finalizado/i }));
    expect(screen.getByLabelText("Nueva fecha")).toBeDisabled();
    expect(screen.getByLabelText(/Horario disponible/)).toBeDisabled();
    expect(screen.getByRole("spinbutton", { name: /Duración total/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Guardar reprogramación" })).toBeDisabled();
  });

  it("filters appointments and switches to the weekly view", () => {
    const tuesdayAppointment = {
      id: "appt_2",
      publicCode: "EFGH234567",
      serviceName: "Service Deluxe",
      serviceDurationMinutes: 60,
      customerName: "Grace Hopper",
      customerPhone: "+5491198765432",
      customerEmail: "grace@example.com",
      contactEmail: null,
      customerUpdatedAt: new Date("2026-07-01T09:00:00-03:00"),
      customerDetailVersion: 0,
      vehicleId: "veh-test",
      vehicleLabel: "Yamaha MT DEF456",
      startAt: new Date("2026-07-07T10:00:00-03:00"),
      endAt: new Date("2026-07-07T11:00:00-03:00"),
      status: "CONFIRMED" as const,
      notes: null,
      updatedAt: new Date("2026-07-01T09:00:00-03:00"),
      detailVersion: 0,
      detailHistory: [],
      intervalHistory: [],
    };
    render(
      <InternalAgendaScreen
        agenda={{ date: "2026-07-06", appointments: [] }}
        exceptions={[
          { date: "2026-07-07", label: "Feriado nacional", source: "IMPORTED", manualOverride: false, isOpen: false, opensAt: null, closesAt: null },
        ]}
        weekAgendas={[
          { date: "2026-07-06", appointments: [] },
          { date: "2026-07-07", appointments: [tuesdayAppointment] },
          { date: "2026-07-08", appointments: [] },
          { date: "2026-07-09", appointments: [] },
          { date: "2026-07-10", appointments: [] },
          { date: "2026-07-11", appointments: [] },
          { date: "2026-07-12", appointments: [] },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Semana" }));
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Grace Hopper/i })).toHaveTextContent("Confirmado");
    expect(screen.getByText("Feriado")).toBeInTheDocument();
    expect(screen.getByText("Feriado nacional")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: /Buscar por cliente/i }), { target: { value: "sin coincidencias" } });
    expect(screen.queryByText("Grace Hopper")).not.toBeInTheDocument();
  });
});
