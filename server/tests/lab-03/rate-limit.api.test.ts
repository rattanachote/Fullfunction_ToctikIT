import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { resetLoginRateLimits, setRateLimitConfig } from "../../src/rateLimit.js";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/auth.js";

describe("Login Rate Limiting API (PostgreSQL Backed & Anti-DoS)", () => {
  const testUserEmail = "ratelimit.user@example.com";
  const testAdminEmail = "admin.target@example.com";
  const correctPassword = "Password123!";

  beforeEach(async () => {
    await resetLoginRateLimits();
    const hashed = hashPassword(correctPassword);

    await getPrisma().session.deleteMany();
    await getPrisma().user.deleteMany({
      where: { email: { in: [testUserEmail, testAdminEmail] } },
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
        email: testAdminEmail,
        name: "Admin Target",
        passwordHash: hashed,
        role: "Administrator",
        mustChangePassword: false,
        isActive: true,
      },
    });
  });

  afterEach(async () => {
    await resetLoginRateLimits();
  });

  describe("Anti-DoS: Scoped Lockout per (IP, Email)", () => {
    it("locks only the attacker's IP when failing 5 times, while the legitimate user can still log in from their IP", async () => {
      const attackerIp = "198.51.100.1";
      const adminIp = "203.0.113.50";

      // Attacker attempts 5 wrong passwords for admin account
      for (let attempt = 1; attempt <= 5; attempt++) {
        const res = await request(app)
          .post("/api/auth/login")
          .set("X-Forwarded-For", attackerIp)
          .send({ email: testAdminEmail, password: "wrong-password" });

        expect(res.status).toBe(401);
      }

      // Attacker's 6th attempt is blocked with 429
      const attackerBlocked = await request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", attackerIp)
        .send({ email: testAdminEmail, password: "wrong-password" });

      expect(attackerBlocked.status).toBe(429);
      expect(attackerBlocked.body.error).toMatch(/temporarily locked/i);
      expect(attackerBlocked.headers["retry-after"]).toBeDefined();
      expect(Number(attackerBlocked.headers["retry-after"])).toBeGreaterThan(0);

      // CRITICAL: The real admin from their own IP can STILL log in successfully (NO Denial of Service!)
      const adminLogin = await request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", adminIp)
        .send({ email: testAdminEmail, password: correctPassword });

      expect(adminLogin.status).toBe(200);
      expect(adminLogin.body.token).toBeDefined();
      expect(adminLogin.body.user.email).toBe(testAdminEmail);
    });

    it("resets failed count in database upon successful login", async () => {
      const clientIp = "192.0.2.77";

      // 4 failed attempts from clientIp
      for (let i = 1; i <= 4; i++) {
        const failRes = await request(app)
          .post("/api/auth/login")
          .set("X-Forwarded-For", clientIp)
          .send({ email: testUserEmail, password: "wrong-password" });
        expect(failRes.status).toBe(401);
      }

      // Successful login resets DB record
      const successRes = await request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", clientIp)
        .send({ email: testUserEmail, password: correctPassword });
      expect(successRes.status).toBe(200);

      // Verify DB record was deleted
      const record = await getPrisma().loginAttempt.findUnique({
        where: { ip_email: { ip: clientIp, email: testUserEmail } },
      });
      expect(record).toBeNull();
    });
  });

  describe("Classroom / Shared NAT Protection", () => {
    it("allows multiple successful logins from the same NAT IP without hitting rate limits", async () => {
      const sharedCampusIp = "161.200.1.5"; // Shared university NAT IP

      // 25 students logging in successfully from the same campus Wi-Fi IP
      for (let student = 1; student <= 25; student++) {
        const res = await request(app)
          .post("/api/auth/login")
          .set("X-Forwarded-For", sharedCampusIp)
          .send({ email: testUserEmail, password: correctPassword });

        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();
      }
    });
  });

  describe("IP Flood Protection (Credential Spraying)", () => {
    it("blocks an IP that generates excessive failures across different accounts", async () => {
      const attackingIp = "198.51.100.99";

      // Configure a lower test threshold for IP flood
      setRateLimitConfig({ ipMaxFailed: 10 });

      // Attacker tries 10 different accounts with wrong passwords
      for (let i = 1; i <= 10; i++) {
        const res = await request(app)
          .post("/api/auth/login")
          .set("X-Forwarded-For", attackingIp)
          .send({ email: `victim-${i}@example.com`, password: "wrong-password" });
        expect(res.status).toBe(401);
      }

      // 11th request from attackingIp is blocked by IP flood limit (429)
      const floodBlocked = await request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", attackingIp)
        .send({ email: "victim-11@example.com", password: "wrong-password" });

      expect(floodBlocked.status).toBe(429);
      expect(floodBlocked.body.error).toMatch(/too many failed login attempts from this ip/i);
    });
  });

  describe("PostgreSQL Persistence Verification", () => {
    it("verifies login attempts and lockouts persist directly in PostgreSQL LoginAttempt table", async () => {
      const testIp = "192.0.2.88";

      // 5 failed attempts
      for (let i = 1; i <= 5; i++) {
        await request(app)
          .post("/api/auth/login")
          .set("X-Forwarded-For", testIp)
          .send({ email: testUserEmail, password: "wrong-password" });
      }

      // Query database directly
      const attemptInDb = await getPrisma().loginAttempt.findUnique({
        where: { ip_email: { ip: testIp, email: testUserEmail } },
      });

      expect(attemptInDb).not.toBeNull();
      expect(attemptInDb!.failedCount).toBe(5);
      expect(attemptInDb!.lockedUntil).not.toBeNull();
      expect(attemptInDb!.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
    });
  });
});
