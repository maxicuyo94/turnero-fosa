import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RouteCard } from "@/src/components/ui";

describe("RouteCard", () => {
  it("renders a reachable navigation action", () => {
    render(
      <RouteCard
        actionLabel="View public shell"
        description="Customer-facing placeholder route."
        eyebrow="Public"
        href="/booking"
        title="Booking entry"
      />,
    );

    expect(screen.getByRole("heading", { name: "Booking entry" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View public shell" })).toHaveAttribute("href", "/booking");
  });
});
