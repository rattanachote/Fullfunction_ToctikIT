import { describe, it, expect, beforeAll, vi } from "vitest";
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

  it("retries when ticket.create throws P2002 on first attempt and succeeds on second attempt", async () => {
    const prisma = getPrisma();
    const realCreate = prisma.ticket.create.bind(prisma.ticket);
    let callCount = 0;

    const spy = vi.spyOn(prisma.ticket, "create").mockImplementation((async (args: any) => {
      callCount++;
      if (callCount === 1) {
        const p2002Err: any = new Error("Unique constraint failed on the fields: (`ticketNo`)");
        p2002Err.code = "P2002";
        throw p2002Err;
      }
      return realCreate(args);
    }) as any);

    try {
      const res = await request(app)
        .post("/api/tickets")
        .set("X-Requester-Id", activeRequesterId.toString())
        .send({
          categoryId,
          relatedSystem: "Corporate Laptop",
          requestedPriority: "HIGH",
          summary: "P2002 retry success test",
          description: "First attempt collides with P2002, second succeeds.",
        });

      expect(res.status).toBe(201);
      expect(callCount).toBe(2);
      expect(res.body).toHaveProperty("ticketNo");
    } finally {
      spy.mockRestore();
    }
  });

  it("returns 500 when ticket.create throws P2002 on all 3 attempts", async () => {
    const prisma = getPrisma();
    let callCount = 0;

    const spy = vi.spyOn(prisma.ticket, "create").mockImplementation((async () => {
      callCount++;
      const p2002Err: any = new Error("Unique constraint failed on the fields: (`ticketNo`)");
      p2002Err.code = "P2002";
      throw p2002Err;
    }) as any);

    try {
      const res = await request(app)
        .post("/api/tickets")
        .set("X-Requester-Id", activeRequesterId.toString())
        .send({
          categoryId,
          relatedSystem: "Corporate Laptop",
          requestedPriority: "HIGH",
          summary: "P2002 retry exhausted test",
          description: "All 3 attempts collide with P2002.",
        });

      expect(res.status).toBe(500);
      expect(callCount).toBe(3);
    } finally {
      spy.mockRestore();
    }
  });
});
