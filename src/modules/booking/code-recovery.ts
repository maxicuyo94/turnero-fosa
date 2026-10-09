import { z } from "zod";
import { formatWorkshopDateTime } from "@/src/lib/workshop-date";
import type { EmailNotificationDraft } from "@/src/modules/notifications/service";

export const recoveryResponse = "Si ese email tiene turnos próximos, recibirás un mensaje con sus códigos. Revisá también la carpeta de spam.";
export const recoveryEmailSchema = z.string().trim().toLowerCase().email().max(254);

export type CodeRecoveryRepository = {
  queueCodesForEmail(email: string, now: Date, draft: (appointments: Array<{ publicCode: string; serviceName: string; startAt: Date }>) => EmailNotificationDraft): Promise<boolean>;
};

export async function recoverPublicCodes(repository: CodeRecoveryRepository, input: { email: string; now: Date; publicOrigin?: string }): Promise<boolean> {
  const email = recoveryEmailSchema.parse(input.email);
  return repository.queueCodesForEmail(email, input.now, (appointments) => ({
    event: "PUBLIC_CODE_RECOVERY",
    recipient: email,
    subject: "Los códigos de tus turnos",
    text: ["Estos son tus próximos turnos:", ...appointments.map((appointment) => {
      const url = input.publicOrigin ? new URL("/booking/status", input.publicOrigin) : null;
      url?.searchParams.set("code", appointment.publicCode);
      return `${appointment.serviceName} · ${formatWorkshopDateTime(appointment.startAt, { dateStyle: "long", timeStyle: "short" })}\nCódigo: ${appointment.publicCode}${url ? `\nConsultar: ${url}` : ""}`;
    }), "Si no pediste este mensaje, podés ignorarlo. Tus turnos no fueron modificados."].join("\n\n"),
  }));
}
