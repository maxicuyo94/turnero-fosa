# Entregables incrementales — Shop y gestión del taller

## Estado y forma de trabajo

El usuario autorizó comenzar la implementación usando agentes, priorizando modelos de menor costo que GPT-6 Astra. El plan se implementará por avances utilizables y verificables. Esta primera ejecución cubre E1; no supone que las etapas restantes estén terminadas ni publica automáticamente en producción.

Restricción confirmada por el usuario: trabajar sólo en DEV. Tras verificar E1 localmente, el usuario autorizó explícitamente desplegar en Vercel. El destino es Vercel Preview y la rama `preview`, con su base de pruebas; producción queda fuera del alcance. El usuario pidió continuar tras la interrupción por límites de uso de los agentes.

Equipo para E1: dos agentes GPT-5.6 Terra para servicio transaccional y pantallas, y un agente GPT-5.6 Luna para pruebas independientes. Coordinador: esquema/migración, integración, revisión y verificaciones. Asignar archivos sin superposición; compartir contratos antes de implementar.

La secuencia prioriza inventario interno para entregar utilidad inmediata sin depender de proveedores de pago/correo/transporte. Cuentas de clientes y autorización de roles deben quedar verificadas antes de habilitar registro público. Todos los entregables mantienen carbón y verde manzana.

## E1 — Inventario interno operativo (implementado y verificado en DEV local)

**Resultado:** el taller puede cargar repuestos reales y registrar movimientos desde el panel.

- Ficha con SKU, código de barras opcional, nombre, categoría, marca, compatibilidad, descripción, precio, stock mínimo y ubicación física.
- Alta con stock inicial y edición de ficha; las cantidades se modifican mediante movimientos con motivo.
- Entradas, ajustes de conteo manual y consumo en reparación; stock físico, reservado y disponible visibles.
- Historial con cantidad anterior/posterior, motivo, fecha y usuario. Protección ante operaciones repetidas, stock negativo, unidades reservadas y ediciones concurrentes.
- Resumen interno con productos, alertas y accesos a inventario; sin indicadores ficticios de ventas todavía inexistentes.
- Sin escaneo de cámara ni sesión de conteo automático en esta etapa: el código ya se puede cargar y buscar manualmente.

**Aceptación:** crear un repuesto, cargar entrada, registrar consumo, consultar historial y rechazar stock insuficiente. Páginas y acciones requieren sesión interna. Migración aditiva, tests, typecheck, lint y verificación del recorrido. No alterar turnos.

**Verificación:** ver [resultados y límites de las pruebas](validation.md). Despliegue a Vercel Preview autorizado; no publicar en producción.

## E2 — Escaneo, etiquetas y conteo de stock

**Depende de:** E1. **Resultado:** operación desde celular para identificar y contar mercadería.

Escaneo con alternativa manual, etiquetas internas imprimibles, conteos completos/por ubicación, revisión de diferencias y ajustes auditados. Lecturas repetidas no duplican cantidades; productos sin contar no se ponen en cero; movimientos concurrentes requieren revisión.

**Aceptación:** completar un conteo desde celular y registrar sólo diferencias aprobadas, probar cámara permitida/denegada y concurrencia.

## E3 — Cuenta de cliente y turnos propios

**Resultado:** registro/acceso y portal con próximos turnos/historial, datos y motos; autorización explícita separada del personal.

Verificación y recuperación de cuenta; vínculo seguro con registros previos. Reservar con cuenta e invitado según decisión final. Configurar entrega de correo antes de habilitar registro. Mantener políticas de cancelación/reprogramación existentes.

**Aceptación:** dos cuentas no acceden a datos ajenos ni a acciones internas; turno creado desde cuenta aparece en su portal.

## E4 — Venta de mostrador y clientes frecuentes

**Depende de:** E1; utiliza E2/E3 cuando estén disponibles. **Resultado:** vender presencialmente con inventario compartido.

Carrito interno, pago efectivo/presencial registrado, cliente frecuente marcado por el personal y porcentaje configurable exclusivamente sobre repuestos. Historial y resumen de ventas cobradas. Porcentaje pendiente, sin valor comercial inventado.

**Aceptación:** confirmar una venta una sola vez, descontar stock y aplicar descuento sólo en efectivo a un cliente elegible; no consumir reservas ajenas.

## E5 — Presupuestos con fecha y PDF

**Depende de:** E1/E4. **Resultado:** emitir y convertir presupuestos sin recargar productos.

Emisión, validez configurable (propuesta: 7 días), vencimiento visible, revisiones, PDF, estados y conversión. Descuento condicionado al efectivo guardado en documento; mano de obra opcional pendiente de acordar. Presupuesto no reserva; conversión valida y reserva.

**Aceptación:** PDF consistente con revisión, vencido requiere renovación y conversiones repetidas no duplican pedido/reserva. Se muestran presupuestos emitidos propios en Mi cuenta.

## E6 — Tienda pública, carrito y pedidos con retiro

**Depende de:** E1/E3/E4. **Resultado:** el cliente elige repuestos y confirma un pedido para pagar/retirar en taller.

Catálogo, búsqueda, filtros, carrito persistente, validación de stock/precio, reserva y código de pedido. Preparación, retiro y cancelación internos. Pedidos propios en Mi cuenta. Invitados según decisión acordada.

**Aceptación:** dos pedidos de la última unidad no se confirman ambos; cancelar libera reserva una vez; retirar no duplica una venta.

## E7 — Mercado Pago

**Depende de:** E4/E6. **Resultado:** cobros digitales vinculados al pedido y separados de señas de turnos.

Checkout, estados verificados, reintentos, conciliación, vencimiento de reservas y pagos tardíos. Definir QR/alternativa de mostrador según cuenta/equipo disponible. Activación real sólo después de compra completa de prueba.

**Aceptación:** aprobado/pendiente/rechazado y eventos duplicados/tardíos sin doble cobro registrado ni doble movimiento.

## E8 — Envíos y cierre de lanzamiento

**Depende de:** E6/E7. **Resultado:** compra con dirección, costo de envío aceptado, despacho y seguimiento.

Elegir cobertura, tarifa/proveedor y acceso comercial. Pago acreditado antes de despacho según regla propuesta. Descontar físico al despachar; entrega no vuelve a descontar. Revisar devoluciones y carga real de catálogo.

**Aceptación:** recorrido online completo con retiro y envío, pagos, presupuestos y permisos; revisión de publicación y documentación operativa.

## Cierre de cada entrega

Registrar archivos/capacidades, pruebas realizadas, límites reales y qué queda pendiente. Ejecutar verificaciones sobre base local o destino no productivo verificado; no sembrar datos ficticios en producción ni publicar sin solicitud. El avance termina con funcionalidad revisable, no sólo estructura vacía.
