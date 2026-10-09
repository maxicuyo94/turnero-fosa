import { cloneElement, isValidElement, type ReactNode, type ReactElement, type AriaAttributes } from "react";
import { cn } from "./cn";

type FieldBaseProps = {
  label: ReactNode;
  /** Muted parenthetical next to the label, e.g. the accepted range. */
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
};

/** A stable control id is required when attaching help or error messages. */
export type FieldProps = FieldBaseProps & (
  | { htmlFor?: string; description?: never; error?: never }
  | { htmlFor: string; description?: ReactNode; error?: ReactNode }
);

/**
 * Label-above-control wrapper for every form input. Renders a `<label>`, so the
 * control it wraps is associated without needing an id.
 */
export function Field({ label, hint, htmlFor, description, error, className, children }: FieldProps) {
  const control = isValidElement(children) ? children as ReactElement<AriaAttributes & { id?: string }> : null;
  const controlId = htmlFor ?? control?.props.id;
  const descriptionId = controlId && description ? `${controlId}-description` : undefined;
  const errorId = controlId && error ? `${controlId}-error` : undefined;
  const describedBy = [control?.props["aria-describedby"], descriptionId, errorId].filter(Boolean).join(" ") || undefined;
  const content = control && controlId ? cloneElement(control, {
    id: controlId,
    "aria-describedby": describedBy,
    "aria-invalid": error ? true : control.props["aria-invalid"],
  }) : children;
  return (
    <div className={cn("grid gap-2 text-sm text-text-secondary", className)}>
      <label className="grid gap-2" htmlFor={controlId}>
        <span>{label}{hint ? <span className="ml-1 text-text-muted"> {hint}</span> : null}</span>
        {content}
      </label>
      {description ? <p id={descriptionId} className="text-sm leading-5 text-text-muted">{description}</p> : null}
      {error ? <p id={errorId} className="text-sm leading-5 text-danger">{error}</p> : null}
    </div>
  );
}
