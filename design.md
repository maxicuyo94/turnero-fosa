# Diseño de Turnero Fosa

Documento de referencia para las pantallas públicas y la gestión del taller. Actualizado el 9 de octubre de 2026.

## Objetivo y usuarios

Los clientes deben poder elegir un servicio, encontrar un horario, reservar y consultar su turno desde el celular. El personal del taller debe encontrar rápidamente la agenda, cambiar el estado de un trabajo y gestionar unidades, repuestos y horarios.

La identidad actual se conserva: fondo oscuro, tarjetas de bordes suaves, tipografía clara y verde lima. La siguiente etapa concentra el trabajo en jerarquía, densidad y recorridos móviles.

## Principios

- Una acción principal por grupo de tarea. El lima destaca acciones y selecciones; los datos secundarios usan tonos neutros legibles.
- Mostrar primero lo necesario para la tarea habitual. Edición, importación e historial se presentan a demanda.
- Separar navegación de clientes y navegación del taller. La gestión mantiene una entrada secundaria al sitio público.
- Mantener el contexto de servicio, fecha, horario y estado junto a las acciones que lo necesitan.
- En móvil, usar listas y cuadrículas compactas que no obliguen a desplazarse horizontalmente para consultar información esencial.
- Escribir en español rioplatense: «Reservá», «Elegí», «Completá». Explicar campos opcionales y consecuencias antes de confirmar.

## Sistema visual

| Elemento | Criterio |
|---|---|
| Superficie | Base `#090d0b`, degradado oscuro y tarjetas con borde tenue. |
| Acción principal | `apple-400` con texto oscuro; `apple-300` para foco y selección. |
| Texto | Blanco para contenido principal; `zinc-300` / `zinc-400` para contenido secundario. |
| Estados | Etiqueta textual compartida en agenda, consulta e historial; el color complementa el texto. |
| Controles | Altura mínima de 44 px para acciones frecuentes; campos de 16 px en móvil. |
| Foco | Contorno visible; diálogos con entrada, recorrido, Escape y restauración del foco. |
| Impresión | Etiquetas blancas con texto oscuro y dimensiones físicas; no heredan el tema de pantalla. |

El contraste debe comprobarse sobre la superficie real. La referencia para texto normal es 4,5:1; los colores base ya se corrigieron, pero esto no representa una certificación completa de accesibilidad.

### Biblioteca compartida

Los componentes nuevos usan roles semánticos para superficies, texto, bordes, acción principal, foco y errores. Los radios de controles, acciones grandes y paneles se definen una sola vez. Botones, tarjetas, campos, secciones desplegables y pestañas ya consumen estos roles; las composiciones anteriores pueden migrarse gradualmente.

`TabNav` unifica navegación principal y secundaria del panel dentro de la biblioteca. `Button` distingue acción principal, alternativa, acción discreta y confirmación destructiva. Se evita usar verde para confirmar cancelaciones. `Field` vincula ayudas y errores con el control, preserva descripciones existentes y mantiene su etiqueta al corregir un error. Los controles contemplan estados deshabilitados y la preferencia de movimiento reducido.

La referencia visual se consulta en `/internal/design-system` con acceso de administrador. Incluye ejemplos de colores, acciones, formularios, navegación, estados y mensajes. Los ejemplos no modifican datos del taller. Las reglas de composición y uso están en `src/components/ui/README.md`.

La actualización de la biblioteca pasó 43 pruebas unitarias seleccionadas y diez recorridos de navegador en móvil y escritorio, incluyendo restricciones de acceso a la referencia, reserva, reprogramación e inventario. Se verificaron campos de 16 px y altura mínima de 44 px en móvil, la asociación de errores y el foco de teclado.

## Correcciones ya realizadas

- Contraste del texto auxiliar, tonos de marca faltantes y nombres compartidos de estados.
- Botones y campos más amplios, foco visible y estado accesible de activadores.
- Teléfono con teclado apropiado, autocompletado y campos opcionales identificados.
- Selección persistente del horario con borde, fondo y texto.
- Fecha y navegación antes del resumen compacto de agenda.
- Mensajes de pago diferenciados; reintentos condicionados por el estado del turno y del pago.
- Inventario vacío diferenciado de una búsqueda sin coincidencias.
- Diálogo de turno con cierre por Escape y recuperación del foco.

## Continuación del refinamiento

### Inicio y navegación

La reserva es el recorrido principal del inicio. «Consultar mi turno» aparece como alternativa próxima. El acceso del personal tiene menos énfasis. Dentro del panel, la cabecera comunica que se está gestionando el taller y ofrece «Ver sitio público» como enlace secundario. La navegación interna sigue mostrando las secciones habilitadas para cada usuario.

La navegación secundaria de Configuración y Repuestos usa pestañas de texto con una línea inferior para la sección activa. Se eliminan las cápsulas y sus fondos; en móvil se distribuyen en dos columnas, manteniendo el área de interacción y el foco visible.

### Reserva

Mantener el recorrido servicio y fecha → horario → datos y confirmación. Usar dos columnas de horarios en móvil, agrupadas en mañana y tarde. Conservar el horario elegido junto a los datos; si no hay disponibilidad, explicar cómo buscar otra fecha antes de pedir información personal. Mostrar importe y condiciones de seña cuando correspondan.

La búsqueda y el envío conservan sus validaciones del servidor, claves de idempotencia y reglas de disponibilidad. Esta iteración mejora la presentación del recorrido; no cambia las políticas de reserva ni introduce pagos automáticos.

### Agenda

La semana móvil se presenta como lista por día, con horarios, cliente y estado; la cuadrícula se mantiene para escritorio. La fecha, el cambio de vista y la navegación se muestran antes de los filtros. Los turnos siguen abriendo el mismo detalle.

### Detalle de turno

Orden: resumen → cambio de estado → acciones auxiliares. Corrección de contacto, reprogramación e historial se agrupan en secciones desplegables con nombres claros. Ningún formulario depende de campos ocultos que puedan impedir el guardado de otro formulario. El foco se mantiene dentro del diálogo incluso con secciones abiertas o cerradas.

### Inventario

Búsqueda y resultados preceden al alta y a la importación. El escaneo es una herramienta auxiliar visible a demanda. Crear e importar tienen entradas claras y secciones que pueden abrirse directamente. Conservar auditoría, reservas de stock, confirmaciones y validaciones existentes.

### Horarios

Cada día muestra un resumen y permite desplegar sus campos. Mantener todos los campos del conjunto en el formulario para guardar días cerrados y abiertos sin perder datos. «Guardar horarios» permanece accesible. Las excepciones y la importación de feriados conservan sus formularios independientes.

## Comprobación

| Área | Resultado verificable |
|---|---|
| Reserva móvil | Catorce horarios no forman catorce filas; se distingue y se recuerda la selección. |
| Semana móvil | Los siete días se consultan sin desplazamiento horizontal de la agenda. |
| Detalle | Cambiar estado aparece antes que editar contacto o reprogramar; teclado y Escape funcionan. |
| Inventario | Búsqueda y listado aparecen antes de alta/importación; se pueden cargar varios repuestos consecutivos. |
| Horarios | La semana se compara mediante resúmenes; guardar conserva también los días plegados. |
| Navegación | El cliente identifica la reserva principal y el personal reconoce el contexto de gestión. |
| Calidad | Pruebas de componentes y recorridos afectados, revisión móvil/tablet/escritorio, tipos, estilos y compilación del sistema visual. |

## Mejoras profundas aplicadas

Cuando la fecha elegida no tiene horarios, la reserva ofrece la primera fecha disponible y su primer horario. La búsqueda respeta feriados, pausas, capacidad, duración, anticipación mínima y ventana de reservas. El enlace conserva servicio y duración del personal. Si no existe otra fecha dentro del período permitido, explica cómo consultar con el taller. La disponibilidad se verifica nuevamente al reservar.

«Consultar turno» permite desplegar «¿Perdiste el código?». La recuperación envía por email los códigos de hasta diez turnos próximos, pendientes o confirmados. Sólo usa el email capturado en cada reserva; el email de una ficha compartida de cliente no otorga acceso. La pantalla responde igual exista o no una coincidencia. Hay límites compartidos por destinatario y dirección de conexión. Sin correo configurado se comunica la indisponibilidad. Reservas sin email requieren contacto con el taller.

La cancelación valida el secreto antes de mostrar código, servicio, fecha, intervalo y seña. Publica la política guardada y distingue pagos aprobados, sin confirmar, devueltos y contracargos. Si el enlace, estado, fecha o política no permiten cancelar, no ofrece el formulario. Cancelar libera el horario y no inicia una devolución de dinero. La acción vuelve a validar las condiciones; el enlace no envía su secreto como referencia al navegar a otro sitio.

Se agregó `publicacion.md` y una comprobación de configuración sin escrituras ni exposición de secretos. Los contactos y la política pública se leen durante la solicitud, para que no queden congelados al compilar.

Las hipótesis de diseño deben validarse posteriormente con clientes y personal; todavía no hay métricas de abandono ni pruebas de uso con esos grupos.

## Estado de ejecución

- [x] Correcciones cortas y medianas iniciales.
- [x] Crear este documento de referencia.
- [x] Inicio y cabecera según contexto.
- [x] Reserva compacta con resumen de selección.
- [x] Agenda semanal móvil por día.
- [x] Detalle con acciones frecuentes primero.
- [x] Inventario con búsqueda y listado primero.
- [x] Horarios con resúmenes desplegables y guardado accesible.
- [x] Verificar la continuación y registrar el resultado.
- [x] Ofrecer próxima fecha con disponibilidad real.
- [x] Recuperar códigos por email con límites y verificación de pertenencia.
- [x] Resumir turno y condiciones antes de cancelar.
- [x] Validar reserva, consulta, cancelación, reprogramación e inventario.
- [x] Documentar preparación de publicación y pendientes del entorno.

## Resultado de la verificación

- 53 pruebas unitarias seleccionadas, incluidas conservación de datos al cambiar horario y envío de los siete días con secciones plegadas.
- 24 recorridos de navegador entre escritorio y móvil: rutas, duración, reserva completa, navegación de agenda, cambio de estado, teclado del diálogo, corrección de contacto, reprogramación, alta consecutiva, importación y búsqueda por código.
- Tipos, revisión estática de los archivos afectados y compilación del sistema visual correctos.
- Revisión visual de inicio, reserva, agenda, inventario y horarios. Se comprobaron vistas a 390, 768 y 1440 px; la semana móvil y las vistas de ancho comprobadas no desbordan horizontalmente.
- El servidor de desarrollo queda disponible en `http://localhost:3000`.

La reserva conserva los datos al cambiar de horario. El detalle omite los controles de secciones cerradas al recorrerlo con teclado y consulta disponibilidad al abrir la reprogramación. Los formularios de inventario se abren desde sus enlaces directos. Los horarios conservan también los valores de días plegados; sus resúmenes reflejan los cambios y el guardado permanece accesible.

### Verificación de mejoras profundas

- 69 pruebas unitarias seleccionadas correctas, incluidas disponibilidad futura, verificación del secreto, estados de seña y límites de recuperación.
- Dos pruebas contra la base local comprueban que sólo se recuperan turnos futuros del email registrado en la reserva y que se encola el mensaje sin enviarlo durante la prueba.
- Ocho casos nuevos de navegador, entre móvil y escritorio, verifican próxima fecha, recuperación, cancelación explícita y restricciones. Seis casos adicionales repiten reserva completa, reprogramación interna y tres altas consecutivas de inventario.
- Las 19 migraciones de la base local están aplicadas. Esta etapa no incorpora migraciones.
- La comprobación local de configuración pasó. Eso no verifica el entorno de producción ni la recepción de emails.
- Tipos, revisión estática de archivos afectados, compilación completa de la aplicación y compilación del sistema visual correctos. Los ocho casos nuevos se repitieron después del ajuste de lectura de políticas durante la solicitud.
- Los cinco avisos de dependencias se corrigieron en la revisión de publicación del 9 de octubre. La auditoría de producción ya no informa vulnerabilidades conocidas. Las versiones y los requisitos operativos constan en `publicacion.md`.

### Revisión y publicación manual del 9 de octubre de 2026

Pasaron las 313 pruebas unitarias de la aplicación, diez casos de navegador en móvil y escritorio, tipos, revisión estática completa y compilación de la aplicación y del sistema visual. Las pruebas de Excel siguieron pasando con las dependencias corregidas.

Preview y Producción se publicaron desde la carpeta local mediante Vercel, sin actualizar ramas ni ejecutar GitHub Actions. Se comprobaron las URLs estables, reserva, consulta, protección del acceso y biblioteca visual con sesión de administrador. Las dos bases tenían las 19 migraciones al día. No se hicieron reservas, cobros ni envíos de correo de prueba sobre producción.

Quedan la comprobación de entrega real de emails, el contacto público del taller cuando falte y la validación de los recorridos con clientes y personal. Los resultados del despliegue constan en `publicacion.md`.
