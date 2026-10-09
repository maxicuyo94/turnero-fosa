import Link from "next/link";
import { Alert, Button, Card, Disclosure, Field, PageHeading, Select, StatusBadge, TabNav, Textarea, TextInput } from "@/src/components/ui";
import { InternalShell } from "@/src/modules/internal/internal-shell";

const palette = [
  { name: "Fondo", className: "bg-surface-page" },
  { name: "Panel", className: "bg-surface-panel" },
  { name: "Control", className: "bg-surface-control" },
  { name: "Acción", className: "bg-action" },
  { name: "Foco", className: "bg-focus" },
  { name: "Error", className: "bg-danger" },
];

export function DesignSystemScreen({ signedInUserName }: { signedInUserName: string }) {
  return (
    <InternalShell active="settings" signedInUserName={signedInUserName} canManageWorkshop>
      <PageHeading
        eyebrow="Referencia visual"
        title="Sistema de diseño"
        description="Colores, componentes y estados compartidos del taller. Los ejemplos de esta vista no guardan datos ni cambian reservas."
        action={<Link className="inline-flex min-h-control items-center font-semibold text-apple-300 underline" href="/internal/settings">Volver a configuración</Link>}
      />
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-xl font-bold text-text-primary">Acciones</h2>
          <p className="mt-2 text-sm leading-6 text-text-muted">El verde destaca la acción principal. Las alternativas tienen menos énfasis y las cancelaciones se distinguen en rojo.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button>Guardar cambios</Button>
            <Button variant="secondary">Ver detalle</Button>
            <Button variant="ghost">Volver</Button>
            <Button variant="danger">Cancelar turno</Button>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button pending>Guardando</Button>
            <Button disabled>Sin disponibilidad</Button>
          </div>
        </Card>
        <Card>
          <h2 className="text-xl font-bold text-text-primary">Colores por función</h2>
          <p className="mt-2 text-sm leading-6 text-text-muted">La misma función mantiene el mismo tratamiento en todas las pantallas.</p>
          <div className="mt-5 grid grid-cols-3 gap-4">
            {palette.map((color) => <div key={color.name}>
              <div aria-hidden="true" className={`h-12 rounded-control border border-border-control ${color.className}`} />
              <p className="mt-2 text-sm text-text-secondary">{color.name}</p>
            </div>)}
          </div>
        </Card>
        <Card>
          <h2 className="text-xl font-bold text-text-primary">Campos y validación</h2>
          <div className="mt-5 grid gap-5">
            <Field label="Nombre y apellido" htmlFor="example-name" description="Escribí el nombre de la persona que trae el vehículo.">
              <TextInput autoComplete="off" placeholder="Ej.: Ana Pérez" />
            </Field>
            <Field label="Email" htmlFor="example-email" hint="opcional" error="Ingresá un email válido, por ejemplo nombre@correo.com.">
              <TextInput autoComplete="off" defaultValue="correo@" type="email" />
            </Field>
            <Field label="Servicio"><Select defaultValue="esencial"><option value="esencial">Service Esencial</option><option value="completo">Service Completo</option></Select></Field>
            <Field label="Código del turno" hint="solo lectura"><TextInput defaultValue="ABCD234567" readOnly mono /></Field>
            <Field label="Comentarios" hint="opcional"><Textarea placeholder="Contanos qué necesitás revisar." /></Field>
          </div>
        </Card>
        <div className="grid content-start gap-6">
          <Card>
            <h2 className="text-xl font-bold text-text-primary">Navegación</h2>
            <p className="mt-2 text-sm leading-6 text-text-muted">La línea inferior identifica la sección actual. Los enlaces abren cada sección de configuración.</p>
            <TabNav className="mt-4" label="Ejemplo de navegación" linkComponent={Link} items={[
              { label: "General", href: "/internal/settings", active: true },
              { label: "Reservas y señas", href: "/internal/settings/booking", active: false },
              { label: "Catálogo", href: "/internal/settings/catalog", active: false },
              { label: "Horarios", href: "/internal/settings/schedule", active: false },
            ]} />
          </Card>
          <Card>
            <h2 className="text-xl font-bold text-text-primary">Estados y mensajes</h2>
            <div className="mt-5 flex flex-wrap gap-2">
              <StatusBadge status="PENDING_CONFIRMATION" />
              <StatusBadge status="CONFIRMED" />
              <StatusBadge status="CANCELLED" />
            </div>
            <div className="mt-5 grid gap-3">
              <Alert tone="success">Los cambios fueron guardados.</Alert>
              <Alert tone="info">Elegí un horario para continuar.</Alert>
              <Alert tone="danger">Ese horario ya no está disponible. Elegí otro.</Alert>
            </div>
          </Card>
          <Disclosure title="Información adicional" description="Los detalles se muestran cuando los necesitás.">
            <p className="text-sm leading-6 text-text-secondary">Las secciones desplegables conservan los campos y sus valores aunque estén cerradas. Podés abrirlas con el mouse, el teclado o tocando el encabezado.</p>
          </Disclosure>
        </div>
      </div>
    </InternalShell>
  );
}
