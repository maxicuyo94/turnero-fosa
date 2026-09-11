import { describe, expect, it, vi } from "vitest";
import { businessSettingsSchema, isDepositActive } from "@/src/modules/settings/business-settings";
import { updateInternalServiceDuration, updateInternalWorkshopSettings } from "@/src/modules/internal/maintenance";
import { getWorkshopNotificationEnv, getWorkshopPaymentEnv } from "@/src/modules/settings/runtime-settings";
import type { PrismaClient } from "@prisma/client";
import { PrismaBookingRepository } from "@/src/modules/booking/prisma-repository";
import { PrismaDepositPaymentRepository } from "@/src/modules/payments/prisma-repository";
import { workshopSeedConfig } from "@/src/modules/settings/defaults";
import { scheduleDateExceptionSchema, weeklyScheduleSchema } from "@/src/modules/settings/schemas";

describe("business settings", () => {
  it("persists business decisions alongside operational settings", async () => {
    const save = vi.fn(async (input) => input);
    const contact = { publicPhone: "+54 261 5551234", whatsappNumber: "+5492615551234", publicAppUrl: "https://taller.example", emailFrom: "turnos@taller.example", depositRefundPolicy: "Consultar al taller para gestionar la devolución.", depositActivationDate: "2026-10-01" };
    await updateInternalWorkshopSettings({ updateWorkshopSettings: save, updateServiceVisibility: vi.fn() }, {
      capacity: 2, minimumNoticeMinutes: 120, maximumBookingWindowDays: 30,
      depositRequired: true, depositAmountArs: 5000, depositExpirationMinutes: 30, ...contact,
    });
    expect(save).toHaveBeenCalledWith(expect.objectContaining(contact));
  });

  it.each([
    { publicAppUrl: "javascript:alert(1)" }, { publicAppUrl: "https://user:pass@taller.example" },
    { publicAppUrl: "https://taller.example/path" }, { emailFrom: "invalid" },
    { whatsappNumber: "letters" }, { publicPhone: "------" }, { depositActivationDate: "2026-02-31" },
  ])("rejects invalid business input %j", (input) => {
    expect(businessSettingsSchema.safeParse(input).success).toBe(false);
  });

  it("clears optional fields and normalizes the public origin", () => {
    expect(businessSettingsSchema.parse({ publicPhone: " ", publicAppUrl: "https://taller.example/" }))
      .toMatchObject({ publicPhone: null, publicAppUrl: "https://taller.example" });
  });

  it("rejects impossible hours and calendar dates in operational settings", () => {
    expect(weeklyScheduleSchema.safeParse({ dayOfWeek: "MONDAY", opensAt: "25:00", closesAt: "26:00", isOpen: true }).success).toBe(false);
    expect(scheduleDateExceptionSchema.safeParse({ date: "2026-02-31", label: null, source: "MANUAL", manualOverride: true, isOpen: false, opensAt: null, closesAt: null }).success).toBe(false);
  });

  it("activates at midnight Argentina only while enabled", () => {
    const policy = { depositRequired: true, depositActivationDate: "2026-10-01" };
    expect(isDepositActive(policy, new Date("2026-10-01T02:59:59Z"))).toBe(false);
    expect(isDepositActive(policy, new Date("2026-10-01T03:00:00Z"))).toBe(true);
    expect(isDepositActive({ ...policy, depositRequired: false }, new Date("2026-10-02"))).toBe(false);
    expect(isDepositActive({ depositRequired: true })).toBe(true);
  });

  it("rejects invalid durations without persisting and saves valid durations", async () => {
    const updateServiceDuration = vi.fn(async () => ({ id: "service", name: "Motor", durationMinutes: 180, isActive: true, displayOrder: 1 }));
    for (const durationMinutes of [0, -1, 1.5, "abc", 1441]) {
      expect(await updateInternalServiceDuration({ updateServiceDuration }, { serviceId: "service", durationMinutes })).toMatchObject({ accepted: false });
    }
    expect(updateServiceDuration).not.toHaveBeenCalled();
    await updateInternalServiceDuration({ updateServiceDuration }, { serviceId: "service", durationMinutes: "180" });
    expect(updateServiceDuration).toHaveBeenCalledWith("service", 180);
  });

  it("uses stored sender and domain with environment fallback and keeps credentials outside settings", async () => {
    const findFirst = vi.fn().mockResolvedValue({ emailFrom: "saved@taller.example", publicAppUrl: "https://taller.example" });
    const prisma = { workshopSettings: { findFirst } } as unknown as PrismaClient;
    const env = { RESEND_API_KEY: "test-only", EMAIL_FROM: "fallback@taller.example", NEXT_PUBLIC_APP_URL: "https://fallback.example", MERCADO_PAGO_ACCESS_TOKEN: "test-only", MERCADO_PAGO_WEBHOOK_SECRET: "test-only" };
    expect(await getWorkshopNotificationEnv(prisma, env)).toMatchObject({ EMAIL_FROM: "saved@taller.example", RESEND_API_KEY: "test-only" });
    expect(await getWorkshopPaymentEnv(prisma, env)).toMatchObject({ NEXT_PUBLIC_APP_URL: "https://taller.example" });
    findFirst.mockResolvedValue({ emailFrom: null, publicAppUrl: null });
    expect(await getWorkshopNotificationEnv(prisma, env)).toMatchObject({ EMAIL_FROM: env.EMAIL_FROM });
    expect(await getWorkshopPaymentEnv(prisma, env)).toMatchObject({ NEXT_PUBLIC_APP_URL: env.NEXT_PUBLIC_APP_URL });
    expect(await getWorkshopNotificationEnv(prisma, {})).toBeNull();
    expect(await getWorkshopPaymentEnv(prisma, {})).toBeNull();
  });

  it("applies the same activation date to booking and checkout repositories", async () => {
    const findFirst = vi.fn().mockResolvedValue({ ...workshopSeedConfig.settings, depositRequired: true, depositActivationDate: "2999-01-01", weeklySchedules: [], scheduleBreaks: [], dateExceptions: [] });
    const prisma = { workshopSettings: { findFirst, findFirstOrThrow: findFirst } } as unknown as PrismaClient;
    expect((await new PrismaBookingRepository(prisma).getBookingContext()).settings.depositRequired).toBe(false);
    expect((await new PrismaDepositPaymentRepository(prisma).getDepositPolicy()).required).toBe(false);
    findFirst.mockResolvedValue({ ...workshopSeedConfig.settings, depositRequired: true, depositActivationDate: "2020-01-01", weeklySchedules: [], scheduleBreaks: [], dateExceptions: [] });
    expect((await new PrismaBookingRepository(prisma).getBookingContext()).settings.depositRequired).toBe(true);
    expect((await new PrismaDepositPaymentRepository(prisma).getDepositPolicy()).required).toBe(true);
  });
});
