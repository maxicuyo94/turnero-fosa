import { cancelAppointmentAction } from "@/app/(public)/booking/actions";
import { bookingRepository, bookingSupport, workshopContactSettings } from "@/src/lib/composition";
import { getPublicCancellationPreview } from "@/src/modules/booking/service";
import { CancellationScreen } from "@/src/modules/booking/cancellation-screen";

export default async function CancellationPage({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const appointmentId = stringParam(params.appointmentId) ?? "";
  const token = stringParam(params.token) ?? "";
  const preview = await getPublicCancellationPreview(bookingRepository(), { appointmentId, token, now: new Date() });
  const [settings, payment] = await Promise.all([
    workshopContactSettings(),
    preview ? bookingSupport.getCancellationPaymentSummary(preview.appointment.id) : null,
  ]);
  return <CancellationScreen preview={preview} token={token} payment={payment} refundPolicy={settings.depositRefundPolicy} result={stringParam(params.result)} action={cancelAppointmentAction} />;
}

function stringParam(value: string | string[] | undefined): string | undefined { return Array.isArray(value) ? value[0] : value; }
