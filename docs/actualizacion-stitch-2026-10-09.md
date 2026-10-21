# Actualización del diseño en Google Stitch

Proyecto: [Taller Express — aplicación actual](https://stitch.withgoogle.com/projects/595898897177555314).
Referencia funcional: código y cambios locales revisados el 9 de octubre de 2026.

## Alcance

Se renombró el proyecto existente y se enviaron cuatro lotes de diseño para representar la aplicación actual, conservando inicialmente las referencias anteriores, que luego se retiraron durante la limpieza solicitada. Stitch recibió descripciones funcionales y datos ficticios; no tuvo acceso al repositorio, credenciales ni datos reales de clientes.

Los cuatro lotes comprenden 31 pantallas base. La revisión final agregó una ficha de unidad específica y una pantalla de propuestas útiles: 33 pantallas vigentes, incluida la guía visual, más la tarjeta de estilos Taller Express. La aplicación no se modificó ni se publicaron sitios o realizaron pagos.

| Grupo | Pantallas base solicitadas |
| --- | --- |
| Inicio y ventas públicas | Inicio, catálogo, detalle de repuesto, carrito, entrega y datos, revisar y pagar |
| Turnos y pedidos públicos | Reservar, consulta de turno, resultado y seña, cancelar turno, mi pedido |
| Móvil | Inicio, catálogo, compra; conteo móvil en el bloque de inventario |
| Taller | Acceso, cuenta, agenda y detalle del turno, unidades e historial |
| Configuración del taller | General, reservas y señas, catálogo de servicios, horarios y fechas especiales |
| Operación comercial | Resumen de repuestos, inventario y alta, ficha y publicación, búsqueda de código y etiquetas, conteos, conteo móvil y revisión, pedidos internos, tienda online |
| Guía | Sistema visual |

## Identidad y reglas

- Español argentino, precios ARS con centavos, fondos `#090d0b` / `#101611`, acción `#8ee000`, foco `#b8ff58` y tipografía Inter (edición para compartir).
- Dos recorridos claros en el inicio: reservar turno y explorar repuestos; consulta del turno y acceso del personal secundarios.
- Búsqueda del catálogo, categorías, compatibilidades registradas, disponibilidad y compra en tres pasos.
- Retiro y envío exclusivamente a Salta capital CP 4400, según configuración. Particular y mecánico comparten precio.
- Cobros no habilitados como estado principal del entorno actual; ejemplos con pagos habilitados identificados como variantes de demostración.
- Acceso al pedido por enlace privado. El código REP es una referencia para el taller, no una credencial de consulta.
- Diferencia explícita entre stock físico, reservado y disponible; reserva de pedido por 30 minutos, descuento físico al retiro o despacho, sin segundo descuento al entregar un envío.
- Pagos en revisión y devoluciones requieren gestión real del proveedor; el diseño no promete reembolsos automáticos.
- Agenda, unidades, configuración, inventario, escaneo, etiquetas, conteos y pedidos respetan la separación entre personal y administrador.

## Mejoras útiles conservadas

El usuario indicó conservar los cambios de Stitch que puedan resultar útiles. La jerarquía del inicio, las composiciones compactas para celular, la claridad del resumen de compra y las ayudas de estado se conservan como mejoras visuales.

Las siguientes extensiones se solicitan en una pantalla separada **PROPUESTA · Pendiente de implementar**:

- Buscar y paginar todo el historial de pedidos, superando el límite actual de los últimos 100.
- Acciones contextuales para preparación, retiro, despacho y entrega, conservando las transiciones existentes.
- Indicadores de pedidos pagados y pendientes, sin confundir cobranza con ganancia.
- Checklist opcional del taller, que actualmente no existe en agenda.

Las propuestas no deben presentarse como funciones ya implementadas. Tampoco se incorporan promesas de cobertura adicional, transferencias, reembolsos automáticos o cuentas obligatorias para compradores.

En el inicio se pidió conservar los dos recorridos principales y rotular cualquier bloque de métricas del taller como propuesta con datos Demo. La confirmación y la seña dependen de configuración; no se anuncia reprogramación pública. Dirección, contacto y horarios de demostración deben reemplazarse por valores reales del taller. El catálogo sigue accesible con un aviso cuando las compras están deshabilitadas.

## Revisión final solicitada

Además de conservar las mejoras útiles, se pidió corregir campos inventados en cuenta y configuración, usar los estados reales de los turnos, mantener email y patente opcionales al reservar, completar la ficha editable de la unidad y finalizar nombres y alturas del canvas.

La ficha de unidad solicitada incluye edición de tipo, marca, modelo, año, color, VIN, número de motor y notas; corrección de patente por separado con validación de duplicadas; historial de turnos, cambios de patente y dueño.

## Evidencia y continuidad

Las especificaciones enviadas y capturas se guardan en `docs/stitch-2026-10-09/`. La captura `stitch-actualizacion-final.jpg` muestra las pantallas de los cuatro lotes antes de la última revisión; `stitch-revision-mejoras.jpg` registra la ficha de unidad y la propuesta separada. Algunos títulos de Stitch todavía figuraban como `Generating Screen...` pese a tener contenido visible; se solicitó finalizarlos.

La revisión visual detectó que Stitch agregó costos, kilometraje, PDF y certificaciones oficiales a la ficha de unidad, además de transferencias y rutas de cadetería a la propuesta. Se envió una corrección puntual para eliminarlos y conservar únicamente la ficha real y las propuestas útiles acordadas. Se comprobó visualmente que la ficha quedó con sus formularios e historial y que la propuesta conservó búsqueda/paginación, acciones, indicadores y checklist, eliminando esos bloques ajenos al alcance.

La respuesta textual de Stitch no sustituye una comprobación visual de todas las pantallas; antes de trasladar diseños al código, contrastar cada campo y acción contra las fuentes indicadas en el análisis original. Las maquetas son una referencia revisable de diseño y los valores Demo no son datos comerciales ni de clientes reales.

Para otra actualización, comparar primero nuevas rutas, formularios, estados, permisos y políticas contra esta referencia, y enviar únicamente las diferencias a Stitch. Conservar la separación entre ACTUAL y PROPUESTA.


## Limpieza solicitada

Se retiraron del canvas las seis pantallas obsoletas de las dos versiones iniciales: Motorcycle Ecommerce Home Page (2), Motorcycle Inventory Listing (2) y Motorcycle Product Detail View (2). Representaban las referencias anteriores de venta de motos y repuestos en inglés, ya sustituidas por las pantallas actuales del taller.

Se conservaron las 33 pantallas vigentes, las variantes móviles, la ficha de unidad corregida, la pantalla de propuestas útiles y la tarjeta de estilos compartida. Los títulos temporales Generating Screen... corresponden a pantallas con contenido vigente; no se eliminaron por ese rótulo.

Stitch mostró Deleted y la acción Undo al realizar la limpieza. Se recargó el proyecto y se comprobó que las seis referencias antiguas ya no aparecen, mientras permanecen las 33 pantallas vigentes. La evidencia es stitch-2026-10-09/stitch-limpieza-final.jpg. Esta limpieza corresponde al proyecto de Stitch; no modificó la aplicación.

## PDF para compartir - edición Inter

Se preparó `output/pdf/Taller-Express-redisenio-completo.pdf`: 43 páginas con las 33 vistas vigentes, índice navegable, recorridos, identidad visual y propuestas pendientes. La edición utiliza Inter Regular 400, Medium 500 y Semibold 600. Conserva la paleta oscura con verde lima y distingue maquetas, datos de demostración y mejoras por implementar.

La tarjeta de estilos de Stitch se actualizó a Inter (versión 3), pero las exportaciones HTML conservaban configuraciones de Arial/Helvetica incluso después de aplicar la tarjeta. Para asegurar el resultado del PDF se prepararon vistas locales con Inter embebida, comprobando la fuente calculada de las 33 pantallas. La guía se compuso con la corrección devuelta por Stitch: escala de tipos, componentes, estados, reglas de negocio y alcance de las propuestas; se eliminaron las afirmaciones ficticias sobre producción, auditorías y servicios ajenos al proyecto.

Se revisaron las 43 páginas renderizadas y se verificaron las tres variantes de Inter embebidas. El archivo pesa aproximadamente 14,7 MB. El documento es una presentación del rediseño; la aplicación todavía no recibió estos cambios visuales. Antes de una implementación o una nueva exportación directa de Stitch, verificar los estilos efectivos y el contenido exportado, no solamente la respuesta textual de la herramienta.
