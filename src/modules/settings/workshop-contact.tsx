import { db } from "@/src/lib/db";
import { businessSettingsSchema } from "@/src/modules/settings/business-settings";

export async function WorkshopContact() {
  const stored = await db.workshopSettings.findFirst({ orderBy: { createdAt: "asc" } });
  const settings = businessSettingsSchema.parse(stored ?? {});
  if (!settings.publicPhone && !settings.whatsappNumber && !settings.publicAppUrl && !settings.depositRefundPolicy) return null;
  return <footer className="mx-auto w-full max-w-6xl px-5 py-8 text-sm text-zinc-300">
    <h2 className="mb-3 text-lg font-bold text-white">Contacto del taller</h2>
    <div className="flex flex-wrap gap-5">
      {settings.publicPhone ? <a className="underline" href={`tel:${settings.publicPhone.replace(/[^+\d]/gu, "")}`}>{settings.publicPhone}</a> : null}
      {settings.whatsappNumber ? <a className="underline" href={`https://wa.me/${settings.whatsappNumber.replace(/\D/gu, "")}`}>Consultar por WhatsApp</a> : null}
      {settings.publicAppUrl ? <a className="underline" href={settings.publicAppUrl}>Sitio del taller</a> : null}
    </div>
    {settings.depositRefundPolicy ? <div className="mt-5 max-w-2xl">
      <h3 className="font-bold text-white">Política de devolución de señas</h3>
      <p className="mt-2 whitespace-pre-wrap break-words">{settings.depositRefundPolicy}</p>
    </div> : null}
  </footer>;
}
