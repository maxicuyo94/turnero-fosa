import { cn } from "./cn";

export type SlotOptionProps = {
  /** Wall-clock start of the slot, already formatted, e.g. `09:30`. */
  startTime: string;
  /** Remaining simultaneous capacity for this slot. */
  remainingCapacity: number;
  /** Radio group name — every slot in one picker shares it. */
  name?: string;
  defaultChecked?: boolean;
  required?: boolean;
  disabled?: boolean;
  className?: string;
};

/**
 * One selectable time slot in the booking picker. Renders a full-width label
 * wrapping a radio input, so the whole row is the hit target.
 */
export function SlotOption({
  startTime,
  remainingCapacity,
  name = "startTime",
  defaultChecked,
  required,
  disabled,
  className,
}: SlotOptionProps) {
  return (
    <label
      className={cn(
        "group flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/20 bg-charcoal-950 px-4 py-3 text-zinc-100 transition hover:border-apple-300/60 hover:bg-apple-400/10 has-[:checked]:border-apple-300 has-[:checked]:bg-apple-400/15 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-apple-300",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <span>
        <input
          className="mr-3 accent-apple-400"
          defaultChecked={defaultChecked}
          disabled={disabled}
          name={name}
          required={required}
          type="radio"
          value={startTime}
        />
        <span className="font-black text-white">{startTime}</span>
      </span>
      <span className="text-right text-xs font-semibold text-apple-300">
        <span className="block uppercase tracking-[0.14em]">{remainingCapacity} {remainingCapacity === 1 ? "cupo" : "cupos"}</span>
        <span aria-hidden="true" className="hidden group-has-[:checked]:block">Seleccionado</span>
      </span>
    </label>
  );
}
