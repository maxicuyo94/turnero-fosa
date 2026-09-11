# Configuración persistente

The system MUST persist business contact and deposit policy settings behind internal authentication.
- Given saved contact details, when a public page loads, then it displays the configured phone and WhatsApp.
- Given a configured sender or public URL, when sending email or creating payment links, then the stored setting overrides the environment fallback.
- Given an enabled deposit with a future activation date, when booking before that date in Argentina, then no deposit is required; on that date it is required.
- Given a changed service duration, when booking again, then availability uses the new duration while existing appointment intervals remain unchanged.
- Given invalid contact, URL, date or duration, when saving, then no invalid data is persisted and the panel reports the validation failure.
