import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PublicAppointmentStatusScreen } from "@/src/modules/booking/public-appointment-status-screen";

describe("PublicAppointmentStatusScreen", () => {
  it("renders code entry and a privacy-limited status result", () => {
    render(
      <PublicAppointmentStatusScreen
        code="ABCD234567"
        result={{
          accepted: true,
          appointment: {
            publicCode: "ABCD234567",
            serviceName: "Service Esencial",
            startAt: new Date("2026-07-06T09:00:00-03:00"),
            endAt: new Date("2026-07-06T09:30:00-03:00"),
            status: "CONFIRMED",
          },
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Consultar turno" })).toBeInTheDocument();
    expect(screen.getByLabelText("Codigo del turno")).toHaveValue("ABCD234567");
    expect(screen.getByLabelText("Codigo del turno")).toHaveAttribute("maxlength", "32");
    expect(screen.getByText("Confirmado")).toBeInTheDocument();
    expect(screen.getByText("Service Esencial")).toBeInTheDocument();
    expect(screen.queryByText(/cliente|telefono|moto|notas/iu)).not.toBeInTheDocument();
  });

  it("renders the generic not-found message", () => {
    render(
      <PublicAppointmentStatusScreen
        code="UNKNOWN234"
        result={{ accepted: false, reason: "APPOINTMENT_NOT_FOUND", message: "No encontramos un turno con ese codigo." }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("No encontramos un turno con ese codigo.");
  });
});
