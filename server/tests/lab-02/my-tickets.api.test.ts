import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("GET /api/tickets", () => {
  let activeRequesterId = 1;

  beforeAll(async () => {
    const active = await getPrisma().user.findFirst({ where: { isActive: true, role: "Requester" }, orderBy: { id: "asc" } });
    if (active) {
      await getPrisma().user.update({
        where: { id: active.id },
        data: { mustChangePassword: false },
      });
      activeRequesterId = active.id;
    }
  });

  it("retrieves the tickets owned by current requester", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Requester-Id", activeRequesterId.toString());

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("tickets");
    expect(Array.isArray(res.body.tickets)).toBe(true);
    expect(res.body).toHaveProperty("pagination");
  });
});
