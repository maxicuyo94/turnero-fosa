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
  const { vehicleId } = await seedVehicle();

  await page.goto(`/internal/vehicles/${vehicleId}`);

  await expect(page.getByRole("heading", { name: "Acceso interno" })).toBeVisible();
  await expect(page.getByText(plate)).toHaveCount(0);
});

test("el taller busca una unidad, ve su historial y completa la ficha", async ({ page }) => {
  test.slow();
  const { vehicleId } = await seedVehicle();
  await signIn(page);

  await page.goto("/internal/vehicles");
  await expect(page.getByRole("heading", { name: "Unidades" })).toBeVisible({ timeout: 30_000 });

  // La patente se busca como está impresa, con espacios.
  await page.getByLabel("Buscar").fill(`${plate.slice(0, 2)} ${plate.slice(2)}`);
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByRole("link", { name: /Honda XR150/ }).first()).toBeVisible();

  await page.goto(`/internal/vehicles/${vehicleId}`);
  await expect(page.getByRole("heading", { name: "Honda XR150" })).toBeVisible();
  await expect(page.getByText("2 turnos registrados", { exact: false })).toBeVisible();

  await page.getByLabel("Número de motor").fill("MOTOR-E2E-001");
  await page.getByLabel("Color").fill("Rojo");
  await page.getByRole("button", { name: "Guardar ficha" }).click();
  await expect(page.getByText("Ficha actualizada.")).toBeVisible();
  await expect(page.getByLabel("Número de motor")).toHaveValue("MOTOR-E2E-001");
  await page.screenshot({ path: test.info().outputPath(`vehicle-${test.info().project.name}.png`), fullPage: true });
});

test("el taller corrige una patente mal cargada y no puede tomar la de otra unidad", async ({ page }) => {
  test.slow();
  const { vehicleId } = await seedVehicle();
  const corrected = `EW${Math.floor(Math.random() * 90_000 + 10_000)}ZZ`;
  const other = await prisma.vehicle.create({
    data: {
      id: `${prefix}${randomUUID()}`,
      customerId: (await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicleId } })).customerId,
      vehicleTypeId: (await prisma.vehicleType.findFirstOrThrow({ where: { isActive: true } })).id,
      brand: "Yamaha",
      model: "YBR125",
      licensePlate: `EX${plate.slice(2)}`,
      plateNormalized: `EX${plate.slice(2)}`,
    },
  });
  await signIn(page);
  await page.goto(`/internal/vehicles/${vehicleId}`);

  // La patente de otra unidad se rechaza y ofrece abrirla.
  await page.getByLabel("Patente").fill(other.licensePlate!.toLowerCase());
  await page.getByRole("button", { name: "Corregir patente" }).click();
  await expect(page.getByText("Esa patente ya es de otra unidad: no se cambió.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver esa unidad" })).toHaveAttribute("href", `/internal/vehicles/${other.id}`);

  await page.getByLabel("Patente").fill(corrected);
  await page.getByRole("button", { name: "Corregir patente" }).click();
  await expect(page.getByText("Patente corregida.")).toBeVisible();
  await expect(page.getByText(`${plate} → ${corrected}`)).toBeVisible();
  expect((await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicleId } })).plateNormalized).toBe(corrected);
});

test("el detalle del turno enlaza al historial de su unidad", async ({ page }) => {
  const { vehicleId, appointmentDate } = await seedVehicle();
  await signIn(page);

  await page.goto(`/internal?date=${appointmentDate}`);
  // Ese dia la unidad tiene dos turnos; se abre el de las 10:00.
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

async function seedVehicle() {
  const vehicleType = await prisma.vehicleType.findFirstOrThrow({ where: { isActive: true } });
  const service = await prisma.service.findFirstOrThrow({ where: { isActive: true } });
  const customer = await prisma.customer.create({
    data: { id: `${prefix}${randomUUID()}`, fullName: "Vehiculo E2E Rider", phone: `11${Math.floor(Math.random() * 1_000_000)}` },
  });

  const vehicle = await prisma.vehicle.create({
    data: {
      id: `${prefix}${randomUUID()}`,
      customerId: customer.id,
      vehicleTypeId: vehicleType.id,
      brand: "Honda",
      model: "XR150",
      licensePlate: plate,
      plateNormalized: plate,
    },
  });

  const appointmentDate = "2026-08-17";
  for (const index of [0, 1]) {
    await prisma.appointment.create({
      data: {
        serviceId: service.id,
        customerId: customer.id,
        vehicleId: vehicle.id,
        startAt: new Date(`${appointmentDate}T${String(9 + index).padStart(2, "0")}:00:00-03:00`),
        endAt: new Date(`${appointmentDate}T${String(10 + index).padStart(2, "0")}:00:00-03:00`),
        idempotencyKey: `${prefix}${randomUUID()}`,
        status: "CONFIRMED",
      },
    });
  }

  return { vehicleId: vehicle.id, appointmentDate };
}

async function deleteFixtures() {
  await prisma.vehiclePlateChange.deleteMany({ where: { vehicleId: { startsWith: prefix } } });
  await prisma.appointment.deleteMany({ where: { idempotencyKey: { startsWith: prefix } } });
  await prisma.vehicle.deleteMany({ where: { id: { startsWith: prefix } } });
  await prisma.customer.deleteMany({ where: { id: { startsWith: prefix } } });
}

function requiredEnv(key: "ADMIN_EMAIL" | "ADMIN_USERNAME" | "ADMIN_PASSWORD"): string {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is required for internal E2E tests.`);
  return value;
}
