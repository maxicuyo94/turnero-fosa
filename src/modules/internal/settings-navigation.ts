import type { AlertTone } from "@/src/components/ui";

/** Configuración is split in pages; actions and screens share these paths and feedback codes. */
export type SettingsPage = "general" | "booking" | "catalog" | "schedule";

export const settingsPaths: Record<SettingsPage, string> = {
  general: "/internal/settings",
  booking: "/internal/settings/booking",
  catalog: "/internal/settings/catalog",
  schedule: "/internal/settings/schedule",
};

export const settingsPageLabels: Record<SettingsPage, string> = {
  general: "General",
  booking: "Reservas y señas",
  catalog: "Catálogo",
  schedule: "Horarios",
};

export const settingsFeedbackCodes = [
  "settings-updated",
  "contact-invalid",
  "booking-invalid",
  "service-updated",
  "service-invalid",
  "vehicle-type-created",
  "vehicle-type-updated",
  "vehicle-type-invalid",
  "schedule-updated",
  "schedule-invalid",
  "exception-saved",
  "exception-deleted",
  "exception-invalid",
  "holidays-imported",
  "holidays-unavailable",
  "holidays-invalid",
] as const;

export type SettingsFeedbackCode = (typeof settingsFeedbackCodes)[number];

export const settingsFeedbackMessages: Record<SettingsFeedbackCode, { tone: AlertTone; message: string }> = {
  "settings-updated": { tone: "success", message: "Guardamos la configuración del taller." },
  "contact-invalid": {
    tone: "danger",
    message: "Revisá los datos: teléfono y WhatsApp válidos, dominio HTTPS sin rutas y remitente de email.",
  },
  "booking-invalid": {
    tone: "danger",
    message: "Revisá los datos: fecha de activación existente y valores numéricos dentro del rango.",
  },
  "service-updated": { tone: "success", message: "Guardamos la duración para los nuevos turnos. Los turnos existentes conservan su horario." },
  "service-invalid": { tone: "danger", message: "La duración debe ser de 1 a 1440 minutos y múltiplo del paso de la agenda." },
  "vehicle-type-created": { tone: "success", message: "Agregamos el tipo de vehículo." },
  "vehicle-type-updated": { tone: "success", message: "Actualizamos la visibilidad del tipo de vehículo." },
  "vehicle-type-invalid": {
    tone: "danger",
    message: "No se pudo guardar el tipo de vehículo: el nombre es obligatorio, de hasta 40 caracteres y sin repetir, y debe quedar al menos un tipo activo.",
  },
  "schedule-updated": { tone: "success", message: "Actualizamos el horario semanal del taller." },
  "schedule-invalid": {
    tone: "danger",
    message: "Revisá los horarios: cada día abierto debe cerrar más tarde y los descansos deben quedar dentro del horario.",
  },
  "exception-saved": { tone: "success", message: "Guardamos la fecha especial." },
  "exception-deleted": { tone: "success", message: "Quitamos la fecha especial. Vuelve a regir el horario semanal." },
  "exception-invalid": {
    tone: "danger",
    message: "Revisá la fecha: una apertura excepcional necesita horario de apertura y cierre válidos.",
  },
  "holidays-imported": { tone: "success", message: "Importamos los feriados nacionales sin tocar tus ajustes manuales." },
  "holidays-unavailable": {
    tone: "danger",
    message: "No pudimos consultar los feriados. Las fechas guardadas siguen vigentes.",
  },
  "holidays-invalid": {
    tone: "danger",
    message: "La respuesta de feriados no tiene el formato esperado. No se modificó ninguna fecha.",
  },
};

export function parseSettingsFeedback(value: string | undefined): SettingsFeedbackCode | null {
  return settingsFeedbackCodes.find((code) => code === value) ?? null;
}
