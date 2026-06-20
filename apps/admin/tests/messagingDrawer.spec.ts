import { test, expect } from '@playwright/test';

test('Messaging drawer works for Sales user', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto('http://localhost:3004/dashboard/bookings', { waitUntil: 'networkidle' });
  await page.waitForSelector('table', { state: 'visible' });

  const pendingRow = await page.locator('tbody tr').filter({ hasText: 'pending_payment' }).first();
  await expect(pendingRow).toBeVisible();

  await pendingRow.click();
  // Wait for the booking detail drawer to appear and the Cancel button to be visible
  await page.waitForSelector('button[title="Cancel booking"]', { state: 'visible' });

  const messageBtn = page.locator('button', { hasText: 'Message Guest' });
  await expect(messageBtn).toBeVisible();
  await messageBtn.click();

  // Wait for the messaging drawer heading
  await page.waitForSelector('h2:has-text("Messaging")', { state: 'visible' });

  // Scope conversation rows to the messaging drawer
  const conversationRows = page.locator('[role="dialog"] tbody tr');
  await expect(conversationRows.first()).toBeVisible({ timeout: 5000 });

  expect(consoleErrors).toEqual([]);
});
