import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";

function key(env: NodeJS.ProcessEnv): Buffer | null {
  const value = env.DATA_ENCRYPTION_KEY;
  if (!value) {
    if (env.NODE_ENV === "production") throw new Error("DATA_ENCRYPTION_KEY is required in production.");
    return null;
  }
  if (!/^[a-f0-9]{64}$/iu.test(value)) throw new Error("DATA_ENCRYPTION_KEY must contain 32 random bytes encoded as hex.");
  return Buffer.from(value, "hex");
}

/** Authenticated encryption. Purposes prevent a ciphertext being reused in another field. */
export function encryptSensitive(value: string, purpose: string, env = process.env): string {
  const secret = key(env);
  if (!secret) return value; // Local development only; release checks require encryption.
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secret, iv);
  cipher.setAAD(Buffer.from(purpose));
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
}

export function decryptSensitive(value: string, purpose: string, env = process.env): string {
  if (!value.startsWith(PREFIX)) return value; // Legacy rows, until security:encrypt-outbox is run.
  const secret = key(env);
  if (!secret) throw new Error("The encryption key is required to read encrypted data.");
  const payload = Buffer.from(value.slice(PREFIX.length), "base64url");
  if (payload.length < 28) throw new Error("Invalid encrypted data.");
  const decipher = createDecipheriv("aes-256-gcm", secret, payload.subarray(0, 12));
  decipher.setAAD(Buffer.from(purpose));
  decipher.setAuthTag(payload.subarray(12, 28));
  return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString("utf8");
}

export function isEncrypted(value: string): boolean { return value.startsWith(PREFIX); }
