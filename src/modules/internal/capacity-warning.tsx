import Link from "next/link";
import { Alert } from "@/src/components/ui";
import { workshopDate } from "@/src/lib/workshop-date";
import type { CapacityConflict } from "@/src/modules/internal/capacity-conflicts";

const formatDate = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

export function CapacityWarning({ capacity, conflicts }: { capacity: number; conflicts: CapacityConflict[] }) {
  if (!conflicts.length) return null;
  return <Alert className="mt-6" tone="danger">
    <h2 className="font-bold">Capacidad superada</h2>
    <p className="mt-2">La capacidad actual es de {capacity} {capacity === 1 ? "moto" : "motos"} a la vez. Hay turnos que superan ese límite.</p>
    <p className="mt-1">Los turnos se mantienen. Reprogramá los afectados o aumentá la capacidad. Este aviso seguirá visible mientras haya conflictos.</p>
    <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto">
      {conflicts.map((conflict) => <li key={conflict.startAt.toISOString()}>
        <Link className="underline" href={`/internal?date=${workshopDate(conflict.startAt)}`}>
          {formatDate.format(conflict.startAt)} – {formatDate.format(conflict.endAt)} · hasta {conflict.peak} turnos simultáneos
        </Link>
      </li>)}
    </ul>
  </Alert>;
}
