import type { ReactNode } from "react";
import { CodeDisplay } from "turnero-fosa";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="rounded-2xl bg-charcoal-950 p-5">{children}</div>
);

export const BookingCode = () => (
  <Surface>
    <CodeDisplay code="ABCD234567" label="Codigo del turno" />
  </Surface>
);

export const OnHighlightPanel = () => (
  <Surface>
    <div className="rounded-2xl border border-apple-300/30 bg-black/20 p-4">
      <CodeDisplay code="XKR7Q19004" label="Codigo" />
    </div>
  </Surface>
);
