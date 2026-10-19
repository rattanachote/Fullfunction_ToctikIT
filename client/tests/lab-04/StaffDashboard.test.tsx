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
      metrics: {
        unassigned: 3,
        myAssigned: 5,
        new: 2,
        open: 4,
        inProgress: 3,
        waitingForRequester: 1,
        resolved: 6,
        closed: 8,
        byPriority: { high: 2, medium: 4, low: 3 },
      },
      recentTickets: [],
    }),
  };
});

describe("Staff Dashboard Screen", () => {
  it("renders staff operational metrics on dashboard load", async () => {
    sessionStorage.clear();
    sessionStorage.setItem("auth_token", "staff-token");
    sessionStorage.setItem(
      "current_user",
      JSON.stringify({
        id: 10,
        name: "Michael Staff",
        email: "michael.s@example.com",
        role: "ITStaff",
        isActive: true,
        mustChangePassword: false,
      })
    );

    render(<App />);

    expect(await screen.findByText(/Welcome back, Michael Staff!/i)).toBeInTheDocument();
    expect(screen.getByText(/Recent Queue Activity/i)).toBeInTheDocument();
    expect(screen.getByText(/Active Tickets by Priority/i)).toBeInTheDocument();
  });
});
