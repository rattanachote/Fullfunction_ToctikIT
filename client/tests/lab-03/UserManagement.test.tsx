import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../../src/App.js";

vi.mock("../../src/api.js", async () => {
  return {
    fetchRequesters: vi.fn().mockResolvedValue([]),
    fetchCategories: vi.fn().mockResolvedValue([]),
    fetchSystems: vi.fn().mockResolvedValue([]),
    fetchTickets: vi.fn().mockResolvedValue({ tickets: [], pagination: { page: 1, limit: 10, totalCount: 0, totalPages: 1 } }),
    fetchAdminUsers: vi.fn().mockResolvedValue([
      { id: 1, name: "Admin User", email: "admin@example.com", role: "Administrator", isActive: true, mustChangePassword: false }
    ]),
  };
});

describe("Administrator User Management", () => {
  it("renders the User Accounts Management title and list", async () => {
    sessionStorage.clear();
    sessionStorage.setItem("auth_token", "admin-token");
    sessionStorage.setItem(
      "current_user",
      JSON.stringify({
        id: 20,
        name: "John Smith",
        email: "john.smith@example.com",
        role: "Administrator",
        isActive: true,
        mustChangePassword: false,
      })
    );

    render(<App />);

    const adminBtn = await screen.findByRole("button", { name: /User Management/i });
    adminBtn.click();

    expect(await screen.findByText(/User Accounts Management/i)).toBeInTheDocument();
    expect(screen.getByText("Admin User")).toBeInTheDocument();
  });
});
