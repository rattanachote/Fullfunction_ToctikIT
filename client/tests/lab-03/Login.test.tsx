import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

vi.mock("../../src/api.js", async () => {
  return {
    login: vi.fn().mockResolvedValue({
      token: "mock-token",
      user: { id: 1, name: "Jennifer Anderson", email: "jennifer.a@example.com", role: "Requester", isActive: true, mustChangePassword: false }
    }),
    fetchRequesters: vi.fn().mockResolvedValue([]),
    fetchCategories: vi.fn().mockResolvedValue([]),
    fetchSystems: vi.fn().mockResolvedValue([]),
    fetchTickets: vi.fn().mockResolvedValue({ tickets: [], pagination: { page: 1, limit: 10, totalCount: 0, totalPages: 1 } }),
    fetchAdminUsers: vi.fn().mockResolvedValue([]),
  };
});

describe("Login Screen", () => {
  it("renders login inputs and submits form", async () => {
    // Clear session storage before test
    sessionStorage.clear();

    render(<App />);

    // Check if login elements are present
    expect(screen.getByText(/Sign in to your account/i)).toBeInTheDocument();
    
    const emailInput = screen.getByPlaceholderText(/name@toktickit.com/i);
    const passwordInput = screen.getByPlaceholderText(/••••••••/i);
    const submitBtn = screen.getByRole("button", { name: /Sign In/i });

    // Simulate login
    fireEvent.change(emailInput, { target: { value: "jennifer.a@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    fireEvent.click(submitBtn);

    // Verify it triggers api.login
    await waitFor(() => {
      expect(api.login).toHaveBeenCalledWith("jennifer.a@example.com", "password123");
    });
  });
});
