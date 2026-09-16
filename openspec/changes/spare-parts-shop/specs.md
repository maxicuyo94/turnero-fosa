# Requisitos

- El descuento por efectivo MUST aplicarse exclusivamente a repuestos. Given una venta con repuestos, mano de obra y envío, When un frecuente paga en efectivo, Then sólo los renglones de repuestos integran la base del descuento.
- El sistema MUST ofrecer acceso de clientes y consulta de turnos propios. Given una sesión de cliente, When abre Mi cuenta, Then sólo ve los turnos vinculados de forma verificada a su ficha.
- Las páginas y acciones internas MUST exigir rol explícito de personal validado en servidor. Given una cuenta pública registrada, When intenta usar inventario/agenda interna o enviar un rol interno, Then se deniega el acceso.
- El portal MUST verificar propiedad en cada lectura/escritura de turnos, pedidos, presupuestos, motos y archivos. Given el identificador de otro cliente, When se solicita desde una cuenta distinta, Then se deniega sin divulgar contenido.
- Vincular historial previo MUST requerir verificación específica o revisión interna auditada. Given coincidencia de nombre/teléfono/correo declarado, When un usuario se registra, Then no adquiere automáticamente esos registros.
- Consultar turnos desde cuenta MUST respetar las políticas existentes de cancelación/reprogramación. Given cancelación online deshabilitada, When el cliente inicia sesión, Then esa acción sigue deshabilitada.

- El panel MUST permitir identificar clientes frecuentes y configurar su descuento por efectivo. Given una venta presencial por transferencia o Mercado Pago, When se calcula el total, Then no se activa el beneficio exclusivo de efectivo.
- El servidor MUST validar elegibilidad y calcular el descuento. Given un teléfono ajeno declarado en checkout público, When se solicita un beneficio, Then no se concede acceso a la ficha ni elegibilidad automática.
- El presupuesto MUST guardar importe/regla/condición del descuento. Given una revisión aceptada vigente, When se convierte manteniendo la condición de efectivo, Then se conserva el descuento una sola vez aunque haya cambiado la configuración.
- Cambiar el medio de pago MUST presentar el total y las condiciones resultantes antes de confirmar. Given un presupuesto condicionado a efectivo, When el cliente elige Mercado Pago, Then no se conserva el beneficio de efectivo ni se cobra silenciosamente un importe nuevo.

Estado: implementación autorizada por entregables. E1 cubre inventario interno; los requisitos restantes guían entregas futuras y conservan las decisiones operativas pendientes. Ver `deliverables.md`.

- El catálogo MUST mostrar solamente productos publicados, con precio, categoría, marca, compatibilidad y disponibilidad. Given un producto oculto, When un visitante busca, Then no se muestra ni se permite pedirlo.
- El carrito MUST permitir agregar, cambiar cantidades y quitar productos, persistiendo en el navegador. Given un producto agotado, When se muestra, Then agregar está deshabilitado.
- El servidor MUST validar cantidades, datos de contacto y precios vigentes. Given un cambio de precio, When se confirma, Then se pide actualizar el catálogo antes de confirmar.
- Los pedidos MUST reservar stock en una única transacción. Given dos compras de la última unidad, When se confirman concurrentemente, Then solamente una puede reservarla.
- Reintentar el mismo pedido MUST devolver el mismo código sin volver a descontar unidades. Given una clave usada para otro contenido, Then se rechaza.
- La administración MUST exigir sesión interna tanto en páginas como en acciones. MUST permitir crear/editar productos y publicar/ocultar sin eliminar historial.
- El inventario MUST ser común a tienda, mostrador y reparaciones. Given una unidad reservada online, When se intenta consumirla en una reparación o venderla en mostrador, Then se rechaza la salida si no hay otras unidades disponibles.
- Toda entrada, salida, reserva, liberación o ajuste MUST dejar historial y referencia de origen. Given un consumo en una reparación, When se registra, Then disminuye la disponibilidad pública.
- Pago y entrega MUST tener estados independientes. Given un pedido listo, When se consulta su estado, Then no se considera pagado sin registro de cobro.
- Mercado Pago MUST acreditar pagos sólo mediante información verificada del proveedor. Given un retorno del navegador o aviso duplicado, When se procesa, Then no se duplica el cobro registrado ni el movimiento de stock.
- El servidor MUST validar importe, moneda y referencia del pedido al acreditar el pago. Given un importe distinto, When llega la confirmación, Then se deriva a revisión sin habilitar el despacho.
- Un pedido MUST reservar al confirmar y descontar físico al retirar o despachar exactamente una vez. Given un envío despachado, When se marca entregado, Then no hay otra salida de stock.
- Cancelar antes de la salida MUST liberar unidades reservadas exactamente una vez. Given una devolución después de despachar, When se reembolsa, Then no se agrega stock hasta registrar recepción de mercadería apta.
- El checkout MUST admitir retiro y envío con cobertura/costo validados. Given un costo de envío aún no definido, When se intenta pagar, Then se exige definir y aceptar el total antes de cobrar.
- La propuesta de despacho MUST exigir pago acreditado. Given un pago pendiente, When se intenta despachar, Then se bloquea la salida hasta registrar el cobro.
- Los pedidos pagados MUST quedar fuera del vencimiento automático. Given un pago acreditado tras vencer la reserva, When no hay stock para reservar nuevamente, Then el pedido queda para resolución/reembolso sin prometer disponibilidad.
- Cambios de stock concurrentes MUST invalidar una edición de producto desactualizada.
- El panel MUST ofrecer dashboard, carga de inventario y venta de mostrador en páginas diferenciadas con navegación común. Given un usuario sin sesión, When intenta acceder o ejecutar una acción, Then se bloquea el acceso.
- Inventario y mostrador MUST permitir escanear desde celular y buscar manualmente. Given una cámara denegada/no disponible, When se utiliza la pantalla, Then se conserva la búsqueda por código o nombre.
- Una lectura MUST identificar sin modificar stock. Given la cámara apuntando al mismo código durante varios cuadros, When se detecta, Then se presenta una sola selección hasta rearmar la lectura.
- Un código MUST resolver un solo producto/presentación. Given un código desconocido, When se escanea, Then se ofrece alta o vinculación sin inventar descripción, precio ni existencias.
- Una carga de inventario MUST admitir revisión de cantidades y confirmación idempotente. Given una carga confirmada, When se reintenta la misma solicitud, Then no se repiten las entradas.
- La venta presencial MUST compartir validación de stock con la tienda online. Given dos canales intentando vender la última unidad, When confirman, Then sólo una operación obtiene esa unidad.
- El mostrador MUST permitir cobrar/entregar un pedido online existente. Given un pedido con reserva, When el cliente lo retira, Then se utiliza la misma venta y se descuenta físico una sola vez.
- Los indicadores MUST derivarse de datos reales y permitir consultar su detalle. Given pedidos sin pagar y consumos de reparación, When se calcula lo cobrado en el shop, Then no se incluyen como ingresos.
- El panel MUST permitir generar presupuestos con cliente, renglones, importes, número y vigencia, y una versión imprimible/PDF. Given una revisión emitida, When cambia el precio del catálogo, Then el documento mantiene los precios emitidos.
- Editar un presupuesto emitido MUST generar una revisión nueva con nueva aceptación antes de convertir. Given una revisión anterior aceptada, When se modifica, Then esa aceptación no autoriza el contenido nuevo.
- Según la política propuesta, presupuestar o registrar aceptación MUST NOT modificar inventario ni ingresos. Given un presupuesto aceptado, When aún no se convierte, Then no se reserva mercadería.
- Convertir MUST verificar aceptación, vigencia y disponibilidad, y preservar precios acordados. Given falta de stock o vencimiento, When se intenta convertir, Then se solicita resolver/revalidar antes de crear el pedido.
- La conversión MUST ser atómica e idempotente. Given dos conversiones concurrentes del mismo presupuesto, When se procesan, Then existe un único pedido y una sola reserva.
- Si se aprueba mano de obra, sus renglones MUST estar separados de productos y MUST NOT descontar stock. Given un presupuesto mixto, When se convierte, Then sólo los repuestos generan reservas.
- El presupuesto MUST mostrar emisión, plazo y vencimiento en pantalla/PDF. Given siete días configurados, When se emite, Then se calcula y guarda la fecha límite según la regla de calendario acordada; cambios posteriores de configuración no alteran esa revisión.
- El vencimiento MUST verificarse en servidor. Given una pantalla abierta antes del vencimiento, When se intenta convertir después del límite, Then se exige revalidación aunque la pantalla aún muestre vigente.
- El inventario MUST permitir registrar y buscar ubicación física interna. Given un producto ubicado en un estante/cajón, When el personal lo busca en mostrador, Then se muestra su ubicación sin exponerla en el catálogo público.
- El conteo MUST distinguir físico total, reservado y disponible, y cero contado de producto sin contar. Given un producto omitido, When se revisa el conteo, Then no se propone ajustar su stock a cero.
- Confirmar un conteo MUST registrar ajustes trazables exactamente una vez. Given un movimiento concurrente o reservas superiores al físico contado, When se intenta aplicar, Then se solicita resolver el conflicto sin sobrescribir movimientos ni consumir reservas ajenas.
