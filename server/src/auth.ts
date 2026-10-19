import crypto from "crypto";

const ITERATIONS = 10000;
const KEY_LEN = 64;
const DIGEST = "sha512";

/**
 * Hash a password using PBKDF2 sync.
 * Returns a string formatted as "salt:hash"
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST).toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verify a password against a stored "salt:hash" string.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  const testHash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST).toString("hex");
  return hash === testHash;
}

// Session Management
export interface Session {
  userId: number;
  email: string;
  name: string;
  role: string;
  expiresAt: Date;
}

const sessions = new Map<string, Session>();

export function createSession(userId: number, email: string, name: string, role: string): string {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour session
  sessions.set(token, { userId, email, name, role, expiresAt });
  return token;
}

export function getSession(token: string): Session | null {
  const session = sessions.get(token);
  if (!session) return null;
  if (new Date() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  return session;
}

export function destroySession(token: string): boolean {
  return sessions.delete(token);
}
