import { createHash } from "node:crypto";

/**
 * Identity keys for customers and vehicles.
 *
 * A booking is typed by a person in a hurry, so the same unit arrives written in several ways.
 * These keys are what a repeated booking is matched against, never what is shown back: the stored
 * spelling stays untouched.
 */

/**
 * Identity key of a unit: uppercase letters and digits only, so `ab 123 cd`, `AB-123-CD` and
 * `AB123CD` are the same motorcycle. Returns null when nothing identifying remains, and a booking
 * without a plate always creates a new unit rather than joining an arbitrary one.
 */
export function normalizeLicensePlate(licensePlate: string | null | undefined): string | null {
  if (!licensePlate) return null;
  const normalized = licensePlate.toUpperCase().replace(/[^A-Z0-9]/gu, "");
  return normalized.length > 0 ? normalized : null;
}

/**
 * Identity key of a customer: digits only. Deliberately conservative — `+5491112345678` and
 * `1112345678` stay apart, because trimming a country code to make them meet would also merge two
 * different people who share the last digits. Failing to merge duplicates a customer; merging
 * wrongly hands one person another's history, and a unit is matched by its plate either way.
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const normalized = phone.replace(/\D/gu, "");
  return normalized.length > 0 ? normalized : null;
}

/**
 * Derives a customer's id from their identity key, which is what keeps two simultaneous bookings
 * from each creating the same person.
 *
 * The booking transaction runs at SERIALIZABLE and takes its snapshot before it waits on the
 * capacity advisory lock, so a booking that queues behind another can still read a database without
 * the customer the first one just committed, find nothing and insert a second row. Deriving the id
 * from the key turns that silent duplicate into a primary key collision, which the repository already
 * retries on a fresh snapshot, and the retry then finds the row. Units no longer need this: their
 * plate has a unique index, and it can be corrected, which a derived id would contradict.
 */
export function identityDerivedId(prefix: string, identityKey: string): string {
  return `${prefix}_${createHash("sha256").update(identityKey).digest("hex").slice(0, 24)}`;
}
