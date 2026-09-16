# Plan de trabajo — Shop de repuestos

Estado: implementación autorizada por el usuario. Ver [entregables incrementales](deliverables.md) para orden operativo, dependencias y criterios de aceptación. Se inicia E1: inventario interno. Las fases siguientes conservan su alcance y no se consideran terminadas.

## Objetivo

Sumar al sitio del taller una tienda de repuestos con catálogo público, carrito, inventario y gestión interna de pedidos. Conservar las reservas de turnos y aprovechar el diseño y el acceso interno existentes.

## Alcance confirmado

- Pagos en el taller y mediante Mercado Pago.
- Entrega con retiro en el taller y envíos.
- Un único inventario para tienda online, ventas de mostrador y repuestos usados en reparaciones.
- Carrito con cantidades, subtotales, total y persistencia en el navegador.
- Escaneo de códigos de barras con la cámara del celular, búsqueda manual y etiquetas internas imprimibles para productos sin código.
- Dashboard interno, página de carga de inventario y página de venta en mostrador. “Compra desde el local” se interpreta como compra presencial atendida por el personal.
- Mantener la temática de colores actual en dashboard, inventario, mostrador y tienda: fondo carbón, superficies oscuras, acento verde manzana y texto claro.
- Generación de presupuestos como sección del panel, integrada con productos y venta en mostrador. El detalle operativo siguiente es una propuesta para revisión.
- Presupuestos con fecha de emisión, plazo de validez configurable (por ejemplo, una semana) y fecha de vencimiento explícita en pantalla y PDF.
- Ubicación física de los repuestos y conteo de stock desde el celular, incorporados por el usuario al alcance de la primera versión.
- Clientes frecuentes con descuento configurable por pago en efectivo exclusivamente sobre repuestos; mano de obra y envío quedan excluidos. Porcentaje y reglas de clasificación pendientes de definir.
- Registro/inicio de sesión para clientes y sección “Mi cuenta” para consultar sus turnos. Incluir pedidos, presupuestos, datos personales y beneficios como recorrido propuesto del portal.

Ver `integrations-and-improvements.md` para integraciones candidatas y mejoras priorizadas. Son propuestas para elegir, no ampliaciones automáticamente aprobadas del alcance.

## 1. Definir la operación

Resolver antes de programar:

- Envíos: zonas/códigos postales cubiertos, responsable del transporte, costo y seguimiento. Elegir tarifa configurable, cotización manual previa al cobro o cálculo con transportista.
- Pago y entrega: propuesta de permitir pago en taller o Mercado Pago para retiro; para envío, exigir pago acreditado antes del despacho. Confirmar si se admite pagar presencialmente y solicitar envío posterior.
- Reservas: en qué momento se apartan unidades, cuánto dura la reserva y quién puede cancelarla.
- Productos: confirmar si hay un listado inicial, fotos, códigos y precios para cargar; definir si las variantes se administran como productos separados.
- Presupuestos: proponer siete días de validez inicial, editable al emitir y configurable como valor predeterminado. Definir condiciones de precio/disponibilidad, posibilidad de descuentos y si se incluirá mano de obra junto con repuestos.
- Clientes frecuentes: definir porcentaje, clasificación manual o por historial y acumulación con otros descuentos. Alcance confirmado: sólo repuestos. Propuesta inicial: marca manual por personal autorizado, un porcentaje general configurable y beneficio por pago completo en efectivo; sin activación ni porcentaje arbitrario.
- Cuenta de cliente: definir el método de acceso y si se mantiene compra/reserva como invitado. Propuesta inicial: correo y contraseña con verificación de correo y recuperación de acceso; navegar el catálogo no requiere sesión.

Propuesta inicial: cuenta disponible para clientes y compra/reserva como invitado a definir; catálogo cargado desde el panel. Cada variante vendible tiene su propio código y stock. Agregar al carrito no reserva unidades; confirmar el pedido sí, con vencimiento configurable para pedidos sin pagar. Un pedido pagado conserva su reserva hasta retiro, despacho o cancelación gestionada. Estas reglas quedan propuestas para revisión.

Entregable: alcance de la primera versión y reglas de stock/pedidos acordadas.

## 2. Diseñar las pantallas y recorridos

- Cliente: catálogo → detalle del repuesto → carrito → retiro o envío → contacto/dirección → forma de pago → confirmación o pago en Mercado Pago.
- Cliente con sesión: Mi cuenta → Mis turnos / Mis pedidos / Mis presupuestos / Mis datos y motos / Beneficios.
- Taller: dashboard con accesos directos a Inventario, Venta en mostrador, Presupuestos y Pedidos, además de la agenda existente.
- Diseñar para celular y escritorio, con la identidad visual actual.
- Contemplar catálogo vacío, búsqueda sin resultados, agotados, cambios de precio y errores al confirmar.

Entregable: estructura de pantallas y recorrido revisable antes de construirlas.

### A. Dashboard interno

Ruta propuesta: `/internal/shop`.

- Indicadores del día/período elegido: ventas cobradas online y en mostrador, importes cobrados y reembolsados por separado.
- Pedidos pendientes de pago, preparación, retiro o despacho, con enlace al listado filtrado.
- Productos agotados y bajo el mínimo configurado.
- Últimos movimientos de inventario con origen y responsable.
- Presupuestos pendientes de respuesta y próximos a vencer, con acceso al detalle. No sumar sus importes a ventas cobradas.
- Accesos rápidos: Cargar mercadería, Nueva venta, Registrar uso en reparación y Ver pedidos.
- Definir períodos según la zona horaria del taller. No contar pedidos sin pagar como ingresos, ni consumos de reparación como ventas del shop; las señas de turnos quedan fuera de estos indicadores.

Aceptación: cada indicador se obtiene de registros reales y coincide con su listado de detalle. El dashboard inicial es operativo, sin cálculos de rentabilidad que requieran costos aún no definidos.

### B. Página de inventario y carga

Ruta propuesta: `/internal/shop/inventory`.

- Buscar por nombre, código interno o código de barras; escanear con la cámara del celular.
- Para un código conocido, mostrar la ficha y permitir agregarlo a una lista de ingreso con cantidad. Revisar toda la lista y confirmar una vez.
- Para un código desconocido, ofrecer vincularlo a un producto existente o crear una ficha; no asumir que el escaneo trae descripción o precio.
- Alta inicial con nombre, código, categoría, marca, compatibilidad, precio de venta, stock inicial y foto opcional.
- Registrar ingreso, ajuste o consumo en reparación con motivo y referencia. Consultar stock físico/reservado/disponible e historial por producto.
- Mostrar unidades antes/después al revisar una carga; cancelar un borrador no modifica stock. Confirmar una carga registra todos sus movimientos una sola vez.
- Permitir imprimir etiquetas internas; mantener búsqueda manual cuando la cámara no esté disponible.
- Registrar ubicación física: sector, estante y cajón, con ejemplo “Depósito / Estante A / Cajón 3”. Mostrarla al buscar/escanear en inventario, venta de mostrador y preparación de pedidos; mantenerla fuera de la ficha pública.
- Permitir buscar/filtrar por ubicación y listar productos sin ubicación asignada. Cambiar la ubicación no modifica cantidades.

#### Conteo de stock desde el celular

- Iniciar un conteo completo o de productos seleccionados por ubicación. Escanear/buscar cada producto e ingresar la cantidad física contada.
- Contar el físico total, incluyendo las unidades apartadas que todavía permanecen en el taller. Mostrar físico registrado, reservado, contado y diferencia; no comparar contra el disponible para vender.
- Guardar un borrador para continuar. Distinguir “sin contar” de “contado: 0”; un producto omitido no se ajusta a cero.
- Revisar faltantes y sobrantes antes de confirmar, con motivo y responsable del ajuste.
- Si hubo movimientos de un producto durante el conteo, marcarlo para revisión/reconteo antes de ajustar; no sobrescribir ventas o entradas recientes.
- Confirmar los ajustes una sola vez y conservar el conteo original e historial. Si el físico contado no alcanza para cubrir reservas, registrar la discrepancia y resolver las reservas afectadas antes de aplicar el ajuste.

Aceptación: escanear identifica el producto, pero no modifica existencias por sí mismo. Las lecturas repetidas mientras la cámara apunta al mismo código no agregan unidades accidentalmente. El personal controla la cantidad y confirma la carga.

### C. Página de venta en mostrador

Ruta propuesta: `/internal/shop/pos`.

- Escanear o buscar repuestos y agregarlos a un carrito interno con cantidades, precio y total.
- Mostrar disponibilidad compartida y bloquear la venta de unidades reservadas para otro pedido.
- Venta rápida sin datos personales obligatorios cuando no sean necesarios; solicitar contacto/destino si el cliente pide envío o seguimiento.
- Elegir pago en taller o Mercado Pago. Definir los medios presenciales que se registrarán (por ejemplo, efectivo o transferencia); no confundir un cobro registrado manualmente con uno verificado por Mercado Pago.
- Para pago presencial y entrega inmediata, confirmar cobro, venta y salida física en una única operación, con referencia y responsable.
- Para Mercado Pago, crear el pedido con reserva y esperar acreditación antes de entregarlo; la modalidad concreta de cobro presencial digital queda por definir, sin asumir integración con terminales o QR.
- Permitir abrir un pedido online existente para cobrarlo y entregarlo en el local, sin crear una segunda venta ni descontar stock otra vez.
- Mostrar resumen de venta imprimible, identificado como constancia interna; facturación fiscal queda fuera de esta primera versión.

Aceptación: una venta de mostrador actualiza el inventario compartido y el dashboard. Repetir la confirmación devuelve la venta original; nunca genera otro cobro registrado ni otra salida.

### D. Página de presupuestos

Ruta propuesta: `/internal/shop/quotes`.

- Crear desde cero o desde el carrito del mostrador; agregar repuestos mediante búsqueda/escaneo y elegir cantidades.
- Registrar cliente y contacto, número único, fecha de emisión, vencimiento, observaciones y condiciones. Datos de moto/turno opcionales para presupuestos relacionados con reparaciones.
- Elegir validez en días y calcular vencimiento automáticamente desde la fecha de emisión; propuesta inicial de siete días, editable antes de emitir. Mostrar “Validez: 7 días · Válido hasta DD/MM/AAAA” en el documento y el detalle.
- Propuesta de cómputo: sumar días calendario a la fecha de emisión y considerar válido hasta finalizar la fecha de vencimiento en la zona horaria del taller. Ejemplo: emisión 15/09/2026, validez 7 días, válido hasta el 22/09/2026 inclusive. Guardar el vencimiento de cada revisión; cambiar la configuración no altera presupuestos emitidos.
- Mostrar automáticamente “Vencido” al superar esa fecha y bloquear conversión sin revalidación; no depender de que el personal cambie el estado a mano. Renovar emite una revisión nueva con fechas y condiciones actualizadas.
- Proponer renglones de mano de obra separados de los repuestos. La mano de obra no modifica stock ni crea por sí sola un turno o una orden de reparación.
- Mostrar precio unitario, subtotal y total en pesos; descuentos explícitos y controlados si se acuerdan. Incluir entrega/costo cuando corresponda; no convertir a cobro un envío sin costo final aceptado.
- Guardar borradores y emitir una versión con nombres, precios y condiciones fijos. Modificar un presupuesto emitido genera una nueva revisión y requiere nueva aceptación.
- Propuesta de estados: borrador → emitido → aceptado/rechazado/vencido; aceptado → convertido en pedido. Registrar quién y cuándo informa la aceptación; crear un documento o abrir WhatsApp no equivale a enviarlo ni a obtener aceptación.
- Descargar PDF o imprimir con identidad del taller y acentos verdes. Propuesta de versión de impresión con fondo claro para ahorrar tinta, manteniendo marca y colores; el panel conserva el tema oscuro. Documento rotulado como presupuesto, sin presentarlo como factura ni constancia de pago.
- Compartir manualmente el PDF por WhatsApp o correo; envío automático sigue siendo una integración opcional, fuera de esta acción de planificación.
- Convertir un presupuesto aceptado y vigente en pedido/venta con un clic, revisando disponibilidad. Conservar el precio de la revisión aceptada; no reemplazarlo silenciosamente por el precio actual del catálogo.
- Crear y aceptar un presupuesto no aparta mercadería como regla propuesta. La conversión reserva stock en la misma transacción que crea el pedido; si falta un repuesto, informar y resolver antes de convertir.
- Un presupuesto vencido requiere revalidar condiciones y emitir/aceptar una nueva revisión. Evitar conversiones duplicadas incluso si el personal reintenta o trabaja desde dos dispositivos.

Aceptación: generar, editar o compartir un presupuesto no cambia stock ni registra ingresos. Una conversión exitosa conserva cliente, renglones y total acordado y crea un solo pedido. El PDF mantiene el contenido de su revisión aunque luego cambie el producto.

### E. Cuenta y portal de clientes

Rutas propuestas: `/account/login`, `/account/register` y `/account` con secciones de turnos, pedidos, presupuestos y perfil. Mantener el fondo oscuro y verde manzana existentes.

- Registro, inicio/cierre de sesión, verificación de contacto y recuperación de acceso. Presentar errores claros y limitar intentos de acceso/recuperación.
- Inicio de cuenta con próximo turno, pedidos activos y presupuestos vigentes; todos corresponden exclusivamente al cliente autenticado.
- Mis turnos: próximos y anteriores, fecha/hora, servicio, moto y estado. Acceso a reservar un nuevo turno con datos vinculados a la cuenta.
- Respetar las reglas actuales del taller: ver un turno no habilita por sí solo cancelación ni reprogramación online. Mostrar únicamente acciones permitidas por configuración.
- Mis pedidos: repuestos, importes, estado de pago, retiro/envío y seguimiento disponible. Ver ventas de mostrador si quedaron vinculadas a su ficha.
- Mis presupuestos: consultar versiones emitidas, fecha de emisión/vencimiento, importes y descargar PDF. No mostrar borradores ni notas internas; aceptación online puede evaluarse por separado.
- Mis datos y motos: actualizar contacto/direcciones y consultar/gestionar motos propias con validación; cambios de contacto sensible requieren nueva verificación y no reescriben datos históricos de pedidos o presupuestos.
- Beneficios: mostrar condición de cliente frecuente y descuento por efectivo sólo sobre repuestos. Registrarse no otorga automáticamente la categoría de frecuente; la asignación sigue siendo interna según la regla acordada.
- Vincular nuevas reservas y compras a la ficha asociada a la sesión. Para registros previos como invitado, requerir verificación específica de pertenencia o revisión del taller antes de incorporarlos al historial; no vincular sólo por coincidencia de nombre/teléfono/correo declarado.
- Separar clientes y personal con autorización explícita en el servidor. Una cuenta de cliente nunca habilita agenda interna, ajustes de stock, precios ni fichas de otras personas.

Aceptación: dos clientes sólo pueden acceder a sus propios registros, incluso modificando enlaces o identificadores. Verificar bloqueo de acceso a páginas y acciones internas, recuperación de acceso, vinculación de historial previo y conservación de las reglas de turnos.

## 3. Productos, inventario y beneficios de clientes

### Clientes frecuentes y descuento por efectivo

- Agregar sección Clientes al panel y un selector en mostrador/presupuestos, reutilizando la ficha de cliente del taller y evitando duplicados. No exigir una cuenta pública para vender presencialmente.
- Buscar por nombre/teléfono y revisar coincidencias antes de vincular una ficha; un teléfono ingresado por un visitante no acredita por sí solo identidad o condición de frecuente.
- Mostrar historial y una marca “Cliente frecuente”. Propuesta inicial: otorgamiento manual por personal autorizado, con fecha/responsable. Clasificación automática por compras se evaluará después de definir cantidad, monto y período; no contar presupuestos ni pedidos impagos/cancelados como compras.
- Configurar descuento porcentual sin modificar los precios base del catálogo. Aplicar exclusivamente sobre renglones de repuestos; excluir siempre envío y mano de obra, según indicación del usuario.
- Identificar el medio como EFECTIVO: “pago en taller” también puede incluir otros medios y no debe activar el beneficio indiscriminadamente. Transferencia, tarjeta y Mercado Pago no se consideran efectivo.
- Mostrar subtotal, descuento por cliente frecuente/pago efectivo y total final antes de confirmar. No acumular automáticamente con otros descuentos.
- En presupuestos, guardar el porcentaje, importe y condición “válido para pago en efectivo” en la revisión y en el PDF. Cambiar el medio de pago exige mostrar el total aplicable y aceptar las nuevas condiciones; no alterar silenciosamente un presupuesto emitido.
- Al convertir un presupuesto vigente, conservar el descuento acordado si se cumple la condición. No aplicar el beneficio por segunda vez sobre el total ya descontado.
- El personal confirma el cobro efectivo; la identidad proviene de una cuenta vinculada y verificada o de selección interna. El servidor calcula el descuento y registra regla e importes. Una venta online de invitado no obtiene descuentos por indicar el teléfono de otro cliente; un cliente autenticado frecuente puede ver el beneficio condicionado al pago efectivo, sin marcarse cobrado antes del registro presencial.
- Guardar el descuento en el historial de la venta para que cambios posteriores de configuración no alteren ventas/presupuestos emitidos. Reembolsos se basan en lo efectivamente cobrado, con asignación del descuento a los renglones.
- El dashboard muestra cobros con descuentos ya aplicados y permite ver el total de descuentos otorgados por separado. La clasificación de cliente no afecta reservas de stock ni disponibilidad.

Aceptación: el beneficio se aplica una sola vez a un cliente elegible con pago efectivo; cambiar a Mercado Pago elimina esa condición y requiere revisión del total. La configuración queda pendiente de decidir y no se activa un descuento comercial durante la planificación.

### Productos y movimientos

- Ficha: código/SKU único, nombre, descripción, categoría, marca, compatibilidad con motos, precio en pesos y foto opcional.
- Asociar códigos de barras del fabricante al producto y generar un identificador interno cuando haga falta. Cada código de unidad vendible resuelve un único producto; los códigos de cajas o packs no se tratarán como una unidad sin definir su presentación.
- Crear, editar, publicar y ocultar productos desde el panel interno.
- Registrar entradas de mercadería, ventas de mostrador, consumo en reparaciones y ajustes con motivo sobre el mismo inventario.
- Identificar el origen de cada salida: pedido online, venta de mostrador o reparación. Vincular el consumo al turno/referencia de reparación cuando corresponda, sin requerir una gestión completa de órdenes de trabajo.
- Diferenciar stock físico, reservado y disponible para vender.
- Guardar historial de movimientos con cantidad, motivo, fecha y responsable; vincular los movimientos de venta con el pedido.
- Mostrar productos agotados y alertas de stock bajo con umbral configurable.
- Impedir cantidades negativas y detectar ediciones simultáneas que podrían sobrescribir cambios.

Aceptación: cada cambio de stock puede explicarse por su historial; disponible = físico − reservado. Un ajuste, venta de mostrador o reparación no puede consumir unidades reservadas para otro pedido. Toda salida actualiza la disponibilidad pública.

## 4. Construir el catálogo público

- Agregar “Repuestos” al menú y un acceso desde el inicio.
- Listado y detalle de productos con precio, compatibilidad y disponibilidad.
- Buscador por nombre, código, marca y compatibilidad; filtro por categoría.
- Mostrar únicamente productos publicados y bloquear la compra de agotados.

Aceptación: un producto publicado desde el panel aparece en la tienda; uno oculto no puede pedirse aunque permanezca en un carrito anterior.

## 5. Construir el carrito y cierre del pedido

- Agregar productos, cambiar cantidades y quitar artículos.
- Conservar el carrito al recargar o volver al sitio desde el mismo navegador.
- Mostrar subtotales, costo de envío cuando corresponda y total final en pesos antes de pagar. No cobrar pedidos cuyo envío aún no tenga un costo definido.
- Pedir nombre, teléfono y observaciones. Para envíos, destinatario, dirección, localidad, provincia y código postal; pedir otros datos sólo si son necesarios para la modalidad de pago/transporte.
- Elegir retiro/envío y pago en taller/Mercado Pago según las combinaciones acordadas. Validar cobertura antes de ofrecer envío.
- Validar precio y disponibilidad nuevamente en el servidor al confirmar.
- Confirmar con código y resumen del pedido, más las instrucciones de pago y entrega acordadas.
- Integrar Mercado Pago para compras del shop, separado de las señas de turnos. Registrar intentos de pago y acreditar sólo con confirmación verificada del proveedor.
- Tratar pagos pendientes, rechazados, reintentos y avisos duplicados sin duplicar pedidos ni movimientos de inventario.
- Registrar cobros presenciales desde el panel, con usuario y fecha; mantener separado el estado del pago del estado de entrega.

Aceptación: un precio cambiado requiere revisión del cliente; reintentar una confirmación no crea un segundo pedido ni duplica la reserva. Si se agota un artículo, se informa sin confirmar un pedido parcial involuntario.

## 6. Construir la gestión de pedidos

- Listado y detalle con cliente, productos, cantidades, total, fecha y estado.
- Propuesta para retiro: pendiente → en preparación → listo para retirar → entregado.
- Propuesta para envío: pendiente → en preparación → despachado → entregado; guardar transportista y referencia de seguimiento cuando existan.
- Separar estados de pedido, pago y entrega. No marcar cobrado un pedido por estar listo o despachado.
- Al confirmar, reservar unidades; al retirar o despachar, registrar salida física y consumir la reserva. Marcar un envío entregado no vuelve a descontar.
- Al cancelar antes de la salida o vencer una reserva sin pagar, liberar la reserva una sola vez y conservar el historial. Excluir los pedidos pagados del vencimiento automático.
- Ante un pago acreditado después del vencimiento, intentar reservar nuevamente en forma atómica; si falta stock, dejar el caso para resolución/reembolso sin prometer la entrega.
- Después del retiro/despacho, gestionar devoluciones en un flujo separado: reintegrar sólo la mercadería recibida y apta para vender. Cancelar o reembolsar no implica por sí mismo una entrada física.
- Definir qué ocurre con reservas vencidas, pedidos no retirados y devoluciones antes de habilitar la venta.

Aceptación: dos pedidos simultáneos no pueden reservar la misma última unidad. Un pedido conserva nombres y precios originales aunque se edite el producto después.

## 7. Verificar y preparar la puesta en marcha

- Probar el recorrido completo en celular y escritorio.
- Probar escaneo en Android e iPhone: permiso aceptado/denegado, cámara no disponible, poca legibilidad, código desconocido y detección repetida. Verificar búsqueda manual y etiquetas internas.
- Probar carga múltiple de mercadería, ajuste y consumo en reparación, venta de mostrador con ambos pagos y retiro de pedido online desde el mostrador.
- Verificar indicadores del dashboard frente a ventas cobradas, reembolsos, pedidos y movimientos; respetar período y zona horaria.
- Verificar presupuestos: PDF/impresión, revisiones, aceptación, vencimiento, falta de stock y conversión simultánea/reintentada. Un precio de catálogo editado no altera una revisión emitida; mano de obra no descuenta inventario.
- Probar validez de presupuestos al cambiar de día, mes y año; coherencia entre PDF/pantalla; vencimiento efectivo del servidor aunque la pantalla esté abierta. Una modificación de plazo predeterminado no cambia revisiones previas.
- Verificar búsqueda por ubicación y conteos con cero explícito, productos omitidos, sobrantes, faltantes, movimientos concurrentes, reservas superiores al físico contado y confirmaciones repetidas.
- Verificar descuentos: frecuente/no frecuente, efectivo/otros medios, cambio de medio, renglones excluidos, redondeo, no acumulación y conversión desde presupuesto sin aplicar dos veces. Los descuentos emitidos no cambian al editar la configuración y un usuario público no puede atribuirse la condición de frecuente.
- Verificar registro, verificación de correo, recuperación y cierre de sesión; acceso cruzado entre clientes y a acciones internas; vínculo de historial previo; perfiles/contactos editados que no cambian el propietario de registros antiguos. Los turnos del portal mantienen políticas de cancelación/reprogramación existentes.
- Verificar agotados, cambios de precio, reservas simultáneas entre todos los canales, cancelaciones, vencimientos y reintentos.
- Probar Mercado Pago en entorno de prueba: aprobado, pendiente, rechazado, confirmación tardía y avisos repetidos; incluir una compra completa antes de habilitar cobros reales.
- Verificar cobertura, costo final del envío, cobro previo al despacho, seguimiento y descuento único de stock al retirar o despachar.
- Verificar que sólo usuarios internos puedan modificar productos, inventario y pedidos.
- Comprobar que las reservas de turnos y su integración de señas siguen funcionando.
- Probar la migración en un entorno separado y preparar reversión conservando información comercial.
- Cargar productos reales y revisar fotos, precios, compatibilidad y stock inicial.
- Revisar la versión de prueba antes de acordar su publicación.

Entregable: tienda verificada y lista para publicar con la modalidad elegida.

## Orden de entrega

El orden operativo vigente es el de [entregables incrementales](deliverables.md), que divide esta primera versión en avances utilizables:

1. E1: inventario interno y resumen, ubicación física y movimientos auditados.
2. E2: escaneo, etiquetas y sesiones de conteo.
3. E3: cuentas de clientes, permisos separados y turnos propios.
4. E4: venta de mostrador y descuento en efectivo para clientes frecuentes.
5. E5: presupuestos con fechas, validez y PDF.
6. E6: tienda pública, carrito y pedidos con retiro.
7. E7: Mercado Pago, conciliación y vencimiento de reservas.
8. E8: envíos y verificación completa previa al lanzamiento.

Los pasos son entregas de construcción dentro de la misma primera versión; presupuestos, dashboard, escaneo, Mercado Pago y envíos forman parte del alcance confirmado.

## Ampliaciones a evaluar por separado

Importación masiva, proveedores y compras, facturación, promociones generales, clasificación automática de clientes frecuentes, aceptación online de presupuestos, gestión completa de órdenes de reparación e informes avanzados. Las cuentas públicas de clientes, la ficha interna y el descuento por efectivo para frecuentes sí forman parte del plan. Estimar plazos después de resolver las decisiones operativas de la fase 1.
