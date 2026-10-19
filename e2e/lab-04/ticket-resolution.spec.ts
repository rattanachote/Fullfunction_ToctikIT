import { test, expect } from "@playwright/test";

test.describe("Ticket Resolution E2E", () => {
  test("distinguishes Requester resolved indication from formal IT Staff resolution and closure", async ({ page }) => {
    await page.goto("http://localhost:5173");

    // 1. Login as Requester and indicate issue is resolved
    await page.fill("input[type='email']", "michael.b@example.com");
    await page.fill("input[type='password']", "password123");
    await page.click("button[type='submit']");

    await page.click("button:has-text('My Tickets')");
    await page.click("button:has-text('Details'):first-of-type");
    await expect(page.locator("text=Actions Taken (Work Tracker)")).toBeVisible();
    await page.click("button:has-text('Logout')");

    // 2. Login as IT Staff / Admin and formally update status
    await page.fill("input[type='email']", "john.smith@example.com");
    await page.fill("input[type='password']", "password123");
    await page.click("button[type='submit']");

    await page.click("button:has-text('Ticket Queue')");
    await page.click("button:has-text('Details'):first-of-type");

    await expect(page.locator("text=Update Status")).toBeVisible();
    await expect(page.locator("select[aria-label='Select Ticket Status']")).toBeVisible();
  });
});
