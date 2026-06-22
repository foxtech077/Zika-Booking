import { test } from '@playwright/test';

test('Check finance page error', async ({ page }) => {
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`PAGE ERROR LOG: "${msg.text()}"`);
    }
  });
  page.on('pageerror', error => {
    console.log(`UNCAUGHT EXCEPTION: ${error.message}`);
    console.log(`STACK: ${error.stack}`);
  });
  
  await page.goto('http://localhost:3002/admin/dashboard/finance', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
});
