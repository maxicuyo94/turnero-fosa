import { decryptSensitive, encryptSensitive } from "@/src/lib/data-encryption";

export const orderPrivateFields = ["fullName", "email", "phone", "workshopName", "address", "city", "province", "postalCode"] as const;
type Contact = { [Field in typeof orderPrivateFields[number]]: string | null };

export function encryptOrderContact<T extends Contact>(contact: T): T {
  return Object.fromEntries(Object.entries(contact).map(([name, value]) => [name,
    orderPrivateFields.includes(name as typeof orderPrivateFields[number]) && typeof value === "string"
      ? encryptSensitive(value, `shop-${name}`) : value,
  ])) as T;
}

export function decryptOrderContact<T extends Contact>(contact: T): T {
  return Object.fromEntries(Object.entries(contact).map(([name, value]) => [name,
    orderPrivateFields.includes(name as typeof orderPrivateFields[number]) && typeof value === "string"
      ? decryptSensitive(value, `shop-${name}`) : value,
  ])) as T;
}
