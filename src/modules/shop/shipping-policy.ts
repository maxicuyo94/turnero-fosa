// Initial delivery area. Keep the checkout and server validation on the same policy.
export const deliveryCity = "Salta";
export const deliveryProvince = "Salta";
export const deliveryPostalCode = "4400";
export const deliveryAreaLabel = "Salta capital";
export const deliveryAreaNotice = "Por el momento, el envío a domicilio está disponible solo dentro de la ciudad de Salta.";
function normalized(value: string) { return value.trim().toLocaleLowerCase("es-AR").replace(/\s+/gu, " "); }
export function isLocalDelivery(city: string, province: string, postalCode: string) {
  return ["salta", "salta capital", "ciudad de salta"].includes(normalized(city)) && normalized(province) === "salta" && postalCode.trim() === deliveryPostalCode;
}
