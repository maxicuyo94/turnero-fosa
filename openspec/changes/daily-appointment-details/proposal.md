# Operación diaria desde el detalle del turno

## Objetivo

Reducir pasos al atender un turno y permitir corregir los datos de contacto y las
notas sin perder quién cambió cada dato ni su valor anterior.

## Alcance

- Copiar el código público; llamar y abrir WhatsApp con el número guardado.
- Editar nombre, teléfono y email del cliente desde un turno. El cliente es un
  registro compartido, por lo que el cambio aparece en todos sus turnos.
- Editar las notas del turno seleccionado y mostrar el historial de estos campos.

La edición de la unidad sigue disponible en su ficha. Este cambio no envía mensajes
ni modifica el estado, el horario o el pago del turno.
