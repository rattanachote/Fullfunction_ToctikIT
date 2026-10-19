import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/auth.js";

describe("Ticket Workflow & Resolution API", () => {
  let requesterToken = "";
  let staffToken = "";
  let ticketId = 0;

  beforeAll(async () => {
    const password = "Password123!";
    const hashed = hashPassword(password);

    // Clean up
    const emails = ["req.flow@example.com", "staff.flow@example.com"];
    const existing = await getPrisma().ticket.findUnique({ where: { ticketNo: "TKT-FLOW-000001" } });
    if (existing) {
      await getPrisma().actionTaken.deleteMany({ where: { ticketId: existing.id } });
      await getPrisma().publicComment.deleteMany({ where: { ticketId: existing.id } });
      await getPrisma().ticket.delete({ where: { id: existing.id } });
    }
    await getPrisma().user.deleteMany({ where: { email: { in: emails } } });

    const r = await getPrisma().user.create({
      data: { name: "Flow Requester", email: "req.flow@example.com", passwordHash: hashed, role: "Requester", mustChangePassword: false, isActive: true },
    });
    const s = await getPrisma().user.create({
      data: { name: "Flow Staff", email: "staff.flow@example.com", passwordHash: hashed, role: "ITStaff", mustChangePassword: false, isActive: true },
    });

    const l1 = await request(app).post("/api/auth/login").send({ email: r.email, password });
    requesterToken = l1.body.token;

    const l2 = await request(app).post("/api/auth/login").send({ email: s.email, password });
    staffToken = l2.body.token;

    const cat = await getPrisma().category.findFirst();
    const catId = cat ? cat.id : 1;

    const t = await getPrisma().ticket.create({
      data: {
        ticketNo: "TKT-FLOW-000001",
        requesterId: r.id,
        categoryId: catId,
        relatedSystem: "Email",
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
        currentStatus: "New",
        summary: "Flow Test Ticket",
        description: "Testing state machine transitions.",
      },
    });
    ticketId = t.id;
  });

  it("permits IT Staff to advance status from New to In Progress", async () => {
    const res = await request(app)
      .put(`/api/tickets/${ticketId}/status`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ currentStatus: "In Progress" });

    expect(res.status).toBe(200);
    expect(res.body.currentStatus).toBe("In Progress");
  });

  it("blocks invalid status transition from In Progress directly to Closed", async () => {
    const res = await request(app)
      .put(`/api/tickets/${ticketId}/status`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ currentStatus: "Closed" });

    expect(res.status).toBe(400);
  });

  it("enforces resolution gate when requireActionForResolve is set and no Actions Taken exist", async () => {
    const res = await request(app)
      .put(`/api/tickets/${ticketId}/status`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ currentStatus: "Resolved", requireActionForResolve: true });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Action Taken/i);
  });

  it("allows Requester to toggle advisory resolved indication without changing ticket status", async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/indicate-resolved`)
      .set("Authorization", `Bearer ${requesterToken}`);

    expect(res.status).toBe(200);
    expect(res.body.requesterResolvedIndication).toBe(true);
    expect(res.body.currentStatus).toBe("In Progress");
  });

  it("returns 409 Conflict when updating status with a stale expectedUpdatedAt timestamp", async () => {
    const res = await request(app)
      .put(`/api/tickets/${ticketId}/status`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        currentStatus: "Resolved",
        expectedUpdatedAt: "2020-01-01T00:00:00.000Z",
      });

    expect(res.status).toBe(409);
  });

  it("allows IT Staff to formally resolve the ticket", async () => {
    const res = await request(app)
      .put(`/api/tickets/${ticketId}/status`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ currentStatus: "Resolved" });

    expect(res.status).toBe(200);
    expect(res.body.currentStatus).toBe("Resolved");
  });

  it("allows IT Staff to close a resolved ticket and reopen if needed", async () => {
    const resClose = await request(app)
      .put(`/api/tickets/${ticketId}/status`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ currentStatus: "Closed" });

    expect(resClose.status).toBe(200);
    expect(resClose.body.currentStatus).toBe("Closed");

    const resReopen = await request(app)
      .put(`/api/tickets/${ticketId}/status`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ currentStatus: "Reopened" });

    expect(resReopen.status).toBe(200);
    expect(resReopen.body.currentStatus).toBe("Reopened");

    const resInProgress = await request(app)
      .put(`/api/tickets/${ticketId}/status`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ currentStatus: "In Progress" });

    expect(resInProgress.status).toBe(200);
    expect(resInProgress.body.currentStatus).toBe("In Progress");
  });
});
