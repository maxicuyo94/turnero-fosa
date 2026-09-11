# Diseño

Calcular conflictos desde los turnos activos de la base al cargar el panel, sin guardar un indicador que pueda quedar desactualizado. Considerar todos los intervalos futuros y la parte pendiente de turnos en curso, independientemente de la semana seleccionada. Agrupar eventos de inicio/fin por instante para no contar intervalos adyacentes como superpuestos.

Mostrar un aviso rojo sin cierre automático con capacidad y enlaces a fechas afectadas. Desaparece en la siguiente carga cuando los datos ya no excedan el límite. No modifica turnos, no bloquea el guardado y no requiere migración. Rollback mediante versión anterior.
