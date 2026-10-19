import { test, expect } from "@playwright/test";

test.describe("Authentication E2E", () => {
  test("forces password change for new users and handles login redirection", async ({ page }) => {
    // 1. Visit App
    await page.goto("http://localhost:5173");

    // 2. Perform login for a seeded user requiring password change
    await page.fill("input[type='email']", "jennifer.a@example.com");
    await page.fill("input[type='password']", "password123");
    await page.click("button[type='submit']");

    // 3. Verify redirected to Change Password screen
    await expect(page.locator("text=Change Your Password")).toBeVisible();
    await expect(page.locator("text=You must change your initial password to continue")).toBeVisible();
  });
});
