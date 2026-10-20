import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

// WORKED EXAMPLE — this test is written for you. Study it, then implement the
// /api/health route in src/app.ts until this test turns green. Use the same
// pattern to write the categories test yourself (see categories.test.ts).
describe("GET /api/health & /api/ready", () => {
  it("returns 200 with status ok and the service name", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", service: "TokTickIT API" });
  });

  it("returns 200 ready when database is reachable", async () => {
    const res = await request(app).get("/api/ready");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ready", db: "connected" });
  });

  it("sets security headers and returns 400 JSON on malformed JSON payload", async () => {
    const healthRes = await request(app).get("/api/health");
    expect(healthRes.headers["x-content-type-options"]).toBe("nosniff");
    expect(healthRes.headers["x-frame-options"]).toBe("DENY");
    expect(healthRes.headers["x-powered-by"]).toBeUndefined();

    const badJsonRes = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email": "broken');
    expect(badJsonRes.status).toBe(400);
    expect(badJsonRes.headers["content-type"]).toContain("application/json");
    expect(badJsonRes.body).toHaveProperty("error");
  });
});
