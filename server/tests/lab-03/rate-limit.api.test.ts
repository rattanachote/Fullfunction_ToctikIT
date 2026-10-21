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

  describe("Phase 1 Tests: Edge Cases & Concurrency", () => {
    it("E1 Spoof XFF: spoofing leftmost XFF entries while keeping rightmost realIp unchanged still locks out after 5 failures", async () => {
      const realIp = "203.0.113.199";

      // 5 failed login attempts with varying leftmost fake IPs but identical rightmost realIp
      for (let n = 1; n <= 5; n++) {
        const xffHeader = `10.0.0.${n}, ${realIp}`;
        const res = await request(app)
          .post("/api/auth/login")
          .set("X-Forwarded-For", xffHeader)
          .send({ email: testUserEmail, password: "wrong-password" });
        expect(res.status).toBe(401);
      }

      // 6th attempt with a new leftmost IP, but same rightmost realIp
      const res6 = await request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", `10.0.0.99, ${realIp}`)
        .send({ email: testUserEmail, password: "wrong-password" });

      expect(res6.status).toBe(429);
      expect(res6.body.error).toMatch(/temporarily locked/i);
    });

    it("E2 Concurrency: concurrent 20 failed login attempts via Promise.all results in failedCount exactly 20 in DB and next request gets 429", async () => {
      const clientIp = "192.0.2.123";

      // Fire 20 failed login requests concurrently
      const promises = Array.from({ length: 20 }, () =>
        request(app)
          .post("/api/auth/login")
          .set("X-Forwarded-For", clientIp)
          .send({ email: testUserEmail, password: "wrong-password" })
      );

      const responses = await Promise.all(promises);

      // Verify DB row
      const attempt = await getPrisma().loginAttempt.findUnique({
        where: { ip_email: { ip: clientIp, email: testUserEmail } },
      });

      expect(attempt).not.toBeNull();
      expect(attempt!.failedCount).toBe(20);

      // 21st attempt must be 429
      const nextRes = await request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", clientIp)
        .send({ email: testUserEmail, password: "wrong-password" });

      expect(nextRes.status).toBe(429);
    });

    it("E3 Data Types: rejects array, object, number, string > 254 chars, and non-string password with 400 and creates no LoginAttempt row", async () => {
      const clientIp = "192.0.2.201";
      const longEmail = "a".repeat(250) + "@example.com"; // 262 chars > 254

      const invalidPayloads = [
        { email: ["admin@example.com"], password: "validPassword123!" },
        { email: { email: "admin@example.com" }, password: "validPassword123!" },
        { email: 12345, password: "validPassword123!" },
        { email: longEmail, password: "validPassword123!" },
        { email: testUserEmail, password: 12345678 },
        { email: testUserEmail, password: ["Password123!"] },
        { email: testUserEmail, password: { pass: "Password123!" } },
      ];

      for (const payload of invalidPayloads) {
        const res = await request(app)
          .post("/api/auth/login")
          .set("X-Forwarded-For", clientIp)
          .send(payload as any);

        expect(res.status).toBe(400);
      }

      // Verify no row was created in LoginAttempt for this IP
      const rowCount = await getPrisma().loginAttempt.count({
        where: { ip: clientIp },
      });
      expect(rowCount).toBe(0);
    });

    it("E4 Lockout then Correct Password: after 5 failed logins, submitting the correct password from the same IP must still return 429", async () => {
      const clientIp = "192.0.2.222";

      for (let i = 1; i <= 5; i++) {
        const failRes = await request(app)
          .post("/api/auth/login")
          .set("X-Forwarded-For", clientIp)
          .send({ email: testUserEmail, password: "wrong-password" });
        expect(failRes.status).toBe(401);
      }

      // Now submit the correct password from the locked IP
      const res = await request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", clientIp)
        .send({ email: testUserEmail, password: correctPassword });

      expect(res.status).toBe(429);
      expect(res.body.error).toMatch(/temporarily locked/i);
    });

    it("E5 Expired Lockout: when lockedUntil is in the past, login with correct password succeeds immediately", async () => {
      const clientIp = "192.0.2.230";

      // 5 failed logins to lock it out
      for (let i = 1; i <= 5; i++) {
        await request(app)
          .post("/api/auth/login")
          .set("X-Forwarded-For", clientIp)
          .send({ email: testUserEmail, password: "wrong-password" });
      }

      // Modify lockedUntil in DB to 5 seconds in the past
      await getPrisma().loginAttempt.update({
        where: { ip_email: { ip: clientIp, email: testUserEmail } },
        data: { lockedUntil: new Date(Date.now() - 5000) },
      });

      // Attempt login with correct password
      const res = await request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", clientIp)
        .send({ email: testUserEmail, password: correctPassword });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
    });

    it("E6 Non-existent Email: 5 failures on unknown email locks out and returns identical 429 format", async () => {
      const clientIp = "192.0.2.235";
      const unknownEmail = "nonexistent.account@example.com";

      for (let i = 1; i <= 5; i++) {
        const res = await request(app)
          .post("/api/auth/login")
          .set("X-Forwarded-For", clientIp)
          .send({ email: unknownEmail, password: "any-password" });
        expect(res.status).toBe(401);
      }

      // 6th attempt must be 429 with identical error message
      const res6 = await request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", clientIp)
        .send({ email: unknownEmail, password: "any-password" });

      expect(res6.status).toBe(429);
      expect(res6.body.error).toMatch(/temporarily locked/i);
      expect(res6.headers["retry-after"]).toBeDefined();
    });

    it("E8 Inactive Account: correct password returns 403, wrong password counts toward lock and triggers 429", async () => {
      const clientIp = "192.0.2.240";
      const inactiveEmail = "inactive.locktest@example.com";

      await getPrisma().user.deleteMany({ where: { email: inactiveEmail } });
      await getPrisma().user.create({
        data: {
          email: inactiveEmail,
          name: "Inactive Lock Test",
          passwordHash: hashPassword(correctPassword),
          role: "Requester",
          mustChangePassword: false,
          isActive: false,
        },
      });

      // Correct password returns 403
      const validRes = await request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", clientIp)
        .send({ email: inactiveEmail, password: correctPassword });
      expect(validRes.status).toBe(403);
      expect(validRes.body.error).toMatch(/inactive/i);

      // 5 wrong passwords
      for (let i = 1; i <= 5; i++) {
        const wrongRes = await request(app)
          .post("/api/auth/login")
          .set("X-Forwarded-For", clientIp)
          .send({ email: inactiveEmail, password: "wrong-password" });
        expect(wrongRes.status).toBe(401);
      }

      // 6th attempt is locked (429)
      const lockedRes = await request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", clientIp)
        .send({ email: inactiveEmail, password: correctPassword });
      expect(lockedRes.status).toBe(429);
    });

    it("E10 Reset Sequence: 4 fails -> 1 success -> 4 fails must NOT be locked", async () => {
      const clientIp = "192.0.2.245";

      // 4 failed logins
      for (let i = 1; i <= 4; i++) {
        const r = await request(app)
          .post("/api/auth/login")
          .set("X-Forwarded-For", clientIp)
          .send({ email: testUserEmail, password: "wrong-password" });
        expect(r.status).toBe(401);
      }

      // 1 successful login (resets counter)
      const successRes = await request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", clientIp)
        .send({ email: testUserEmail, password: correctPassword });
      expect(successRes.status).toBe(200);

      // 4 more failed logins
      for (let i = 1; i <= 4; i++) {
        const r = await request(app)
          .post("/api/auth/login")
          .set("X-Forwarded-For", clientIp)
          .send({ email: testUserEmail, password: "wrong-password" });
        expect(r.status).toBe(401); // All 4 must be 401, NOT locked
      }

      // 5th attempt with correct password succeeds because count is only 4 (not locked)
      const finalRes = await request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", clientIp)
        .send({ email: testUserEmail, password: correctPassword });
      expect(finalRes.status).toBe(200);
    });

    it("E11 Mixed-case preservation & unified rate limit key: authenticates user stored with uppercase email and groups different case variations into single rate limit key", async () => {
      const clientIp = "192.0.2.250";
      const mixedEmailInDb = "MixedCase.User@example.com";
      const userPassword = "MixedPassword123!";

      await getPrisma().user.deleteMany({ where: { email: mixedEmailInDb } });
      await getPrisma().user.create({
        data: {
          email: mixedEmailInDb,
          name: "Mixed Case User",
          passwordHash: hashPassword(userPassword),
          role: "Requester",
          mustChangePassword: false,
          isActive: true,
        },
      });

      // 1. Logging in with exact uppercase email stored in DB must succeed (200)
      const validLoginRes = await request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", clientIp)
        .send({ email: "  " + mixedEmailInDb + "  ", password: userPassword });
      expect(validLoginRes.status).toBe(200);
      expect(validLoginRes.body.token).toBeDefined();

      // 2. Rate limit key unification:
      // Send 3 wrong password attempts with lowercase, 2 wrong password attempts with UPPERCASE (total 5)
      for (let i = 1; i <= 3; i++) {
        const r = await request(app)
          .post("/api/auth/login")
          .set("X-Forwarded-For", clientIp)
          .send({ email: mixedEmailInDb.toLowerCase(), password: "wrong-password" });
        expect(r.status).toBe(401);
      }

      for (let i = 1; i <= 2; i++) {
        const r = await request(app)
          .post("/api/auth/login")
          .set("X-Forwarded-For", clientIp)
          .send({ email: mixedEmailInDb.toUpperCase(), password: "wrong-password" });
        expect(r.status).toBe(401);
      }

      // 6th attempt using MixedCase must be locked out with 429 because rate limit key was normalized
      const lockedRes = await request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", clientIp)
        .send({ email: mixedEmailInDb, password: userPassword });

      expect(lockedRes.status).toBe(429);
      expect(lockedRes.body.error).toMatch(/temporarily locked/i);
    });
  });
});
