import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/auth.js";

describe("Authorization API", () => {
  let requesterToken = "";
  let itStaffToken = "";
  let adminToken = "";
  let otherRequesterId = 0;
  let otherRequesterTicketId = 0;

  beforeAll(async () => {
    const password = "Password123!";
    const hashed = hashPassword(password);

    // Clean up first to ensure idempotency
    const emails = ["req.auth@example.com", "it.auth@example.com", "admin.auth@example.com", "other.req@example.com"];
    await getPrisma().ticket.deleteMany({ where: { ticketNo: "TKT-AUTH-000001" } });
    await getPrisma().user.deleteMany({ where: { email: { in: emails } } });

    // Create a Requester
    const r = await getPrisma().user.create({
      data: {
        name: "Test Requester",
        email: "req.auth@example.com",
        passwordHash: hashed,
        role: "Requester",
        mustChangePassword: false,
        isActive: true,
      },
    });
    const loginR = await request(app).post("/api/auth/login").send({ email: r.email, password });
    requesterToken = loginR.body.token;

    // Create IT Staff
    const s = await getPrisma().user.create({
      data: {
        name: "Test IT Staff",
        email: "it.auth@example.com",
        passwordHash: hashed,
        role: "ITStaff",
        mustChangePassword: false,
        isActive: true,
      },
    });
    const loginS = await request(app).post("/api/auth/login").send({ email: s.email, password });
    itStaffToken = loginS.body.token;

    // Create Administrator
    const a = await getPrisma().user.create({
      data: {
        name: "Test Admin",
        email: "admin.auth@example.com",
        passwordHash: hashed,
        role: "Administrator",
        mustChangePassword: false,
        isActive: true,
      },
    });
    const loginA = await request(app).post("/api/auth/login").send({ email: a.email, password });
    adminToken = loginA.body.token;

    // Create another Requester and their ticket to test isolation
    const otherR = await getPrisma().user.create({
      data: {
        name: "Other Requester",
        email: "other.req@example.com",
        passwordHash: hashed,
        role: "Requester",
        mustChangePassword: false,
        isActive: true,
      },
    });
    otherRequesterId = otherR.id;

    const cat = await getPrisma().category.findFirst();
    const catId = cat ? cat.id : 1;

    const ticket = await getPrisma().ticket.create({
      data: {
        ticketNo: "TKT-AUTH-000001",
        requesterId: otherRequesterId,
        categoryId: catId,
        relatedSystem: "Email",
        requestedPriority: "LOW",
        itPriority: "LOW",
        currentStatus: "New",
        summary: "Other User Ticket",
        description: "Testing authorization boundaries",
      },
    });
    otherRequesterTicketId = ticket.id;
  });

  it("blocks Requester from User Management list", async () => {
    const res = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${requesterToken}`);
    expect(res.status).toBe(403);
  });

  it("blocks IT Staff from User Management list", async () => {
    const res = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${itStaffToken}`);
    expect(res.status).toBe(403);
  });

  it("allows Administrator to access User Management list", async () => {
    const res = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it("blocks Requester from writing internal notes", async () => {
    const res = await request(app)
      .post(`/api/tickets/${otherRequesterTicketId}/notes`)
      .set("Authorization", `Bearer ${requesterToken}`)
      .send({ content: "Sneaky internal note" });
    expect(res.status).toBe(403);
  });

  it("blocks Requester from viewing details of another requester's ticket (safe error 404)", async () => {
    const res = await request(app)
      .get(`/api/tickets/${otherRequesterTicketId}`)
      .set("Authorization", `Bearer ${requesterToken}`);
    expect(res.status).toBe(404);
  });

  it("allows IT Staff to view details of any ticket", async () => {
    const res = await request(app)
      .get(`/api/tickets/${otherRequesterTicketId}`)
      .set("Authorization", `Bearer ${itStaffToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(otherRequesterTicketId);
  });
});
