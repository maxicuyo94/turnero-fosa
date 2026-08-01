import { db } from "@/src/lib/db";
import { PrismaBookingRepository } from "@/src/modules/booking/prisma-repository";
import { PublicAppointmentStatusScreen } from "@/src/modules/booking/public-appointment-status-screen";
import { getPublicAppointmentStatus } from "@/src/modules/booking/service";

type AppointmentStatusPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AppointmentStatusPage({ searchParams }: AppointmentStatusPageProps) {
  const params = (await searchParams) ?? {};
  const codeParam = params.code;
  const code = (Array.isArray(codeParam) ? codeParam[0] : codeParam) ?? "";
  const result = code ? await getPublicAppointmentStatus(new PrismaBookingRepository(db), { code }) : undefined;

  return <PublicAppointmentStatusScreen code={code} result={result} />;
}
