import "dotenv/config";
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getDatabaseUrl } from "@/src/lib/env";
import { createPasswordHash } from "@/src/lib/password";
import { resolveTestDataTarget } from "@/src/modules/testing/test-data-guard";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: getDatabaseUrl() }) });
const target = resolveTestDataTarget({
  profile: "development",
  env: { ...process.env, NODE_ENV: process.env.NODE_ENV ?? "test" },
});
const prefix = "e2e-vehicles-";
const plate = `EV${Math.floor(Math.random() * 90_000 + 10_000)}ZZ`;

test.beforeEach(async () => {
  if (!target.allowed) test.skip(true, target.message);
  await deleteFixtures();
});

test.afterAll(async () => {
  await deleteFixtures();
  await prisma.$disconnect();
});

test("el historial de la unidad requiere sesión interna", async ({ page }) => {
  const { target: vehicleId } = await seedDuplicatePair();

  await page.goto(`/internal/vehicles/${vehicleId}`);

  await expect(page.getByRole("heading", { name: "Acceso interno" })).toBeVisible();
  await expect(page.getByText(plate)).toHaveCount(0);
});

test("el taller busca una unidad, ve su historial y fusiona el duplicado", async ({ page }) => {
  test.slow();
  const { source, target: vehicleId } = await seedDuplicatePair();
  await signIn(page);

  await page.goto("/internal/vehicles");
  await expect(page.getByRole("heading", { name: "Unidades" })).toBeVisible({ timeout: 30_000 });

  // La patente se busca como está impresa, con espacios.
  await page.getByLabel("Buscar").fill(`${plate.slice(0, 2)} ${plate.slice(2)}`);
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByRole("link", { name: /Honda XR150/ }).first()).toBeVisible();

  await page.goto(`/internal/vehicles/${vehicleId}`);
  await expect(page.getByRole("heading", { name: "Honda XR150" })).toBeVisible();
  await expect(page.getByText("1 turnos registrados", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Posibles duplicados" })).toBeVisible();

  // La patente se muestra pero no se edita: identifica a la unidad.
  await expect(page.getByLabel("Patente")).toBeDisabled();

  await page.getByLabel("Numero de motor").fill("MOTOR-E2E-001");
  await page.getByLabel("Color").fill("Rojo");
  await page.getByRole("button", { name: "Guardar ficha" }).click();
  await expect(page.getByText("Ficha actualizada.")).toBeVisible();
  await expect(page.getByLabel("Numero de motor")).toHaveValue("MOTOR-E2E-001");

  await page.getByRole("button", { name: "Fusionar en esta" }).click();
  await expect(page.getByText("Unidades fusionadas.")).toBeVisible();
  await expect(page.getByText("2 turnos registrados", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Posibles duplicados" })).toHaveCount(0);

  expect(await prisma.vehicle.findUnique({ where: { id: source } })).toBeNull();
  expect(await prisma.appointment.count({ where: { vehicleId } })).toBe(2);
});

test("el detalle del turno enlaza al historial de su unidad", async ({ page }) => {
  const { target: vehicleId, appointmentDate } = await seedDuplicatePair();
  await signIn(page);

  await page.goto(`/internal?date=${appointmentDate}`);
  // Ese dia hay un turno por cada unidad duplicada; el que empieza 10:00 es el de la que sobrevive.
  // El nombre accesible arranca con la hora de inicio, asi que "10:00 hasta" no matchea al de las 09:00.
  await page.getByRole("button", { name: /^10:00 hasta 11:00 Vehiculo E2E Rider/ }).click();
  await page.getByRole("link", { name: "Ver historial de la unidad" }).click();

  await expect(page.getByRole("heading", { name: "Honda XR150" })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/internal/vehicles/${vehicleId}$`));
});

async function signIn(page: Page) {
  await prisma.user.upsert({
    where: { email: requiredEnv("ADMIN_EMAIL") },
    update: { username: requiredEnv("ADMIN_USERNAME"), passwordHash: await createPasswordHash(requiredEnv("ADMIN_PASSWORD")) },
    create: {
      email: requiredEnv("ADMIN_EMAIL"),
      username: requiredEnv("ADMIN_USERNAME"),
      name: process.env.ADMIN_NAME ?? "Fosa Admin",
      passwordHash: await createPasswordHash(requiredEnv("ADMIN_PASSWORD")),
    },
  });
  await page.goto("/internal/login");
  await page.getByLabel("Usuario").fill(requiredEnv("ADMIN_USERNAME"));
  await page.getByLabel("Contraseña").fill(requiredEnv("ADMIN_PASSWORD"));
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("heading", { name: "Agenda" })).toBeVisible({ timeout: 30_000 });
}

async function seedDuplicatePair() {
  const vehicleType = await prisma.vehicleType.findFirstOrThrow({ where: { isActive: true } });
  const service = await prisma.service.findFirstOrThrow({ where: { isActive: true } });
  const customer = await prisma.customer.create({
    data: { id: `${prefix}${randomUUID()}`, fullName: "Vehiculo E2E Rider", phone: `11${Math.floor(Math.random() * 1_000_000)}` },
  });

  const make = (licensePlate: string) =>
    prisma.vehicle.create({
      data: {
        id: `${prefix}${randomUUID()}`,
        customerId: customer.id,
        vehicleTypeId: vehicleType.id,
        brand: "Honda",
        model: "XR150",
        licensePlate,
        plateNormalized: plate,
      },
    });
  const source = await make(plate.toLowerCase());
  const target = await make(plate);

  const appointmentDate = "2026-08-17";
  for (const [index, vehicleId] of [source.id, target.id].entries()) {
    await prisma.appointment.create({
      data: {
        serviceId: service.id,
        customerId: customer.id,
        vehicleId,
        startAt: new Date(`${appointmentDate}T${String(9 + index).padStart(2, "0")}:00:00-03:00`),
        endAt: new Date(`${appointmentDate}T${String(10 + index).padStart(2, "0")}:00:00-03:00`),
        idempotencyKey: `${prefix}${randomUUID()}`,
        status: "CONFIRMED",
      },
    });
  }

  return { source: source.id, target: target.id, appointmentDate };
}

async function deleteFixtures() {
  await prisma.appointment.deleteMany({ where: { idempotencyKey: { startsWith: prefix } } });
  await prisma.vehicleMerge.deleteMany({ where: { sourceVehicleId: { startsWith: prefix } } });
  await prisma.vehicle.deleteMany({ where: { id: { startsWith: prefix } } });
  await prisma.customer.deleteMany({ where: { id: { startsWith: prefix } } });
}

function requiredEnv(key: "ADMIN_EMAIL" | "ADMIN_USERNAME" | "ADMIN_PASSWORD"): string {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is required for internal E2E tests.`);
  return value;
}
