# Tienda pública — 9 de octubre de 2026

Alcance de esta solicitud: vender repuestos del taller a mecánicos y particulares, con pago online
y opción de envío. No se habilita publicación por vendedores externos. La compra es como invitado
con un enlace privado de consulta; no requiere ni concede acceso al panel del personal.

## Implementación

- Catálogo público y carrito persistente en `/shop`; búsqueda, categorías, marca, descripción,
  compatibilidad, precio en ARS y disponibilidad física menos reservas.
- Publicación explícita por producto; todos los productos previos permanecen sin publicar.
- Contacto de compra y elección de particular/mecánico; taller opcional para el mecánico.
- Retiro con instrucciones del taller, o envío a código postal cubierto con costo fijo configurable.
- Pedido con precios y cantidades conservados, reserva transaccional, vencimiento y consulta privada.
- Checkout Pro y webhook propios; reutilización del adaptador de Mercado Pago sin mezclar señas.
- Panel de pedidos, preparación, despacho con seguimiento, entrega y cancelación sin pago.
- Importe, moneda y modo del pago verificados; pagos adicionales/tardíos y devoluciones requieren revisión.
- Cierre de revisión exclusivamente por administrador después de verificar la devolución o contracargo.
- Movimiento `SALE` al retirar/despachar; entrega de un envío no vuelve a descontar stock.
- Endpoint protegido para conciliación periódica de vencidos; requiere configurar un scheduler externo.

## Verificación y límites

La migración aditiva se aplicó exclusivamente a PostgreSQL local. Tipos y revisión estática correctos.
La suite completa pasó con 418 casos antes de los últimos refuerzos; luego pasaron los 34 casos
seleccionados de tienda y pagos, incluidos creación concurrente de checkout, cierre de revisión y
devoluciones parciales. Pruebas de base cubren reservas
concurrentes de última unidad, reenvíos, manipulación de precio/costo, cobertura, acceso privado,
verificación de pagos, stock auditado, vencimiento, pagos tardíos y errores del proveedor.

Ocho recorridos de navegador pasaron en escritorio y celular: catálogo y protección de datos,
mecánico con envío y despacho de pedido pagado, particular con retiro y administración/publicación
con restricción de permisos. Revisión visual del carrito y panel, sin desbordamiento horizontal en
el recorrido móvil. Compilaciones de aplicación y biblioteca visual correctas.

Las credenciales locales de Mercado Pago estaban ausentes. Las pruebas de servicio usan un proveedor
simulado y las de navegador usan credenciales ficticias únicamente para habilitar el recorrido local;
no ejecutan cobros externos. La tienda permanece deshabilitada hasta configurar y verificar Mercado Pago.

Pendientes operativos: productos reales publicados, credenciales de pago por entorno, dominio HTTPS,
compra de prueba contra el proveedor, dirección de retiro, cobertura/costo de envío y scheduler de
conciliación. No se publicó esta implementación en Preview ni en Producción.

No se incluyen cuentas de compradores, confirmación por email, precios mayoristas, cotización o
etiquetas automáticas de transportistas, devolución automática ni factura fiscal. Los precios son
iguales para particulares y mecánicos; despachos y devoluciones se coordinan manualmente.
