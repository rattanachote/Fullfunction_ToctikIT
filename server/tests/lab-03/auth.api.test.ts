import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/auth.js";
import { resetLoginRateLimits } from "../../src/rateLimit.js";

describe("Authentication API", () => {
  const email = "auth.test@example.com";
  const password = "Password123!";
  let token = "";

  beforeEach(() => {
    resetLoginRateLimits();
  });

  beforeAll(async () => {
    // Ensure clean test user
    const existing = await getPrisma().user.findUnique({ where: { email } });
    if (existing) {
      await getPrisma().user.delete({ where: { email } });
    }

    await getPrisma().user.create({
      data: {
        name: "Auth Test User",
        email,
        passwordHash: hashPassword(password),
        role: "Requester",
        mustChangePassword: false,
        isActive: true,
      },
    });
  });

  it("fails login with invalid credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "wrongpassword" });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error");
  });

  it("succeeds login with valid credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(res.body.user.email).toBe(email);
    token = res.body.token;
  });

  it("can retrieve user profile using token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
  });

  it("fails to change password with weak password", async () => {
    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: password, newPassword: "weak" });
    expect(res.status).toBe(400);
  });

  it("succeeds changing password with strong password", async () => {
    const newPass = "NewPassword123!";
    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: password, newPassword: newPass });
    expect(res.status).toBe(200);

    // Verify login with new password works
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email, password: newPass });
    expect(loginRes.status).toBe(200);
  });

  it("can logout successfully", async () => {
    const res = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);

    // Verify token is invalidated
    const profileRes = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(profileRes.status).toBe(401);
  });

  it("rejects x-requester-id with 401 across all authenticated endpoints when ALLOW_LEGACY_REQUESTER_HEADER is disabled", async () => {
    const prev = process.env.ALLOW_LEGACY_REQUESTER_HEADER;
    process.env.ALLOW_LEGACY_REQUESTER_HEADER = "false";

    try {
      const endpoints = [
        { method: "get" as const, path: "/api/auth/me" },
        { method: "get" as const, path: "/api/requesters" },
        { method: "get" as const, path: "/api/tickets" },
        { method: "post" as const, path: "/api/tickets" },
        { method: "get" as const, path: "/api/tickets/1" },
        { method: "get" as const, path: "/api/attachments/1" },
        { method: "get" as const, path: "/api/dashboard/requester" },
        { method: "get" as const, path: "/api/dashboard/staff" },
        { method: "get" as const, path: "/api/admin/users" },
      ];

      for (const ep of endpoints) {
        const res = await request(app)[ep.method](ep.path).set("x-requester-id", "1");
        expect(res.status).toBe(401);
      }
    } finally {
      process.env.ALLOW_LEGACY_REQUESTER_HEADER = prev;
    }
  });

  it("rejects x-requester-id with 401 across all authenticated endpoints when ALLOW_LEGACY_REQUESTER_HEADER is unset (undefined)", async () => {
    const prev = process.env.ALLOW_LEGACY_REQUESTER_HEADER;
    delete process.env.ALLOW_LEGACY_REQUESTER_HEADER;

    try {
      const endpoints = [
        { method: "get" as const, path: "/api/auth/me" },
        { method: "get" as const, path: "/api/requesters" },
        { method: "get" as const, path: "/api/tickets" },
        { method: "post" as const, path: "/api/tickets" },
        { method: "get" as const, path: "/api/tickets/1" },
        { method: "get" as const, path: "/api/attachments/1" },
        { method: "get" as const, path: "/api/dashboard/requester" },
        { method: "get" as const, path: "/api/dashboard/staff" },
        { method: "get" as const, path: "/api/admin/users" },
      ];

      for (const ep of endpoints) {
        const res = await request(app)[ep.method](ep.path).set("x-requester-id", "1");
        expect(res.status).toBe(401);
      }
    } finally {
      process.env.ALLOW_LEGACY_REQUESTER_HEADER = prev;
    }
  });

  it("does not reveal inactive account status (returns 401, not 403) when login password is wrong", async () => {
    const inactiveEmail = "inactive.enum@example.com";
    await getPrisma().user.deleteMany({ where: { email: inactiveEmail } });
    await getPrisma().user.create({
      data: {
        name: "Inactive User",
        email: inactiveEmail,
        passwordHash: hashPassword("CorrectPass123!"),
        role: "Requester",
        mustChangePassword: false,
        isActive: false,
      },
    });

    const wrongPassRes = await request(app)
      .post("/api/auth/login")
      .send({ email: inactiveEmail, password: "WrongPassword999!" });
    expect(wrongPassRes.status).toBe(401);

    const rightPassRes = await request(app)
      .post("/api/auth/login")
      .send({ email: inactiveEmail, password: "CorrectPass123!" });
    expect(rightPassRes.status).toBe(403);
  });

  it("revokes other active sessions when user changes password and revokes all sessions on admin password reset", async () => {
    const revokeEmail = "session.revoke@example.com";
    const adminEmail = "session.admin@example.com";
    await getPrisma().user.deleteMany({ where: { email: { in: [revokeEmail, adminEmail] } } });

    const u = await getPrisma().user.create({
      data: {
        name: "Session Revoke User",
        email: revokeEmail,
        passwordHash: hashPassword("InitPass123!"),
        role: "Requester",
        mustChangePassword: false,
        isActive: true,
      },
    });
    await getPrisma().user.create({
      data: {
        name: "Session Admin",
        email: adminEmail,
        passwordHash: hashPassword("AdminPass123!"),
        role: "Administrator",
        mustChangePassword: false,
        isActive: true,
      },
    });

    const login1 = await request(app).post("/api/auth/login").send({ email: revokeEmail, password: "InitPass123!" });
    const login2 = await request(app).post("/api/auth/login").send({ email: revokeEmail, password: "InitPass123!" });
    const tok1 = login1.body.token;
    const tok2 = login2.body.token;

    // Change password using tok1 -> tok2 must be revoked (401), tok1 stays valid (200)
    const chgRes = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${tok1}`)
      .send({ currentPassword: "InitPass123!", newPassword: "ChangedPass123!" });
    expect(chgRes.status).toBe(200);

    const meTok2 = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${tok2}`);
    expect(meTok2.status).toBe(401);

    const meTok1 = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${tok1}`);
    expect(meTok1.status).toBe(200);

    // Admin resets password -> tok1 must also be revoked (401)
    const loginAdmin = await request(app).post("/api/auth/login").send({ email: adminEmail, password: "AdminPass123!" });
    const resetRes = await request(app)
      .put(`/api/admin/users/${u.id}/reset-password`)
      .set("Authorization", `Bearer ${loginAdmin.body.token}`)
      .send({ newInitialPassword: "AdminReset123!" });
    expect(resetRes.status).toBe(200);

    const meAfterReset = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${tok1}`);
    expect(meAfterReset.status).toBe(401);
  });
});
