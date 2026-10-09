import { InternalShell } from "@/src/modules/internal/internal-shell";
import { CapacityWarning } from "@/src/modules/internal/capacity-warning";
import type { CapacityConflict } from "@/src/modules/appointments/capacity-conflicts";
import { PaidDepositWarning } from "@/src/modules/internal/paid-deposit-warning";
import type { PaidUnconfirmedDeposit } from "@/src/modules/payments/prisma-repository";
import { Alert, PageHeading, type AlertTone } from "@/src/components/ui";
import type { InternalWorkshopSettingsRecord } from "@/src/modules/settings/maintenance";
import { agendaHref, type AgendaView } from "@/src/modules/appointments/agenda-navigation";
import { InternalAgendaWorkspace } from "@/src/modules/internal/internal-agenda-workspace";
import { intervalRejectionMessage, type InternalAgenda } from "@/src/modules/appointments/operations";
import type { ScheduleDateException } from "@/src/modules/settings/schemas";

export const internalFeedbackCodes = [
  "status-updated",
  "status-invalid",
  "appointment-not-found",
  "details-updated",
  "details-unchanged",
  "details-stale",
  "details-phone-in-use",
  "details-invalid",
  "appointment-rescheduled",
  "reschedule-invalid-input",
  "reschedule-terminal",
  "reschedule-invalid-duration",
  "reschedule-closed-date",
  "reschedule-outside-opening-hours",
  "reschedule-break-overlap",
  "reschedule-day-boundary-exceeded",
  "reschedule-capacity-exhausted",
  "forbidden",
] as const;

export type InternalFeedbackCode = (typeof internalFeedbackCodes)[number];

const feedbackMessages: Record<InternalFeedbackCode, { tone: AlertTone; message: string }> = {
  "status-updated": { tone: "success", message: "Actualizamos el estado del turno." },
  "status-invalid": {
    tone: "danger",
    message: "No se pudo cambiar el estado: el turno ya no admite ese cambio. Recargá la agenda para ver su estado actual.",
  },
  "appointment-not-found": { tone: "danger", message: "No encontramos el turno. Puede haber sido eliminado." },
  "details-updated": { tone: "success", message: "Actualizamos el contacto y las notas. Los cambios quedaron en el historial." },
  "details-unchanged": { tone: "success", message: "No había cambios para guardar." },
  "details-stale": { tone: "danger", message: "El contacto o el turno cambió mientras editabas. Abrí el detalle de nuevo y revisá los datos actuales." },
  "details-phone-in-use": { tone: "danger", message: "Ese teléfono ya pertenece a otro cliente. Revisá la ficha antes de cambiarlo." },
  "details-invalid": { tone: "danger", message: "Revisá nombre, teléfono, email y notas. No guardamos cambios." },
  "appointment-rescheduled": { tone: "success", message: "El turno fue reprogramado correctamente." },
  "reschedule-invalid-input": { tone: "danger", message: "Revisá la fecha, el horario y la duración elegidos." },
  "reschedule-terminal": { tone: "danger", message: "No se puede reprogramar un turno finalizado." },
  "reschedule-invalid-duration": { tone: "danger", message: intervalRejectionMessage("INVALID_DURATION") },
  "reschedule-closed-date": { tone: "danger", message: intervalRejectionMessage("CLOSED_DATE") },
  "reschedule-outside-opening-hours": { tone: "danger", message: intervalRejectionMessage("OUTSIDE_OPENING_HOURS") },
  "reschedule-break-overlap": { tone: "danger", message: intervalRejectionMessage("BREAK_OVERLAP") },
  "reschedule-day-boundary-exceeded": { tone: "danger", message: intervalRejectionMessage("DAY_BOUNDARY_EXCEEDED") },
  "reschedule-capacity-exhausted": { tone: "danger", message: intervalRejectionMessage("CAPACITY_EXHAUSTED") },
  forbidden: { tone: "danger", message: "Esa sección es solo para administradores del taller." },
};

export function InternalAgendaScreen({
  agenda,
  weekAgendas = [agenda],
  settings,
  capacityConflicts = [],
  paidUnconfirmedDeposits = [],
  exceptions = [],
  feedback,
  signedInUserName,
  today = agenda.date,
  view = "day",
  canManageWorkshop = true,
}: {
  agenda: InternalAgenda;
  weekAgendas?: InternalAgenda[];
  settings?: InternalWorkshopSettingsRecord;
  capacityConflicts?: CapacityConflict[];
  paidUnconfirmedDeposits?: PaidUnconfirmedDeposit[];
  exceptions?: ScheduleDateException[];
  feedback?: InternalFeedbackCode | null;
  signedInUserName?: string | null;
  today?: string;
  view?: AgendaView;
  /** Administrators only: shows the Configuración tab. */
  canManageWorkshop?: boolean;
}) {
  const feedbackAlert = feedback ? feedbackMessages[feedback] : null;

  return (
    <InternalShell
      active="agenda"
      canManageWorkshop={canManageWorkshop}
      hrefs={{ agenda: agendaHref({ date: agenda.date, view }) }}
      signedInUserName={signedInUserName}
    >
      <PageHeading eyebrow="Gestión del taller" title="Agenda" />

      {settings ? <CapacityWarning capacity={settings.capacity} conflicts={capacityConflicts} /> : null}
      <PaidDepositWarning deposits={paidUnconfirmedDeposits} />

      {feedbackAlert ? (
        <Alert className="mt-6" tone={feedbackAlert.tone}>
          {feedbackAlert.message}
        </Alert>
      ) : null}

      <InternalAgendaWorkspace
        agenda={agenda}
        capacity={settings?.capacity}
        exceptions={exceptions}
        slotStepMinutes={settings?.slotStepMinutes}
        today={today}
        view={view}
        weekAgendas={weekAgendas}
      />
    </InternalShell>
  );
}
