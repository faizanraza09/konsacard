import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  const code = 'l0cw';
  const referer = `https://www.foodpanda.pk/restaurant/${code}`;
  const apiUrl = `https://pk.fd-api.com/api/v5/vendors/${code}?include=menus&language_id=1&opening_type=delivery&basket_currency=PKR`;

  console.log(`Navigating to ${referer}...`);
  const response = await page.goto(referer, { waitUntil: 'domcontentloaded', timeout: 15000 });
  console.log(`Page status: ${response.status()}`);
  
  // Check if we hit a captcha
  const content = await page.content();
  if (content.includes('captcha') || content.includes('PerimeterX') || content.includes('blocked')) {
    console.log('WARNING: Page content suggests a CAPTCHA or block!');
  }

  console.log('Waiting 2s for PX scripts...');
  await new Promise(r => setTimeout(r, 2000));

  console.log('Fetching API from within page context...');
  const result = await page.evaluate(async (url) => {
    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'x-fp-api-key': 'volo',
          'x-disco-client-id': 'web'
        }
      });
      return { status: res.status, text: await res.text().catch(() => 'failed to read text') };
    } catch (e) {
      return { error: e.message };
    }
  }, apiUrl);

  console.log('API Result:', result);
  
  await browser.close();
}

test().catch(console.error);
