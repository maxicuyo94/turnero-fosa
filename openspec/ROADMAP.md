# Roadmap — Turnero Taller Express

Actualizado: **2026-09-11**. Base revisada: `e15ebe8` en `main`.

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
| Agenda protegida, estados, horarios, descansos y feriados | Implementado y publicado | `src/modules/internal/`; queda cerrar evidencia pendiente de aceptación de feriados |
| Reprogramación interna, duración e historial de intervalos | Implementado y publicado | [Cambio OpenSpec](changes/safe-appointment-rescheduling/tasks.md); pendiente seguimiento de logs de email |
| Base de señas con Mercado Pago y webhook firmado | Código publicado; activación comercial pendiente | [Tareas de pagos](changes/mercado-pago-deposits/tasks.md); falta compra sandbox completa y configuración productiva |
| Correcciones de reintentos vencidos, pagos fallidos, enlaces manipulados y zona horaria | Publicadas en `e15ebe8` | `tests/payments-prisma.test.ts`, `tests/availability.test.ts`, `e2e/foundation.spec.ts` |
| Email de creación, cambio de estado y reprogramación | Implementado; operación por verificar | Confirmar remitente/dominio productivo y entrega real; aún sin cola durable ni recordatorios |

Publicar el código de pagos no habilita Mercado Pago automáticamente. En la
verificación del 2026-09-09 no había credenciales de Mercado Pago en producción y
el formulario público no exigía seña. Revisar la configuración antes de activarla.

## Próximo bloque — Estabilidad

Objetivo: evitar estados inconsistentes y rechazar entradas inválidas antes de
consultar o modificar la base.

| Orden | Trabajo | Prioridad | Criterio de salida |
| --- | --- | --- | --- |
| 1 | Transiciones de estado atómicas, incluyendo cancelación pública | P1 · [ERR-001](BACKLOG.md#err-001--cambios-de-estado-concurrentes) | Dos operaciones incompatibles no pueden aprobarse sobre un estado obsoleto; historial coherente en PostgreSQL |
| 2 | Fechas reales y horas válidas en páginas, acciones y esquemas | P1 · [ERR-002](BACKLOG.md#err-002--fechas-y-horas-invalidas) | `2026-02-31`, `25:00` y una fecha malformada producen feedback controlado, sin persistencia ni excepción sin manejar |
| 3 | Inicio de pago idempotente bajo concurrencia | P1 antes de cobrar · [PAY-001](BACKLOG.md#pay-001--inicio-de-pago-concurrente) | Doble clic/reintento paralelo devuelve el mismo intento y no crea dos checkouts cobrables |
| 4 | Orden de actualizaciones de pago y reconciliación | P1 antes de cobrar · [PAY-002](BACKLOG.md#pay-002--actualizaciones-de-pago-fuera-de-orden) | Una respuesta vieja no rebaja un pago aprobado; reembolsos y contracargos conservan su significado |
| 5 | Vencimiento sin depender de visitas a reservas | P2 · [PAY-003](BACKLOG.md#pay-003--vencimiento-dependiente-del-trafico) | Los turnos vencen dentro de un intervalo acordado aunque nadie abra `/booking` |

ERR-001 y ERR-002 son el siguiente trabajo recomendado. Los demás pueden avanzar
en cambios independientes, pero PAY-001 y PAY-002 deben resolverse antes de exigir
señas. No se corrigieron estos puntos durante la actualización documental.

## Siguiente bloque — Operación diaria

Objetivo: reducir pasos para atender y administrar turnos.

- Navegación anterior/hoy/siguiente para día y semana.
- Accesos para copiar código, llamar y abrir WhatsApp desde el detalle.
- Edición validada de contacto, moto y notas, con trazabilidad.
- Mostrar historial de estados junto al historial de intervalos ya disponible.
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
- Guardar eventos de email en una outbox transaccional y enviarlos con un worker.
- Agregar reintentos, estados de entrega visibles y recordatorios configurables.
- Definir proveedor, consentimiento, plantillas y costos antes de automatizar WhatsApp.

**Señas**

- Resolver PAY-001/PAY-002/PAY-003 y ejecutar una compra sandbox completa.
- Probar aprobación, rechazo, expiración, notificación duplicada y pago tardío.
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
- Roles de administrador, recepción y mecánico, con permisos por operación.
- Auditoría de modificaciones, monitoreo de errores, health checks, límites de
  solicitudes y ejercicios de restauración de backups.
- Auditoría actualizada de dependencias y revisión de las actualizaciones automáticas.

Inventario, sucursales, historia mecánica completa, pagos adicionales y
reprogramación pública quedan fuera del alcance inmediato, hasta definir su necesidad.

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
