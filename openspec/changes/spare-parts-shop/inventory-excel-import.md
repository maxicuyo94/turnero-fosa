# Importación de inventario desde Excel

## Propuesta y alcance

Completar E1 con altas masivas desde la plantilla descargable en Inventario.
Sólo productos nuevos. La carga no modifica fichas ni existencias anteriores.
No requiere migración ni modifica turnos. Publicación fuera de esta ejecución.

## Contrato

- Sesión interna requerida antes de leer el archivo o acceder al inventario.
- Formato `.xlsx`, máximo 3 MB y 1.000 productos. Hoja `Carga`, encabezados
  de la plantilla entre las primeras diez filas; columnas reordenables.
- Filas vacías ignoradas, incluso entre productos. Informar los números reales
  de fila y mostrar hasta 25 errores. Cualquier error rechaza el archivo completo.
- SKU normalizado a mayúsculas; código de barras como texto para conservar ceros.
- SKU opcional al dar de alta: el formulario genera un código a partir de la clave
  de operación y Excel a partir del contenido normalizado de la fila. Conservar
  la columna SKU aunque sus celdas estén vacías. Reordenar filas sin modificarlas
  mantiene sus códigos y evita duplicados al reimportar. Cambiar su contenido
  genera otro código: las correcciones y entradas se hacen desde la ficha existente.
- Precio expresado en ARS con dos decimales como máximo; persistencia en centavos.
- Cantidades enteras no negativas. Estado activo explícito Sí/No.
- SKU/códigos repetidos en el archivo o ya existentes cancelan toda la carga.
- Alta de todos los productos y movimientos iniciales en una transacción serializable.
  Auditoría atribuida al usuario autenticado; los reintentos no duplican existencias.

## Diseño

ExcelJS lee y valida la plantilla; el servicio vuelve a validar su entrada y realiza
la conversión definitiva a centavos. Escrituras por lotes para evitar miles de
consultas dentro de la transacción. Restricciones únicas y reintento serializable
protegen importaciones concurrentes. El límite de Server Actions es 4 MB para
admitir el archivo de 3 MB y el formulario; el navegador también controla el tamaño.

La plantilla conserva contenido, validaciones y formato. Se normalizaron los
prefijos XML de SpreadsheetML porque ExcelJS no reconocía el prefijo `x:` usado
en el archivo original. La prueba abre el archivo público real, además de cubrir
el recorrido descarga → edición → carga.

## Verificación

Ver `validation.md` para resultados, entorno y límites de esta entrega.
