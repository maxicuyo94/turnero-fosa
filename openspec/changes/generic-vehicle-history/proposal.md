# Unidad genérica con historial

El taller podrá ver la historia de una unidad: qué turnos tuvo, qué servicio se hizo en cada
uno y en qué terminó. La entidad deja de ser "moto" y pasa a ser "vehículo", con un catálogo
de tipos administrable desde Configuración, porque el taller ya recibe unidades que no son motos.

El habilitador no es el modelo sino la identidad. Hoy cada reserva pública crea un cliente y una
moto nuevos sin excepción ([repositorio de reservas](../../../src/modules/booking/prisma-repository.ts)),
así que una unidad nunca acumula más de un turno y el historial no existe aunque los datos estén.
La especificación vigente de [captura de cliente](../../specs/customer-motorcycle-records/spec.md)
ya pide crear **o reutilizar**; esta entrega cierra esa brecha.

La unidad se reconoce por su patente normalizada. Sin patente se crea una unidad nueva, porque una
moto vieja puede no tenerla, y el taller la vincula a mano desde el panel. Los duplicados que ya
existen en producción no se fusionan solos: el panel los propone y una persona confirma cada fusión.

Alcance de esta entrega: V1 (entidad genérica, catálogo de tipos, identidad y reutilización) y
V2 (ficha de unidad con historial, buscador y fusión manual), en dos revisiones encadenadas.
Fuera de alcance: registro de trabajo realizado, kilometraje y repuestos consumidos por turno,
que el [roadmap](../../ROADMAP.md) mantiene diferidos como historia mecánica completa.
