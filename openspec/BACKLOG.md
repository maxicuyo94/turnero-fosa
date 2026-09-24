# Backlog de errores y riesgos

Revisión: **2026-09-24**, código `ca19321` en `main` (incluye `generic-vehicle-history`,
el outbox de emails y los roles de personal).

| Ítem | Estado |
| --- | --- |
| ERR-001, ERR-002 | Cerrados; se conservan como referencia |
| PAY-001, PAY-002 | Mitigados en código; falta evidencia contra el sandbox |
| PAY-003 | Endpoints listos; falta programar los cron |
| VEH-001 | Cerrado: patente única desde `20260924150000_unique_vehicle_plate` |
| VEH-002 | Asumido, sin corrección |
| OPS-001 | Outbox implementado; falta remitente productivo y visibilidad de entrega |

Orden de trabajo: [ROADMAP.md](ROADMAP.md).

P1: priorizar antes de ampliar uso o activar el flujo afectado. P2: siguiente
iteración. Una reproducción en memoria demuestra el comportamiento del servicio,
pero no acredita por sí sola un incidente en PostgreSQL o en producción.

## ERR-001 — Cambios de estado concurrentes

Avance 2026-09-18: los cambios internos (`1f1624d`) y la cancelación pública solo
escriben si el turno sigue en el estado validado, con una única fila de historial
por transición aceptada. Probado en PostgreSQL con confirmar/cancelar internos en
paralelo y con cancelación pública contra confirmación interna. Reprogramar ya
corría bajo el bloqueo de agenda. Los webhooks, la conciliación y el vencimiento de
señas bloquean la fila del turno y leen su estado bajo ese bloqueo, así que se
serializan con los cambios condicionales; lo cubre una prueba de aprobación contra
cancelación interna en PostgreSQL. **Cerrado** salvo reproducción nueva.

- **Prioridad:** P1. **Evidencia:** reproducido en el servicio con repositorio en
  memoria; pendiente prueba concurrente con PostgreSQL.
- **Escenario:** dos solicitudes leen `PENDING_CONFIRMATION`; una cancela y otra
  confirma. Ambas son aceptadas y el resultado puede ser `CANCELLED → CONFIRMED`,
  transición que la política normal prohíbe.
- **Origen:** [operaciones](../src/modules/internal/operations.ts)
  (`updateInternalAppointmentStatus`) valida antes de escribir; el
  [repositorio](../src/modules/internal/prisma-repository.ts)
  (`updateAppointmentStatus`) no compara el estado esperado al actualizar.
- **Alcance a revisar:** cancelación pública, cambios internos y webhooks deben
  coordinarse; el bloqueo de reprogramación por sí solo no cubre estos caminos.
- **Cierre:** validar y actualizar bajo una operación atómica o comparar versión;
  probar cancelar/confirmar y cancelar/reprogramar en paralelo, con un historial
  que refleje exclusivamente transiciones aceptadas.

## ERR-002 — Fechas y horas invalidas

Avance 2026-09-11 (`business-settings`): corregida la validación de horas y fechas
en Configuración, incluyendo excepciones y fecha de activación de señas, con
pruebas de regresión. Avance 2026-09-18 (`e471060`): `?date=` malformado en la
agenda interna y en `/booking` vuelve a una fecha válida, y la reserva rechaza
fechas de calendario inexistentes. Una prueba E2E recorre `/booking` y la agenda
con fechas inexistentes, meses inválidos y texto arbitrario. **Cerrado** salvo
reproducción nueva.

- **Prioridad:** P1. **Evidencia:** reproducido en los esquemas; errores HTTP
  específicos pendientes de reproducción local.
- **Reproducción:** `weeklyScheduleSchema.safeParse` acepta un lunes abierto de
  `25:00` a `26:00`; `scheduleDateExceptionSchema.safeParse` acepta `2026-02-31`.
- **Origen:** [esquemas de horarios](../src/modules/settings/schemas.ts) comprueban
  formato, pero no rangos ni existencia de la fecha. La
  [página pública](../app/(public)/booking/page.tsx) pasa `date` de la URL al
  [repositorio](../src/modules/booking/prisma-repository.ts), que construye fechas
  para Prisma sin una validación previa de calendario.
- **Impacto posible:** configuraciones imposibles, fechas normalizadas a otro día
  o excepciones al consultar páginas mediante URLs malformadas.
- **Cierre:** validadores comunes para calendario y `00:00–23:59`, feedback
  controlado en páginas/acciones y pruebas con año bisiesto, fecha inexistente,
  texto arbitrario y rangos de horario. No consultar ni guardar fechas inválidas.

## PAY-001 — Inicio de pago concurrente

Avance 2026-09-18 (`fix/mercado-pago`): `createAttempt` vuelve a buscar el intento
vigente bajo el bloqueo del turno, `markPreferenceCreated` solo guarda el primer
checkout y la preferencia usa la referencia externa como `X-Idempotency-Key`. Probado
con dos inicios simultáneos en memoria y en PostgreSQL. Pendiente: doble clic real
contra el sandbox.

- **Prioridad:** P1 antes de activar señas. **Evidencia:** reproducido en memoria;
  pendiente confirmar concurrencia con PostgreSQL y sandbox.
- **Reproducción:** dos `initiateAppointmentDeposit` simultáneos, sin intento
  reusable visible al comienzo, generan dos intentos y dos preferencias.
- **Origen:** [servicio de pagos](../src/modules/payments/service.ts) busca el
  intento antes de crearlo. [createAttempt](../src/modules/payments/prisma-repository.ts)
  bloquea el turno y comprueba su estado, pero no vuelve a buscar un intento
  vigente dentro de ese bloqueo. La llamada externa tampoco se serializa.
- **Cierre:** reservar/reutilizar de forma atómica el inicio de checkout y coordinar
  la creación de preferencia. Probar doble clic, dos sesiones y fallo de red
  después de la respuesta del proveedor. No deben quedar dos enlaces cobrables.

## PAY-002 — Actualizaciones de pago fuera de orden

Avance 2026-09-18 (`ee0e378`): un intento aprobado solo pasa a reembolso o
contracargo, que son finales; `markAttemptError` no degrada pagos cobrados. La
conciliación aplica todos los pagos de la referencia en orden cronológico.

- **Prioridad:** P1 antes de activar señas. **Evidencia:** riesgo por inspección;
  todavía no reproducido con solicitudes reales del proveedor.
- **Escenario:** una consulta al proveedor obtiene `pending`, otra obtiene
  `approved`; si la respuesta pendiente se persiste al final puede sobrescribir
  el intento aprobado aunque el turno ya esté confirmado.
- **Origen:** [processMercadoPagoPayment](../src/modules/payments/service.ts)
  consulta al proveedor antes de la transacción;
  [applyProviderPayment](../src/modules/payments/prisma-repository.ts) asigna el
  estado recibido sin validar orden o transición. `markAttemptError` también
  puede sustituir un estado previo por `ERROR`.
- **Cierre:** definir transiciones/versionado y separar errores de procesamiento
  del estado financiero; simular respuestas invertidas y notificaciones
  duplicadas. Preservar reembolsos y contracargos válidos; no limitarse a ignorar
  todas las actualizaciones posteriores a `APPROVED`.

## PAY-003 — Vencimiento dependiente del trafico

Avance 2026-09-18 (`fix/mercado-pago`): nuevo endpoint `/api/cron/deposits`
protegido con `CRON_SECRET`; la agenda interna también ejecuta el barrido. Antes de
cancelar se consulta a Mercado Pago por la referencia. Pendiente: programar el cron
(Vercel Pro o programador externo) y monitorearlo.

Avance 2026-09-23: las páginas ya no esperan el barrido; lo disparan después de
responder (`after()`), y los barridos de una misma instancia comparten una sola
ejecución. La disponibilidad pública trata como libre una retención vencida, y la
reserva liquida las vencidas antes de su transacción. `/api/cron/emails` reintenta
el outbox de emails con el mismo `CRON_SECRET`: programarlo junto al de señas.

- **Prioridad:** P2, resolver antes de operar señas obligatorias.
- **Evidencia:** limitación confirmada por inspección de los puntos de llamada.
- **Origen:** `expireOverdueDepositReservations` solo se llama al listar turnos
  desde el [repositorio público](../src/modules/booking/prisma-repository.ts),
  fuera de su transacción de reserva. La agenda interna y consulta por código
  no ejecutan esa limpieza; no hay un proceso periódico implementado.
- **Impacto:** sin visitas a disponibilidad, un turno vencido puede seguir
  figurando pendiente; la liberación no ocurre necesariamente al cumplirse el plazo.
- **Cierre:** trabajo periódico idempotente o una política de lectura consistente,
  con frecuencia acordada, monitoreo y prueba sin tráfico público. Coordinar
  expiración con reintentos y pagos en curso.

## VEH-001 — Patente sin unicidad mientras queden duplicados

Cierre 2026-09-24: se vaciaron los datos operativos de producción y Preview (solo había
datos de prueba), así que no quedaron duplicados. La migración
`20260924150000_unique_vehicle_plate` agrega el índice único parcial y corta con un
mensaje claro si encuentra patentes repetidas. La fusión de unidades existía solo para
limpiar esos duplicados: se quitó, junto con la tabla `VehicleMerge`. Queda pendiente
un camino para corregir una patente mal cargada, que hoy no se puede editar.

- **Prioridad:** P2. **Evidencia:** limitación conocida, asumida al entregar
  `generic-vehicle-history`.
- **Origen:** cada reserva anterior creaba su propia unidad, así que producción tiene
  la misma patente en varias filas de `Vehicle`. Un índice único haría fallar
  `prisma migrate deploy` durante el build, así que `plateNormalized` quedó con índice
  común.
- **Mitigación vigente:** el id de una unidad con patente se deriva de la patente
  (`identityDerivedId`), así que dos reservas simultáneas chocan en la clave primaria y
  la transacción reintenta con snapshot fresco en lugar de duplicar en silencio.
  Reproducido con dos sesiones de PostgreSQL: sin esto, la segunda transacción no ve la
  fila que la primera acaba de commitear, porque su snapshot serializable es anterior al
  lock de capacidad.
- **Cierre:** fusionar los duplicados desde Interno → Unidades y recién entonces agregar
  la migración de unicidad parcial (`WHERE "plateNormalized" IS NOT NULL`). Verificar
  antes que no queden grupos duplicados.

## VEH-002 — La migración de vehículos falla sin configuración del taller

- **Prioridad:** P3. **Evidencia:** reproducido localmente con PostgreSQL.
- **Reproducción:** con filas en `Motorcycle` y `WorkshopSettings` vacía, la migración
  `20260921120000_generic_vehicle` corta con
  `column "vehicleTypeId" of relation "Vehicle" contains null values`: el tipo `Moto` se
  siembra a partir de `WorkshopSettings`, así que sin esa tabla el backfill queda en null
  y el `SET NOT NULL` no pasa.
- **Por qué no se corrigió:** la aplicación no puede producir ese estado, porque un turno
  necesita un servicio y los servicios cuelgan de `WorkshopSettings`. La única forma de
  blindarlo sería volver `vehicleTypeId` nullable, debilitando el modelo contra un caso
  que no ocurre.
- **Cierre:** si alguna vez aparece una base en ese estado, sembrar la configuración del
  taller antes de migrar. Revisar de nuevo si se habilitan varios talleres, que es cuando
  el estado deja de ser imposible.

## OPS-001 — Entrega de email y recuperación de fallos

Avance 2026-09-23 (`98851c1`): los emails se encolan en `EmailLog` (`PENDING`) en la
misma escritura que crea, confirma o reprograma el turno y se entregan después de
responder, con reintentos, antigüedad máxima de 24 h e `Idempotency-Key` de Resend.
`/api/cron/emails` reintenta los pendientes, pero todavía no está programado (ver
PAY-003).

- **Prioridad:** P2. **Evidencia:** capacidad incompleta por inspección.
- **Pendiente:** programar el cron, mostrar al taller el estado de entrega de cada
  email y validar remitente/dominio productivo con una entrega real.
- **Cierre:** una caída del proveedor no pierde eventos ni impide el registro del
  turno, y el taller ve qué emails no se entregaron.

## Verificaciones operativas pendientes

- Revisar límites de solicitudes en login, consulta por código, reservas y
  reintentos. No se detectó un limitador explícito en el código de la aplicación;
  revisar también las protecciones configuradas en infraestructura.
- Actualizar auditoría de dependencias. No tratar el aviso histórico de `sharp`
  del README como el resultado de una auditoría actual.
- Verificar restauración de backup y recuperación ante indisponibilidad de Neon.
  El primer despliegue de preview del 2026-09-09 falló con P1001; el reintento fue
  correcto. Eso no demuestra por sí solo la causa ni garantiza recuperación automática.
- Cerrar evidencia de aceptación de feriados y monitoreo de emails todavía
  pendientes en las tareas OpenSpec, sin marcar verificaciones no realizadas.

## Corregidos y publicados el 2026-09-09

No reabrir estos problemas sin una reproducción nueva: se conservan como referencia.

| Problema | Corrección / evidencia |
| --- | --- |
| Un intento vencido cancelaba un reintento vigente | Coordinación por turno y comprobación de intentos protegidos; `tests/payments-prisma.test.ts` |
| Intentos con error/rechazo dejaban reservas fuera del vencimiento | Incluidos en la política de vencimiento; prueba de liberación e historial único |
| Enlaces de pago/cancelación manipulables por query string | Checkout desde base y ruta local de cancelación; prueba E2E de enlaces inyectados |
| Ventana pública variaba con zona horaria del servidor | Calendario del taller explícito; regresiones en `tests/availability.test.ts` |

## Cómo mantener el registro

Agregar a cada ítem: estado, responsable al asignarlo, reproducción, evidencia,
criterio de cierre y commit verificado. Un test exitoso del camino normal no
descarta carreras de concurrencia. Registrar por separado fallo reproducido,
riesgo por inspección e incidente observado en producción.
