import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/auth.js";

describe("Staff Ticket Detail API", () => {
  let itStaffToken = "";
  let itStaffId = 0;
  let otherStaffId = 0;
  let ticketId = 0;

  beforeAll(async () => {
    const password = "Password123!";
    const hashed = hashPassword(password);

    // Clean up first to ensure idempotency
    const emails = ["alpha.it@example.com", "beta.it@example.com", "creator.req@example.com"];
    await getPrisma().ticket.deleteMany({ where: { ticketNo: "TKT-DETAIL-000001" } });
    await getPrisma().user.deleteMany({ where: { email: { in: emails } } });

    // Create IT Staff 1 (test operator)
    const s1 = await getPrisma().user.create({
      data: {
        name: "Staff Alpha",
        email: "alpha.it@example.com",
        passwordHash: hashed,
        role: "ITStaff",
        mustChangePassword: false,
        isActive: true,
      },
    });
    itStaffId = s1.id;
    const loginS = await request(app).post("/api/auth/login").send({ email: s1.email, password });
    itStaffToken = loginS.body.token;

    // Create IT Staff 2
    const s2 = await getPrisma().user.create({
      data: {
        name: "Staff Beta",
        email: "beta.it@example.com",
        passwordHash: hashed,
        role: "ITStaff",
        mustChangePassword: false,
        isActive: true,
      },
    });
    otherStaffId = s2.id;

    // Create Requester & Ticket
    const r = await getPrisma().user.create({
      data: {
        name: "Ticket Creator",
        email: "creator.req@example.com",
        passwordHash: hashed,
        role: "Requester",
        mustChangePassword: false,
        isActive: true,
      },
    });

    const cat = await getPrisma().category.findFirst();
    const catId = cat ? cat.id : 1;

    const ticket = await getPrisma().ticket.create({
      data: {
        ticketNo: "TKT-DETAIL-000001",
        requesterId: r.id,
        categoryId: catId,
        relatedSystem: "Email",
        requestedPriority: "LOW",
        itPriority: "LOW",
        currentStatus: "New",
        summary: "Detail Test Ticket",
        description: "Testing status changes and owner assignment",
      },
    });
    ticketId = ticket.id;
  });

  it("allows IT staff to claim ticket ownership", async () => {
    const res = await request(app)
      .put(`/api/tickets/${ticketId}/owner`)
      .set("Authorization", `Bearer ${itStaffToken}`)
      .send({ ownerId: itStaffId });
    expect(res.status).toBe(200);
    expect(res.body.ownerId).toBe(itStaffId);
  });

  it("allows IT staff to reassign ticket ownership", async () => {
    const res = await request(app)
      .put(`/api/tickets/${ticketId}/owner`)
      .set("Authorization", `Bearer ${itStaffToken}`)
      .send({ ownerId: otherStaffId });
    expect(res.status).toBe(200);
    expect(res.body.ownerId).toBe(otherStaffId);
  });

  it("updates IT priority successfully", async () => {
    const res = await request(app)
      .put(`/api/tickets/${ticketId}/status`)
      .set("Authorization", `Bearer ${itStaffToken}`)
      .send({ itPriority: "HIGH" });
    expect(res.status).toBe(200);
    expect(res.body.itPriority).toBe("HIGH");
  });

  it("allows valid status transition (New -> In Progress)", async () => {
    // Current status in DB is "New" (or reset to New for cleanliness)
    await getPrisma().ticket.update({
      where: { id: ticketId },
      data: { currentStatus: "New" }
    });

    const res = await request(app)
      .put(`/api/tickets/${ticketId}/status`)
      .set("Authorization", `Bearer ${itStaffToken}`)
      .send({ currentStatus: "In Progress" });
    expect(res.status).toBe(200);
    expect(res.body.currentStatus).toBe("In Progress");
  });

  it("rejects invalid status transition (New -> Closed directly)", async () => {
    // Reset to New
    await getPrisma().ticket.update({
      where: { id: ticketId },
      data: { currentStatus: "New" }
    });

    const res = await request(app)
      .put(`/api/tickets/${ticketId}/status`)
      .set("Authorization", `Bearer ${itStaffToken}`)
      .send({ currentStatus: "Closed" });
    expect(res.status).toBe(400); // Bad Request
  });
});
