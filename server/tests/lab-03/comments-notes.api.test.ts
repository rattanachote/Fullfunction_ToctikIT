import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/auth.js";

describe("Comments & Notes API", () => {
  let requesterToken = "";
  let itStaffToken = "";
  let ticketId = 0;

  beforeAll(async () => {
    const password = "Password123!";
    const hashed = hashPassword(password);

    // Clean up first to ensure idempotency
    const emails = ["comments.req@example.com", "comments.it@example.com"];
    const existingTicket = await getPrisma().ticket.findUnique({ where: { ticketNo: "TKT-COMM-000001" } });
    if (existingTicket) {
      await getPrisma().publicComment.deleteMany({ where: { ticketId: existingTicket.id } });
      await getPrisma().internalNote.deleteMany({ where: { ticketId: existingTicket.id } });
      await getPrisma().ticket.delete({ where: { id: existingTicket.id } });
    }
    await getPrisma().user.deleteMany({ where: { email: { in: emails } } });

    // Create a Requester
    const r = await getPrisma().user.create({
      data: {
        name: "Comments Requester",
        email: "comments.req@example.com",
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
        name: "Comments IT Staff",
        email: "comments.it@example.com",
        passwordHash: hashed,
        role: "ITStaff",
        mustChangePassword: false,
        isActive: true,
      },
    });
    const loginS = await request(app).post("/api/auth/login").send({ email: s.email, password });
    itStaffToken = loginS.body.token;

    // Create a ticket for the requester
    const cat = await getPrisma().category.findFirst();
    const catId = cat ? cat.id : 1;

    const ticket = await getPrisma().ticket.create({
      data: {
        ticketNo: "TKT-COMM-000001",
        requesterId: r.id,
        categoryId: catId,
        relatedSystem: "VPN",
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
        currentStatus: "New",
        summary: "Comments Ticket",
        description: "Testing comments and notes",
      },
    });
    ticketId = ticket.id;
  });

  it("can post a valid public comment as requester", async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/comments`)
      .set("Authorization", `Bearer ${requesterToken}`)
      .send({ content: "This is a public comment from the requester." });
    expect(res.status).toBe(201);
    expect(res.body.content).toBe("This is a public comment from the requester.");
  });

  it("rejects empty public comment", async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/comments`)
      .set("Authorization", `Bearer ${requesterToken}`)
      .send({ content: "   " });
    expect(res.status).toBe(400);
  });

  it("can post a public comment as IT staff", async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/comments`)
      .set("Authorization", `Bearer ${itStaffToken}`)
      .send({ content: "This is a public reply from the IT staff." });
    expect(res.status).toBe(201);
  });

  it("can post an internal note as IT staff", async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/notes`)
      .set("Authorization", `Bearer ${itStaffToken}`)
      .send({ content: "Internal diagnostic note: user needs VPN group access." });
    expect(res.status).toBe(201);
  });

  it("blocks requester from posting an internal note", async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/notes`)
      .set("Authorization", `Bearer ${requesterToken}`)
      .send({ content: "Attempted note" });
    expect(res.status).toBe(403);
  });

  it("blocks requester from reading internal notes", async () => {
    const res = await request(app)
      .get(`/api/tickets/${ticketId}/notes`)
      .set("Authorization", `Bearer ${requesterToken}`);
    expect(res.status).toBe(403);
  });

  it("allows IT staff to read internal notes", async () => {
    const res = await request(app)
      .get(`/api/tickets/${ticketId}/notes`)
      .set("Authorization", `Bearer ${itStaffToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].content).toContain("diagnostic note");
  });
});
