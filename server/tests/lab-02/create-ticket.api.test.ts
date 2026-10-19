import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("POST /api/tickets", () => {
  let activeRequesterId = 1;
  let categoryId = 1;

  beforeAll(async () => {
    const active = await getPrisma().user.findFirst({ where: { isActive: true, role: "Requester" }, orderBy: { id: "asc" } });
    if (active) {
      await getPrisma().user.update({
        where: { id: active.id },
        data: { mustChangePassword: false },
      });
      activeRequesterId = active.id;
    }
    const cat = await getPrisma().category.findFirst();
    if (cat) categoryId = cat.id;
  });

  it("successfully creates a ticket with valid inputs", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", activeRequesterId.toString())
      .send({
        categoryId,
        relatedSystem: "Corporate Laptop",
        requestedPriority: "MEDIUM",
        summary: "Laptop keyboard broken",
        description: "Multiple keys (E, R, T) are unresponsive.",
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("ticketNo");
    expect(res.body.ticketNo).toMatch(/^TKT-\d{4}-\d{6}$/);
    expect(res.body.currentStatus).toBe("New");
  });

  it("fails to create a ticket without X-Requester-Id header", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .send({
        categoryId,
        relatedSystem: "Corporate Laptop",
        requestedPriority: "MEDIUM",
        summary: "Test",
        description: "Test",
      });

    expect(res.status).toBe(401);
  });

  it("fails to create a ticket with invalid priority", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", activeRequesterId.toString())
      .send({
        categoryId,
        relatedSystem: "Corporate Laptop",
        requestedPriority: "SUPER_URGENT",
        summary: "Test",
        description: "Test",
      });

    expect(res.status).toBe(400);
  });
});
