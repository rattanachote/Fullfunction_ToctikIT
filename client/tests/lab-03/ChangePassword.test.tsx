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
  };
});

describe("Change Password Screen", () => {
  it("renders change password form when user must change password", async () => {
    sessionStorage.clear();
    // Cache user with mustChangePassword = true
    sessionStorage.setItem("auth_token", "temp-token");
    sessionStorage.setItem(
      "current_user",
      JSON.stringify({
        id: 1,
        name: "Reset User",
        email: "reset@example.com",
        role: "Requester",
        isActive: true,
        mustChangePassword: true,
      })
    );

    render(<App />);

    expect(await screen.findByText(/Change Your Password/i)).toBeInTheDocument();
    expect(screen.getByText(/You must change your initial password to continue/i)).toBeInTheDocument();
  });
});
