# Tienda de repuestos

Agregar un catálogo público en `/shop`, buscador, categorías y carrito, integrado al diseño existente. El taller administra productos, precios en ARS, disponibilidad y pedidos desde `/internal/shop`.

Alcance confirmado por el usuario: tienda de repuestos con carrito, pago en el taller o Mercado Pago, retiro y envíos, e inventario único compartido entre tienda online, ventas de mostrador y repuestos utilizados en reparaciones.

El usuario también solicitó escaneo con celular, un dashboard, generación de presupuestos y páginas separadas para carga de inventario y compra desde el local. Esta última se interpreta como venta de mostrador realizada por el personal para el cliente presencial. El panel tendrá accesos a Resumen, Inventario, Venta en mostrador, Presupuestos y Pedidos. La tienda pública mantiene su propio recorrido de compra.

Presupuestos: proponer fichas con cliente, productos, cantidades, precios, vigencia, condiciones y exportación imprimible/PDF; mano de obra opcional como propuesta para el taller. Conservar revisiones emitidas y convertir un presupuesto aceptado en pedido sin recargar productos. Propuesta de stock: presupuestar no reserva; convertir valida disponibilidad y reserva una sola vez. El precio emitido se conserva durante la vigencia acordada, sujeto a las condiciones registradas.

Confirmado adicionalmente: fecha de emisión y vencimiento visible con validez configurable (por ejemplo, una semana), ubicación física de los repuestos y conteo de stock. Propuesta inicial: siete días editables por presupuesto; ubicación por sector/estante/cajón; conteos revisables que generan ajustes trazables sin sobrescribir movimientos concurrentes.

Pendientes operativos: cobertura y cálculo del envío, combinación de pago presencial con envío, duración de reservas sin pagar y procedimiento de devoluciones. Propuesta: permitir ambos medios de pago para retiro y exigir pago acreditado antes de despachar un envío. No se incluye pago contra entrega salvo nueva definición del usuario.

Estado: el usuario autorizó comenzar la implementación por entregables usando agentes de menor costo cuando sea posible. Ver `deliverables.md` para secuencia acordada por alcance y `tasks.md` para detalle funcional y decisiones operativas pendientes. Primera ejecución: E1, inventario interno; sin publicación automática.

Se incorpora la posibilidad de clientes frecuentes con descuento por pago efectivo exclusivamente sobre repuestos; mano de obra y envío quedan excluidos por indicación del usuario. Propuesta: reutilizar clientes internos, marcar elegibilidad manualmente y configurar porcentaje. Distinguir efectivo de otros cobros presenciales; conservar el descuento y su condición en presupuestos/ventas. No se definió un porcentaje ni se activó una promoción. Historial, acumulación y eventual clasificación automática quedan sujetos a reglas comerciales por acordar.

El usuario solicitó inicio de sesión para clientes y consulta de turnos. Se incorpora “Mi cuenta” con registro/acceso y turnos propios; se propone reunir también pedidos, presupuestos emitidos, perfil/motos y beneficios. El vínculo con registros previos debe verificarse y la autorización debe separar clientes del personal. Conservar las políticas existentes de cancelación/reprogramación de turnos y la identidad de colores.

La migración agrega tablas independientes. Revertir la interfaz conserva los pedidos y el inventario; no se eliminan tablas con información comercial. No cambia la lógica de turnos.
