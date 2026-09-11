# Backlog de errores y riesgos

Revisión: **2026-09-11**, código `e15ebe8`. Todos los ítems siguientes están abiertos.
Orden de trabajo: [ROADMAP.md](ROADMAP.md).

P1: priorizar antes de ampliar uso o activar el flujo afectado. P2: siguiente
iteración. Una reproducción en memoria demuestra el comportamiento del servicio,
pero no acredita por sí sola un incidente en PostgreSQL o en producción.

## ERR-001 — Cambios de estado concurrentes

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
pruebas de regresión. Sigue pendiente validar los parámetros de fecha de las
páginas públicas/internas antes de acceder a Prisma; el ítem permanece abierto.

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

## OPS-001 — Entrega de email y recuperación de fallos

- **Prioridad:** P2. **Evidencia:** capacidad incompleta por inspección.
- [sendEmailAndLog](../src/modules/notifications/service.ts) espera al proveedor
  durante la solicitud y registra el resultado en modo best-effort. No existe
  outbox durable ni un reintento automático; si falla también el log, el evento
  puede perderse sin quedar visible para el taller.
- **Cierre:** evento transaccional, worker con timeout/reintentos y visibilidad de
  entrega; validar remitente productivo. Una caída del proveedor no debe perder
  eventos ni impedir el registro del turno.

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
