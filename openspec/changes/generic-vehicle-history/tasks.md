# Tareas

Dos revisiones encadenadas, cada una por debajo de las 800 líneas de implementación,
documentación y pruebas nuevas.

## V1 — Entidad genérica e identidad

- [ ] 1.1 Pruebas RED de normalización de patente y teléfono, reutilización de cliente y unidad,
      reserva sin patente, reserva concurrente con la misma patente y conservación de datos guardados.
- [ ] 1.2 Catálogo `VehicleType` colgado de `WorkshopSettings`, con semilla del tipo `Moto`.
- [ ] 1.3 Migración: renombrar `Motorcycle` a `Vehicle` y `Appointment.motorcycleId` a `vehicleId`,
      agregar columnas nuevas, backfillear tipo y patente normalizada, índice no único.
- [ ] 1.4 Reutilización de cliente y unidad dentro de la transacción de reserva, con cambio de dueño registrado.
- [ ] 1.5 Selector de tipo de vehículo en la reserva pública —único campo nuevo público— y
      administración del catálogo en Configuración.
- [ ] 1.6 Renombrar los usos restantes en agenda interna, perfil de datos de prueba y E2E.
- [ ] 1.7 Verificar tipos, lint, pruebas, E2E y build.

## V2 — Ficha de unidad, historial y fusión

- [ ] 2.1 Pruebas RED de historial por unidad, búsqueda, detección de duplicados, edición de campos
      internos, fusión y fusión repetida.
- [ ] 2.2 `/internal/vehicles` con búsqueda y posibles duplicados por patente normalizada.
- [ ] 2.3 `/internal/vehicles/[id]` con ficha, línea de tiempo de turnos y cambios de dueño.
- [ ] 2.3b Edición en la ficha de tipo, marca, modelo, año, VIN, número de motor, color y notas;
      la patente no se edita ahí.
- [ ] 2.4 Enlace desde el detalle del turno en la agenda interna.
- [ ] 2.5 Acción de fusión autenticada, transaccional e idempotente, con confirmación explícita.
- [ ] 2.6 Verificar tipos, lint, pruebas, E2E y build.

## Pendientes fuera de estas revisiones

- [ ] 3.1 Verificar la ficha y una fusión en Vercel Preview antes de publicar en producción.
- [ ] 3.2 Migración de unicidad parcial de `plateNormalized`, recién con los duplicados ya fusionados.
- [ ] 3.3 Actualizar README, ROADMAP y BACKLOG con el alcance entregado y lo que queda abierto.
