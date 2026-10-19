import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("Attachments API", () => {
  let activeRequesterId = 1;
  let ticketId = 0;

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
    const catId = cat ? cat.id : 1;

    // Clean up first to avoid unique constraint error
    await getPrisma().attachment.deleteMany({ where: { ticket: { ticketNo: "TKT-TEST-ATTACH" } } });
    await getPrisma().ticket.deleteMany({ where: { ticketNo: "TKT-TEST-ATTACH" } });

    const t = await getPrisma().ticket.create({
      data: {
        ticketNo: "TKT-TEST-ATTACH",
        requesterId: activeRequesterId,
        categoryId: catId,
        relatedSystem: "Email",
        requestedPriority: "LOW",
        summary: "Attachment Ticket",
        description: "Test upload",
      },
    });
    ticketId = t.id;
  });

  it("can upload a valid file attachment", async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .set("X-Requester-Id", activeRequesterId.toString())
      .attach("file", Buffer.from("dummy pdf content"), "sample.pdf");

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body.originalName).toBe("sample.pdf");
  });

  it("fails to upload invalid extension", async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .set("X-Requester-Id", activeRequesterId.toString())
      .attach("file", Buffer.from("dummy exe content"), "malicious.exe");

    expect(res.status).toBe(400);
  });
});
