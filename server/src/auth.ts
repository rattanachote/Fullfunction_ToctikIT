import crypto from "crypto";
import { getPrisma } from "./prisma.js";

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
 * Verify a password against a stored "salt:hash" string using constant-time comparison.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  const testBuf = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST);
  const storedBuf = Buffer.from(hash, "hex");
  if (storedBuf.length !== testBuf.length) return false;
  return crypto.timingSafeEqual(storedBuf, testBuf);
}

/**
 * Hash a session token using SHA-256 so raw tokens are never stored in Postgres.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export interface SessionWithUser {
  userId: number;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  mustChangePassword: boolean;
  expiresAt: Date;
}

/**
 * Create a new 24-hour session in Postgres after cleaning up expired sessions.
 */
export async function createSession(
  userId: number,
  _email?: string,
  _name?: string,
  _role?: string
): Promise<string> {
  const prisma = getPrisma();
  const now = new Date();

  // Clean up expired sessions on login
  await prisma.session.deleteMany({
    where: { expiresAt: { lt: now } },
  });

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hour session

  await prisma.session.create({
    data: {
      tokenHash,
      userId,
      expiresAt,
    },
  });

  return token;
}

/**
 * Look up a session by SHA-256 token hash and fetch its associated User in a single query.
 */
export async function getSession(token: string): Promise<SessionWithUser | null> {
  const prisma = getPrisma();
  const tokenHash = hashToken(token);

  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session) return null;

  if (new Date() > session.expiresAt) {
    await prisma.session.deleteMany({ where: { tokenHash } });
    return null;
  }

  return {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    isActive: session.user.isActive,
    mustChangePassword: session.user.mustChangePassword,
    expiresAt: session.expiresAt,
  };
}

/**
 * Destroy a session in Postgres by its SHA-256 token hash.
 */
export async function destroySession(token: string): Promise<boolean> {
  const prisma = getPrisma();
  const tokenHash = hashToken(token);
  const result = await prisma.session.deleteMany({
    where: { tokenHash },
  });
  return result.count > 0;
}

/**
 * Revoke all sessions for a given userId, optionally keeping the current token active.
 */
export async function revokeUserSessions(userId: number, keepToken?: string): Promise<number> {
  const prisma = getPrisma();
  const where: any = { userId };
  if (keepToken) {
    where.tokenHash = { not: hashToken(keepToken) };
  }
  const result = await prisma.session.deleteMany({ where });
  return result.count;
}
