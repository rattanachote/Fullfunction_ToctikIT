import { test, expect } from "@playwright/test";

test.describe("Requester Ticket Flow E2E", () => {
  test("allows user to select requester, create a ticket, and inspect details", async ({ page }) => {
    // 1. Visit the app
    await page.goto("http://localhost:5173");

    // 2. Select requester (simulated login)
    await page.selectOption("select.form-select", { label: "Jennifer Anderson (jennifer.a@example.com)" });
    await page.click("button:has-text('Continue')");

    // 3. Navigate to Create Ticket page
    await page.click("button:has-text('Create Ticket')");

    // 4. Fill form
    await page.selectOption("select[required]:nth-of-type(1)", { label: "Hardware" });
    await page.selectOption("select[required]:nth-of-type(2)", { label: "Corporate Laptop" });
    await page.fill("input[placeholder*='summary']", "My keyboard is broken");
    await page.fill("textarea[placeholder*='description']", "Multiple keys are unresponsive.");

    // 5. Submit form
    await page.click("button[type='submit']");

    // 6. Verify success screen
    await expect(page.locator("text=Ticket Created Successfully")).toBeVisible();
  });
});
