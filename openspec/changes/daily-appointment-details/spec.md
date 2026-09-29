# Requisitos — Detalle operativo del turno

- El personal autenticado MUST poder copiar el código público y abrir enlaces `tel:`
  y WhatsApp construidos con el teléfono almacenado. El sistema MUST NOT agregar
  un código de país supuesto.
- El personal autenticado MUST poder corregir nombre, teléfono y email del cliente
  y las notas del turno. Los datos MUST validarse en el servidor.
- Cada campo modificado MUST registrar valor anterior, nuevo, fecha, usuario y turno
  desde el que se hizo el cambio. El historial de contacto MUST ser visible desde
  otros turnos del mismo cliente; las notas MUST quedar asociadas al turno editado.
- Una pantalla desactualizada MUST NOT sobrescribir silenciosamente cambios recientes.
  Un teléfono ya asociado a otro cliente MUST ser rechazado.
- Corregir un teléfono MUST NOT impedir que un cliente nuevo reserve usando el número
  anterior, ni hacer que las reservas con el número nuevo pierdan el cliente existente.

## Casos de aceptación

1. Al abrir un turno, copiar el código deja el mismo texto en el portapapeles;
   llamada y WhatsApp usan el número registrado.
2. Cambiar contacto y notas registra únicamente los campos modificados y muestra
   responsable y valores antes/después.
3. Dos ediciones simultáneas con la misma versión aceptan una sola; la otra pide
   revisar datos actuales.
4. Tras corregir el teléfono, una reserva con el número viejo crea otro cliente y
   una reserva con el nuevo reutiliza el cliente corregido.
