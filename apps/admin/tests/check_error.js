const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log(`[CONSOLE ${msg.type().toUpperCase()}]: ${msg.text()}`);
  });
  
  page.on('pageerror', err => {
    console.log(`[PAGE ERROR]: ${err.message}`);
    console.log(err.stack);
  });

  page.on('response', response => {
    const status = response.status();
    if (status >= 400) {
      console.log(`[RESPONSE ERROR] ${status}: ${response.url()}`);
    }
  });

  page.on('requestfailed', request => {
    console.log(`[REQUEST FAILED]: ${request.url()} - ${request.failure() ? request.failure().errorText : 'unknown'}`);
  });
  
  console.log("Navigating to dashboard/finance...");
  try {
    await page.goto('http://localhost:3002/admin/dashboard/finance', { waitUntil: 'networkidle', timeout: 15000 });
  } catch (e) {
    console.log("Navigation ended/failed:", e.message);
  }
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const bodyHTML = await page.evaluate(() => document.body.innerHTML);
  console.log("BODY CONTENT LENGTH:", bodyHTML.length);
  if (bodyHTML.length < 1000) {
    console.log("BODY HTML:", bodyHTML);
  }
  
  await browser.close();
})();
