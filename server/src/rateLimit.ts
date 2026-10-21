import { Request, Response, NextFunction } from "express";

export interface RateLimitConfig {
  ipWindowMs: number;
  ipMax: number;
  accountWindowMs: number;
  accountMaxFailed: number;
  accountLockoutMs: number;
}

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  ipWindowMs: 60 * 1000, // 1 minute per-IP window
  ipMax: 20, // max 20 login requests per minute per IP
  accountWindowMs: 15 * 60 * 1000, // 15 minutes failed attempt window
  accountMaxFailed: 5, // max 5 consecutive failed attempts
  accountLockoutMs: 15 * 60 * 1000, // 15 minutes temporary lockout
};

let currentConfig: RateLimitConfig = { ...DEFAULT_RATE_LIMIT_CONFIG };

interface IpRecord {
  count: number;
  resetAt: number;
}

interface AccountRecord {
  failedCount: number;
  resetAt: number;
  lockedUntil: number;
}

const ipMap = new Map<string, IpRecord>();
const accountMap = new Map<string, AccountRecord>();

/**
 * Configure rate limiter options (useful for testing custom thresholds)
 */
export function setRateLimitConfig(config: Partial<RateLimitConfig>): void {
  currentConfig = { ...currentConfig, ...config };
}

/**
 * Reset all rate limit counters to initial state
 */
export function resetLoginRateLimits(): void {
  ipMap.clear();
  accountMap.clear();
  currentConfig = { ...DEFAULT_RATE_LIMIT_CONFIG };
}

/**
 * Prune expired entries to prevent memory leaks
 */
function cleanupExpiredRecords(now: number): void {
  // Prune IP records whose reset time has passed
  for (const [ip, record] of ipMap.entries()) {
    if (now >= record.resetAt) {
      ipMap.delete(ip);
    }
  }

  // Prune Account records that are neither locked nor in an active failure window
  for (const [account, record] of accountMap.entries()) {
    if (now >= record.resetAt && now >= record.lockedUntil) {
      accountMap.delete(account);
    }
  }
}

/**
 * Normalize client IP address (handles IPv4, IPv6, loopback)
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim().length > 0) {
    const first = forwarded.split(",")[0].trim();
    if (first) return first;
  }
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
 * Tier 1: Per-IP burst limiter middleware
 * Checks if the originating IP has sent more than `ipMax` requests within `ipWindowMs`.
 */
export function loginIpRateLimiter(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  cleanupExpiredRecords(now);

  const ip = getClientIp(req);
  let record = ipMap.get(ip);

  if (!record || now >= record.resetAt) {
    record = { count: 1, resetAt: now + currentConfig.ipWindowMs };
    ipMap.set(ip, record);
  } else {
    record.count++;
  }

  const remaining = Math.max(0, currentConfig.ipMax - record.count);
  const resetSeconds = Math.ceil(record.resetAt / 1000);
  const retryAfter = Math.ceil((record.resetAt - now) / 1000);

  res.setHeader("X-RateLimit-Limit", currentConfig.ipMax);
  res.setHeader("X-RateLimit-Remaining", remaining);
  res.setHeader("X-RateLimit-Reset", resetSeconds);

  if (record.count > currentConfig.ipMax) {
    res.setHeader("Retry-After", retryAfter);
    res.status(429).json({
      error: "Too many login requests from this IP. Please try again later.",
      retryAfter,
    });
    return;
  }

  next();
}

/**
 * Tier 2: Per-Account pre-login check middleware
 * Checks if the targeted email is currently in temporary lockout from previous failures.
 */
export function checkAccountLockout(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  const email = normalizeAccountKey(req.body?.email);

  if (!email) {
    // If email is missing, let standard validation handle it (400 Bad Request)
    next();
    return;
  }

  const record = accountMap.get(email);
  if (record && record.lockedUntil > now) {
    const retryAfter = Math.ceil((record.lockedUntil - now) / 1000);
    const minutesLeft = Math.ceil(retryAfter / 60);
    res.setHeader("Retry-After", retryAfter);
    res.status(429).json({
      error: `Too many failed login attempts. Account temporarily locked. Please try again in ${minutesLeft} minute${minutesLeft > 1 ? "s" : ""}.`,
      retryAfter,
    });
    return;
  }

  // If lockout expired, clear lockout
  if (record && record.lockedUntil > 0 && now >= record.lockedUntil) {
    accountMap.delete(email);
  }

  next();
}

/**
 * Record a failed login attempt for a specific account
 */
export function recordLoginFailure(email: unknown): { failedCount: number; isLocked: boolean; retryAfter: number } {
  const now = Date.now();
  const key = normalizeAccountKey(email);
  if (!key) return { failedCount: 0, isLocked: false, retryAfter: 0 };

  let record = accountMap.get(key);
  if (!record || now >= record.resetAt) {
    record = {
      failedCount: 1,
      resetAt: now + currentConfig.accountWindowMs,
      lockedUntil: 0,
    };
    accountMap.set(key, record);
  } else {
    record.failedCount++;
  }

  if (record.failedCount >= currentConfig.accountMaxFailed) {
    record.lockedUntil = now + currentConfig.accountLockoutMs;
    const retryAfter = Math.ceil(currentConfig.accountLockoutMs / 1000);
    return { failedCount: record.failedCount, isLocked: true, retryAfter };
  }

  return { failedCount: record.failedCount, isLocked: false, retryAfter: 0 };
}

/**
 * Clear failed login attempts upon successful authentication
 */
export function recordLoginSuccess(email: unknown): void {
  const key = normalizeAccountKey(email);
  if (key) {
    accountMap.delete(key);
  }
}
