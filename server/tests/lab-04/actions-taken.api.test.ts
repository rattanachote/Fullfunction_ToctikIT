import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/auth.js";

describe("Actions Taken API", () => {
  let requesterToken = "";
  let otherRequesterToken = "";
  let staffToken = "";
  let secondStaffToken = "";
  let inactiveStaffId = 0;
  let testTicketId = 0;
  let testActionId = 0;
  let testActionUpdatedAt = "";

  beforeAll(async () => {
    const password = "Password123!";
    const hashed = hashPassword(password);

    // Clean up
    const emails = [
      "req.action@example.com",
      "other.action@example.com",
      "staff.action@example.com",
      "staff2.action@example.com",
      "inactive.action@example.com",
    ];
    const existingTicket = await getPrisma().ticket.findUnique({ where: { ticketNo: "TKT-ACTION-000001" } });
    if (existingTicket) {
      await getPrisma().actionTaken.deleteMany({ where: { ticketId: existingTicket.id } });
      await getPrisma().ticket.delete({ where: { id: existingTicket.id } });
    }
    const oldUsers = await getPrisma().user.findMany({ where: { email: { in: emails } } });
    if (oldUsers.length > 0) {
      await getPrisma().actionTaken.deleteMany({ where: { performedById: { in: oldUsers.map((u) => u.id) } } });
      await getPrisma().user.deleteMany({ where: { email: { in: emails } } });
    }

    // Create users
    const r1 = await getPrisma().user.create({
      data: { name: "Action Req 1", email: "req.action@example.com", passwordHash: hashed, role: "Requester", mustChangePassword: false, isActive: true },
    });
    const r2 = await getPrisma().user.create({
      data: { name: "Action Req 2", email: "other.action@example.com", passwordHash: hashed, role: "Requester", mustChangePassword: false, isActive: true },
    });
    const s = await getPrisma().user.create({
      data: { name: "Action Staff", email: "staff.action@example.com", passwordHash: hashed, role: "ITStaff", mustChangePassword: false, isActive: true },
    });
    const s2 = await getPrisma().user.create({
      data: { name: "Second Action Staff", email: "staff2.action@example.com", passwordHash: hashed, role: "ITStaff", mustChangePassword: false, isActive: true },
    });
    const inactiveStaff = await getPrisma().user.create({
      data: { name: "Inactive Action Staff", email: "inactive.action@example.com", passwordHash: hashed, role: "ITStaff", mustChangePassword: false, isActive: false },
    });
    inactiveStaffId = inactiveStaff.id;

    const l1 = await request(app).post("/api/auth/login").send({ email: r1.email, password });
    requesterToken = l1.body.token;

    const l2 = await request(app).post("/api/auth/login").send({ email: r2.email, password });
    otherRequesterToken = l2.body.token;

    const l3 = await request(app).post("/api/auth/login").send({ email: s.email, password });
    staffToken = l3.body.token;

    const l4 = await request(app).post("/api/auth/login").send({ email: s2.email, password });
    secondStaffToken = l4.body.token;

    // Create ticket owned by r1, coordinated by s
    const cat = await getPrisma().category.findFirst();
    const catId = cat ? cat.id : 1;

    const t = await getPrisma().ticket.create({
      data: {
        ticketNo: "TKT-ACTION-000001",
        requesterId: r1.id,
        ownerId: s.id,
        categoryId: catId,
        relatedSystem: "VPN",
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
        summary: "Actions Taken Test Ticket",
        description: "Testing actions taken line items.",
      },
    });
    testTicketId = t.id;
  });

  it("allows IT Staff (Ticket Owner) to create an Action Taken record", async () => {
    const res = await request(app)
      .post(`/api/tickets/${testTicketId}/actions-taken`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        actionDescription: "Rebooted VPN Gateway server",
        result: "Service is online and healthy",
        followUpRequired: false,
        attachmentNotes: "See server uptime logs",
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body.actionDescription).toBe("Rebooted VPN Gateway server");
    expect(res.body.performedBy.role).toBe("ITStaff");
    testActionId = res.body.id;
    testActionUpdatedAt = res.body.updatedAt;
  });

  it("allows a different IT Staff member to record an Action Taken on the same ticket (BR-02)", async () => {
    const res = await request(app)
      .post(`/api/tickets/${testTicketId}/actions-taken`)
      .set("Authorization", `Bearer ${secondStaffToken}`)
      .send({
        actionDescription: "Verified client IPSec routing table and DNS resolution",
        result: "All routes responding within 15ms",
        followUpRequired: true,
        followUpNote: "Monitor packet loss during peak hours tomorrow",
      });

    expect(res.status).toBe(201);
    expect(res.body.performedBy.name).toBe("Second Action Staff");
    expect(res.body.followUpRequired).toBe(true);
    expect(res.body.followUpNote).toContain("Monitor packet loss");
  });

  it("fails to create Action Taken if follow-up is required but follow-up note is missing", async () => {
    const res = await request(app)
      .post(`/api/tickets/${testTicketId}/actions-taken`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        actionDescription: "Applied software patch",
        followUpRequired: true,
        followUpNote: "",
      });

    expect(res.status).toBe(400);
  });

  it("rejects Action Taken creation with an invalid actionDateTime format", async () => {
    const res = await request(app)
      .post(`/api/tickets/${testTicketId}/actions-taken`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        actionDateTime: "not-a-valid-date",
        actionDescription: "Invalid date test",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid actionDateTime/i);
  });

  it("rejects Action Taken assignment to an inactive IT Staff user", async () => {
    const res = await request(app)
      .post(`/api/tickets/${testTicketId}/actions-taken`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        actionDescription: "Attempted assignment to inactive staff",
        assigneeId: inactiveStaffId,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/inactive/i);
  });

  it("blocks Requester from creating an Action Taken record", async () => {
    const res = await request(app)
      .post(`/api/tickets/${testTicketId}/actions-taken`)
      .set("Authorization", `Bearer ${requesterToken}`)
      .send({
        actionDescription: "Requester trying to record action",
      });

    expect(res.status).toBe(403);
  });

  it("allows ticket owner (Requester) to view all Actions Taken in stable chronological order", async () => {
    const res = await request(app)
      .get(`/api/tickets/${testTicketId}/actions-taken`)
      .set("Authorization", `Bearer ${requesterToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(res.body[0].actionDescription).toBe("Rebooted VPN Gateway server");
    expect(res.body[1].actionDescription).toBe("Verified client IPSec routing table and DNS resolution");
  });

  it("blocks non-owner Requester from viewing Actions Taken (safe error 404)", async () => {
    const res = await request(app)
      .get(`/api/tickets/${testTicketId}/actions-taken`)
      .set("Authorization", `Bearer ${otherRequesterToken}`);

    expect(res.status).toBe(404);
  });

  it("allows IT Staff to update an existing Action Taken record", async () => {
    const res = await request(app)
      .put(`/api/actions-taken/${testActionId}`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        result: "Confirmed all VPN tunnels are active.",
        expectedUpdatedAt: testActionUpdatedAt,
      });

    expect(res.status).toBe(200);
    expect(res.body.result).toBe("Confirmed all VPN tunnels are active.");
  });

  it("returns 409 Conflict when updating Action Taken with a stale expectedUpdatedAt timestamp", async () => {
    const res = await request(app)
      .put(`/api/actions-taken/${testActionId}`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        result: "Stale overwrite attempt",
        expectedUpdatedAt: "2020-01-01T00:00:00.000Z",
      });

    expect(res.status).toBe(409);
  });
});
