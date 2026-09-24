import { chromium } from 'playwright';
const file = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('request', (r) => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) errors.push('request: ' + r.url()); });
await page.goto('file://' + file);
await page.waitForSelector('.brand');
console.log('home ok:', await page.textContent('.today'));
await page.click('text=Start Daily Mix');
await page.waitForSelector('.sess-main');
for (let i = 0; i < 12; i++) {
  const kicker = await page.textContent('.kicker').catch(() => null);
  if (!kicker) break;
  // intro
  const got = await page.$('button:has-text("Got it")');
  if (got) await got.click();
  const opt = await page.$('.opt:not([disabled])');
  const input = await page.$('.answer-input:not([disabled])');
  const tok = await page.$('.tok:not([disabled])');
  if (input && await input.isVisible()) { await input.fill('test'); await page.keyboard.press('Enter'); }
  else if (tok) { await tok.click(); }
  else if (opt) { await opt.click(); }
  await page.waitForTimeout(150);
  const fb = await page.$('.fb .head');
  console.log(i, kicker, '->', fb ? (await fb.textContent()).trim() : 'no feedback');
  const cont = await page.$('button:has-text("Continue")');
  if (cont) await cont.click(); else break;
  await page.waitForTimeout(120);
  if (page.url().includes('summary')) break;
}
console.log('url', page.url());
console.log('errors', errors);
await page.screenshot({ path: 'smoke.png' });
await browser.close();
