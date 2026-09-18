import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const PASSWORD_HASH_PREFIX = "scrypt";

export async function createPasswordHash(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${PASSWORD_HASH_PREFIX}:${salt}:${derived.toString("hex")}`;
}

let dummyHash: Promise<string> | undefined;

/** Runs the same scrypt work as a real check and always fails; used when the user does not exist. */
export async function verifyPasswordAgainstDummy(password: string): Promise<false> {
  dummyHash ??= createPasswordHash(randomBytes(16).toString("hex"));
  await verifyPassword(password, await dummyHash);
  return false;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [prefix, salt, expectedHex] = storedHash.split(":");
  if (prefix !== PASSWORD_HASH_PREFIX || !salt || !expectedHex) return false;

  const expected = Buffer.from(expectedHex, "hex");
  const actual = (await scryptAsync(password, salt, expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
