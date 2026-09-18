import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PaidDepositWarning } from "@/src/modules/internal/paid-deposit-warning";

describe("paid deposits on cancelled appointments", () => {
  it("lists each deposit with the customer contact and links to its agenda day", () => {
    const deposit = {
      attemptId: "attempt-1",
      amountCents: 500_000,
      approvedAt: new Date("2026-10-01T15:00:00Z"),
      publicCode: "ABCD234567",
      startAt: new Date("2026-10-02T12:00:00-03:00"),
      appointmentStatus: "CANCELLED" as const,
      customerName: "Ada Lovelace",
      customerPhone: "+5491100000000",
    };
    const { rerender } = render(<PaidDepositWarning deposits={[deposit]} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Señas cobradas en turnos cancelados");
    expect(screen.getByRole("alert")).toHaveTextContent("Ada Lovelace (+5491100000000)");
    expect(screen.getByRole("link")).toHaveAttribute("href", "/internal?date=2026-10-02");
    rerender(<PaidDepositWarning deposits={[]} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
