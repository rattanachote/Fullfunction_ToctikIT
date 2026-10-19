import { test, expect } from "@playwright/test";

test.describe("Actions Taken Flow E2E", () => {
  test("allows IT Staff to record and edit actions taken on a ticket", async ({ page }) => {
    await page.goto("http://localhost:5173");

    // Login as IT Staff / Admin
    await page.fill("input[type='email']", "john.smith@example.com");
    await page.fill("input[type='password']", "password123");
    await page.click("button[type='submit']");

    // Navigate to Queue
    await page.click("button:has-text('Ticket Queue')");

    // Open first ticket details
    await page.click("button:has-text('Details'):first-of-type");

    // Verify Actions Taken card is visible
    await expect(page.locator("text=Actions Taken (Work Tracker)")).toBeVisible();
    await expect(page.locator("button:has-text('Record Action')")).toBeVisible();

    // Record a new Action Taken
    await page.fill("textarea[placeholder*='Record action taken description']", "Verified network switch port configuration and reset VLAN tagging.");
    await page.fill("input[placeholder*='Result']", "Port connectivity restored.");
    await page.click("button:has-text('Record Action')");

    await expect(page.locator("text=Verified network switch port configuration and reset VLAN tagging.")).toBeVisible();

    // Edit the recorded Action Taken inline
    await page.click("button:has-text('Edit'):first-of-type");
    await page.fill("input[placeholder='Result...']", "Confirmed stable link with user.");
    await page.click("button:has-text('Save Action')");
    await expect(page.locator("text=Confirmed stable link with user.")).toBeVisible();
  });

  test("allows Requester to view Actions Taken read-only while hiding Internal Notes", async ({ page }) => {
    await page.goto("http://localhost:5173");

    // Login as Requester (Michael Brown)
    await page.fill("input[type='email']", "michael.b@example.com");
    await page.fill("input[type='password']", "password123");
    await page.click("button[type='submit']");

    // Navigate to My Tickets
    await page.click("button:has-text('My Tickets')");
    await page.click("button:has-text('Details'):first-of-type");

    // Requester sees Actions Taken read-only without Record Action form or Internal Notes
    await expect(page.locator("text=Actions Taken (Work Tracker)")).toBeVisible();
    await expect(page.locator("button:has-text('Record Action')")).toHaveCount(0);
    await expect(page.locator("text=Internal Notes (IT Only)")).toHaveCount(0);
  });
});
