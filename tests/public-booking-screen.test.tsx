import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PublicBookingScreen } from "@/src/modules/booking/public-booking-screen";

describe("PublicBookingScreen", () => {
  it("shows active services, available slots, and the customer booking form", () => {
    render(
      <PublicBookingScreen
        services={[{ id: "oil", name: "Service Esencial", description: null, durationMinutes: 60, isActive: true, displayOrder: 1 }]}
        selectedServiceId="oil"
        selectedDate="2026-07-06"
        slots={[{ startAt: new Date("2026-07-06T09:00:00-03:00"), endAt: new Date("2026-07-06T09:30:00-03:00"), startTime: "09:00", remainingCapacity: 2 }]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Reservar turno" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Service Esencial - 60 min" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /09:00/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre y apellido")).toBeInTheDocument();
    expect(screen.getByLabelText("Marca de la moto")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Solicitar turno" })).toBeInTheDocument();
  });

  it("shows a choose-another-slot message when no slots are available", () => {
    render(
      <PublicBookingScreen
        services={[{ id: "long", name: "Service Deluxe", description: null, durationMinutes: 240, isActive: true, displayOrder: 1 }]}
        selectedServiceId="long"
        selectedDate="2026-07-06"
        slots={[]}
      />,
    );

    expect(screen.getByText("No hay horarios disponibles para este servicio y fecha. Proba con otro dia."))
      .toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
});
