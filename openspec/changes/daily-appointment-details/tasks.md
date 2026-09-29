# Tareas — Detalle operativo del turno

- [x] Enlaces para copiar código, llamar y abrir WhatsApp desde el panel lateral.
- [x] Formulario de contacto y notas con validación, permisos y feedback.
- [x] Migración aditiva e historial por campo con atribución del personal.
- [x] Protección ante ediciones simultáneas y colisión de teléfono.
- [x] Conservar reservas con el número anterior tras una corrección de contacto.
- [x] Generar Prisma Client, validar esquema, pasar typecheck y pruebas locales sin DB.
- [x] Aplicar migración en una base aislada y ejecutar las pruebas de PostgreSQL.
- [x] Verificar el recorrido en navegador en escritorio y móvil.
- [x] Publicar `04a6491` en Preview y aplicar `20260929120000_appointment_detail_history` a su base.
- [x] Promover `43d5847` a Producción y aplicar la misma migración a su base.

El 2026-09-29 se aplicaron las 17 migraciones en PostgreSQL 17 aislado y pasaron
las 19 pruebas de integración de operaciones internas y reutilización de clientes.
El recorrido de edición y accesos rápidos pasó en Chromium de escritorio y móvil.
Vercel confirmó la migración y el despliegue de Preview el 2026-09-29. Las rutas
`/booking` y `/internal/login` respondieron 200. Ese día Vercel confirmó también
la migración y el despliegue en Producción; ambas rutas respondieron 200 allí.
