# Diseño — Detalle operativo del turno

La agenda existente carga los datos para el panel lateral. Los enlaces de contacto
se generan en el cliente a partir de dígitos del teléfono; si no hay un número
utilizable no se muestran. El formulario usa una acción de servidor que comprueba
la sesión interna y redirige a la agenda con un código de resultado.

La migración agrega versiones de edición de detalles a `Customer` y `Appointment`
y la tabla aditiva `AppointmentDetailChange`. Cada fila guarda un campo modificado,
valor anterior/nuevo, cliente, turno de origen, usuario y fecha. Una transacción
bloquea cliente y turno, compara versiones y `updatedAt`, rechaza un teléfono que
ya pertenece a otro cliente y escribe datos e historial juntos. La ficha del turno
presenta los cambios de contacto del cliente y los cambios de notas de ese turno.

Las reservas crean clientes con un identificador derivado del teléfono. Al corregir
un número, ese identificador sigue ocupado; la reserva de un cliente nuevo con el
número anterior busca identificadores alternativos deterministas antes de crear.
Así conserva el comportamiento ante reservas concurrentes.
