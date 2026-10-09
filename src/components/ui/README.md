# Sistema de diseño de Turnero Fosa

La biblioteca está en `src/components/ui`, se importa desde su `index.ts` y se compila con `pnpm ds:build`. Los componentes son presentacionales, compatibles con renderizado del servidor e independientes de Next.js. La aplicación conecta navegación, estados pendientes, permisos y acciones mediante adaptadores.

La referencia visual está en `/internal/design-system`, con acceso de administrador. El documento `design.md` recoge las decisiones para las pantallas completas.

## Fundamentos

`tokens.css` define la paleta y los roles semánticos. Usar roles en los componentes nuevos, en lugar de repetir colores literales:

| Rol | Uso |
|---|---|
| `surface-page`, `surface-panel`, `surface-control`, `surface-hover` | Fondo, tarjetas, campos y estados al pasar el cursor |
| `text-primary`, `text-secondary`, `text-muted` | Títulos, contenido y ayuda |
| `border-subtle`, `border-control` | Separación de grupos y bordes de controles |
| `action`, `action-hover`, `action-text` | Acción principal y texto sobre ella |
| `focus`, `danger` | Foco de teclado y errores o acciones destructivas |
| `radius-control`, `radius-action-lg`, `radius-panel` | Radios de controles, acciones grandes y tarjetas |
| `spacing-control` | Altura mínima de interacción: 44 px |

Se mantienen los colores `apple` y `charcoal` para composiciones de marca. La biblioteca comparte Arial/Helvetica y el foco visible. Texto de campos: 16 px en móvil para evitar zoom al ingresar datos. La preferencia de movimiento reducido desactiva animaciones y transiciones prolongadas.

## Acciones y navegación

`Button` admite `primary`, `secondary`, `ghost` y `danger`. Usar una acción principal por grupo; `danger` identifica una cancelación o eliminación, sin sustituir el resumen de sus consecuencias. Botones pendientes quedan deshabilitados y usan `aria-busy`; los estados deshabilitados no reaccionan visualmente al cursor.

`TabNav` reemplaza las implementaciones de pestañas del panel y configuración. Sus elementos son enlaces entre páginas, con `aria-current="page"`, y no un widget ARIA de paneles intercambiables. La variante `secondary` se organiza en dos columnas en móvil; `primary` permite envolver las secciones del panel. Pasar `linkComponent` para la navegación del framework y `indicator` para el estado pendiente. El estilo activo es una línea, sin cápsulas.

## Formularios

`Field` mantiene etiqueta, ayuda y error juntos. Para `description` o `error`, proporcionar un `htmlFor` único y un único control como hijo directo (`TextInput`, `Select` o `Textarea`). El componente asigna el id y conecta los mensajes mediante `aria-describedby`; un error también establece `aria-invalid`. Los mensajes quedan fuera de la etiqueta y respetan descripciones adicionales del control.

```tsx
<Field label="Email" htmlFor="customer-email" error={errors.email}>
  <TextInput name="email" type="email" autoComplete="email" />
</Field>
```

El componente presenta errores que recibe; la validación y la autorización permanecen en el servidor. Con `density="sm"` cambia el espacio interior, sin reducir la altura mínima. Los controles nativos conservan teclado, validación y envío del formulario.

## Componentes complementarios

- `Card`, `PageShell` y `PageHeading`: estructura y jerarquía de pantalla.
- `StatusBadge`: estado escrito además del color.
- `Alert`: confirmación, información o rechazo; el rol accesible depende del tono.
- `Disclosure`: detalles nativos que conservan su contenido montado.
- `SlotOption`, `CodeDisplay`, `DetailList`, `EmptyState`: patrones propios del turnero.

Para incorporar un patrón, exportarlo desde `index.ts`, agregar un ejemplo a la referencia visual y comprobar móvil, escritorio, foco y estados relevantes. No copiar estilos de controles a cada pantalla. La compilación genera declaraciones de tipos y CSS en `ds-dist`; sus archivos son derivados y no se versionan.
