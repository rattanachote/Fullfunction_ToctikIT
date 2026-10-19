import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../../src/App.js";

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

describe("Attachment Section", () => {
  it("renders selector initially", async () => {
    render(<App />);
    expect(await screen.findByText(/Sign in to your account/i)).toBeInTheDocument();
  });
});
