# Diseño

WorkshopSettings posee teléfono público, WhatsApp, URL pública, remitente, política de devolución y fecha calendario de activación. Campos opcionales permiten conservar los despliegues existentes, con respaldo de URL/remitente del entorno. La fecha rige desde las 00:00 de Argentina y requiere además depositRequired. No se modifican intentos de pago existentes.

Las acciones exigen sesión interna y validan los datos antes de persistir. Las duraciones se actualizan en Service y afectan reservas nuevas; los intervalos de citas existentes se conservan. Horarios, descansos, capacidad, aviso mínimo y ventana conservan sus repositorios actuales. La URL admite únicamente origen HTTPS y el remitente una dirección de email. Los enlaces públicos se construyen desde datos validados.

Rollback: volver al código anterior conserva las columnas opcionales. Si se hubiera programado un cobro, deshabilitarlo antes del rollback: el código anterior no conoce la fecha de activación.
