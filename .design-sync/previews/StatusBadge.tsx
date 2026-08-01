import type { ReactNode } from "react";
import { CodeDisplay, StatusBadge } from "turnero-fosa";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="rounded-2xl bg-charcoal-950 p-5">{children}</div>
);

export const AllStates = () => (
  <Surface>
    <div className="flex flex-wrap gap-3">
      <StatusBadge status="PENDING_CONFIRMATION" />
      <StatusBadge status="CONFIRMED" />
      <StatusBadge status="IN_PROGRESS" />
      <StatusBadge status="COMPLETED" />
      <StatusBadge status="CANCELLED" />
      <StatusBadge status="NO_SHOW" />
    </div>
  </Surface>
);

export const Settled = () => (
  <Surface>
    <div className="flex flex-wrap gap-3">
      <StatusBadge status="CONFIRMED" />
      <StatusBadge status="COMPLETED" />
    </div>
  </Surface>
);

export const Lost = () => (
  <Surface>
    <div className="flex flex-wrap gap-3">
      <StatusBadge status="CANCELLED" />
      <StatusBadge status="NO_SHOW" />
    </div>
  </Surface>
);

export const InSummaryHeader = () => (
  <Surface>
    <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
      <CodeDisplay code="ABCD234567" label="Codigo" />
      <StatusBadge status="CONFIRMED" />
    </div>
  </Surface>
);
