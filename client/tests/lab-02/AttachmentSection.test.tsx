import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

vi.mock("../../src/api.js", async () => {
  const actual = await vi.importActual("../../src/api.js");
  return {
    ...actual,
    fetchRequesters: vi.fn().mockResolvedValue([
      { id: 1, name: "Jennifer Anderson", email: "jennifer.a@example.com", isActive: true }
    ]),
    fetchCategories: vi.fn().mockResolvedValue([
      { id: 1, name: "Hardware" }
    ]),
    fetchSystems: vi.fn().mockResolvedValue([
      { id: 1, name: "Corporate Laptop", isActive: true }
    ]),
    fetchTicketDetails: vi.fn().mockResolvedValue({
      id: 202,
      ticketNo: "TKT-2026-000202",
      requesterId: 2,
      requester: { id: 2, name: "Jennifer Anderson", email: "jennifer.a@example.com" },
      ownerId: null,
      owner: null,
      categoryId: 1,
      category: { id: 1, name: "Hardware" },
      relatedSystem: "Corporate Laptop",
      requestedPriority: "HIGH",
      itPriority: "HIGH",
      currentStatus: "In Progress",
      requesterResolvedIndication: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attachments: [
        {
          id: 99,
          ticketId: 202,
          filename: "file-99.pdf",
          originalName: "diagnostic-report.pdf",
          size: 2048,
          mimeType: "application/pdf",
          isRemoved: false,
          removeReason: null,
          createdAt: new Date().toISOString(),
        },
      ],
    }),
    fetchComments: vi.fn().mockResolvedValue([]),
    fetchNotes: vi.fn().mockResolvedValue([]),
    fetchActionsTaken: vi.fn().mockResolvedValue([]),
    downloadAttachment: vi.fn().mockResolvedValue(undefined),
  };
});

describe("Attachment Section", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("renders selector initially", async () => {
    render(<App />);
    expect(await screen.findByText(/Sign in to your account/i)).toBeInTheDocument();
  });

  it("renders Attachments Management section in ticket detail and invokes downloadAttachment on click", async () => {
    sessionStorage.setItem("auth_token", "req-token");
    sessionStorage.setItem("current_screen", "detail");
    sessionStorage.setItem("current_ticket_id", "202");
    sessionStorage.setItem(
      "current_user",
      JSON.stringify({
        id: 2,
        name: "Jennifer Anderson",
        email: "jennifer.a@example.com",
        role: "Requester",
        isActive: true,
        mustChangePassword: false,
      })
    );

    render(<App />);
    expect(await screen.findByText(/Attachments Management/i)).toBeInTheDocument();
    const fileBtn = await screen.findByRole("button", { name: "diagnostic-report.pdf" });
    expect(fileBtn).toBeInTheDocument();

    fireEvent.click(fileBtn);
    expect(api.downloadAttachment).toHaveBeenCalledWith(99, "diagnostic-report.pdf");
  });
});
