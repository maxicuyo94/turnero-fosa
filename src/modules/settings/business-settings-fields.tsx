import { Field, TextInput, Textarea } from "@/src/components/ui";
import type { BusinessSettings } from "@/src/modules/settings/business-settings";

export function ContactSettingsFields({ settings }: { settings: Partial<BusinessSettings> }) {
  return <fieldset className="grid gap-4">
    <legend className="mb-4 text-lg font-bold text-white">Contacto y comunicaciones</legend>
    <Field label="Teléfono público"><TextInput name="publicPhone" type="tel" maxLength={30} defaultValue={settings.publicPhone ?? ""} /></Field>
    <Field label="WhatsApp" hint="Código de país y número, sin espacios. Ej.: +5492615551234">
      <TextInput name="whatsappNumber" type="tel" maxLength={16} defaultValue={settings.whatsappNumber ?? ""} />
    </Field>
    <Field label="Dominio público" hint="Ej.: https://mitaller.com">
      <TextInput name="publicAppUrl" type="url" maxLength={250} defaultValue={settings.publicAppUrl ?? ""} />
    </Field>
    <Field label="Remitente de email" hint="Ej.: turnos@mitaller.com">
      <TextInput name="emailFrom" type="email" maxLength={254} defaultValue={settings.emailFrom ?? ""} />
    </Field>
    <p className="text-sm text-zinc-400">Usá un dominio conectado al sitio y un remitente verificado para enviar correos. Si los dejás vacíos, se mantienen los valores de la instalación.</p>
  </fieldset>;
}

export function DepositSettingsFields({ settings }: { settings: Partial<BusinessSettings> }) {
  return <>
    <Field label="Fecha de activación de señas" hint="Desde las 00:00 de Argentina">
      <TextInput name="depositActivationDate" type="date" defaultValue={settings.depositActivationDate ?? ""} />
    </Field>
    <p className="text-sm text-zinc-400">Requiere activar “Cobrar seña con Mercado Pago”. Sin fecha, el cobro comienza al habilitarlo. Mercado Pago debe estar conectado.</p>
    <Field label="Política de devolución" hint="Visible para clientes">
      <Textarea name="depositRefundPolicy" maxLength={2000} rows={4} defaultValue={settings.depositRefundPolicy ?? ""} />
    </Field>
    <p className="text-sm text-zinc-400">Describí cómo solicitar una devolución y sus condiciones. Las devoluciones se gestionan manualmente.</p>
  </>;
}
