import { bookingRepository } from "@/src/lib/composition";
import { guardPublicAccess } from "@/src/lib/public-access";
import { PublicAppointmentStatusScreen } from "@/src/modules/booking/public-appointment-status-screen";
import { getPublicAppointmentStatus } from "@/src/modules/booking/service";
import { recoverCodesAction } from "@/app/(public)/booking/actions";

type AppointmentStatusPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AppointmentStatusPage({ searchParams }: AppointmentStatusPageProps) {
  const params = (await searchParams) ?? {};
  const codeParam = params.code;
  const code = (Array.isArray(codeParam) ? codeParam[0] : codeParam) ?? "";
  if (code) await guardPublicAccess();
  const result = code ? await getPublicAppointmentStatus(bookingRepository(), { code }) : undefined;

  return <PublicAppointmentStatusScreen code={code} result={result} recoveryAction={recoverCodesAction} />;
}
