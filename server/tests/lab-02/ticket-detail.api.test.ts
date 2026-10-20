import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("GET /api/tickets/:id", () => {
  let requesterAId = 1;
  let requesterBId = 2;
  let ticketIdOwnedByA = 0;

  beforeAll(async () => {
    const users = await getPrisma().user.findMany({ where: { isActive: true, role: "Requester" }, orderBy: { id: "asc" } });
    if (users.length >= 2) {
      requesterAId = users[0].id;
      requesterBId = users[1].id;
      
      await getPrisma().user.updateMany({
        where: { id: { in: [requesterAId, requesterBId] } },
        data: { mustChangePassword: false }
      });
    }

    const cat = await getPrisma().category.findFirst();
    const catId = cat ? cat.id : 1;

    // Clean up first to avoid unique constraint error
    await getPrisma().attachment.deleteMany({ where: { ticket: { ticketNo: "TKT-TEST-A1" } } });
    await getPrisma().ticket.deleteMany({ where: { ticketNo: "TKT-TEST-A1" } });

    // Create a ticket for Requester A
    const t = await getPrisma().ticket.create({
      data: {
        ticketNo: "TKT-TEST-A1",
        requesterId: requesterAId,
        categoryId: catId,
        relatedSystem: "Email",
        requestedPriority: "LOW",
        summary: "A's Ticket",
        description: "Private issue",
      },
    });
    ticketIdOwnedByA = t.id;
  });

  it("allows owner (Requester A) to retrieve details", async () => {
    const res = await request(app)
      .get(`/api/tickets/${ticketIdOwnedByA}`)
      .set("X-Requester-Id", requesterAId.toString());

    expect(res.status).toBe(200);
    expect(res.body.summary).toBe("A's Ticket");
  });

  it("blocks non-owner (Requester B) from retrieving details", async () => {
    const res = await request(app)
      .get(`/api/tickets/${ticketIdOwnedByA}`)
      .set("X-Requester-Id", requesterBId.toString());

    expect(res.status).toBe(403);
  });

  it("returns 400 (not 500) for non-numeric or out-of-range ticket IDs and negative pagination", async () => {
    const resNaN = await request(app)
      .get("/api/tickets/abc")
      .set("X-Requester-Id", requesterAId.toString());
    expect(resNaN.status).toBe(400);

    const resOverflow = await request(app)
      .get("/api/tickets/9999999999999999")
      .set("X-Requester-Id", requesterAId.toString());
    expect(resOverflow.status).toBe(400);

    const resNegPage = await request(app)
      .get("/api/tickets?page=-1&limit=-5")
      .set("X-Requester-Id", requesterAId.toString());
    expect(resNegPage.status).toBe(200);

    const resBadCat = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", requesterAId.toString())
      .send({
        categoryId: "not-a-number",
        relatedSystem: "Email",
        requestedPriority: "LOW",
        summary: "Test",
        description: "Test",
      });
    expect(resBadCat.status).toBe(400);

    const resMissingCat = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", requesterAId.toString())
      .send({
        categoryId: 999999,
        relatedSystem: "Email",
        requestedPriority: "LOW",
        summary: "Test",
        description: "Test",
      });
    expect(resMissingCat.status).toBe(400);
  });
});
