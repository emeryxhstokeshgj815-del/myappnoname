// Dev helper: screenshots of every screen for design review.
import { chromium } from 'playwright';
const [file, outDir, w = '390', hgt = '844'] = process.argv.slice(2);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: +w, height: +hgt }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('file://' + file);
await page.waitForSelector('.brand');
const shot = async (name) => page.screenshot({ path: `${outDir}/${name}.png`, fullPage: true });
await shot('01-learn-empty');
// play a daily session answering correctly using the app internals
await page.click('text=Start Daily Mix');
await page.waitForSelector('.sess-main');
await shot('02-intro-card');
await page.click('button:has-text("Got it")');
await shot('03-intro-check');
const answer = async () => page.evaluate(() => {
  const app = window.__crux; const s = app.state.session; const t = s.tasks[s.pos]; return t;
});
for (let i = 0; i < 10; i++) {
  const t = await answer();
  if (!t) break;
  if (t.mech === 'intro') {
    const got = await page.$('button:has-text("Got it")'); if (got) await got.click();
    await page.click(`.opt[data-i="${t.answerIndex}"]`);
  } else if (t.options && t.answerIndex !== undefined) {
    await page.click(`.opt[data-i="${t.answerIndex}"]`);
  } else if (t.mech === 'fixit') {
    await page.click(`.tok[data-i="${t.wrongIndex}"]`); await page.fill('.answer-input', t.answer); await page.keyboard.press('Enter');
  } else if (t.mech === 'match') {
    for (const id of t.left) { await page.click(`.match .col:first-child .opt[data-id="${id}"]`); await page.click(`.match .col:last-child .opt[data-id="${id}"]`); }
  } else {
    await shot(`04-task-${i}-${t.mech}`);
    await page.fill('.answer-input', i % 3 === 0 ? 'wrongword' : t.accepted[0]); await page.keyboard.press('Enter');
  }
  await page.waitForTimeout(100);
  await shot(`05-feedback-${i}-${t.mech}`);
  const cont = await page.$('button:has-text("Continue")'); if (!cont) break; await cont.click(); await page.waitForTimeout(80);
  if (page.url().includes('summary')) break;
}
await page.waitForTimeout(200);
await shot('06-summary');
await page.goto('file://' + file + '#/learn'); await page.waitForTimeout(150); await shot('07-learn');
await page.goto('file://' + file + '#/play'); await page.waitForTimeout(150); await shot('08-play');
await page.click('text=Free Practice'); await page.waitForTimeout(100); await shot('09-play-free');
await page.goto('file://' + file + '#/library'); await page.waitForTimeout(150); await shot('10-library');
await page.fill('input[type=search]', 'zzzz'); await page.waitForTimeout(100); await shot('11-library-empty');
const firstId = await page.evaluate(() => window.__crux.lex.words[0].id);
await page.goto('file://' + file + '#/word/' + firstId); await page.waitForTimeout(150); await shot('12-word');
await page.goto('file://' + file + '#/progress'); await page.waitForTimeout(150); await shot('13-progress');
await page.goto('file://' + file + '#/settings'); await page.waitForTimeout(150); await shot('14-settings');
await page.goto('file://' + file + '#/info/learning'); await page.waitForTimeout(150); await shot('15-info');
console.log('errors:', errors);
await browser.close();
