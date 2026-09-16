# Diseño

## Clientes frecuentes y descuento por efectivo

Reutilizar `Customer` y agregar metadatos de elegibilidad con auditoría, sin asumir que el teléfono existente es único. Proponer gestión manual inicial por personal interno y regla porcentual configurable. Almacenar método de pago explícito; presencial no equivale a efectivo. Alcance confirmado exclusivamente sobre repuestos, excluyendo mano de obra y envío. Reglas de acumulación y pagos mixtos pendientes: propuesta inicial sin acumulación y con pago íntegro en efectivo.

Calcular importes en centavos en servidor, con redondeo determinista y reparto de descuentos por línea. Persistir subtotal, regla/porcentaje aplicado, base elegible, descuento y total en revisión de presupuesto y pedido. Al convertir copiar el descuento vigente condicionado al medio acordado, sin recalcularlo desde la configuración actual ni aplicarlo dos veces. Cambios de medio requieren revisión del total y aceptación; nunca cobrar un importe diferente sin mostrarlo. Reembolsar según importes pagados por línea.

Vincular clientes desde sesión interna verificada. No otorgar acceso a historial ni descuentos de una ficha por un teléfono declarado en checkout público. Validar elegibilidad en servidor, conservar responsable y exponer en documentos sólo datos necesarios. Los presupuestos con beneficios condicionales explicitan el requisito de efectivo. Revisar reglas comerciales antes de activación; la tarea sigue en planificación.

## Arquitectura general

### Cuenta de cliente y autorización

El acceso de clientes es alcance confirmado. Propuesta: registro por correo/contraseña con verificación y recuperación mediante token temporal de un uso, expiración y controles de intentos. Seleccionar el método concreto antes de implementar; un proveedor social no está incluido automáticamente. Configurar entrega de mensajes de acceso antes de habilitar registro.

Hallazgo del código actual: `src/lib/auth.ts` considera interna una sesión si tiene id, username o email. Esa comprobación funciona sólo bajo la premisa actual de identidades exclusivamente internas y no debe reutilizarse sin cambios al abrir registro público. Antes de habilitar clientes, definir roles/personal explícitos desde el servidor y actualizar todas las páginas, acciones y controles internos. La migración identifica cuentas internas existentes; el registro público siempre crea clientes y no acepta roles enviados por el navegador.

Asociar la identidad autenticada a `Customer` mediante vínculo explícito único y verificado. Las lecturas/escrituras de turnos, motos, pedidos, presupuestos y archivos siempre se filtran por el propietario resuelto de la sesión, no por un customerId confiado del cliente. Separar identidad de acceso, contacto editable y datos históricos; verificar cambios de email y preservar titularidad. No unir registros antiguos por teléfono/correo declarado: usar proceso específico de verificación o resolución interna auditada, considerando duplicados heredados.

Portal propuesto `/account` con resumen, turnos, pedidos, presupuestos emitidos, datos/motos y beneficios. No exponer borradores ni notas del taller. El cliente puede conocer su elegibilidad, pero no editarla. Sesión cliente nunca equivale a rol interno. Las acciones de cancelar/reprogramar conservan configuración y validaciones existentes; mostrar historial no habilita funciones desactivadas. Compra/reserva de invitado queda pendiente de decisión y sus registros sólo se vinculan tras verificación.

Estado: diseño preliminar dentro de la planificación. Confirmados pagos en taller/Mercado Pago, retiro/envíos e inventario compartido. Vencimientos, cobertura/costo de envío y devoluciones pendientes de definición operativa.

Modelos propuestos: `ShopProduct`, `ShopOrder`, `ShopOrderItem`, `InventoryMovement`, `StockReservation`, `ShopPaymentAttempt` y datos de entrega/envío asociados al pedido. Los importes se almacenan en centavos; las líneas guardan nombre, SKU y precio al comprar. El total se calcula en el servidor e incluye el costo de envío acordado antes de generar un cobro.

Inventario único: stock físico, reservado y disponible (físico menos reservado). Cada movimiento guarda cantidad, origen, motivo, responsable y referencia al pedido/venta/reparación. Las ventas de mostrador y consumos en reparaciones usan la misma operación transaccional y no pueden consumir reservas ajenas.

Confirmar un pedido reserva unidades. Retirar o despachar consume la reserva y descuenta el físico una sola vez. Cancelar antes de la salida libera la reserva. Después de la salida, una devolución reintegra stock solamente al recibir mercadería apta para vender, independientemente de cuándo se reembolse el pago.

Transacción PostgreSQL con actualizaciones condicionales por stock/estado y orden estable de productos para evitar sobreventa e interbloqueos. Versión incremental de productos evita sobrescribir cambios concurrentes desde un formulario viejo. Clave UUID y huella SHA-256 de contenido implementan reintentos seguros.

Acciones internas protegidas por Auth.js existente. No exponer datos personales mediante códigos cortos de pedido; el diseño de confirmación/consulta pública usará un acceso no adivinable y datos mínimos. Dirección y contacto de envíos quedan restringidos al flujo autorizado del cliente y al personal interno.

Pagos en taller con registro de responsable y fecha. Mercado Pago mantiene intentos y referencias de pedidos separados de las señas existentes; evaluar reutilizar el adaptador de transporte sin compartir la lógica de negocio. Confirmaciones verificadas, procesamiento idempotente y conciliación de eventos tardíos/duplicados. Los parámetros de retorno del navegador no acreditan un pago.

Reservas sin pagar vencen según política configurable. Una transacción decide entre confirmación de pago y vencimiento; los pedidos pagados quedan excluidos del vencimiento automático. Si un pago llega tras liberar stock, se intenta reservar nuevamente y, si no hay disponibilidad, se deriva a resolución/reembolso. No habilitar cobros reales antes de probar este recorrido.

Estado de pago independiente de preparación y entrega. Envíos requieren cobertura y costo definidos antes de cobrar, y pago acreditado antes de despachar como regla propuesta. Primera integración logística pendiente de elegir: tarifa administrada, cotización manual previa o transportista. Guardar dirección, costo acordado y seguimiento como datos históricos del pedido.

Se reutilizan encabezado, tarjetas, inputs y colores del sistema. El catálogo comienza vacío hasta que el taller publique sus productos. Imágenes HTTPS opcionales; sin imágenes se muestra un símbolo de repuesto.

Requisito visual confirmado por el usuario: conservar la temática actual. Tokens existentes: fondo `#090D0B`, superficies `#101611` y `#172018`, verde principal `#8EE000`, variantes `#B8FF58` y `#73BD00`, texto `#F5F7F2`. Reutilizar los componentes compartidos y el degradado suave; evitar definir una segunda paleta para el shop. Reservar verde para acciones principales, selección y confirmación, y usar texto/iconos además del color para estados. Conservar legibilidad en tablas de inventario y controles grandes en el escáner/mostrador. Las pantallas externas de proveedores mantienen su propia identidad.

Navegación propuesta: `/internal/shop` (dashboard), `/internal/shop/inventory` (fichas, carga y movimientos), `/internal/shop/pos` (venta presencial), `/internal/shop/orders` (pedidos) y `/shop` (tienda pública). Todas las páginas y acciones internas exigen sesión. La estructura inicial de permisos reutiliza el acceso interno existente; permisos más específicos se definirán si el negocio los necesita.

Escaneo compartido entre inventario y mostrador: permiso de cámara a demanda, sin guardar imágenes, lector compatible con los códigos de producto elegidos y alternativa manual. Validar en Android/iPhone antes de elegir la implementación. Pausar la detección tras una lectura y requerir rearmado explícito para evitar lecturas repetidas del mismo objeto. Sólo confirmar una operación modifica existencias.

Guardar códigos como texto, preservando ceros iniciales. Separar identificadores internos de códigos del fabricante, normalizar equivalencias antes de asociar y garantizar una resolución inequívoca por presentación vendible. Un código desconocido abre vinculación/alta para personal autorizado. No usar datos externos inferidos como ficha comercial ni interpretar el código de una caja como una unidad suelta. Etiquetas internas imprimibles usan un identificador del taller, sin presentarlo como GTIN oficial.

Carga de inventario con borrador de varias líneas, revisión de cantidades y confirmación transaccional/idempotente. Guardar cantidad, motivo, responsable y referencia de cada entrada; los cambios de ficha y ajustes conservan control de concurrencia.

Venta presencial comparte pedidos e inventario con canal `COUNTER`, frente a `ONLINE`; los consumos en reparaciones son movimientos con referencia propia. Pago presencial con entrega inmediata registra venta, cobro y salida en una transacción. Un pago digital pendiente mantiene reserva y bloquea entrega. Reutilizar el pedido online al retirarlo/cobrarlo en mostrador. Definir la forma concreta de iniciar Mercado Pago presencial antes de implementar, sin asumir QR ni terminal física.

Dashboard: agregaciones del servidor con período y zona horaria del taller, importes cobrados y reembolsados separados, ventas por canal, pendientes por estado y alertas de disponibilidad. No mezclar señas de turnos ni consumo de reparaciones con ventas del shop. Contadores enlazan a listados con los mismos filtros para poder reconciliarlos.

Las reservas de turnos conservan sus invariantes actuales: horarios, pausas, capacidad, anticipación, ventana, cancelación y confirmación no cambian.

## Presupuestos

Fechas y validez confirmadas: propuesta de plazo inicial configurable de siete días, editable al emitir. Persistir fecha de emisión, días de validez, fecha de vencimiento y límite temporal exclusivo al inicio del día siguiente en la zona horaria del taller. Mostrar la fecha inclusive en pantalla/PDF; validar el límite en servidor al aceptar/convertir, sin depender del estado almacenado ni de la hora del celular. La regla de fecha de emisión + días calendario es una propuesta explícita. Cambiar la configuración no altera revisiones emitidas; renovar genera revisión nueva.

Sección propuesta `/internal/shop/quotes` con acceso desde dashboard y mostrador. Modelar presupuesto, revisiones y renglones con instantáneas de cliente, descripciones, precios, condiciones y vencimiento. Número legible único para referencia interna; archivos y datos personales accesibles sólo mediante autorización, sin publicar documentos con códigos adivinables.

## Ubicación y conteo de inventario

Confirmados por el usuario. Propuesta inicial: ubicación principal descriptiva por producto (sector/estante/cajón), visible sólo al personal, con búsqueda y filtro; no implica depósitos con saldos separados. Si se necesita distribuir un mismo producto entre varias ubicaciones con cantidades propias, definir ese alcance antes de modelarlo.

Modelar sesión de conteo y líneas con producto, cantidad física inicial, versión de inventario, cantidad contada nullable, responsable y fechas. Un nulo significa sin contar; cero es conteo explícito. El conteo compara físico total (incluidas unidades apartadas) y mantiene visibles las reservas. Borradores no modifican stock.

Aplicar sólo líneas revisadas en una operación transaccional e idempotente. Verificar versiones actuales: cambios concurrentes requieren revisión/reconteo y actualización explícita de la base de comparación antes de confirmar. No aplicar diferencias antiguas sobre existencias nuevas. Ajustar mediante movimientos con referencia al conteo, conservando valores antes/después; bloquear ajustes incompatibles con reservas y mostrar la discrepancia para resolución. Contar y ajustar exige sesión interna; no sustituir el historial por ediciones directas de stock.

## Revisiones y conversión de presupuestos

Borradores editables; revisiones emitidas inmutables. Registrar aceptación de una revisión concreta con responsable/fecha. Una revisión nueva invalida la aceptación anterior para futuras conversiones. Evaluar renglones de servicio/mano de obra separados de productos: si se aprueban, adaptar también las líneas de pedido y el cobro; únicamente los renglones de producto afectan inventario.

PDF generado desde la revisión persistida, con identidad y acentos verdes; impresión clara propuesta para legibilidad/ahorro de tinta. Generar/descargar un archivo no registra envío automático ni aceptación. No incluir imágenes de terceros no confiables ni datos privados en enlaces públicos por defecto.

Convertir con transacción y referencia única al presupuesto: verificar estado, revisión aceptada, vigencia, condiciones de entrega y stock; copiar importes aceptados, crear pedido y reservas, marcar convertido. Reintentos devuelven el mismo pedido. Un cambio de precio de catálogo no reemplaza el precio presupuestado vigente; cambios negociados requieren revisión y nueva aceptación. Propuesta: aceptación sin reserva, conversión con reserva. Si falta disponibilidad, no crear un pedido parcial involuntario.

Presupuestos no cuentan como ingresos. Un pedido convertido usa el mismo circuito de pagos/entregas y movimientos que una venta normal. Si sus repuestos se usan en una reparación, consumir la reserva del pedido con referencia a la reparación, evitando otra salida independiente al entregar la moto; este recorrido se detallará sólo si se incluye mano de obra. No convertir presupuestos en turnos automáticamente.
