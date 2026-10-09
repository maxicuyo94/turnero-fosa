import { retryDepositAction } from "@/app/(public)/booking/actions";
import { PaymentReturnScreen } from "@/src/modules/booking/payment-return-screen";
import { depositPaymentRepository, reconcileReturnedDeposit } from "@/src/lib/composition";

export default async function PaymentReturnPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const reference = first(params.reference) ?? first(params.external_reference) ?? "";
  await reconcileOnReturn(first(params.payment_id) ?? first(params.collection_id), reference);
  const attempt = reference
    ? await depositPaymentRepository().getPublicAttempt(reference)
    : null;

  return <PaymentReturnScreen attempt={attempt} retryAction={retryDepositAction} />;
}

/**
 * Webhooks stay the primary signal, but test credentials never send them and a real one can be
 * delayed. Asking Mercado Pago here lets the customer see the settled state right away. Failures
 * only mean the page shows the stored state; the webhook or the expiry sweep settles it later.
 */
async function reconcileOnReturn(paymentId: string | undefined, reference: string): Promise<void> {
  try {
    await reconcileReturnedDeposit({ paymentId: paymentId && paymentId !== "null" ? paymentId : undefined, reference });
  } catch (error) {
    console.error("payment return reconciliation failed", error);
  }
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
