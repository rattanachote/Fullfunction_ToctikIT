import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { resetLoginRateLimits, setRateLimitConfig } from "../../src/rateLimit.js";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/auth.js";

describe("Login Rate Limiting API", () => {
  const testUserEmail = "ratelimit.user@example.com";
  const testOtherEmail = "ratelimit.other@example.com";
  const correctPassword = "Password123!";

  beforeEach(async () => {
    resetLoginRateLimits();
    const hashed = hashPassword(correctPassword);

    await getPrisma().session.deleteMany();
    await getPrisma().user.deleteMany({
      where: { email: { in: [testUserEmail, testOtherEmail] } },
    });

    await getPrisma().user.create({
      data: {
        email: testUserEmail,
        name: "Rate Limit User",
        passwordHash: hashed,
        role: "Requester",
        mustChangePassword: false,
        isActive: true,
      },
    });

    await getPrisma().user.create({
      data: {
        email: testOtherEmail,
        name: "Rate Limit Other",
        passwordHash: hashed,
        role: "Requester",
        mustChangePassword: false,
        isActive: true,
      },
    });
  });

  afterEach(() => {
    resetLoginRateLimits();
  });

  describe("Tier 1: Per-IP Burst Protection", () => {
    it("allows up to 20 requests per minute from a single IP and includes rate limit headers", async () => {
      const clientIp = "192.168.1.100";

      // 20 attempts using distinct accounts so Tier 2 (account lockout) is not triggered
      for (let i = 1; i <= 20; i++) {
        const res = await request(app)
          .post("/api/auth/login")
          .set("X-Forwarded-For", clientIp)
          .send({ email: `burst-user-${i}@example.com`, password: "wrong-password" });

        expect(res.status).toBe(401);
        expect(res.headers["x-ratelimit-limit"]).toBe("20");
        expect(Number(res.headers["x-ratelimit-remaining"])).toBe(20 - i);
        expect(res.headers["x-ratelimit-reset"]).toBeDefined();
      }

      // 21st attempt from the same IP should be blocked with 429
      const blockedRes = await request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", clientIp)
        .send({ email: "burst-user-21@example.com", password: "wrong-password" });

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.error).toMatch(/too many login requests/i);
      expect(blockedRes.headers["retry-after"]).toBeDefined();
      expect(Number(blockedRes.headers["retry-after"])).toBeGreaterThan(0);

      // A different IP should NOT be blocked
      const differentIpRes = await request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", "192.168.1.200")
        .send({ email: testOtherEmail, password: correctPassword });

      expect(differentIpRes.status).toBe(200);
      expect(differentIpRes.body.token).toBeDefined();
    });
  });

  describe("Tier 2: Per-Account Failed Attempts Protection", () => {
    it("locks an account after 5 consecutive failed logins and rejects further attempts with 429", async () => {
      // Use different IPs for each request to verify account-based lockout independent of IP
      for (let attempt = 1; attempt <= 5; attempt++) {
        const res = await request(app)
          .post("/api/auth/login")
          .set("X-Forwarded-For", `10.0.0.${attempt}`)
          .send({ email: testUserEmail, password: "wrong-password" });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe("Invalid email or password");
      }

      // 6th attempt even with correct password should be rejected with 429
      const lockedRes = await request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", "10.0.0.99")
        .send({ email: testUserEmail, password: correctPassword });

      expect(lockedRes.status).toBe(429);
      expect(lockedRes.body.error).toMatch(/temporarily locked/i);
      expect(lockedRes.headers["retry-after"]).toBeDefined();
      expect(Number(lockedRes.headers["retry-after"])).toBeGreaterThan(0);

      // Other accounts must NOT be affected
      const otherRes = await request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", "10.0.0.99")
        .send({ email: testOtherEmail, password: correctPassword });

      expect(otherRes.status).toBe(200);
      expect(otherRes.body.token).toBeDefined();
    });

    it("resets failed attempt counter upon successful login", async () => {
      // 3 failed logins
      for (let i = 1; i <= 3; i++) {
        await request(app)
          .post("/api/auth/login")
          .send({ email: testUserEmail, password: "wrong-password" });
      }

      // Successful login resets the counter
      const successRes = await request(app)
        .post("/api/auth/login")
        .send({ email: testUserEmail, password: correctPassword });

      expect(successRes.status).toBe(200);

      // Now 4 more failed logins should NOT lock the account (since previous 3 were cleared)
      for (let i = 1; i <= 4; i++) {
        const failRes = await request(app)
          .post("/api/auth/login")
          .send({ email: testUserEmail, password: "wrong-password" });
        expect(failRes.status).toBe(401);
      }

      // 5th failed login will now lock it
      const fifthFail = await request(app)
        .post("/api/auth/login")
        .send({ email: testUserEmail, password: "wrong-password" });
      expect(fifthFail.status).toBe(401);

      // Next attempt is 429 locked
      const lockedRes = await request(app)
        .post("/api/auth/login")
        .send({ email: testUserEmail, password: correctPassword });
      expect(lockedRes.status).toBe(429);
    });
  });
});
