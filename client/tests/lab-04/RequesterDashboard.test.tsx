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
    fetchRequesterDashboard: vi.fn().mockResolvedValue({
      metrics: {
        totalOpen: 3,
        inProgress: 2,
        waitingForRequester: 1,
        recentlyResolved: 4,
      },
      recentTickets: [],
    }),
  };
});

describe("Requester Dashboard Screen", () => {
  it("renders requester metrics and quick actions", async () => {
    sessionStorage.clear();
    sessionStorage.setItem("auth_token", "req-token");
    sessionStorage.setItem(
      "current_user",
      JSON.stringify({
        id: 1,
        name: "Jennifer Anderson",
        email: "jennifer.a@example.com",
        role: "Requester",
        isActive: true,
        mustChangePassword: false,
      })
    );

    render(<App />);

    expect(await screen.findByText(/Welcome, Jennifer Anderson!/i)).toBeInTheDocument();
    expect(screen.getByText(/My Open Tickets/i)).toBeInTheDocument();
    expect(screen.getByText(/Quick Actions/i)).toBeInTheDocument();
  });
});
