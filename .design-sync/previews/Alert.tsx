import type { ReactNode } from "react";
import { Alert, CodeDisplay } from "turnero-fosa";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="rounded-2xl bg-charcoal-950 p-5">{children}</div>
);

export const BookingConfirmed = () => (
  <Surface>
    <Alert tone="success">
      <p>Tu turno quedo registrado. Te esperamos en el taller.</p>
      <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-apple-300/30 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between">
        <CodeDisplay code="ABCD234567" label="Codigo del turno" />
        <a className="font-black text-apple-200 underline underline-offset-4" href="/booking/status">
          Consultar estado
        </a>
      </div>
      <p className="mt-3 text-sm text-apple-100/80">
        La reprogramacion online no esta disponible por ahora.
      </p>
    </Alert>
  </Surface>
);

export const NotFound = () => (
  <Surface>
    <Alert tone="danger">No encontramos un turno con ese codigo.</Alert>
  </Surface>
);

export const BadCredentials = () => (
  <Surface>
    <Alert tone="danger">Email o contraseña incorrectos.</Alert>
  </Surface>
);

export const Info = () => (
  <Surface>
    <Alert tone="info">
      Los cupos quedan sujetos a la politica actual del taller.
    </Alert>
  </Surface>
);
