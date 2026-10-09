import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button, Field, Select, TabNav, TextInput } from "@/src/components/ui";

describe("design system accessibility contracts", () => {
  it("links errors and help to the labelled control while preserving existing descriptions", () => {
    render(<>
      <p id="existing-help">El email se usa para confirmar la reserva.</p>
      <Field label="Email" htmlFor="email" description="Usá tu email habitual." error="Revisá el formato.">
        <TextInput aria-describedby="existing-help" />
      </Field>
    </>);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("id", "email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("El email se usa para confirmar la reserva. Usá tu email habitual. Revisá el formato.");
  });
  it("removes the error association after correction while keeping the control labelled", () => {
    const { rerender } = render(<Field label="Servicio" htmlFor="service" error="Elegí un servicio."><Select><option value="">Elegir</option></Select></Field>);
    expect(screen.getByLabelText("Servicio")).toHaveAttribute("aria-invalid", "true");
    rerender(<Field label="Servicio" htmlFor="service"><Select><option>Service Esencial</option></Select></Field>);
    expect(screen.getByLabelText("Servicio")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByLabelText("Servicio")).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByText("Elegí un servicio.")).not.toBeInTheDocument();
  });
  it("preserves implicit labels on existing fields", () => {
    render(<Field label="Teléfono"><TextInput type="tel" /></Field>);
    expect(screen.getByLabelText("Teléfono")).toHaveAttribute("type", "tel");
  });
  it("uses route links with only the selected destination marked current", () => {
    render(<TabNav label="Configuración" items={[
      { label: "General", href: "/settings", active: true },
      { label: "Horarios", href: "/settings/schedule", active: false },
    ]} />);
    expect(screen.getByRole("navigation", { name: "Configuración" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "General" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Horarios" })).not.toHaveAttribute("aria-current");
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });
  it("a pending destructive action prevents repeated clicks", () => {
    render(<Button variant="danger" pending>Cancelar turno</Button>);
    const button = screen.getByRole("button", { name: "Cancelar turno" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("type", "button");
  });
});
