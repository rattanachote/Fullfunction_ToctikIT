import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import App from "../../src/App.js";

vi.mock("../../src/api.js", async () => {
  return {
    fetchRequesters: vi.fn().mockResolvedValue([]),
    fetchCategories: vi.fn().mockResolvedValue([]),
    fetchSystems: vi.fn().mockResolvedValue([]),
    fetchTickets: vi.fn().mockResolvedValue({ tickets: [], pagination: { page: 1, limit: 10, totalCount: 0, totalPages: 1 } }),
    fetchAdminUsers: vi.fn().mockResolvedValue([]),
    fetchTicketDetails: vi.fn().mockResolvedValue({
      id: 101,
      ticketNo: "TKT-2026-000101",
      requesterId: 2,
      requester: { id: 2, name: "Jennifer Anderson", email: "jennifer@example.com" },
      ownerId: null,
      categoryId: 1,
      category: { id: 1, name: "Hardware" },
      relatedSystem: "Laptop",
      requestedPriority: "HIGH",
      itPriority: "HIGH",
      currentStatus: "New",
      requesterResolvedIndication: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attachments: [],
    }),
    fetchComments: vi.fn().mockResolvedValue([]),
    fetchNotes: vi.fn().mockResolvedValue([]),
    fetchStaffDashboard: vi.fn().mockResolvedValue({
      metrics: {
        unassigned: 0,
        myAssigned: 0,
        myActionsTakenCount: 0,
        new: 0,
        open: 0,
        inProgress: 0,
        waitingForRequester: 0,
        resolved: 0,
        closed: 0,
        byPriority: { high: 0, medium: 0, low: 0 },
        userCounts: { totalUsers: 1, activeUsers: 1, inactiveUsers: 0 },
      },
      recentTickets: [],
      myRecentActions: [],
    }),
  };
});

describe("IT Staff Ticket Detail", () => {
  it("renders the IT Operations Control Panel in details view", async () => {
    sessionStorage.clear();
    sessionStorage.setItem("auth_token", "staff-token");
    sessionStorage.setItem(
      "current_user",
      JSON.stringify({
        id: 10,
        name: "Sarah Support",
        email: "sarah.s@example.com",
        role: "ITStaff",
        isActive: true,
        mustChangePassword: false,
      })
    );

    render(<App />);
    expect(await screen.findByRole("button", { name: /Ticket Queue/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Sarah Support/i).length).toBeGreaterThan(0);
  });
});
