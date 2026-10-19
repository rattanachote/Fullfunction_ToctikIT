import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/auth.js";

describe("Staff Queue API", () => {
  let itStaffToken = "";
  let requesterToken = "";
  let requesterId = 0;

  beforeAll(async () => {
    const password = "Password123!";
    const hashed = hashPassword(password);

    // Clean up first to ensure idempotency
    const emails = ["queue.it@example.com", "queue.req@example.com"];
    await getPrisma().ticket.deleteMany({ where: { ticketNo: { in: ["TKT-QUEUE-000001", "TKT-QUEUE-000002"] } } });
    await getPrisma().user.deleteMany({ where: { email: { in: emails } } });

    // Create IT Staff
    const s = await getPrisma().user.create({
      data: {
        name: "Queue Staff",
        email: "queue.it@example.com",
        passwordHash: hashed,
        role: "ITStaff",
        mustChangePassword: false,
        isActive: true,
      },
    });
    const loginS = await request(app).post("/api/auth/login").send({ email: s.email, password });
    itStaffToken = loginS.body.token;

    // Create Requester
    const r = await getPrisma().user.create({
      data: {
        name: "Queue Requester",
        email: "queue.req@example.com",
        passwordHash: hashed,
        role: "Requester",
        mustChangePassword: false,
        isActive: true,
      },
    });
    requesterId = r.id;
    const loginR = await request(app).post("/api/auth/login").send({ email: r.email, password });
    requesterToken = loginR.body.token;

    const cat = await getPrisma().category.findFirst();
    const catId = cat ? cat.id : 1;

    // Create two tickets: one owned by requester, one by someone else
    await getPrisma().ticket.createMany({
      data: [
        {
          ticketNo: "TKT-QUEUE-000001",
          requesterId: requesterId,
          categoryId: catId,
          relatedSystem: "VPN",
          requestedPriority: "MEDIUM",
          itPriority: "MEDIUM",
          currentStatus: "New",
          summary: "My VPN Ticket",
          description: "Details here",
        },
        {
          ticketNo: "TKT-QUEUE-000002",
          requesterId: s.id, // created by staff user acting as requester or someone else
          categoryId: catId,
          relatedSystem: "Email",
          requestedPriority: "HIGH",
          itPriority: "HIGH",
          currentStatus: "Open",
          summary: "Someone Else Ticket",
          description: "Details here",
        }
      ]
    });
  });

  it("allows IT staff to view all tickets in the queue", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("Authorization", `Bearer ${itStaffToken}`);
    expect(res.status).toBe(200);
    expect(res.body.tickets.length).toBeGreaterThanOrEqual(2);
  });

  it("filters tickets by status for IT staff", async () => {
    const res = await request(app)
      .get("/api/tickets?status=New")
      .set("Authorization", `Bearer ${itStaffToken}`);
    expect(res.status).toBe(200);
    expect(res.body.tickets.every((t: any) => t.currentStatus === "New")).toBe(true);
  });

  it("limits Requester to only their own tickets", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("Authorization", `Bearer ${requesterToken}`);
    expect(res.status).toBe(200);
    // Should only return TKT-QUEUE-000001
    expect(res.body.tickets.every((t: any) => t.requesterId === requesterId)).toBe(true);
  });
});
