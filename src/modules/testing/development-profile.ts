import type { PrismaClient } from "@prisma/client";
import type { AppointmentStatus } from "@/src/modules/appointments/schemas";
import { seedAdminUser, seedWorkshopConfiguration } from "@/src/modules/settings/seed";

export type TestDataSummary = {
  profile: "development";
  workshopSettingsId: string;
  adminConfigured: boolean;
  customers: number;
  motorcycles: number;
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
    motorcycle: { id: `${testDataPrefix}motorcycle-ada`, brand: "Honda", model: "XR150", licensePlate: "TDA001", year: 2022 },
  },
  {
    id: `${testDataPrefix}customer-grace`,
    fullName: "Grace Hopper",
    phone: "+5491111110002",
    email: "grace@example.test",
    motorcycle: { id: `${testDataPrefix}motorcycle-grace`, brand: "Yamaha", model: "FZ25", licensePlate: "TDA002", year: 2023 },
  },
  {
    id: `${testDataPrefix}customer-alan`,
    fullName: "Alan Turing",
    phone: "+5491111110003",
    email: null,
    motorcycle: { id: `${testDataPrefix}motorcycle-alan`, brand: "Bajaj", model: "Rouser 200", licensePlate: "TDA003", year: 2021 },
  },
] as const;

const sampleAppointments: {
  idempotencyKey: string;
  customerId: string;
  motorcycleId: string;
  serviceDisplayOrder: number;
  startTime: string;
  status: AppointmentStatus;
  notes: string;
}[] = [
  {
    idempotencyKey: `${testDataPrefix}appointment-pending`,
    customerId: sampleCustomers[0].id,
    motorcycleId: sampleCustomers[0].motorcycle.id,
    serviceDisplayOrder: 1,
    startTime: "09:00",
    status: "PENDING_CONFIRMATION",
    notes: "Dato de prueba: turno pendiente de confirmacion.",
  },
  {
    idempotencyKey: `${testDataPrefix}appointment-confirmed`,
    customerId: sampleCustomers[1].id,
    motorcycleId: sampleCustomers[1].motorcycle.id,
    serviceDisplayOrder: 3,
    startTime: "10:00",
    status: "CONFIRMED",
    notes: "Dato de prueba: turno confirmado.",
  },
  {
    idempotencyKey: `${testDataPrefix}appointment-completed`,
    customerId: sampleCustomers[2].id,
    motorcycleId: sampleCustomers[2].motorcycle.id,
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

  for (const customer of sampleCustomers) {
    const customerData = { fullName: customer.fullName, phone: customer.phone, email: customer.email };
    await prisma.customer.upsert({
      where: { id: customer.id },
      update: customerData,
      create: { id: customer.id, ...customerData },
    });

    const motorcycleData = {
      customerId: customer.id,
      brand: customer.motorcycle.brand,
      model: customer.motorcycle.model,
      licensePlate: customer.motorcycle.licensePlate,
      year: customer.motorcycle.year,
    };
    await prisma.motorcycle.upsert({
      where: { id: customer.motorcycle.id },
      update: motorcycleData,
      create: { id: customer.motorcycle.id, ...motorcycleData },
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
      motorcycleId: appointment.motorcycleId,
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
    motorcycles: sampleCustomers.length,
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
