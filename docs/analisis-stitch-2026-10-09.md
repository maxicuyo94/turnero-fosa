# Revisión de Taller Express con Google Stitch

Fecha: 9 de octubre de 2026. Estado revisado: código y cambios locales de este proyecto.

## Resultado

La aplicación ya reúne una base funcional de turnos y venta de repuestos. El principal problema de diseño es que la portada sigue presentando principalmente un turnero: la tienda aparece después de un bloque grande destinado al personal. El catálogo y la compra tienen funciones útiles, pero necesitan una presentación más compacta en celular y mejores herramientas de seguimiento y gestión de pedidos.

La propuesta visual existente en Stitch sirve como referencia de composición, fotografías y jerarquía. Necesita una adaptación considerable al negocio real: taller y repuestera local, español argentino, precios ARS y envío únicamente en Salta capital. Sus ejemplos de concesionaria internacional no deben convertirse directamente en contenido comercial.

## Cómo se hizo la revisión

- Se accedió a Google Stitch mediante la sesión de Chrome y se examinó el proyecto [Motorcycle Ecommerce Home Page](https://stitch.withgoogle.com/projects/595898897177555314).
- Se solicitó una auditoría escrita a Stitch con el mapa de funciones y la descripción de las pantallas reales. Se envió una segunda consulta para corregir inferencias que no coincidían con el código.
- Se revisaron rutas, componentes compartidos, módulos de turnos, agenda, unidades, configuración, inventario, conteos, catálogo, carrito, pedidos y pagos, además de documentación y pruebas.
- Se inspeccionaron el inicio y catálogo en navegador y se recorrió la compra en un tamaño móvil de 390 × 844. Se usaron productos demo y datos ficticios, sin confirmar un pedido ni realizar un pago.
- Se ejecutaron los controles de tipos, estilo y las 340 pruebas del proyecto unitario. Los módulos internos se revisaron por código; no se inició una sesión de personal ni se ejecutó nuevamente toda la suite de integración o E2E.

Stitch recibió una descripción funcional, no acceso al repositorio ni a la base de datos. Sus respuestas son recomendaciones de diseño; este informe conserva solo las conclusiones contrastadas y señala las hipótesis. No certifica producción ni constituye una auditoría exhaustiva de seguridad.

## Mapa general del proyecto

| Área | Base existente | Evaluación y siguiente mejora |
| --- | --- | --- |
| Inicio | Accesos a reservar, consultar turno, repuestos y panel | Reequilibrar las dos necesidades del cliente: reservar y comprar. |
| Reserva pública | Servicio, fecha, horarios disponibles, contacto, resultado y política de seña | Mantener reserva sin cuenta y disponibilidad real. El resumen y las opciones de horario deben seguir siendo claros en celular. |
| Consulta, cancelación y seña | Consulta por código, recuperación de código de turno, cancelación según política y pago | Mantener diferencias entre pendiente, confirmado, cancelado y pago. La recuperación de turnos no equivale a recuperación de pedidos de tienda. |
| Agenda interna | Día/semana, navegación, detalle, reprogramación, capacidad y advertencias | Preservar contexto y acciones frecuentes; evaluar visualmente la semana móvil con el personal antes de rediseñarla. |
| Unidades | Búsqueda e historial asociado a cada unidad | Buena separación del seguimiento de turnos. Facilitar el acceso desde agenda; no mezclar estas unidades con modelos de compatibilidad del catálogo. |
| Configuración | Horarios, feriados, catálogo de servicios y políticas, con permisos de administrador | Mantener una fuente de verdad para políticas y contacto. Revisar datos comerciales de ejemplo antes de abrir ventas. |
| Cuenta y acceso | ADMIN/STAFF, validación de usuario vigente y versión de sesión | Conservar permisos y acceso discreto en la web pública. No agregar una cuenta obligatoria al comprador. |
| Inventario | Productos, movimientos, disponibilidad, mínimo, Excel y detalle | Añadir una vista de preparación comercial: publicado, foto, descripción y compatibilidades completas. |
| Escaneo, etiquetas y conteos | Herramientas para operación física y diferencias de stock | Mantener uso móvil y trazabilidad; distinguir stock físico, reservado y disponible en todas las pantallas. |
| Tienda pública | Búsqueda, categorías, filtros de moto/año, stock, orden y ficha | Compactar cabecera móvil, mejorar fotos y hacer más visible la búsqueda por compatibilidad. |
| Carrito y compra | Persistencia, cantidades, cobertura, datos y revisión en tres pasos | Conservar el flujo existente. Reforzar errores recuperables y el aviso sobre conservación del enlace del pedido. |
| Pedidos internos | Pago, retiro, despacho, entrega e historial | Añadir búsqueda, filtros, paginación y acciones específicas. El resumen de inventario aún no es un tablero de ventas. |
| Pagos y tareas periódicas | Mercado Pago, validaciones, reservas y conciliación | La preparación comercial requiere prueba del proveedor y programación de conciliación; el diseño no reemplaza esas verificaciones. |

## Hallazgos priorizados

P1: resolver antes de abrir o ampliar el flujo afectado. P2: siguiente mejora de producto. P3: mejora posterior. Las prioridades de crecimiento dependen del volumen real.

| Prioridad | Hallazgo y evidencia | Propuesta concreta |
| --- | --- | --- |
| P1 al abrir ventas | El acceso a la compra depende del enlace privado. Existe copia del enlace, pero no email de confirmación ni recuperación digital por código REP. El recuerdo del último pedido usa sessionStorage, hasta 24 horas; cerrar la sesión/pestaña puede perderlo antes. | Dar protagonismo a guardar el enlace y explicar que REP es referencia para el taller. Incorporar después envío privado del enlace o recuperación autenticada, sin convertir el código público en una credencial. |
| P1 al abrir ventas | Pagos aún deshabilitados en el entorno local. Hay avisos correctos y el botón final de compra está bloqueado. La documentación registra pendientes de configuración comercial y scheduler externo. | Verificar productos reales, retiro, costo/cobertura, Mercado Pago y conciliación antes de habilitar compras. No presentar pago por transferencia o al retirar como funciones existentes. |
| P1 cuando crezca el historial | Pedidos consulta solo los últimos 100 registros, sin búsqueda ni paginación. Un pedido anterior puede quedar fuera aunque todavía requiera atención. | Consultar por código y estado en servidor, ofrecer páginas y priorizar pedidos con acción pendiente. Filtrar solo las 100 tarjetas ya cargadas no soluciona el problema. |
| P2, principal mejora visual | El inicio da una tarjeta destacada al acceso del personal, mientras repuestos queda debajo. La descripción principal habla solamente de turnos. | Portada con dos accesos principales: Reservar turno y Ver repuestos; consulta de turno secundaria y acceso del personal discreto. |
| P2, principal mejora móvil | En 390 × 844, título, explicación, beneficios, aviso y filtros llenan la primera pantalla del catálogo; todavía no se ve una tarjeta de producto. | Acortar cabecera y espacios, reunir beneficios en una línea y mantener búsqueda visible. Abrir filtros secundarios bajo demanda. Conservar aviso de pagos y cobertura legibles. |
| P2, carga comercial | Los 12 productos demo locales aparecen con Foto pendiente. Las fotos ya están soportadas. | Cargar fotografías reales, claras y uniformes; mantener un reemplazo honesto para faltantes. Es trabajo de contenido, no requiere generar otro sistema de imágenes. |
| P2 | Buscar por mi moto está colapsado y combina marca/modelo/versión en un selector. Al aumentar modelos, la selección se vuelve larga. | Destacar el acceso y evaluar selectores dependientes de marca, modelo y versión, con año opcional. Usar solo compatibilidades registradas; conservar filtros al volver desde la ficha. |
| P2 al superar 1.000 publicados | La consulta pública toma hasta 1.000 productos ordenados por nombre; los filtros se aplican después en el navegador. Productos fuera de ese conjunto no aparecen en búsqueda ni categorías. | Filtrar y paginar en servidor, con conteo correcto y filtros en URL. No limitarse a aumentar el máximo ni paginar el subconjunto cargado. |
| P2 | Cada pedido se opera con un selector y el botón genérico Aplicar. La lista obliga a recorrer tarjetas. | Botones contextuales Verificar pago, Marcar listo, Confirmar despacho y Confirmar entrega, conservando las transiciones y los permisos actuales. |
| P2 | La tarjeta pública resume compatibilidad desde el texto libre; si solo hay compatibilidades estructuradas, puede mostrar una invitación genérica a consultar la ficha. | Resumir los modelos registrados o la coincidencia con el filtro elegido. Evitar la etiqueta de compatibilidad certificada. |
| P2, robustez | saveCart absorbe errores de localStorage y Agregar comunica éxito sin comprobar que se guardó. Es un escenario identificado en código, no reproducido en navegador. | Devolver un resultado de guardado y mostrar aviso si falla; decidir una alternativa temporal en memoria. Reproducir con almacenamiento bloqueado antes de implementar. |
| P3, calidad | Una prueba de foco de error de compra falló en la suite completa; al repetir sus 6 casos aislados pasaron todos. | Investigar temporización y aislamiento. No afirmar un error real del comprador ni que la suite completa pasó. |
| P3 | El resumen interno muestra inventario, stock y mínimos, sin indicadores de ventas. | Incorporar pendientes de preparar y pedidos pagados por período. Distinguir pagos cobrados de mercadería efectivamente retirada/despachada; no mostrar ingresos como beneficio. |
| P3 | Título y descripción globales siguen centrados en turnos. | Adaptar metadatos del inicio a taller y repuestos y preparar contenido de difusión usando datos reales. |

Fuentes principales: `app/page.tsx`, `app/layout.tsx`, `src/modules/shop/storefront-screen.tsx`, `storefront-components.tsx`, `storefront-queries.ts`, `checkout-screen.tsx`, `shop-customer-state.ts`, `cart-storage.ts`, `store-management-screen.tsx`, `inventory-queries.ts` y `order-service.ts`.

## Propuesta de inicio

1. Encabezado compacto con marca, Turnos, Repuestos y acceso discreto al personal.
2. Presentación breve: **Tu taller y tus repuestos, en un mismo lugar.** Explicación de reserva sin cuenta y catálogo del taller.
3. Dos bloques principales de jerarquía comparable: **Reservar turno** y **Ver repuestos**. Mantener **Consultar mi turno** como acción secundaria.
4. Categorías reales de repuestos y una pequeña selección de productos publicados con foto, precio y disponibilidad. Llamarlos Destacados si la selección es editorial; no Más vendidos sin datos.
5. Retiro y envío según configuración vigente, datos reales del taller y consulta de compatibilidad.

En móvil los dos destinos deben entenderse pronto, sin una portada fotográfica tan alta que esconda las acciones. Las fotos pueden apoyar la identidad; no deben sugerir venta de motocicletas completas. Si los pagos están deshabilitados, el texto invita a explorar, sin prometer una compra disponible.

Conservar Arial y los tokens existentes: fondos `#090d0b`/`#101611`, acción `#8ee000`, hover y foco `#b8ff58`. No hay motivo comprobado para cambiar toda la identidad visual.

## Propuesta de catálogo, ficha y compra

**Catálogo:** búsqueda visible, acceso claro a Mi moto, número de resultados y filtros activos. Mantener tarjetas horizontales en celular y grilla en escritorio; la mejora principal está en el espacio anterior al catálogo. Foto, nombre, marca, compatibilidad, precio y stock preceden al código. El SKU sigue disponible para mecánicos. Conservar la opción de mostrar agotados: puede servir para identificar una pieza, sin permitir comprarla.

**Ficha:** foto principal y miniaturas manejables, nombre/precio/disponibilidad próximos al botón, compatibilidades registradas por modelo y año, descripción y consulta al taller con la referencia precargada. No inventar prestaciones, material, certificación o disponibilidad del fabricante. Verificar que las fotos representen la pieza real y su presentación por unidad, par o kit.

**Compra:** mantener Carrito → Entrega y datos → Revisar y pagar. Ya hay validación de cobertura antes del contacto, edición de cantidades, revisión de datos, total y acciones fijas en móvil. Mejorar comunicación de error con una acción que resuelva el caso: corregir datos, actualizar precios/stock o reintentar. Revisar persistencia si el almacenamiento falla.

**Pedido:** separar claramente Pedido registrado de Pago acreditado. Junto al código, explicar el siguiente paso, conservación del enlace, importe y entrega. Existe Copiar enlace de mi pedido con feedback; reforzar visibilidad y aviso, no reconstruirlo. Un email privado de confirmación sería una extensión útil; no está implementado actualmente.

## Ventas y estados que el diseño debe respetar

| Operación | Secuencia principal | Stock físico |
| --- | --- | --- |
| Crear pedido | Esperando pago, reserva de 30 minutos | Reserva disponibilidad; no descuenta stock físico. |
| Acreditar pago | Pago acreditado tras verificación del proveedor | Conserva reserva. |
| Retiro | Pago acreditado → Listo para retirar → Entregado; también se admite retiro directo desde pagado | Descuenta una vez al confirmar retiro. |
| Envío | Pago acreditado → Enviado → Entregado | Descuenta una vez al confirmar despacho; entrega no descuenta nuevamente. |
| Vencer o cancelar sin pago | Vencido/Cancelado después de las comprobaciones correspondientes | Libera reserva. |
| Pago tardío/adicional, devolución o contracargo | Pago en revisión | Requiere revisión; no devuelve automáticamente mercadería ya despachada. |

Separar visualmente retiros pendientes, envíos por despachar y pagos en revisión. Búsqueda inicial por código de pedido y fechas; añadir búsqueda de contacto con una estrategia compatible con el cifrado de esos campos, sin intentar un filtro SQL de texto sobre valores cifrados.

Mostrar en cada fila código, fecha, cliente, entrega, importe, estado y acción relevante. Ofrecer detalles/historial al abrirla. En móvil usar tarjetas compactas; en escritorio puede convenir una tabla. El panel necesita recuperar todo el historial, no simplemente ocultar tarjetas mediante filtros.

## Qué tomar y qué corregir en Stitch

| Tomar como referencia | Adaptación necesaria |
| --- | --- |
| Fotografías de componentes, composición y categorías | Usar repuestos reales, marca Taller Express y categorías existentes. |
| Buscador por moto | Conectarlo con los modelos/compatibilidades registrados, sin listas ficticias. |
| Precio y acción destacados | ARS y español rioplatense; conservar decimales cuando existan, sin redondear precios por estética. |
| Ficha con información técnica organizada | Mostrar únicamente especificaciones disponibles y comprobadas. |
| Accesos comerciales claros | No copiar descuentos, favoritos, cuenta, newsletter ni mayoristas como si existieran. |

Las maquetas incluyen variantes antiguas de motos completas, inglés, formato extranjero de precios, envío global/gratis, plazos y VERIFIED FIT. Son diferencias de las maquetas, no fallos existentes del catálogo real.

La segunda respuesta de Stitch mejoró el diagnóstico, pero todavía necesita criterio: menciona el producto por encima del ID 1.000 aunque el corte real es por nombre; presenta 339/340 como fortaleza sin cerrar el fallo; mezcla seña con pago de repuestos y propone tamaños exactos no medidos. La tienda cobra el pedido completo, las medidas de rediseño son propuestas y el resultado de pruebas debe informarse con su fallo inicial.

## Plan de tres entregas

| Entrega | Desarrollo | Contenido y operación | Aceptación |
| --- | --- | --- | --- |
| 1. Inicio y catálogo móvil | Equilibrar reservar/comprar; reducir bloque de personal; compactar cabecera y filtros; preservar tokens y navegación. | Elegir fotos y categorías reales; revisar contacto y copy. | En 390 × 844 se entiende la tienda y se ve al menos el comienzo del primer producto sin desplazarse. Controles de 44 px, sin desbordamiento; reserva/consulta siguen accesibles. |
| 2. Catálogo y acceso al pedido | Mejorar selector de moto y resumen de compatibilidad; filtro/paginación servidor; manejo de fallos de guardado; aviso destacado para conservar enlace. | Completar fotos y compatibilidades; definir canal privado de recuperación si se amplía el alcance. | Buscar un producto fuera del primer millar funciona; volver desde ficha conserva filtros; agotados no se pueden comprar; guardar enlace tiene feedback claro. |
| 3. Operación de ventas | Búsqueda/paginación/estados de pedidos; acciones contextuales; indicadores sencillos; investigar prueba intermitente. | Configurar conciliación, retiro y logística; realizar prueba del proveedor antes de habilitar compras. | Un pedido anterior a los últimos 100 se recupera; ADMIN/STAFF conservan permisos; doble operación no duplica descuento; errores y revisión de pago no permiten entrega incorrecta. |

La apertura comercial también necesita cerrar los pendientes de pago y conciliación aunque la presentación visual esté terminada. No habilitarla por el solo hecho de completar las tres entregas de diseño.

## Verificación de esta revisión

| Control | Resultado |
| --- | --- |
| `pnpm typecheck` | Correcto. |
| `pnpm lint` | Correcto. |
| Suite unitaria, un trabajador | 47 archivos, 340 casos: 339 pasaron y 1 falló en foco del error de compra. |
| Repetición de `shop-purchase-ui.test.tsx` | 6 de 6 pasaron. La causa del fallo inicial sigue sin determinar. |
| Navegador local | Inicio y catálogo; búsqueda Filtro de aceite, agregar, carrito, envío, cobertura inválida y válida, datos ficticios y revisión. |
| Móvil | 390 × 844; sin desbordamiento horizontal en catálogo y revisión. Botón final bloqueado por pagos no activos. |
| Cambios durante el recorrido | Se retiró el producto de prueba del carrito al terminar. No se creó un pedido ni se efectuó un pago. |

Evidencia: [revisión de compra móvil](stitch-2026-10-09/checkout-mobile.jpg). La imagen contiene datos ficticios de la revisión.

Esta entrega agrega el informe y evidencia. No implementa el rediseño, no cambia las funciones de la aplicación y no publica la tienda.
