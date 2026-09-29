# Tareas — Detalle operativo del turno

- [x] Enlaces para copiar código, llamar y abrir WhatsApp desde el panel lateral.
- [x] Formulario de contacto y notas con validación, permisos y feedback.
- [x] Migración aditiva e historial por campo con atribución del personal.
- [x] Protección ante ediciones simultáneas y colisión de teléfono.
- [x] Conservar reservas con el número anterior tras una corrección de contacto.
- [x] Generar Prisma Client, validar esquema, pasar typecheck y pruebas locales sin DB.
- [x] Aplicar migración en una base aislada y ejecutar las pruebas de PostgreSQL.
- [x] Verificar el recorrido en navegador en escritorio y móvil.

El 2026-09-29 se aplicaron las 17 migraciones en PostgreSQL 17 aislado y pasaron
las 19 pruebas de integración de operaciones internas y reutilización de clientes.
El recorrido de edición y accesos rápidos pasó en Chromium de escritorio y móvil.
