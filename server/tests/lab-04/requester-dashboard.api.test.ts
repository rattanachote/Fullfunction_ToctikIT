import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/auth.js";

describe("Requester Dashboard API", () => {
  let requesterToken = "";
  let requesterId = 0;

  beforeAll(async () => {
    const password = "Password123!";
    const hashed = hashPassword(password);

    // Clean up
    const email = "dash.req@example.com";
    await getPrisma().ticket.deleteMany({ where: { requester: { email } } });
    await getPrisma().user.deleteMany({ where: { email } });

    const r = await getPrisma().user.create({
      data: { name: "Dashboard Requester", email, passwordHash: hashed, role: "Requester", mustChangePassword: false, isActive: true }
    });
    requesterId = r.id;

    const l = await request(app).post("/api/auth/login").send({ email: r.email, password });
    requesterToken = l.body.token;

    const cat = await getPrisma().category.findFirst();
    const catId = cat ? cat.id : 1;

    // Create 2 open tickets and 1 resolved ticket
    await getPrisma().ticket.create({
      data: {
        ticketNo: "TKT-DASH-REQ-001",
        requesterId: r.id,
        categoryId: catId,
        relatedSystem: "Campus Wi-Fi",
        requestedPriority: "HIGH",
        currentStatus: "Open",
        summary: "Wi-Fi Issue",
        description: "Disconnects often",
      }
    });

    await getPrisma().ticket.create({
      data: {
        ticketNo: "TKT-DASH-REQ-002",
        requesterId: r.id,
        categoryId: catId,
        relatedSystem: "Email",
        requestedPriority: "LOW",
        currentStatus: "Waiting for Requester",
        summary: "Email sync issue",
        description: "Need help configuring phone",
      }
    });

    await getPrisma().ticket.create({
      data: {
        ticketNo: "TKT-DASH-REQ-003",
        requesterId: r.id,
        categoryId: catId,
        relatedSystem: "Printer",
        requestedPriority: "MEDIUM",
        currentStatus: "Resolved",
        summary: "Paper jam",
        description: "Resolved by cleaning",
      }
    });
  });

  it("retrieves operational metrics and recent tickets for the requester", async () => {
    const res = await request(app)
      .get("/api/dashboard/requester")
      .set("Authorization", `Bearer ${requesterToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("metrics");
    expect(res.body).toHaveProperty("recentTickets");

    expect(res.body.metrics.totalOpen).toBe(2);
    expect(res.body.metrics.waitingForRequester).toBe(1);
    expect(res.body.metrics.recentlyResolved).toBe(1);
    expect(Array.isArray(res.body.recentTickets)).toBe(true);
    expect(res.body.recentTickets.length).toBe(3);
  });

  it("rejects unauthenticated dashboard request", async () => {
    const res = await request(app).get("/api/dashboard/requester");
    expect(res.status).toBe(401);
  });
});
