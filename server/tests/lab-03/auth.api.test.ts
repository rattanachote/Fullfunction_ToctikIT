import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/auth.js";

describe("Authentication API", () => {
  const email = "auth.test@example.com";
  const password = "Password123!";
  let token = "";

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
});
