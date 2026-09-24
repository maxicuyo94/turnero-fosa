"use client";

import { useLinkStatus } from "next/link";
import { useFormStatus } from "react-dom";
import { Button, Spinner, Toggle, type ButtonProps, type ToggleProps } from "@/src/components/ui";

// Wrappers that read the pending state of the enclosing form or link, so a screen gets a spinner
// without becoming a client component. The design system stays presentational: it only takes `pending`.

/** Submit button that shows a spinner while its form waits on the server. */
export function SubmitButton({ children, pendingLabel, ...props }: Omit<ButtonProps, "type" | "pending"> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button {...props} pending={pending} type="submit">
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}

/** Switch that submits its form and spins until the server answers. */
export function SubmitToggle(props: Omit<ToggleProps, "type" | "pending">) {
  const { pending } = useFormStatus();
  return <Toggle {...props} pending={pending} type="submit" />;
}

/** Place inside a `Link`: spins while the navigation it started is loading. */
export function LinkPendingSpinner({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  return pending ? <Spinner className={className} label="Cargando" /> : null;
}
