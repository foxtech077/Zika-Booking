import { test, expect } from '@playwright/test';

test('Messaging drawer works for Sales user', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto('http://localhost:3004/dashboard/bookings');
  await page.waitForSelector('table');

  const pendingRow = await page.locator('tbody tr').filter({ hasText: 'pending_payment' }).first();
  await expect(pendingRow).toBeVisible();

  await pendingRow.click();
  await page.waitForSelector('button[title="Cancel booking"]');

  const messageBtn = page.locator('button', { hasText: 'Message Guest' });
  await expect(messageBtn).toBeVisible();
  await messageBtn.click();

  await page.waitForSelector('h2:has-text("Messaging")');

  const conversationRows = page.locator('tbody tr');
  await expect(conversationRows.first()).toBeVisible({ timeout: 5000 });

  expect(consoleErrors).toEqual([]);
});
