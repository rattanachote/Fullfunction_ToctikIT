import { test, expect } from "@playwright/test";

test.describe("Dashboards E2E", () => {
  test("renders the staff operational dashboard with metrics, my recent actions, admin user summary, and drill-down", async ({ page }) => {
    await page.goto("http://localhost:5173");

    // Login as Admin
    await page.fill("input[type='email']", "john.smith@example.com");
    await page.fill("input[type='password']", "password123");
    await page.click("button[type='submit']");

    // Check dashboard elements
    await expect(page.locator("text=Welcome back, John Smith!")).toBeVisible();
    await expect(page.locator("text=Recent Queue Activity")).toBeVisible();
    await expect(page.locator("text=Active Tickets by Priority")).toBeVisible();
    await expect(page.locator("text=My Recent Actions Taken")).toBeVisible();
    await expect(page.locator("text=System User Accounts (Admin)")).toBeVisible();

    // Drill down into Unassigned Tickets
    await page.click("text=Unassigned Tickets");
    await expect(page.locator("text=IT Ticket Queue")).toBeVisible();
  });

  test("renders the requester dashboard with ticket summary counts and drill-down", async ({ page }) => {
    await page.goto("http://localhost:5173");

    // Login as Requester
    await page.fill("input[type='email']", "michael.b@example.com");
    await page.fill("input[type='password']", "password123");
    await page.click("button[type='submit']");

    await expect(page.locator("text=Welcome back, Michael Brown!")).toBeVisible();
    await expect(page.locator("text=All Open Tickets")).toBeVisible();
    await expect(page.locator("text=Waiting for My Reply")).toBeVisible();
    await expect(page.locator("text=My Recent Tickets")).toBeVisible();
  });
});
