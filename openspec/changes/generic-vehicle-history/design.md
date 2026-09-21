# Diseño

## Modelo

`VehicleType` es un catálogo colgado de `WorkshopSettings`, con la misma forma que `Service`
(nombre, activo, orden, marcas de tiempo). La semilla crea un único tipo activo, `Moto`, que es
lo que el taller tiene hoy; los demás los agrega desde Configuración sin migración ni deploy.
Un tipo con unidades asociadas se desactiva, no se borra.

`Motorcycle` se renombra a `Vehicle` con `ALTER TABLE ... RENAME TO`, y `Appointment.motorcycleId`
a `vehicleId`. El rename conserva identificadores, claves foráneas y filas, así que ningún turno
pierde su unidad. Se agregan `vehicleTypeId`, `plateNormalized`, `vin`, `engineNumber`, `color` y
`notes`. La migración backfillea `vehicleTypeId` al tipo `Moto` y `plateNormalized` desde la patente
guardada antes de marcar el tipo como obligatorio.

`plateNormalized` lleva índice **no único** en esta entrega. Producción ya tiene la misma patente
repetida en muchas filas, así que una restricción única haría fallar `prisma migrate deploy` en el
build. La unicidad parcial (`WHERE "plateNormalized" IS NOT NULL`) se agrega en una migración
posterior, recién cuando el taller haya fusionado los duplicados.

La unidad sobrevive al cambio de dueño, así que `Vehicle.customer` pasa de `Cascade` a `Restrict`:
`customerId` es el dueño actual, no una pertenencia. Hoy nada borra clientes, por lo que el cambio
no altera ningún camino existente.

`vin`, `engineNumber`, `color` y `notes` son datos internos: la reserva pública no los pide ni los
muestra, y se cargan únicamente desde el detalle de la unidad, bajo sesión interna. El formulario
público suma un solo campo, el tipo de vehículo, que es lo que el taller necesita saber de antemano.
Pedirle el número de motor a quien reserva alargaría el formulario con un dato que el taller
verifica con la unidad delante.

## Identidad y reutilización

La patente se normaliza a mayúsculas sin caracteres no alfanuméricos: `ab 123 cd`, `AB-123-CD` y
`ab123cd` son la misma unidad. El cliente se reconoce por su teléfono normalizado a dígitos.

Dentro de la transacción de reserva, y bajo el mismo bloqueo que ya serializa la creación del turno:

1. Con patente, se busca la unidad por `plateNormalized`. Si aparece, se reutiliza.
2. Si la unidad reutilizada tenía otro dueño, el turno queda con el cliente que reservó y la unidad
   pasa a ese dueño; el cambio se registra como evento de la unidad.
3. Sin patente se crea una unidad nueva, siempre.
4. Los datos ya guardados de un cliente o una unidad reutilizados no se pisan con los del formulario:
   una reserva no es una corrección de ficha. Los campos vacíos sí se completan.

Buscar y decidir dentro de la transacción evita que dos reservas simultáneas de la misma patente
creen dos unidades, igual que hace hoy `createAttempt` en pagos.

## Historial y fusión

`/internal/vehicles` busca por patente, marca, modelo o cliente y lista las unidades que comparten
patente normalizada como posibles duplicados. `/internal/vehicles/[id]` muestra la ficha y una línea
de tiempo descendente con los turnos de la unidad —fecha, servicio, estado final, notas— y los
cambios de dueño. El detalle del turno en la agenda enlaza a la ficha de su unidad.

Desde la ficha se editan tipo, marca, modelo, año, VIN, número de motor, color y notas. La patente
no: es la clave de identidad, así que cambiarla puede partir o unir unidades sin que se vea. Se
corrige fusionando, o con el ítem de edición validada con trazabilidad que el roadmap ya tiene
abierto. El dueño tampoco se edita a mano en esta entrega; cambia cuando otro cliente reserva con
esa patente.

La fusión es una acción autenticada y explícita: reasigna los turnos de la unidad de origen a la de
destino, completa los campos vacíos del destino, registra el evento y elimina el origen, todo en una
transacción. Una clave de operación repetida no fusiona dos veces, como en los movimientos de
inventario. Nunca se fusiona sin confirmación de una persona.

## Rollback

El rename no es reversible volviendo el código: el anterior consulta `Motorcycle` y fallaría. Revertir
exige la migración inversa, que conserva los datos salvo las columnas nuevas. Las fusiones ya
confirmadas no se deshacen: eliminan una fila y reasignan turnos. Conviene fusionar recién después
de verificar la ficha en Preview.
