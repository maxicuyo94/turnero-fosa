# Roadmap — Turnero Taller Express

Actualizado: **2026-09-29**. Base revisada: `e10dd03` en las ramas locales
`main` y `preview`. El estado del despliegue remoto no se verificó en esta revisión.

Este documento ordena el trabajo futuro. El detalle de errores, riesgos y pruebas
pendientes está en [BACKLOG.md](BACKLOG.md). Las prioridades son propuestas; no
representan fechas comprometidas ni autorización para activar cobros.

## Estado de partida

El 2026-09-09 se publicó `e15ebe8` en producción con migraciones aplicadas y
[CI aprobado](https://github.com/maxicuyo94/turnero-fosa/actions/runs/34361160756).
En esa entrega pasaron 127 pruebas unitarias/de integración y 10 pruebas E2E.
Estos resultados son históricos: esta actualización documental no vuelve a
certificar el estado remoto ni constituye una auditoría exhaustiva.

| Capacidad | Estado | Evidencia / pendiente |
| --- | --- | --- |
| Reserva pública, consulta por código, disponibilidad y capacidad | Implementado y publicado | `src/modules/booking/`, `src/modules/availability/` |
| Agenda protegida, estados, horarios, descansos y feriados | Implementado y publicado | `src/modules/internal/`; feriados importados y excepciones verificados en Preview el 2026-09-24 |
| Reprogramación interna, duración e historial de intervalos | Implementado y publicado | [Cambio OpenSpec](changes/safe-appointment-rescheduling/tasks.md); pendiente seguimiento de logs de email |
| Base de señas con Mercado Pago y webhook firmado | Integración probada en Preview; activación comercial pendiente | [Tareas de pagos](changes/mercado-pago-deposits/tasks.md); compra de prueba aprobada y turno confirmado el 2026-09-23 (`BGJ294X52X`), con aceptación de notificación firmada registrada. Observar confirmación inmediata por webhook en logs es una comprobación adicional, no una compra de prueba pendiente |
| Correcciones de reintentos vencidos, pagos fallidos, enlaces manipulados y zona horaria | Publicadas en `e15ebe8` | `tests/payments-prisma.test.ts`, `tests/availability.test.ts`, `e2e/foundation.spec.ts` |
| Email de creación, cambio de estado y reprogramación | Implementado con outbox y reintentos (`98851c1`) | Confirmar remitente/dominio productivo y entrega real; hacer visible el estado de entrega. Programar `/api/cron/emails` es de baja prioridad hoy |
| Roles de personal ADMIN/STAFF | Publicado (`98851c1`) | Configuración queda para ADMIN; falta el rol de mecánico y permisos por operación |
| Inventario interno y escaneo de códigos | E1 publicado en producción; E2 verificado en Preview el 2026-09-24 | [Entregables del shop](changes/spare-parts-shop/deliverables.md); el usuario confirmó el 2026-09-29 que se realizó la prueba con hardware del taller, sin registrar aquí dispositivos ni resultados detallados |
| Unidad genérica con historial y reutilización | Publicado (`3cbdc2b`); patente única el 2026-09-24 | [Cambio OpenSpec](changes/generic-vehicle-history/tasks.md); la fusión se quitó (VEH-001); la patente se corrige desde la ficha con historial |

Publicar el código de pagos no habilita Mercado Pago automáticamente. En la
verificación del 2026-09-09 no había credenciales de Mercado Pago en producción y
el formulario público no exigía seña. Revisar la configuración antes de activarla.

## Estabilidad — estado actual

Las transiciones atómicas y la validación estricta de fechas y horas quedaron
cerradas como [ERR-001 y ERR-002](BACKLOG.md). El inicio idempotente y la
reconciliación de pagos tienen cobertura en código y PostgreSQL ([PAY-001 y
PAY-002](BACKLOG.md)); la compra aprobada en Preview confirma el recorrido principal
con Mercado Pago. Las pruebas específicas de doble clic real y respuestas del
proveedor fuera de orden no están registradas como aceptación independiente.

Los endpoints periódicos de señas y correo están implementados, pero todavía no
tienen programador. [PAY-003](BACKLOG.md#pay-003--vencimiento-dependiente-del-trafico)
queda como mejora operativa de **baja prioridad hoy**: la reserva reconcilia antes de
escribir, la disponibilidad considera libres las retenciones vencidas y algunas
páginas disparan barridos después de responder. Revaluar la frecuencia requerida si
se activan señas obligatorias o se acuerdan plazos de entrega de correo.

## Siguiente bloque — Operación diaria

Objetivo: reducir pasos para atender y administrar turnos.

- ~~Navegación anterior/hoy/siguiente para día y semana.~~ Hecho el 2026-09-19: la
  vista elegida viaja en la URL (`?view=week`) y sobrevive a recargas y redirects.
- ~~Historial por unidad.~~ Entregado en el cambio `generic-vehicle-history` (`3cbdc2b`): la reserva reutiliza cliente y unidad en lugar de crearlos de nuevo,
  y el panel muestra la ficha con sus turnos y cambios de dueño. Desde el 2026-09-24 la
  patente es única y la fusión de duplicados se quitó.
- ~~Corrección validada de una patente mal cargada.~~ Hecho el 2026-09-24: la ficha tiene "Corregir patente", rechaza la de otra unidad y registra cada cambio.
- ~~Accesos para copiar código, llamar y abrir WhatsApp desde el detalle.~~ Implementados
  localmente el 2026-09-29; los enlaces usan el número guardado sin inventar prefijos.
- ~~Edición validada de nombre, teléfono, email y notas del turno, con trazabilidad.~~
  Implementada localmente el 2026-09-29. El contacto se comparte entre turnos del
  cliente; las notas pertenecen al turno. Cada campo modificado registra valor
  anterior/nuevo y personal responsable. La migración
  `20260929120000_appointment_detail_history`, las pruebas con PostgreSQL y el
  recorrido de navegador en escritorio y móvil pasaron en un entorno aislado.
  Falta aplicar la migración al publicar. Ver [cambio OpenSpec](changes/daily-appointment-details/tasks.md).
- La edición de datos de la unidad sigue en su ficha; considerar un acceso más
  directo desde la agenda si el taller lo necesita.
- Mostrar historial de estados junto al historial de intervalos ya disponible, y
  sumarlo también a la ficha de la unidad, que hoy lista turnos pero no sus cambios de estado.
- Vista móvil compacta de agenda: evaluar lista o tres días.
- Mantener la visualización de feriados y agregar una alerta para turnos antiguos
  que hayan quedado dentro de un cierre o fuera de la capacidad actual.
- Mejorar `/booking/status`: pasos siguientes según estado y acceso seguro al
  reintento de pago cuando corresponda; revisar legibilidad en móvil.

Aceptación: comprobar los recorridos cotidianos con el taller, teclado y móvil;
conservar autorización, historial y validación de capacidad.

## Siguiente bloque — Comunicaciones y señas operativas

Se puede trabajar por separado en ambos frentes.

**Comunicaciones**

- Verificar dominio/remitente de Resend y entrega real de los eventos existentes.
- Mostrar al taller los estados de entrega del outbox ya implementado.
- Evaluar recordatorios configurables y programación periódica cuando la operación lo requiera.
- Definir proveedor, consentimiento, plantillas y costos antes de automatizar WhatsApp.

**Señas**

- Conservar como aceptación la compra de prueba aprobada y el turno confirmado en Preview.
- Completar, cuando se prepare la activación comercial, la evidencia de los casos
  específicos aún no registrados: doble clic real, respuestas fuera de orden,
  rechazo, expiración, notificación duplicada y pago tardío.
- Incorporar consulta/reconciliación operativa, devolución y contracargo.
- Definir qué hace el taller ante un pago acreditado con turno cancelado.
- Configurar credenciales y webhook de producción; activar la política en una
  entrega explícita, con seguimiento del primer pago y posibilidad de desactivar
  nuevos cobros sin borrar el historial.

Aceptación: seguir un pago desde la reserva hasta el proveedor y el turno,
incluyendo recuperaciones ante fallos; nunca tomar la URL de retorno como aprobación.

## Más adelante — Capacidad, reportes y acceso

- Visualización de puestos/carriles para motos simultáneas y huecos de ocupación.
- Indicadores de turnos, cancelaciones, ausencias, demanda por servicio,
  utilización y clientes recurrentes; acordar definiciones y límites de fecha.
- Rol de mecánico y permisos por operación (ADMIN/STAFF ya existen).
- Auditoría de modificaciones, monitoreo de errores, health checks, límites de
  solicitudes y ejercicios de restauración de backups.
- Auditoría actualizada de dependencias y revisión de las actualizaciones automáticas.

Las siguientes entregas del shop (cuenta de cliente, mostrador, presupuestos y
tienda pública), sucursales, historia mecánica completa, pagos adicionales y
reprogramación pública requieren planificación o decisiones del taller.

## Decisiones pendientes del taller

Estos valores se administran desde **Interno → Configuración** y se guardan en la
base de datos. El cambio `business-settings` agrega contacto, dominio, remitente,
política de devolución, fecha de activación y edición de duraciones. La fecha
controla el comienzo del cobro habilitado, en horario de Argentina. Cargar el
dominio/remitente requiere que estén conectados/verificados con sus proveedores.
El taller puede completar los datos reales desde el panel; ya no requiere editar código.

| Tema | Decisión necesaria |
| --- | --- |
| Operación | Confirmar horarios, descansos, capacidad y duraciones reales de reparaciones |
| Contacto | Número público/WhatsApp, dominio y remitente de email |
| Señas | Monto, vencimiento, manejo de devolución y fecha de activación |
| Prioridad de producto | Elegir entre mejoras de agenda, comunicaciones y activación de señas después del bloque de estabilidad |

## Entrega y mantenimiento del plan

1. Para cada cambio funcional, preparar propuesta, especificación, diseño y tareas OpenSpec.
2. Mantener cada revisión por debajo del presupuesto de 800 líneas o dividirla.
3. Reproducir el fallo con una prueba y seguir RED-GREEN-REFACTOR para cambios de comportamiento.
4. Pasar `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e` y `pnpm build`.
5. Usar una base de pruebas aislada; nunca ejecutar suites que escriben datos contra producción.
6. Verificar preview en escritorio/móvil y publicar el mismo commit en `main`.
7. Comprobar migraciones, dominio final y rutas, y registrar SHA, fecha y evidencia.
8. Al cerrar un ítem, actualizar este roadmap, el backlog y sus tareas; separar
   código publicado de configuración activada y de verificaciones pendientes.
