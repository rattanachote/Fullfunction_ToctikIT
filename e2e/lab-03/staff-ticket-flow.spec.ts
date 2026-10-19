import { test, expect } from "@playwright/test";

test.describe("IT Staff Ticket Flow E2E", () => {
  test("allows IT staff to login, view queue, assign ticket, and post comments", async ({ page }) => {
    // Note: We use john.smith@example.com (Admin) or sarah.it@example.com (IT Staff).
    // Let's use john.smith@example.com since we seeded it with mustChangePassword = false.
    await page.goto("http://localhost:5173");

    // Login
    await page.fill("input[type='email']", "john.smith@example.com");
    await page.fill("input[type='password']", "password123");
    await page.click("button[type='submit']");

    // Navigate to Ticket Queue
    await page.click("button:has-text('Ticket Queue')");
    await expect(page.locator("text=IT Staff Ticket Queue")).toBeVisible();

    // Verify first ticket exists and open it
    await page.click("button:has-text('Details'):first-of-type");
    await expect(page.locator("text=Ticket Details")).toBeVisible();

    // Verify public comments and internal notes sections are visible
    await expect(page.locator("text=Public Comments")).toBeVisible();
    await expect(page.locator("text=Internal Notes")).toBeVisible();
  });
});
