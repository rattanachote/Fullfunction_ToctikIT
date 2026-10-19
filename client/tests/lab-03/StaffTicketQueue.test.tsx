import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../../src/App.js";

vi.mock("../../src/api.js", async () => {
  return {
    fetchRequesters: vi.fn().mockResolvedValue([]),
    fetchCategories: vi.fn().mockResolvedValue([]),
    fetchSystems: vi.fn().mockResolvedValue([]),
    fetchTickets: vi.fn().mockResolvedValue({
      tickets: [
        {
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
        }
      ],
      pagination: { page: 1, limit: 10, totalCount: 1, totalPages: 1 },
    }),
    fetchAdminUsers: vi.fn().mockResolvedValue([]),
  };
});

describe("IT Staff Ticket Queue", () => {
  it("renders the shared queue table when logged in as IT Staff", async () => {
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

    const queueBtn = await screen.findByRole("button", { name: /Ticket Queue/i });
    queueBtn.click();

    expect(await screen.findByText(/IT Staff Ticket Queue/i)).toBeInTheDocument();
    expect(screen.getByText("TKT-2026-000101")).toBeInTheDocument();
  });
});
