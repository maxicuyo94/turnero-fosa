# Verificación de E1 — Inventario interno

Fecha: 16 de septiembre de 2026. Destino: aplicación y PostgreSQL locales. No desplegado en Vercel.

## Comprobaciones completadas

- Compilación de Next.js, TypeScript y ESLint correctos.
- 23 pruebas de servicio y acciones: validación, permisos, atribución del usuario, protección de stock y operaciones repetidas.
- 11 pruebas con PostgreSQL: alta/edición, auditoría, stock reservado, reversión completa ante fallo de auditoría, versiones y operaciones concurrentes.
- La suite general pasó 178 de 179 pruebas inicialmente; el único fallo correspondía a un dato esperado en la nueva prueba de inventario. Esa prueba se corrigió y las 11 pruebas de inventario con PostgreSQL pasaron después. No se afirma una segunda ejecución completa de la suite.
- Primer recorrido de navegador: 4 pruebas aprobadas entre Chromium de escritorio y emulación Pixel 5, con autenticación, alta, edición, entrada, consumo insuficiente/corregido y ajuste.

## Revisión final de navegador

La revisión visual detectó que las capturas se tomaban mientras el último ajuste todavía se mostraba como guardando. Se corrigió la prueba para esperar la finalización de cada operación y comprobar el stock final también en pantalla. El recorrido ampliado pasó las 6 pruebas entre escritorio y emulación móvil:

- Acceso anónimo redirigido al inicio de sesión.
- Alta, edición, entrada, consumo rechazado por falta de stock, consumo corregido y ajuste, sin recargar manualmente.
- Stock final de 4 unidades visible y movimiento de conteo presente en el historial.
- Tres altas consecutivas, con claves de operación renovadas y tres productos distintos.
- Búsqueda por nombre y filtro de stock mínimo.
- Cuatro indicadores del resumen comparados con los datos persistidos.
- Ausencia de desplazamiento horizontal en ficha, listado y resumen.

Se generan capturas completas y de la vista visible para ficha, listado y resumen en `test-results/`. El caso de listado conserva el cursor durante las capturas para evitar que el ocultamiento automático de Playwright cambie atributos durante la inicialización de React.

Las pruebas crean usuarios y productos propios y eliminan únicamente esos registros. No usan credenciales administrativas ni datos de producción.

## Límites del resultado

- La emulación móvil verifica disposición y funcionamiento en Chromium; no equivale a una prueba con cámara ni en un teléfono físico.
- El código de barras se carga como texto en E1. La cámara y las sesiones de conteo pertenecen a E2.
- Mostrador, presupuestos, cuentas de clientes, tienda pública y pagos siguen en las siguientes entregas.
- No se ejecutó un despliegue a Vercel Preview ni a producción.
