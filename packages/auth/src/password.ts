import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

/** Length of the derived key in bytes. */
const KEY_LENGTH = 64;

/**
 * Hashes a plaintext password with scrypt and a random per-password salt.
 * Returns a `${salt}:${derivedKey}` string (both hex) suitable for storage.
 */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
};

/**
 * Verifies a plaintext password against a stored `${salt}:${derivedKey}` hash
 * using a constant-time comparison.
 */
export const verifyPassword = async (
  password: string,
  storedHash: string,
): Promise<boolean> => {
  const [salt, key] = storedHash.split(":");
  if (!salt || !key) return false;

  const keyBuffer = Buffer.from(key, "hex");
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;

  if (keyBuffer.length !== derivedKey.length) return false;
  return timingSafeEqual(keyBuffer, derivedKey);
};
