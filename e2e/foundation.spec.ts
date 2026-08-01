import "dotenv/config";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getEnv } from "@/src/lib/env";
import { createPasswordHash } from "@/src/lib/password";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: getEnv().DATABASE_URL }) });
const e2ePhonePrefix = "+5491100";
const internalE2EDate = "2026-07-21";

test.beforeEach(async () => {
  await cleanupPublicBookingE2EData();
  await cleanupInternalE2EData();
});

test.afterEach(async () => {
  await cleanupPublicBookingE2EData();
  await cleanupInternalE2EData();
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("foundation routes are reachable", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Taller de motos Express" })).toBeVisible();

  await page.getByRole("link", { name: "Ir a reservar →" }).click();
  await expect(page.getByRole("heading", { name: "Reservar turno" })).toBeVisible();

  await page.goto("/internal");
  await expect(page.getByRole("heading", { name: "Acceso interno" })).toBeVisible();
});

test("public booking happy path creates a pending request", async ({ page }) => {
  const runId = Date.now().toString();
  const bookingDate = await findNextPublicBookingDate();

  await page.goto(`/booking?date=${bookingDate}`);

  await page.getByRole("radio").first().check();
  await page.getByLabel("Nombre y apellido").fill("E2E Rider");
  await page.getByLabel("Telefono").fill(`${e2ePhonePrefix}${runId}`);
  await page.getByLabel("Marca de la moto").fill("Honda");
  await page.getByLabel("Modelo").fill("XR150");
  await page.getByRole("button", { name: "Solicitar turno" }).click();

  await expect(page.getByText("Tu turno quedo confirmado automaticamente.")).toBeVisible();
  await expect(page.getByText(/^[A-HJ-NP-Z2-9]{10}$/u)).toBeVisible();
  await expect(page.getByRole("link", { name: "Guardar enlace de cancelacion" })).toHaveCount(0);
  await expect(page.getByText("La reprogramacion online no esta disponible por ahora.")).toBeVisible();
  await page.getByRole("link", { name: "Consultar estado" }).click();
  await expect(page.getByRole("heading", { name: "Consultar turno" })).toBeVisible();
  await expect(page.getByText("Confirmado")).toBeVisible();
});

test("internal user changes an appointment status", async ({ page }) => {
  const appointmentId = await seedInternalE2EAppointment();

  await ensureE2EAdminUser();
  await page.goto("/internal/login");
  await page.getByLabel("Usuario").fill(requiredEnv("ADMIN_USERNAME"));
  await page.getByLabel("Contraseña").fill(requiredEnv("ADMIN_PASSWORD"));
  await page.getByRole("button", { name: "Ingresar" }).click();

  await expect(page.getByRole("heading", { name: "Agenda" })).toBeVisible();
  await page.goto(`/internal?date=${internalE2EDate}`);
  await expect(page.getByText("Internal E2E Rider")).toBeVisible();

  await page.getByLabel("Estado").selectOption("IN_PROGRESS");
  await page.getByRole("button", { name: "Actualizar" }).click();

  await expect(page.getByText("09:00-09:30 · en curso")).toBeVisible();
  await expect.poll(async () => {
    const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId }, select: { status: true } });
    return appointment?.status;
  }).toBe("IN_PROGRESS");
});

async function cleanupPublicBookingE2EData() {
  const appointments = await prisma.appointment.findMany({
    where: { customer: { phone: { startsWith: e2ePhonePrefix } } },
    select: { id: true, motorcycleId: true, customerId: true },
  });
  const appointmentIds = appointments.map((appointment) => appointment.id);
  const motorcycleIds = appointments.map((appointment) => appointment.motorcycleId);
  const customerIds = appointments.map((appointment) => appointment.customerId);

  await prisma.appointment.deleteMany({ where: { id: { in: appointmentIds } } });
  await prisma.motorcycle.deleteMany({ where: { id: { in: motorcycleIds } } });
  await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
}

async function findNextPublicBookingDate(): Promise<string> {
  const settings = await prisma.workshopSettings.findFirst({ include: { weeklySchedules: true } });
  if (!settings) throw new Error("Seed workshop settings before running E2E tests.");

  const openDays = new Set(settings.weeklySchedules.filter((schedule) => schedule.isOpen).map((schedule) => schedule.dayOfWeek));
  const dayNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const;

  for (let daysAhead = 1; daysAhead <= settings.maximumBookingWindowDays; daysAhead += 1) {
    const candidate = new Date();
    candidate.setHours(12, 0, 0, 0);
    candidate.setDate(candidate.getDate() + daysAhead);
    if (openDays.has(dayNames[candidate.getDay()])) return localDate(candidate);
  }

  throw new Error("No open workshop day exists inside the booking window.");
}

function localDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function seedInternalE2EAppointment(): Promise<string> {
  const service = await prisma.service.findFirst({ where: { isActive: true }, orderBy: { displayOrder: "asc" } });
  if (!service) throw new Error("Seed an active service before running E2E tests.");

  const customer = await prisma.customer.create({
    data: {
      fullName: "Internal E2E Rider",
      phone: "+5491199999999",
    },
  });
  const motorcycle = await prisma.motorcycle.create({
    data: { customerId: customer.id, brand: "Yamaha", model: "FZ", licensePlate: "E2EINT" },
  });
  const appointment = await prisma.appointment.create({
    data: {
      serviceId: service.id,
      customerId: customer.id,
      motorcycleId: motorcycle.id,
      startAt: new Date(`${internalE2EDate}T09:00:00-03:00`),
      endAt: new Date(`${internalE2EDate}T09:30:00-03:00`),
      status: "CONFIRMED",
      idempotencyKey: `e2e-internal-${Date.now().toString(36)}`,
      statusHistory: { create: { toStatus: "CONFIRMED", note: "Internal E2E seed." } },
    },
  });

  return appointment.id;
}

async function cleanupInternalE2EData() {
  const appointments = await prisma.appointment.findMany({
    where: { idempotencyKey: { startsWith: "e2e-internal-" } },
    select: { id: true, motorcycleId: true, customerId: true },
  });
  const appointmentIds = appointments.map((appointment) => appointment.id);
  const motorcycleIds = appointments.map((appointment) => appointment.motorcycleId);
  const customerIds = appointments.map((appointment) => appointment.customerId);

  await prisma.appointment.deleteMany({ where: { id: { in: appointmentIds } } });
  await prisma.motorcycle.deleteMany({ where: { id: { in: motorcycleIds } } });
  await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
}

async function ensureE2EAdminUser() {
  await prisma.user.upsert({
    where: { email: requiredEnv("ADMIN_EMAIL") },
    update: {
      username: requiredEnv("ADMIN_USERNAME"),
      passwordHash: await createPasswordHash(requiredEnv("ADMIN_PASSWORD")),
    },
    create: {
      email: requiredEnv("ADMIN_EMAIL"),
      username: requiredEnv("ADMIN_USERNAME"),
      name: process.env.ADMIN_NAME ?? "Fosa Admin",
      passwordHash: await createPasswordHash(requiredEnv("ADMIN_PASSWORD")),
    },
  });
}

function requiredEnv(key: "ADMIN_EMAIL" | "ADMIN_USERNAME" | "ADMIN_PASSWORD"): string {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is required for internal E2E tests.`);
  return value;
}
