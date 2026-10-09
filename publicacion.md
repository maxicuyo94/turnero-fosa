# Preparación de publicación

## Cambios incluidos

Próxima fecha disponible cuando la fecha elegida está completa o cerrada; recuperación de códigos por email desde «Consultar turno»; resumen y condiciones antes de cancelar. No se modifican las políticas vigentes ni se habilitan cobros o devoluciones automáticamente.

## Comprobación del entorno

`pnpm release:check --local` revisa la configuración local sin mostrar secretos. Para revisar un entorno de publicación, seleccionar explícitamente un archivo privado completo: `pnpm release:check --env=.env.preview.local` o `pnpm release:check --env=.env.production.local`. La comprobación sólo lee datos y no publica, migra ni cambia contraseñas. Vercel no permite exportar las variables sensibles: una descarga puede contener campos vacíos o `[SENSITIVE]`, por lo que ese archivo no acredita la configuración online ni sirve para ejecutar esta comprobación sin completarlo de forma privada. La revisión del proveedor de señas de este script está orientada a producción; el sandbox de Preview debe revisarse por separado.

Comprobar en ese mismo entorno el estado de migraciones con `prisma migrate status`. El despliegue existente en Vercel aplica las migraciones con `pnpm vercel-build`. Esta etapa no necesita nuevas tablas ni migraciones.

## Requisitos operativos

- Dominio HTTPS del entorno, secreto de sesiones y acceso de administrador propio; no usar las credenciales de desarrollo publicadas en este chat.
- Remitente con dominio verificado y credenciales del proveedor de correo. Probar entrega a una cuenta propia; la comprobación automática no puede acreditar recepción. Un remitente de prueba de Resend no habilita envíos a todos los clientes.
- Mantener servicios, días abiertos, anticipación mínima y ventana de reservas según la operación real del taller.
- Configurar contacto público y política de devolución si hay señas. La cancelación online continúa dependiendo de la configuración del taller.
- Si se cobra una seña, verificar credenciales y notificaciones del entorno correspondiente. Cancelar un turno no inicia una devolución de dinero.
- Programar las tareas existentes `/api/cron/emails` y `/api/cron/deposits` con `CRON_SECRET` según las necesidades del taller. Las solicitudes conservan el mecanismo de procesamiento posterior a la respuesta como respaldo.

## Validación antes de actualizar online

Ejecutar tipos, revisión estática, pruebas, compilación y recorridos de navegador. Revisar reserva, consulta, recuperación, cancelación, reprogramación interna e inventario en móvil y escritorio. Confirmar que no se cargan datos de demostración en producción.

La integración Git existente publica las ramas `preview` y `main`. La publicación manual utiliza directamente la carpeta local y las variables de Vercel de cada entorno; no actualiza esas ramas ni ejecuta GitHub Actions. Primero verificar Preview y después publicar Producción.

## Resultado local del 9 de octubre de 2026

Pasaron 69 pruebas unitarias seleccionadas, dos pruebas de recuperación contra la base local y 14 casos de navegador entre móvil y escritorio. La base local tiene aplicadas sus 19 migraciones y la comprobación local de configuración pasó. La recepción de emails y la configuración de producción necesitan verificarse en ese entorno.

Tipos, revisión estática de los archivos afectados, compilación completa de la aplicación y compilación del sistema visual pasaron. Los datos y la política del pie público se leen al atender cada solicitud; la compilación no intenta precargar ese contacto desde la base del entorno publicado.

La revisión de publicación resolvió los cinco avisos preexistentes mediante versiones fijas en las sustituciones de dependencias y el archivo de bloqueo. `pnpm audit --prod` ya no informa vulnerabilidades conocidas:

| Dependencia | Versión corregida | Validación |
|---|---|---|
| `deepmerge-ts`, transitiva de Prisma | `8.0.0` | Generación del cliente y migraciones en ambos entornos |
| `mysql2`, transitiva de Prisma | `3.23.1` | Instalación y compilación; la aplicación usa PostgreSQL |
| `source-map-js` | `1.2.2` | Compilación de la aplicación y del sistema visual |
| `uuid`, transitiva de ExcelJS | `11.1.1` | Pruebas existentes de lectura y escritura de inventario Excel |

## Publicación manual realizada

El 9 de octubre de 2026 se publicaron los cambios locales completos de la aplicación mediante Vercel CLI. No se hicieron commits, pushes ni cambios de ramas en GitHub y no se ejecutó GitHub Actions. La compilación del alojamiento utilizó el proceso existente `pnpm vercel-build`, con las variables propias de cada entorno. Producción omitió la sincronización del administrador de Preview.

| Entorno | URL estable | Despliegue confirmado Ready |
|---|---|---|
| Preview | https://turnero-fosa-git-preview-maxicuyo94s-projects.vercel.app | https://turnero-fosa-c2glmjq01-maxicuyo94s-projects.vercel.app |
| Producción | https://turnero-fosa.vercel.app | https://turnero-fosa-m4i6cky43-maxicuyo94s-projects.vercel.app |

Preview se publicó con `--target=preview --meta githubCommitRef=preview` para seleccionar sus credenciales y se asignó su alias estable después de la comprobación. Producción se publicó con `--prod`. Las inspecciones de las dos URLs estables confirman los despliegues nuevos.

La lista de subida se verificó antes de publicar: no incluyó variables privadas, notas `*.local.md`, metadatos Git ni resultados locales. `.vercelignore` ahora excluye también esos archivos y los artefactos de diseño generados.

### Validación de esta publicación

- 313 pruebas unitarias y diez casos de navegador en móvil y escritorio correctos.
- Tipos, revisión estática completa, compilación de la aplicación y del sistema visual correctos.
- Reserva y consulta respondieron HTTP 200 en ambos entornos; el acceso anónimo a la biblioteca visual redirigió al ingreso (307).
- Navegador: reserva con disponibilidad real en Preview, acceso de administrador y biblioteca visual nueva en Preview y Producción.
- Las 19 migraciones estaban aplicadas en las dos bases: los despliegues no tuvieron migraciones pendientes.
- No se cargaron datos de demostración, no se crearon reservas de prueba en producción y no se hicieron cobros ni envíos de correo de prueba.

### Pendientes operativos y recuperación

La recepción real de emails sigue sin acreditarse. Verificar remitente y dominio con Resend y entrega a una cuenta propia; un remitente de prueba sólo permite destinatarios limitados. Completar el contacto público si falta y validar los recorridos con clientes y personal. No se modificaron cobros ni políticas del taller para publicar.

Las variables sensibles no fueron exportadas para una comprobación local completa de producción; las compilaciones online, migraciones y pantallas prueban el acceso y funcionamiento descritos, sin acreditar entrega de correo ni transacciones de Mercado Pago.

El despliegue de producción anterior a esta publicación es https://turnero-fosa-o2nfyf57d-maxicuyo94s-projects.vercel.app. Se conserva como referencia para restaurar la versión anterior mediante Vercel si fuese necesario. Las ramas de GitHub siguen con su contenido anterior: incorporar estos cambios locales antes de una futura publicación desde Git, para que no sobrescriba esta versión con código anterior.
