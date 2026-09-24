import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/(internal)/internal/actions", () => ({
  signOutAction: async () => undefined,
}));

import { InternalShell } from "@/src/modules/internal/internal-shell";

function sectionLinks() {
  const nav = screen.getByRole("navigation", { name: "Secciones del panel" });
  return within(nav).getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")]);
}

describe("InternalShell", () => {
  it("shows the same sections on every internal screen and marks the active one", () => {
    render(<InternalShell active="vehicles" signedInUserName="Ana">contenido</InternalShell>);

    expect(sectionLinks()).toEqual([
      ["Agenda", "/internal"],
      ["Unidades", "/internal/vehicles"],
      ["Repuestos", "/internal/shop"],
      ["Mi cuenta", "/internal/account"],
    ]);
    expect(screen.getByRole("link", { name: "Unidades" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Agenda" })).not.toHaveAttribute("aria-current");
  });

  it("adds Configuración for administrators and honours per-section hrefs", () => {
    render(
      <InternalShell active="settings" canManageWorkshop hrefs={{ agenda: "/internal?date=2026-07-06" }}>
        contenido
      </InternalShell>,
    );

    expect(sectionLinks()).toEqual([
      ["Agenda", "/internal?date=2026-07-06"],
      ["Configuración", "/internal?section=settings"],
      ["Unidades", "/internal/vehicles"],
      ["Repuestos", "/internal/shop"],
      ["Mi cuenta", "/internal/account"],
    ]);
    expect(screen.getByRole("link", { name: "Configuración" })).toHaveAttribute("aria-current", "page");
  });
});
