import { z } from "zod";
import { workshopDate } from "@/src/lib/workshop-date";

const optionalText = (schema: z.ZodString) => z.preprocess(
  (value) => typeof value === "string" ? value.trim() || null : value ?? null,
  schema.nullable(),
).default(null);

export const calendarDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "La fecha no existe.");

export const businessSettingsSchema = z.object({
  publicPhone: optionalText(z.string().regex(/^(?=(?:\D*\d){6})\+?[\d ()-]{6,30}$/u)),
  whatsappNumber: optionalText(z.string().regex(/^\+?[1-9]\d{7,14}$/u)),
  publicAppUrl: optionalText(z.string().url().max(250)).refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash;
    } catch { return false; }
  }, "Usá un dominio HTTPS sin rutas.").transform((value) => value ? new URL(value).origin : null),
  emailFrom: optionalText(z.string().email().max(254)),
  depositRefundPolicy: optionalText(z.string().max(2000)),
  depositActivationDate: optionalText(calendarDateSchema),
});

export type BusinessSettings = z.infer<typeof businessSettingsSchema>;

export function isDepositActive(settings: { depositRequired: boolean; depositActivationDate?: string | null }, now = new Date()): boolean {
  return settings.depositRequired && (!settings.depositActivationDate || workshopDate(now) >= settings.depositActivationDate);
}
