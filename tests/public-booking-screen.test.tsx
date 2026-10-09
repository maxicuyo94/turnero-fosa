import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PublicBookingScreen } from "@/src/modules/booking/public-booking-screen";

const services = [
  { id: "oil", name: "Service Esencial", description: null, durationMinutes: 60, isActive: true, displayOrder: 1 },
  { id: "full", name: "Service Completo", description: null, durationMinutes: 120, isActive: true, displayOrder: 2 },
];

describe("PublicBookingScreen", () => {
  it("updates the selection summary without discarding customer details", () => {
    render(<PublicBookingScreen services={services} selectedServiceId="oil" selectedDate="2026-07-06" selectedDurationMinutes={60} slots={[
      { startAt: new Date("2026-07-06T09:00:00-03:00"), endAt: new Date("2026-07-06T10:00:00-03:00"), startTime: "09:00", remainingCapacity: 2 },
      { startAt: new Date("2026-07-06T15:00:00-03:00"), endAt: new Date("2026-07-06T16:00:00-03:00"), startTime: "15:00", remainingCapacity: 1 },
    ]} />);
    fireEvent.click(screen.getByRole("radio", { name: /09:00/ }));
    fireEvent.change(screen.getByLabelText("Nombre y apellido"), { target: { value: "Ada" } });
    fireEvent.click(screen.getByRole("radio", { name: /15:00/ }));
    expect(screen.getByText("15:00–16:00 · 60 min")).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre y apellido")).toHaveValue("Ada");
    expect(screen.getByRole("radio", { name: /15:00/ })).toBeChecked();
  });
  it("shows active services, available slots, and the customer booking form", () => {
    render(
      <PublicBookingScreen
        services={services.slice(0, 1)}
        selectedServiceId="oil"
        selectedDate="2026-07-06"
        selectedDurationMinutes={90}
        canEditDuration
        slots={[{ startAt: new Date("2026-07-06T09:00:00-03:00"), endAt: new Date("2026-07-06T09:30:00-03:00"), startTime: "09:00", remainingCapacity: 2 }]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Reservar turno" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Service Esencial - 60 min" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: /Duración total/i })).toHaveValue(90);
    expect(screen.getByRole("radio", { name: /09:00/i })).toBeInTheDocument();
    expect(screen.queryByLabelText("Nombre y apellido")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /09:00/i }));
    expect(screen.getByLabelText("Nombre y apellido")).toBeInTheDocument();
    expect(screen.getByLabelText("Marca")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Solicitar turno" })).toBeInTheDocument();
  });

  it("hides the duration control from visitors without an internal session", () => {
    const { container } = render(
      <PublicBookingScreen
        services={services}
        selectedServiceId="oil"
        selectedDate="2026-07-06"
        selectedDurationMinutes={60}
        slots={[]}
      />,
    );

    expect(screen.queryByRole("spinbutton", { name: /Duración total/i })).not.toBeInTheDocument();
    expect(container.querySelector('input[name="durationMinutes"]')).toBeNull();
    expect(screen.queryByLabelText("Nombre y apellido")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cambiar servicio o fecha" })).toHaveAttribute("href", "#buscar-horarios");
  });

  it("resets the duration to the newly selected service duration", () => {
    render(
      <PublicBookingScreen
        services={services}
        selectedServiceId="oil"
        selectedDate="2026-07-06"
        selectedDurationMinutes={90}
        canEditDuration
        slots={[]}
      />,
    );

    fireEvent.change(screen.getByLabelText("Servicio"), { target: { value: "full" } });

    expect(screen.getByRole("spinbutton", { name: /Duración total/i })).toHaveValue(120);
    expect(screen.getByRole("spinbutton", { name: /Duración total/i })).toHaveAttribute("min", "120");
  });

  it("shows a choose-another-slot message when no slots are available", () => {
    render(
      <PublicBookingScreen
        services={[{ id: "long", name: "Service Deluxe", description: null, durationMinutes: 240, isActive: true, displayOrder: 1 }]}
        selectedServiceId="long"
        selectedDate="2026-07-06"
        selectedDurationMinutes={240}
        slots={[]}
      />,
    );

    expect(screen.getByText("No hay horarios disponibles para este servicio y fecha."))
      .toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("shows the public code and status link after a successful booking", () => {
    render(
      <PublicBookingScreen
        services={[]}
        selectedServiceId=""
        selectedDate="2026-07-06"
        selectedDurationMinutes={0}
        slots={[]}
        outcome={{ accepted: true, message: "Turno creado.", publicCode: "ABCD234567" }}
      />,
    );

    expect(screen.getByText("ABCD234567")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Consultar estado" })).toHaveAttribute("href", "/booking/status?code=ABCD234567");
  });
});
