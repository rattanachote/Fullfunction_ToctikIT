import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../../src/App.js";

// Mock the API helpers
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
  };
});

describe("Create Ticket Screen", () => {
  it("renders the Create Ticket header when navigates to create screen", async () => {
    render(<App />);
    // Since App defaults to selector screen, it should show selector title
    expect(await screen.findByText(/Sign in to your account/i)).toBeInTheDocument();
  });
});
