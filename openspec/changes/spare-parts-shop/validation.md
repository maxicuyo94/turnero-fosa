# Verificación de E1 — Inventario interno

## E2 · Escaneo de códigos — 18 de septiembre de 2026

- Lector con `barcode-detector`: usa `BarcodeDetector` nativo cuando existe y, si no
  (iPhone, Chromium de escritorio), ZXing en WASM servido desde `/vendor/`. El binario
  se copia desde `node_modules` en `postinstall`; no se usa el CDN por defecto.
- Cámara a demanda, sin guardar imágenes; se apaga tras la primera lectura y se
  rearma con "Escanear otro". Leer nunca modifica stock.
- Resolución exacta por código de barras o SKU, con equivalencia UPC-A/EAN-13.
  Coincidencias múltiples se listan sin elegir una. Vincular un código no reemplaza
  uno existente, valida versión y resiste dos vinculaciones simultáneas.
- Pruebas: 21 nuevas de lectura, servicio con PostgreSQL y componente (permiso
  denegado, sin cámara, cancelar, lectura única y rearmado). Suite: **27 archivos,
  221 pruebas aprobadas** en cinco corridas seguidas; una corrida previa tuvo un fallo
  aislado que no se pudo reproducir ni atribuir.
- Navegador: **38 pruebas aprobadas** en Chromium de escritorio y emulación Pixel 5.
  El recorrido de cámara usa un video Y4M con un EAN-13 como cámara falsa y verifica
  la carga del WASM propio, la lectura y que el stock no cambia. Capturas revisadas
  sin desborde horizontal.
- PWA interna: manifiesto sólo en `/internal`, verificado en navegador; `/booking`
  no lo publica.
- Límite: sin prueba en teléfono físico Android ni iPhone; la emulación no usa la
  cámara real ni el lector nativo.
- Ajuste por prueba del usuario en celular (códigos muy chicos sin enfoque): se pide
  1920×1080, foco continuo y zoom inicial 2× cuando el equipo los ofrece, con zoom
  ajustable, linterna, toque para enfocar y cambio de lente recordado en el equipo.
  Sin esas capacidades (iPhone) la lectura sigue igual. 9 pruebas del componente;
  suite 226 y navegador 38 aprobadas. Pendiente confirmar en el mismo celular.

## Publicación en producción — 18 de septiembre de 2026

- A pedido explícito del usuario, `main` avanzó a `bd42853` (inventario) y luego
  a `e74ad92` (importación desde Excel y restricción de duración en reservas).
  Vercel publica `main` en https://turnero-fosa.vercel.app.
- Migración aplicada en producción por `prebuild`: `20260915150000_shop_inventory`.
- En producción: `/internal/login` responde 200, `/internal/shop/inventory` redirige
  al acceso sin sesión y la plantilla pública se descarga (200, 12 KB, `.xlsx`).
- Verificación posterior en PostgreSQL 17 local (Docker): **24 archivos, 206
  pruebas aprobadas** y **28 pruebas de navegador aprobadas** en Chromium de
  escritorio y emulación Pixel 5, incluidas las de inventario e importación.
- Los recorridos internos devolvían 404 en el servidor de desarrollo por caché
  desactualizada de Turbopack; se resolvió borrando `.next`. No afecta producción.
- ESLint ahora ignora `.vercel/**`, carpeta local ignorada por Git; `pnpm lint`
  queda limpio sin modificar `load-shop-demo.cjs`.
- No se cargaron datos ni se hicieron operaciones en la base de producción.

## SKU automático — 18 de septiembre de 2026

- Alta manual e importación admiten SKU vacío. Los SKU escritos se conservan
  normalizados; reimportar filas sin cambios, incluso reordenadas, mantiene su código.
- 38 pruebas de lectura, servicio y acciones aprobadas; 19 pruebas de PostgreSQL
  aprobadas. La prueba de lectura ampliada para reordenamiento pasó posteriormente
  junto con las otras seis pruebas del archivo.
- TypeScript correcto. Recorrido de importación aprobado en Chromium de escritorio
  y emulación Pixel 5: descarga real, fila inválida, alta sin SKU, precio/stock y
  rechazo de reimportación sin movimientos duplicados.
- El primer intento de escritorio venció a los cinco segundos durante el ingreso.
  Se amplió la espera de la agenda a treinta segundos; ambos recorridos pasaron.
- Se utilizó la base temporal `turnero_import_test` en `127.0.0.1:5432`.
  No se desplegó ni se ejecutó nuevamente la suite general.

## Importación Excel — 17 de septiembre de 2026

- Lectura de la plantilla pública real y conservación de códigos como texto.
- Correcciones verificadas: incompatibilidad de prefijos XML de la plantilla,
  doble conversión de ARS a centavos, filas omitidas después de espacios vacíos
  y límite de subida distinto al anunciado en pantalla.
- Archivos de hasta 3 MB y 1.000 productos. Altas por lotes y auditoría en la misma
  transacción; duplicados dentro del archivo, contra inventario y concurrentes
  rechazados sin duplicar stock. Fallo de auditoría revierte todas las altas.
- Suite final completa: **24 archivos, 198 pruebas aprobadas**. Incluye 18 pruebas
  de inventario con PostgreSQL y la importación efectiva de 1.000 productos.
- Navegador: **8 pruebas aprobadas** en Chromium de escritorio y emulación Pixel 5.
  El nuevo recorrido descarga la plantilla, carga una fila inválida, muestra su
  número real, importa la versión corregida, verifica precio y stock persistidos
  y rechaza reimportarla. Capturas de ambos tamaños revisadas, sin desborde horizontal.
- TypeScript y compilación Next.js correctos. ESLint correcto excluyendo `.vercel/**`,
  carpeta local ignorada por Git cuyo archivo previo `load-shop-demo.cjs` genera dos
  errores por uso de `require`. No se modificó ese archivo ajeno a la importación.
- Entorno: PostgreSQL temporal 18.4 en `127.0.0.1:55439/turnero_import_test`, con
  migraciones y configuración inicial aplicadas sólo allí. Se utilizó porque Docker
  no pudo iniciar. El entorno habitual del proyecto utiliza PostgreSQL 17.
- La plantilla se inspeccionó y se revisó visualmente. La corrección sólo cambia
  la representación del namespace XML, conservando valores, formato y validaciones.
- No se ejecutaron los demás recorridos E2E ajenos al inventario ni un despliegue.
  La base temporal se detuvo al finalizar. No se modificaron datos reales.

Contrato: [importación desde Excel](inventory-excel-import.md).

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
- Esta verificación no incluyó despliegue; la publicación posterior en producción figura al inicio del documento.
