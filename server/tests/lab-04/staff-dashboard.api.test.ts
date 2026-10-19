import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/auth.js";

describe("Staff Dashboard API", () => {
  let staffToken = "";
  let adminToken = "";
  let requesterToken = "";

  beforeAll(async () => {
    const password = "Password123!";
    const hashed = hashPassword(password);

    // Clean up
    const emails = ["dash.staff@example.com", "dash.admin@example.com", "dash.req2@example.com"];
    await getPrisma().actionTaken.deleteMany({ where: { OR: [{ performedBy: { email: { in: emails } } }, { ticket: { requester: { email: { in: emails } } } }] } });
    await getPrisma().attachment.deleteMany({ where: { ticket: { requester: { email: { in: emails } } } } });
    await getPrisma().publicComment.deleteMany({ where: { OR: [{ author: { email: { in: emails } } }, { ticket: { requester: { email: { in: emails } } } }] } });
    await getPrisma().internalNote.deleteMany({ where: { OR: [{ author: { email: { in: emails } } }, { ticket: { requester: { email: { in: emails } } } }] } });
    await getPrisma().ticket.deleteMany({ where: { OR: [{ requester: { email: { in: emails } } }, { owner: { email: { in: emails } } }] } });
    await getPrisma().user.deleteMany({ where: { email: { in: emails } } });

    const s = await getPrisma().user.create({
      data: { name: "Dashboard Staff", email: "dash.staff@example.com", passwordHash: hashed, role: "ITStaff", mustChangePassword: false, isActive: true }
    });
    const a = await getPrisma().user.create({
      data: { name: "Dashboard Admin", email: "dash.admin@example.com", passwordHash: hashed, role: "Administrator", mustChangePassword: false, isActive: true }
    });
    const r = await getPrisma().user.create({
      data: { name: "Dashboard Req 2", email: "dash.req2@example.com", passwordHash: hashed, role: "Requester", mustChangePassword: false, isActive: true }
    });

    const l1 = await request(app).post("/api/auth/login").send({ email: s.email, password });
    staffToken = l1.body.token;

    const lAdmin = await request(app).post("/api/auth/login").send({ email: a.email, password });
    adminToken = lAdmin.body.token;

    const l2 = await request(app).post("/api/auth/login").send({ email: r.email, password });
    requesterToken = l2.body.token;
  });

  it("retrieves operational metrics, priority breakdown, actions taken summary, and recent tickets for IT Staff", async () => {
    const res = await request(app)
      .get("/api/dashboard/staff")
      .set("Authorization", `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("metrics");
    expect(res.body).toHaveProperty("recentTickets");
    expect(res.body).toHaveProperty("myRecentActions");

    expect(res.body.metrics).toHaveProperty("unassigned");
    expect(res.body.metrics).toHaveProperty("myAssigned");
    expect(res.body.metrics).toHaveProperty("myActionsTakenCount");
    expect(res.body.metrics).toHaveProperty("byPriority");
    expect(res.body.metrics.userCounts).toBeUndefined();
    expect(Array.isArray(res.body.recentTickets)).toBe(true);
    expect(Array.isArray(res.body.myRecentActions)).toBe(true);
  });

  it("includes userCounts breakdown when requested by an Administrator", async () => {
    const res = await request(app)
      .get("/api/dashboard/staff")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.metrics.userCounts).toBeDefined();
    expect(res.body.metrics.userCounts).toHaveProperty("totalUsers");
    expect(res.body.metrics.userCounts).toHaveProperty("activeUsers");
    expect(res.body.metrics.userCounts).toHaveProperty("inactiveUsers");
  });

  it("blocks Requester from accessing IT Staff dashboard", async () => {
    const res = await request(app)
      .get("/api/dashboard/staff")
      .set("Authorization", `Bearer ${requesterToken}`);

    expect(res.status).toBe(403);
  });
});
