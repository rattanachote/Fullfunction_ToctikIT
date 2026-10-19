import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../../src/App.js";

vi.mock("../../src/api.js", async () => {
  return {
    fetchRequesters: vi.fn().mockResolvedValue([]),
    fetchCategories: vi.fn().mockResolvedValue([]),
    fetchSystems: vi.fn().mockResolvedValue([]),
    fetchTickets: vi.fn().mockResolvedValue({ tickets: [], pagination: { page: 1, limit: 10, totalCount: 0, totalPages: 1 } }),
    fetchAdminUsers: vi.fn().mockResolvedValue([]),
    fetchStaffDashboard: vi.fn().mockResolvedValue({
      metrics: { unassigned: 0, myAssigned: 0, new: 0, open: 0, inProgress: 0, waitingForRequester: 0, resolved: 0, closed: 0, byPriority: { high: 0, medium: 0, low: 0 } },
      recentTickets: [],
      myRecentActions: [],
    }),
    fetchTicketDetails: vi.fn().mockResolvedValue({
      id: 102,
      ticketNo: "TKT-2026-000102",
      requesterId: 2,
      requester: { id: 2, name: "Jennifer Anderson", email: "jennifer@example.com" },
      ownerId: 10,
      owner: { id: 10, name: "Workflow Staff", email: "flow@example.com" },
      categoryId: 1,
      category: { id: 1, name: "Software" },
      relatedSystem: "LEB2 App",
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      currentStatus: "New",
      requesterResolvedIndication: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attachments: [],
    }),
    fetchComments: vi.fn().mockResolvedValue([]),
    fetchNotes: vi.fn().mockResolvedValue([]),
    fetchActionsTaken: vi.fn().mockResolvedValue([]),
  };
});

describe("Ticket Workflow Screen", () => {
  it("renders permitted status transitions for New ticket in workflow controls", async () => {
    sessionStorage.clear();
    sessionStorage.setItem("auth_token", "staff-token");
    sessionStorage.setItem("current_screen", "detail");
    sessionStorage.setItem("current_ticket_id", "102");
    sessionStorage.setItem(
      "current_user",
      JSON.stringify({
        id: 10,
        name: "Workflow Staff",
        email: "flow@example.com",
        role: "ITStaff",
        isActive: true,
        mustChangePassword: false,
      })
    );

    render(<App />);
    expect(await screen.findByText(/IT Staff Operations & Workflow Controls/i)).toBeInTheDocument();
    expect(screen.getByText(/New \(Current\)/i)).toBeInTheDocument();
    expect(screen.getByText(/→ Open/i)).toBeInTheDocument();
    expect(screen.getByText(/→ In Progress/i)).toBeInTheDocument();
    expect(screen.getByText(/→ Cancelled/i)).toBeInTheDocument();
  });
});
