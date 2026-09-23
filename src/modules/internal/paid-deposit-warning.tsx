import Link from "next/link";
import { Alert } from "@/src/components/ui";
import { WORKSHOP_LOCALE, WORKSHOP_TIME_ZONE, workshopDate } from "@/src/lib/workshop-date";
import type { PaidUnconfirmedDeposit } from "@/src/modules/payments/prisma-repository";

const formatDate = new Intl.DateTimeFormat(WORKSHOP_LOCALE, {
  timeZone: WORKSHOP_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const formatArs = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

/** Stays visible until each deposit is refunded (the refund webhook clears it) or the turn is rebooked. */
export function PaidDepositWarning({ deposits }: { deposits: PaidUnconfirmedDeposit[] }) {
  if (!deposits.length) return null;
  return <Alert className="mt-6" tone="danger">
    <h2 className="font-bold">Señas cobradas en turnos cancelados</h2>
    <p className="mt-2">Mercado Pago acreditó estas señas, pero el turno está cancelado. Contactá al cliente para reprogramar o devolver el dinero.</p>
    <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto">
      {deposits.map((deposit) => <li key={deposit.attemptId}>
        <Link className="underline" href={`/internal?date=${workshopDate(deposit.startAt)}`}>
          Turno {deposit.publicCode} · {formatDate.format(deposit.startAt)}
        </Link>
        {" "}· {deposit.customerName} ({deposit.customerPhone}) · {formatArs.format(deposit.amountCents / 100)}
      </li>)}
    </ul>
  </Alert>;
}
