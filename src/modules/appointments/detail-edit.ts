import { Prisma, type AppointmentDetailField, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { normalizePhone } from "@/src/modules/customers/identity";

export const appointmentDetailEditSchema = z.object({
  appointmentId: z.string().trim().min(1),
  expectedCustomerUpdatedAt: z.iso.datetime(),
  expectedAppointmentUpdatedAt: z.iso.datetime(),
  expectedCustomerDetailVersion: z.coerce.number().int().nonnegative(),
  expectedAppointmentDetailVersion: z.coerce.number().int().nonnegative(),
  fullName: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(6).max(40),
  email: z.string().trim().max(254).email().or(z.literal("")),
  notes: z.string().trim().max(2_000),
  changedById: z.string().trim().min(1),
});

export type AppointmentDetailEditResult =
  | { status: "UPDATED" | "UNCHANGED" }
  | { status: "NOT_FOUND" | "STALE" | "PHONE_IN_USE" | "INVALID_PHONE" };

/** Contact edits affect the customer across all appointments; notes belong to this appointment. */
export async function updateAppointmentDetails(
  prisma: PrismaClient,
  input: z.input<typeof appointmentDetailEditSchema>,
): Promise<AppointmentDetailEditResult> {
  const parsed = appointmentDetailEditSchema.parse(input);
  const phoneNormalized = normalizePhone(parsed.phone);
  if (!phoneNormalized || phoneNormalized.length < 6 || phoneNormalized.length > 20) return { status: "INVALID_PHONE" };

  return prisma.$transaction(async (tx) => {
    const reference = await tx.appointment.findUnique({ where: { id: parsed.appointmentId }, select: { customerId: true } });
    if (!reference) return { status: "NOT_FOUND" };

    // All detail edits lock the same customer before their appointment. Reading again after the
    // locks prevents two open staff screens from silently overwriting one another.
    await tx.$queryRaw`SELECT id FROM "Customer" WHERE id = ${reference.customerId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "Appointment" WHERE id = ${parsed.appointmentId} FOR UPDATE`;
    const appointment = await tx.appointment.findUnique({
      where: { id: parsed.appointmentId },
      include: { customer: true },
    });
    if (!appointment) return { status: "NOT_FOUND" };
    if (
      appointment.customer.updatedAt.toISOString() !== parsed.expectedCustomerUpdatedAt ||
      appointment.updatedAt.toISOString() !== parsed.expectedAppointmentUpdatedAt ||
      appointment.customer.detailVersion !== parsed.expectedCustomerDetailVersion ||
      appointment.detailVersion !== parsed.expectedAppointmentDetailVersion
    ) return { status: "STALE" };

    if (parsed.phone !== appointment.customer.phone && phoneNormalized !== appointment.customer.phoneNormalized) {
      // Serialize two staff edits that try to assign the same number to different customers.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('customer_phone'), hashtext(${phoneNormalized}))`;
      const holder = await tx.customer.findFirst({
        where: { phoneNormalized, id: { not: appointment.customerId } },
        select: { id: true },
      });
      if (holder) return { status: "PHONE_IN_USE" };
    }

    const nextEmail = parsed.email || null;
    const nextNotes = parsed.notes || null;
    const changes: Prisma.AppointmentDetailChangeCreateManyInput[] = [];
    const addChange = (field: AppointmentDetailField, previousValue: string | null, newValue: string | null) => {
      if (previousValue !== newValue) {
        changes.push({
          customerId: appointment.customerId,
          appointmentId: appointment.id,
          changedById: parsed.changedById,
          field,
          previousValue,
          newValue,
        });
      }
    };
    addChange("CUSTOMER_NAME", appointment.customer.fullName, parsed.fullName);
    addChange("CUSTOMER_PHONE", appointment.customer.phone, parsed.phone);
    addChange("CUSTOMER_EMAIL", appointment.customer.email, nextEmail);
    addChange("APPOINTMENT_NOTES", appointment.notes, nextNotes);
    if (changes.length === 0) return { status: "UNCHANGED" };

    if (changes.some((change) => change.field !== "APPOINTMENT_NOTES")) {
      await tx.customer.update({
        where: { id: appointment.customerId },
        data: { fullName: parsed.fullName, phone: parsed.phone, phoneNormalized, email: nextEmail, detailVersion: { increment: 1 } },
      });
    }
    if (appointment.notes !== nextNotes) {
      await tx.appointment.update({ where: { id: appointment.id }, data: { notes: nextNotes, detailVersion: { increment: 1 } } });
    }
    await tx.appointmentDetailChange.createMany({ data: changes });
    return { status: "UPDATED" };
  });
}
