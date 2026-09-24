# Tareas

Dos revisiones encadenadas, cada una por debajo de las 800 líneas de implementación,
documentación y pruebas nuevas.

## V1 — Entidad genérica e identidad

Revisión real: 1056 líneas, por encima del presupuesto de 800. El exceso es el renombre mecánico
repartido en 20 archivos más las pruebas nuevas; la lógica nueva son unas 435 líneas. Se puede
partir en renombre y comportamiento si la revisión lo pide.

- [x] 1.1 Pruebas RED de normalización de patente y teléfono, reutilización de cliente y unidad,
      reserva sin patente, reserva concurrente con la misma patente y conservación de datos guardados.
- [x] 1.2 Catálogo `VehicleType` colgado de `WorkshopSettings`, con semilla del tipo `Moto`.
- [x] 1.3 Migración: renombrar `Motorcycle` a `Vehicle` y `Appointment.motorcycleId` a `vehicleId`,
      agregar columnas nuevas, backfillear tipo y patente normalizada, índice no único.
- [x] 1.4 Reutilización de cliente y unidad dentro de la transacción de reserva, con cambio de dueño registrado.
- [x] 1.5 Selector de tipo de vehículo en la reserva pública —único campo nuevo público— y
      administración del catálogo en Configuración.
- [x] 1.6 Renombrar los usos restantes en agenda interna, perfil de datos de prueba y E2E.
- [x] 1.7 Verificar tipos, lint, pruebas, E2E y build (2026-09-21, PostgreSQL 16 local).
      `typecheck`, `lint` y `build` en verde; 293 pruebas pasan. De las E2E corrieron 18 de 24 specs:
      los 6 de `inventory-code` necesitan un Chromium que este contenedor no tiene y quedaron sin ejecutar,
      no fallaron por el cambio. CI usa PostgreSQL 17 y Node 24; acá fueron 16 y 22.

## V2 — Ficha de unidad, historial y fusión

Revisión: 1410 líneas, también por encima de las 800 (unas 660 son pruebas y pantallas nuevas). Agrega la tabla `VehicleMerge` para auditar
la fusión, que el diseño pedía registrar.

- [x] 2.1 Pruebas RED de historial por unidad, búsqueda, detección de duplicados, edición de campos
      internos, fusión y fusión repetida.
- [x] 2.2 `/internal/vehicles` con búsqueda y posibles duplicados por patente normalizada.
- [x] 2.3 `/internal/vehicles/[id]` con ficha, línea de tiempo de turnos y cambios de dueño.
- [x] 2.3b Edición en la ficha de tipo, marca, modelo, año, VIN, número de motor, color y notas;
      la patente no se edita ahí.
- [x] 2.4 Enlace desde el detalle del turno en la agenda interna.
- [x] 2.5 Acción de fusión autenticada, transaccional e idempotente, con confirmación explícita.
- [x] 2.6 Verificar tipos, lint, pruebas, E2E y build (2026-09-21, PostgreSQL 16 local).
      `typecheck`, `lint` y `build` en verde; 308 pruebas pasan. E2E: 21 pruebas en chromium, incluidas las
      tres nuevas de unidades. Los specs de `inventory-code` y el proyecto `mobile-chromium` siguen sin
      poder ejecutarse acá por la versión de Chromium del contenedor.

## Pendientes fuera de estas revisiones

- [x] 3.1 ~~Verificar una fusión en Vercel Preview.~~ Descartada el 2026-09-24: con los datos
      operativos vaciados y la patente única, la fusión no tenía uso y se quitó.
- [x] 3.2 Migración de unicidad parcial de `plateNormalized` (VEH-001):
      `20260924150000_unique_vehicle_plate`, con guarda ante patentes repetidas. También elimina
      `VehicleMerge`. Prisma no declara índices parciales: el esquema conserva `@@index([plateNormalized])`.
- [x] 3.3 Actualizar README, ROADMAP y BACKLOG con el alcance entregado y lo que queda abierto
      (2026-09-21). Los riesgos asumidos quedaron como VEH-001 (patente sin unicidad) y
      VEH-002 (la migración necesita configuración del taller).
