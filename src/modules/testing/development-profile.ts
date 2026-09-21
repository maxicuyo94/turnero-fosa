import type { PrismaClient } from "@prisma/client";
import type { AppointmentStatus } from "@/src/modules/appointments/schemas";
import { seedAdminUser, seedWorkshopConfiguration } from "@/src/modules/settings/seed";
import { normalizeLicensePlate, normalizePhone } from "@/src/modules/customers/identity";

export type TestDataSummary = {
  profile: "development";
  workshopSettingsId: string;
  adminConfigured: boolean;
  customers: number;
  vehicles: number;
  appointments: number;
};

/** Deterministic identifiers keep repeated loads idempotent and make cleanup a prefix match. */
export const testDataPrefix = "test-data-";

const sampleCustomers = [
  {
    id: `${testDataPrefix}customer-ada`,
    fullName: "Ada Lovelace",
    phone: "+5491111110001",
    email: "ada@example.test",
    vehicle: { id: `${testDataPrefix}vehicle-ada`, brand: "Honda", model: "XR150", licensePlate: "TDA001", year: 2022 },
  },
  {
    id: `${testDataPrefix}customer-grace`,
    fullName: "Grace Hopper",
    phone: "+5491111110002",
    email: "grace@example.test",
    vehicle: { id: `${testDataPrefix}vehicle-grace`, brand: "Yamaha", model: "FZ25", licensePlate: "TDA002", year: 2023 },
  },
  {
    id: `${testDataPrefix}customer-alan`,
    fullName: "Alan Turing",
    phone: "+5491111110003",
    email: null,
    vehicle: { id: `${testDataPrefix}vehicle-alan`, brand: "Bajaj", model: "Rouser 200", licensePlate: "TDA003", year: 2021 },
  },
] as const;

const sampleAppointments: {
  idempotencyKey: string;
  customerId: string;
  vehicleId: string;
  serviceDisplayOrder: number;
  startTime: string;
  status: AppointmentStatus;
  notes: string;
}[] = [
  {
    idempotencyKey: `${testDataPrefix}appointment-pending`,
    customerId: sampleCustomers[0].id,
    vehicleId: sampleCustomers[0].vehicle.id,
    serviceDisplayOrder: 1,
    startTime: "09:00",
    status: "PENDING_CONFIRMATION",
    notes: "Dato de prueba: turno pendiente de confirmacion.",
  },
  {
    idempotencyKey: `${testDataPrefix}appointment-confirmed`,
    customerId: sampleCustomers[1].id,
    vehicleId: sampleCustomers[1].vehicle.id,
    serviceDisplayOrder: 3,
    startTime: "10:00",
    status: "CONFIRMED",
    notes: "Dato de prueba: turno confirmado.",
  },
  {
    idempotencyKey: `${testDataPrefix}appointment-completed`,
    customerId: sampleCustomers[2].id,
    vehicleId: sampleCustomers[2].vehicle.id,
    serviceDisplayOrder: 2,
    startTime: "15:00",
    status: "COMPLETED",
    notes: "Dato de prueba: turno completado.",
  },
];

export async function loadDevelopmentTestData(
  prisma: PrismaClient,
  options: { now?: Date; env?: Record<string, string | undefined> } = {},
): Promise<TestDataSummary> {
  const workshopSettingsId = await seedWorkshopConfiguration(prisma);
  const adminId = await seedAdminUser(prisma, options.env);
  const agendaDate = nextMonday(options.now ?? new Date());

  // Required since vehicles carry a type; the seed guarantees at least one active row.
  const vehicleType = await prisma.vehicleType.findFirstOrThrow({
    where: { workshopSettingsId, isActive: true },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  });

  for (const customer of sampleCustomers) {
    const customerData = {
      fullName: customer.fullName,
      phone: customer.phone,
      phoneNormalized: normalizePhone(customer.phone),
      email: customer.email,
    };
    await prisma.customer.upsert({
      where: { id: customer.id },
      update: customerData,
      create: { id: customer.id, ...customerData },
    });

    const vehicleData = {
      customerId: customer.id,
      vehicleTypeId: vehicleType.id,
      brand: customer.vehicle.brand,
      model: customer.vehicle.model,
      licensePlate: customer.vehicle.licensePlate,
      plateNormalized: normalizeLicensePlate(customer.vehicle.licensePlate),
      year: customer.vehicle.year,
    };
    await prisma.vehicle.upsert({
      where: { id: customer.vehicle.id },
      update: vehicleData,
      create: { id: customer.vehicle.id, ...vehicleData },
    });
  }

  for (const appointment of sampleAppointments) {
    const service = await prisma.service.findFirstOrThrow({
      where: { workshopSettingsId, displayOrder: appointment.serviceDisplayOrder },
    });
    const startAt = new Date(`${agendaDate}T${appointment.startTime}:00-03:00`);
    const endAt = new Date(startAt.getTime() + service.durationMinutes * 60_000);
    const data = {
      serviceId: service.id,
      customerId: appointment.customerId,
      vehicleId: appointment.vehicleId,
      startAt,
      endAt,
      status: appointment.status,
      notes: appointment.notes,
    };

    await prisma.appointment.upsert({
      where: { idempotencyKey: appointment.idempotencyKey },
      update: data,
      create: {
        ...data,
        idempotencyKey: appointment.idempotencyKey,
        statusHistory: { create: { toStatus: appointment.status, note: "Perfil de datos de prueba." } },
      },
    });
  }

  return {
    profile: "development",
    workshopSettingsId,
    adminConfigured: adminId !== null,
    customers: sampleCustomers.length,
    vehicles: sampleCustomers.length,
    appointments: sampleAppointments.length,
  };
}

/** Sample appointments land on the next Monday so the internal agenda always has something to show. */
function nextMonday(now: Date): string {
  const argentinaNow = new Date(now.getTime() - 3 * 3_600_000);
  const daysUntilMonday = (8 - argentinaNow.getUTCDay()) % 7 || 7;
  const monday = new Date(argentinaNow.getTime() + daysUntilMonday * 86_400_000);
  return monday.toISOString().slice(0, 10);
}
