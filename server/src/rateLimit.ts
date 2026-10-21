import { Request, Response, NextFunction } from "express";
import { getPrisma } from "./prisma.js";

export interface RateLimitConfig {
  accountWindowMs: number; // 15 minutes window
  accountMaxFailed: number; // 5 failed attempts per (IP, Email)
  accountLockoutMs: number; // 15 minutes lockout
  ipMaxFailed: number; // 60 failed attempts per IP across all accounts
}

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  accountWindowMs: 15 * 60 * 1000,
  accountMaxFailed: 5,
  accountLockoutMs: 15 * 60 * 1000,
  ipMaxFailed: 60,
};

let currentConfig: RateLimitConfig = { ...DEFAULT_RATE_LIMIT_CONFIG };

export function setRateLimitConfig(config: Partial<RateLimitConfig>): void {
  currentConfig = { ...currentConfig, ...config };
}

export async function resetLoginRateLimits(): Promise<void> {
  const prisma = getPrisma();
  await prisma.loginAttempt.deleteMany();
  currentConfig = { ...DEFAULT_RATE_LIMIT_CONFIG };
}

/**
 * Get client IP securely from Express req.ip (trust proxy must be enabled).
 * Never read X-Forwarded-For manually to prevent header spoofing.
 */
export function getClientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || "127.0.0.1";
}

/**
 * Normalize email key
 */
export function normalizeAccountKey(email: unknown): string {
  if (typeof email !== "string") return "";
  return email.trim().toLowerCase();
}

/**
 * Middleware: Check if the (IP, Email) pair or the IP itself is currently locked out
 */
export async function checkLoginRateLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  const ip = getClientIp(req);
  const email = normalizeAccountKey(req.body?.email);

  if (!email) {
    // Missing email handled downstream (400 Bad Request)
    next();
    return;
  }

  const prisma = getPrisma();
  const now = new Date();

  try {
    // 1. Check (IP, Email) composite lockout (prevents DoS on other users from different IPs)
    const accountAttempt = await prisma.loginAttempt.findUnique({
      where: {
        ip_email: { ip, email },
      },
    });

    if (accountAttempt?.lockedUntil && accountAttempt.lockedUntil > now) {
      const retryAfter = Math.ceil((accountAttempt.lockedUntil.getTime() - now.getTime()) / 1000);
      const minutesLeft = Math.ceil(retryAfter / 60);
      res.setHeader("Retry-After", retryAfter);
      res.status(429).json({
        error: `Too many failed login attempts from this network. Account temporarily locked for this device. Please try again in ${minutesLeft} minute${minutesLeft > 1 ? "s" : ""}.`,
        retryAfter,
      });
      return;
    }

    // 2. Check Global IP flood failed attempts (prevents spraying 100s of accounts from single IP)
    const windowStart = new Date(now.getTime() - currentConfig.accountWindowMs);
    const ipTotalFailed = await prisma.loginAttempt.aggregate({
      where: {
        ip,
        updatedAt: { gte: windowStart },
      },
      _sum: {
        failedCount: true,
      },
    });

    const totalFromIp = ipTotalFailed._sum.failedCount || 0;
    if (totalFromIp >= currentConfig.ipMaxFailed) {
      const retryAfter = Math.ceil(currentConfig.accountLockoutMs / 1000);
      res.setHeader("Retry-After", retryAfter);
      res.status(429).json({
        error: "Too many failed login attempts from this IP address. Please try again later.",
        retryAfter,
      });
      return;
    }

    next();
  } catch (error) {
    // In case of DB error during rate limit check, fail open to avoid total auth outage
    console.error("Rate limit check error:", error);
    next();
  }
}

/**
 * Record a failed login attempt in PostgreSQL
 */
export async function recordLoginFailure(
  req: Request,
  emailInput: unknown
): Promise<{ failedCount: number; isLocked: boolean; retryAfter: number }> {
  const ip = getClientIp(req);
  const email = normalizeAccountKey(emailInput);
  if (!email) return { failedCount: 0, isLocked: false, retryAfter: 0 };

  const prisma = getPrisma();
  const now = new Date();
  const windowStart = new Date(now.getTime() - currentConfig.accountWindowMs);

  try {
    const existing = await prisma.loginAttempt.findUnique({
      where: { ip_email: { ip, email } },
    });

    let newCount = 1;
    let lockedUntil: Date | null = null;

    if (existing) {
      if (existing.updatedAt >= windowStart) {
        newCount = existing.failedCount + 1;
      } else {
        newCount = 1;
      }
    }

    const isLocked = newCount >= currentConfig.accountMaxFailed;
    if (isLocked) {
      lockedUntil = new Date(now.getTime() + currentConfig.accountLockoutMs);
    }

    await prisma.loginAttempt.upsert({
      where: { ip_email: { ip, email } },
      create: {
        ip,
        email,
        failedCount: newCount,
        lockedUntil,
      },
      update: {
        failedCount: newCount,
        lockedUntil,
      },
    });

    const retryAfter = isLocked ? Math.ceil(currentConfig.accountLockoutMs / 1000) : 0;
    return { failedCount: newCount, isLocked, retryAfter };
  } catch (error) {
    console.error("Failed to record login failure:", error);
    return { failedCount: 0, isLocked: false, retryAfter: 0 };
  }
}

/**
 * Clear failed login attempts in PostgreSQL upon successful login
 */
export async function recordLoginSuccess(req: Request, emailInput: unknown): Promise<void> {
  const ip = getClientIp(req);
  const email = normalizeAccountKey(emailInput);
  if (!email) return;

  const prisma = getPrisma();
  try {
    await prisma.loginAttempt.deleteMany({
      where: { ip, email },
    });
  } catch (error) {
    console.error("Failed to clear login attempts:", error);
  }
}
