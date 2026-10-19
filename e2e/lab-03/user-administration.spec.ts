import { test, expect } from "@playwright/test";

test.describe("User Administration E2E", () => {
  test("allows admin to view users list and inspect admin controls", async ({ page }) => {
    await page.goto("http://localhost:5173");

    // Login as Admin
    await page.fill("input[type='email']", "john.smith@example.com");
    await page.fill("input[type='password']", "password123");
    await page.click("button[type='submit']");

    // Verify User Management dashboard is loaded
    await expect(page.locator("text=User Accounts Management")).toBeVisible();
    await expect(page.locator("text=Create New User")).toBeVisible();
  });
});
