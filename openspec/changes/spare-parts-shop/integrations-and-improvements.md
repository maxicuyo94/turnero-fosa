# Integraciones y mejoras propuestas

Estado: recomendaciones para revisar durante la planificación. Mantener la paleta actual está confirmado; las integraciones nuevas y ampliaciones siguientes quedan propuestas. Fuentes consultadas el 15 de septiembre de 2026; verificar requisitos de cuenta y disponibilidad concreta antes de implementar.

## Identidad visual confirmada

| Uso | Color existente |
|---|---|
| Fondo principal | Carbón `#090D0B` |
| Superficies | `#101611` / `#172018` |
| Botones principales y selección | Verde manzana `#8EE000` |
| Interacción y variantes verdes | `#B8FF58` / `#73BD00` |
| Texto principal | Blanco suave `#F5F7F2` |

Aplicar los mismos componentes, bordes, tarjetas y degradado del sitio a todas las pantallas nuevas. Dashboard con indicadores legibles; inventario con tablas y filtros; mostrador con búsqueda/escaneo y carrito visible. Adaptar cada recorrido al celular. Alertas con texto e iconos, sin depender exclusivamente del color. El checkout externo de Mercado Pago conserva la identidad del proveedor.

## Integraciones candidatas

### 1. Mercado Pago online y QR para mostrador

El pago por Mercado Pago está confirmado. Propuesta concreta: Checkout Pro para la tienda y evaluar QR dinámico por venta para el mostrador. La integración QR permite asociar importe y operación, consultar estados y generar un código por transacción; requiere configurar sucursal/caja e integración específica. La integración de señas existente no equivale a tener este recorrido listo. Point es otra alternativa si el taller ya dispone de equipo compatible; verificar el modelo antes de elegirla.

Fuentes: [Soluciones de Mercado Pago](https://www.mercadopago.com.ar/developers/es/docs/getting-started), [Procesamiento con QR](https://www.mercadopago.com.ar/developers/es/docs/qr-code/payment-processing).

Prioridad recomendada: primera versión para Mercado Pago; elegir QR o alternativa presencial durante el diseño de cobros.

### 2. Correo Argentino / MiCorreo

Evaluar la integración para generar envíos y rótulos; revisar los servicios de cotización y seguimiento habilitados para la cuenta elegida. La documentación oficial indica que las credenciales API se gestionan con un ejecutivo comercial. Antes de comprometer el cálculo automático, confirmar acceso, modalidad, cobertura y datos requeridos de peso/medidas.

Fuente: [Preguntas frecuentes de MiCorreo](https://www.correoargentino.com.ar/MiCorreo/public/faqs).

Prioridad recomendada: resolver el proveedor durante la primera versión, porque envíos está confirmado. Si se eligen tarifas administradas y despacho manual, mantener el costo aceptado antes de cobrar.

### 3. WhatsApp y avisos de pedido

Proponer primero acceso al chat desde el pedido para que el personal contacte al cliente. Evaluar después notificaciones automáticas de pedido listo o despachado mediante WhatsApp Business Platform; definir alta, consentimiento, plantillas y costos al seleccionar la solución. Abrir un chat no envía automáticamente un mensaje. Evaluar también ampliar el módulo de email ya presente en el proyecto para confirmaciones del shop, una vez configurado su remitente.

Fuentes: [Click-to-chat](https://faq.whatsapp.com/5913398998672934/), [WhatsApp Business Platform](https://whatsappbusiness.com/products/business-platform/).

Prioridad recomendada: contacto manual al inicio; automatizaciones como ampliación elegida explícitamente.

### 4. Facturación electrónica ARCA

Evaluar emisión de comprobantes fiscales desde la venta mediante los servicios de facturación electrónica o un sistema de facturación que ya use el taller. Definir configuración fiscal con los datos y asesoramiento contable del negocio. La constancia interna del mostrador no sustituye una factura fiscal.

Fuente: [Webservices de factura electrónica de ARCA](https://www.arca.gob.ar/ws/documentacion/ws-factura-electronica.asp).

Prioridad: definir cómo facturará el negocio antes de operar; automatizar la integración en una etapa elegida según su sistema actual. No cambiar automáticamente el alcance ya acordado de la primera versión.

## Mejoras del producto para priorizar

1. **Ubicación física por repuesto — confirmado:** sector/estante/cajón para encontrarlo después de escanear o buscar; incorporado a la primera versión.
2. **Conteo de stock con celular — confirmado:** abrir un conteo, registrar cantidades y revisar diferencias antes de generar ajustes. Detectar movimientos ocurridos durante el conteo para no sobrescribir ventas recientes. Incorporado a la primera versión; detalle en `tasks.md`.
3. **Importación y exportación de planillas:** cargar catálogo/precios iniciales mediante archivo, con vista previa y validación de duplicados; exportar ventas y movimientos. Ampliación pendiente de elegir.
4. **Cierre de caja:** saldo inicial, cobros por medio, retiros/ingresos y diferencia al cierre. Separar efectivo de cobros digitales; es un módulo adicional al dashboard.
5. **Permisos por función:** administración, mostrador y mecánica, conservando responsable e historial de cambios.
6. **Costos y reposición:** último costo, proveedor y sugerencias por stock mínimo. Mostrar margen sólo después de definir costos, gastos y tratamiento de devoluciones; no inferir ganancia desde ventas cobradas.
7. **Lector e impresora de mostrador:** mantener captura por teclado para lectores compatibles y evaluar impresora de tickets/etiquetas con el hardware real. No asumir impresión Bluetooth directa desde cualquier navegador.

## Recomendación de secuencia

Mantener primero el alcance confirmado: cuentas de clientes con consulta de turnos propios, inventario compartido, ubicación física, conteo y escaneo, mostrador, presupuestos con fechas/validez, clientes frecuentes con descuento por efectivo sólo sobre repuestos, dashboard, tienda/carrito, Mercado Pago y envíos. Elegir el mecanismo de facturación según la operación actual. Incorporar caja, planillas, costos y automatizaciones cuando el usuario decida incluirlas.
