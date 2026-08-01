import { randomUUID } from "node:crypto";
import { createAppointmentAction } from "@/app/(public)/booking/actions";
import { auth, getInternalSessionDisplayName } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import { PublicBookingScreen } from "@/src/modules/booking/public-booking-screen";
import { PrismaBookingRepository } from "@/src/modules/booking/prisma-repository";
import { getPublicAvailability, listPublicServices } from "@/src/modules/booking/service";

type BookingPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BookingPage({ searchParams }: BookingPageProps) {
  const params = (await searchParams) ?? {};
  const session = await auth();
  const repository = new PrismaBookingRepository(db);
  const services = await listPublicServices(repository);
  const selectedServiceId = stringParam(params.serviceId) ?? services[0]?.id ?? "";
  const selectedService = services.find((service) => service.id === selectedServiceId);
  const selectedDate = stringParam(params.date) ?? defaultBookingDate();
  const requestedDurationMinutes = numberParam(params.durationMinutes);
  const availability = selectedServiceId
    ? await getPublicAvailability(repository, {
        serviceId: selectedServiceId,
        date: selectedDate,
        durationMinutes: requestedDurationMinutes,
        now: new Date(),
      })
    : { accepted: true as const, slots: [], durationMinutes: 0, slotStepMinutes: 1 };

  const selectedDurationMinutes = availability.accepted
    ? availability.durationMinutes
    : requestedDurationMinutes ?? selectedService?.durationMinutes ?? 0;
  const durationStepMinutes = availability.accepted ? availability.slotStepMinutes : availability.slotStepMinutes ?? 1;

  return <PublicBookingScreen
    action={createAppointmentAction}
    idempotencyKey={randomUUID()}
    outcome={outcomeFromParams(params)}
    selectedDate={selectedDate}
    selectedDurationMinutes={selectedDurationMinutes}
    durationStepMinutes={durationStepMinutes}
    selectedServiceId={selectedServiceId}
    signedInUserName={getInternalSessionDisplayName(session)}
    services={services}
    slots={availability.accepted ? availability.slots : []}
  />;
}

function defaultBookingDate(): string {
  const date = new Date(Date.now() + 3 * 86_400_000);
  return date.toISOString().slice(0, 10);
}

function stringParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function numberParam(value: string | string[] | undefined): number | undefined {
  const parsed = Number(stringParam(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function outcomeFromParams(params: Record<string, string | string[] | undefined>) {
  const message = stringParam(params.message);
  if (!message) return undefined;
  return {
    accepted: stringParam(params.booked) === "1",
    message,
    cancellationUrl: stringParam(params.cancel),
    publicCode: stringParam(params.code),
  };
}
