import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button, Toggle } from "@/src/components/ui";

describe("estado pendiente", () => {
  it("el botón pendiente muestra un spinner, queda deshabilitado y marcado como ocupado", () => {
    const { container } = render(<Button pending type="submit">Guardar</Button>);
    const button = screen.getByRole("button", { name: "Guardar" });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(container.querySelector("svg.animate-spin")).not.toBeNull();
  });

  it("sin pendiente no hay spinner y respeta su propio disabled", () => {
    const { container } = render(<Button disabled={false}>Guardar</Button>);

    expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled();
    expect(screen.getByRole("button")).not.toHaveAttribute("aria-busy");
    expect(container.querySelector("svg.animate-spin")).toBeNull();
  });

  it("el toggle pendiente gira y no acepta otro click", () => {
    const { container } = render(<Toggle aria-label="Ocultar Moto" checked pending />);

    expect(screen.getByRole("button", { name: "Ocultar Moto" })).toBeDisabled();
    expect(container.querySelector("svg.animate-spin")).not.toBeNull();
  });
});
