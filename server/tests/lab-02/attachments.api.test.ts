import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("Attachments API", () => {
  let activeRequesterId = 1;
  let otherRequesterId = 2;
  let ticketId = 0;
  let uploadedAttachmentId = 0;
  const pdfPayload = Buffer.from("%PDF-1.4 dummy pdf content for postgres blob test");

  beforeAll(async () => {
    const requesters = await getPrisma().user.findMany({
      where: { isActive: true, role: "Requester" },
      orderBy: { id: "asc" },
      take: 2,
    });
    if (requesters[0]) {
      await getPrisma().user.update({
        where: { id: requesters[0].id },
        data: { mustChangePassword: false },
      });
      activeRequesterId = requesters[0].id;
    }
    if (requesters[1]) {
      await getPrisma().user.update({
        where: { id: requesters[1].id },
        data: { mustChangePassword: false },
      });
      otherRequesterId = requesters[1].id;
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

  it("can upload a valid file attachment without returning binary blob in metadata", async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .set("X-Requester-Id", activeRequesterId.toString())
      .attach("file", pdfPayload, "sample.pdf");

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body.originalName).toBe("sample.pdf");
    expect(res.body).not.toHaveProperty("blob");
    uploadedAttachmentId = res.body.id;
  });

  it("can download the uploaded attachment and matches binary content", async () => {
    const res = await request(app)
      .get(`/api/attachments/${uploadedAttachmentId}`)
      .set("X-Requester-Id", activeRequesterId.toString())
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(Buffer.compare(res.body as Buffer, pdfPayload)).toBe(0);
  });

  it("denies download to another requester who does not own the ticket", async () => {
    const res = await request(app)
      .get(`/api/attachments/${uploadedAttachmentId}`)
      .set("X-Requester-Id", otherRequesterId.toString());

    expect([403, 404]).toContain(res.status);
  });

  it("fails to upload invalid extension", async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .set("X-Requester-Id", activeRequesterId.toString())
      .attach("file", Buffer.from("dummy exe content"), "malicious.exe");

    expect(res.status).toBe(400);
  });

  it("rejects .svg or .html file even when Content-Type is spoofed as image/png", async () => {
    const svgRes = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .set("X-Requester-Id", activeRequesterId.toString())
      .attach("file", Buffer.from("<svg onload=alert(1)></svg>"), {
        filename: "payload.svg",
        contentType: "image/png",
      });
    expect(svgRes.status).toBe(400);

    const htmlInPngRes = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .set("X-Requester-Id", activeRequesterId.toString())
      .attach("file", Buffer.from("<html><script>alert(1)</script></html>"), {
        filename: "spoofed.png",
        contentType: "image/png",
      });
    expect(htmlInPngRes.status).toBe(400);
  });

  it("rejects 0-byte empty file upload", async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .set("X-Requester-Id", activeRequesterId.toString())
      .attach("file", Buffer.alloc(0), {
        filename: "empty.pdf",
        contentType: "application/pdf",
      });
    expect(res.status).toBe(400);
  });

  it("sets X-Content-Type-Options: nosniff, Content-Disposition: attachment, and canonical Content-Type on download", async () => {
    const res = await request(app)
      .get(`/api/attachments/${uploadedAttachmentId}`)
      .set("X-Requester-Id", activeRequesterId.toString());

    expect(res.status).toBe(200);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["content-disposition"]).toContain('attachment; filename="sample.pdf"');
    expect(res.headers["content-type"]).toBe("application/pdf");
  });

  it("canonicalizes mimeType from whitelist extension even if upload contentType is image/jpg", async () => {
    const jpegMagic = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const uploadRes = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .set("X-Requester-Id", activeRequesterId.toString())
      .attach("file", jpegMagic, {
        filename: "photo.jpg",
        contentType: "image/jpg",
      });

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.mimeType).toBe("image/jpeg");

    const dlRes = await request(app)
      .get(`/api/attachments/${uploadRes.body.id}`)
      .set("X-Requester-Id", activeRequesterId.toString());

    expect(dlRes.status).toBe(200);
    expect(dlRes.headers["content-type"]).toBe("image/jpeg");
    expect(dlRes.headers["x-content-type-options"]).toBe("nosniff");
    expect(dlRes.headers["content-disposition"]).toContain('attachment; filename="photo.jpg"');
  });
});
