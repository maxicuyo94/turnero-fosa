import { describe, expect, it } from "vitest";
import { contactLinks } from "@/src/modules/internal/contact-links";

describe("contact links", () => {
  it("preserves the stored international number for calling and WhatsApp", () => {
    expect(contactLinks("+54 9 11-1234-5678")).toEqual({
      call: "tel:+5491112345678",
      whatsapp: "https://wa.me/5491112345678",
    });
  });

  it("does not guess a country code or expose links for an unusable number", () => {
    expect(contactLinks("11 1234-5678")).toEqual({
      call: "tel:1112345678",
      whatsapp: "https://wa.me/1112345678",
    });
    expect(contactLinks("sin teléfono")).toBeNull();
  });
});
