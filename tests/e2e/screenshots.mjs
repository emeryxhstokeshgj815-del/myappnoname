// Screenshots for docs/screenshots (mobile 390x844 and desktop 1280x800).
// usage: node tests/e2e/screenshots.mjs [index.html] [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FILE = resolve(process.argv[2] || join(ROOT, 'index.html'));
const OUT = resolve(process.argv[3] || join(ROOT, 'docs', 'screenshots'));
mkdirSync(OUT, { recursive: true });
const URL = 'file://' + FILE;
const browser = await chromium.launch();

async function seed(page) {
  // play one Daily Mix through the UI so that progress screens have real data
  await page.click('button:has-text("Start Daily Mix")');
  await page.waitForSelector('.sess-main');
  for (let i = 0; i < 30; i++) {
    if (page.url().includes('#/summary')) break;
    const t = await page.evaluate(() => {
      const s = window.__crux.state.session;
      return s.tasks[s.pos];
    });
    if (t.mech === 'intro') await page.click('button:has-text("Got it")');
    if (t.mech === 'match') {
      for (const id of t.left) {
        await page.click(`.match .col:first-child .opt[data-id="${id}"]`);
        await page.click(`.match .col:last-child .opt[data-id="${id}"]`);
      }
    } else if (t.mech === 'collocation' && t.variant === 'build') {
      const used = new Set();
      for (const w of t.answer.split(' ')) {
        const i = t.tiles.findIndex((x, k) => x === w && !used.has(k));
        used.add(i);
        await page.click(`.build-bank .tile[data-i="${i}"]`);
      }
      await page.click('button:has-text("Check")');
    } else if (t.mech === 'fixit') {
      await page.click(`.tok[data-i="${t.wrongIndex}"]`);
      await page.fill('.answer-input', t.answer);
      await page.keyboard.press('Enter');
    } else if (t.options && t.answerIndex !== undefined) {
      await page.click(`.opt[data-i="${i === 3 ? (t.answerIndex + 1) % t.options.length : t.answerIndex}"]`);
    } else {
      await page.fill('.answer-input', t.accepted[0]);
      await page.keyboard.press('Enter');
    }
    await page.waitForSelector('.fb');
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(60);
  }
}

async function showTask(page, mech, variant, pick) {
  await page.evaluate(({ mech, variant, pick }) => {
    const app = window.__crux;
    const cands = app.lex.words.filter((w) => (mech === 'wordform' ? w.wordFormation : mech === 'reply' ? w.reply : mech === 'rewrite' ? w.rewrite : true));
    const word = cands[pick % cands.length];
    const s = { id: 'shot-' + mech, seed: 1, mode: 'daily', length: 10, day: app.today(), startedAt: Date.now(), endsAt: null, config: {}, voice: false, tasks: [], counter: 1, pos: 0, results: {}, requeued: [], usage: {}, xp: 0, graded: 0, correct: 0, hints: 0, mistakes: [], finished: false };
    const t = app.debug.buildTask(mech, word.id, variant);
    t.id = s.id + ':0';
    s.tasks.push(t);
    for (let i = 1; i < 10; i++) s.tasks.push({ ...t, id: s.id + ':' + i });
    s.pos = 3;
    s.tasks[3] = { ...t, id: s.id + ':3' };
    app.state.session = s;
    app.navigate('session');
  }, { mech, variant, pick });
  await page.waitForSelector('.sess-main .task');
  await page.waitForTimeout(250);
}

async function run(name, viewport, list) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, timezoneId: 'Europe/Moscow' });
  const page = await ctx.newPage();
  await page.goto(URL);
  await page.waitForSelector('.brand');
  await page.waitForTimeout(250);
  const shot = async (n, full = false) => page.screenshot({ path: join(OUT, `${name}-${n}.png`), fullPage: full });
  await shot('01-learn-first-run');
  await seed(page);
  await page.waitForTimeout(400);
  await shot('02-summary');
  for (const [n, fn] of list) {
    await fn(page);
    await page.waitForTimeout(250);
    await shot(n);
  }
  await ctx.close();
}

const mobile = [
  ['03-learn', async (p) => { await p.goto(URL + '#/learn'); await p.waitForTimeout(300); }],
  ['04-new-word', async (p) => { await p.evaluate(() => { window.__crux.state.session = null; }); await p.goto(URL + '#/word/' + (await p.evaluate(() => window.__crux.lex.words.find((w) => !window.__crux.state.words[w.id]).id))); await p.click('text=Learn this word now'); await p.waitForSelector('.intro-card'); }],
  ['05-context-gap', async (p) => showTask(p, 'gap', 'choice', 3)],
  ['06-context-gap-answered', async (p) => { const t = await p.evaluate(() => { const s = window.__crux.state.session; return s.tasks[s.pos]; }); await p.click(`.opt[data-i="${(t.answerIndex + 1) % 4}"]`); await p.waitForSelector('.fb'); }],
  ['07-recall-hint', async (p) => { await showTask(p, 'recall', undefined, 5); await p.click('button:has-text("Hint")'); }],
  ['08-nuance-duel', async (p) => showTask(p, 'nuance', 'standard', 7)],
  ['09-fix-it', async (p) => showTask(p, 'fixit', undefined, 9)],
  ['10-trio', async (p) => showTask(p, 'trio', undefined, 11)],
  ['11-collocation', async (p) => showTask(p, 'collocation', 'complete', 13)],
  ['11b-collocation-build', async (p) => showTask(p, 'collocation', 'build', 8)],
  ['12-reply', async (p) => showTask(p, 'reply', undefined, 2)],
  ['13-rewrite', async (p) => showTask(p, 'rewrite', undefined, 4)],
  ['14-word-formation', async (p) => showTask(p, 'wordform', undefined, 6)],
  ['15-match', async (p) => showTask(p, 'match', undefined, 1)],
  ['16-play', async (p) => { await p.evaluate(() => { window.__crux.state.session = null; }); await p.goto(URL + '#/play'); }],
  ['17-library', async (p) => { await p.goto(URL + '#/library'); }],
  ['18-word', async (p) => { await p.goto(URL + '#/word/' + (await p.evaluate(() => Object.keys(window.__crux.state.words)[0]))); }],
  ['19-progress', async (p) => { await p.goto(URL + '#/progress'); }],
  ['20-settings', async (p) => { await p.goto(URL + '#/settings'); }],
];
await run('mobile', { width: 390, height: 844 }, mobile);
await run('desktop', { width: 1280, height: 800 }, [
  ['03-learn', async (p) => { await p.evaluate(() => { window.__crux.state.session = null; }); await p.goto(URL + '#/learn'); }],
  ['05-context-gap', async (p) => showTask(p, 'gap', 'choice', 3)],
  ['08-nuance-duel', async (p) => showTask(p, 'nuance', 'standard', 7)],
  ['19-progress', async (p) => { await p.evaluate(() => { window.__crux.state.session = null; }); await p.goto(URL + '#/progress'); }],
]);
await run('narrow320', { width: 320, height: 640 }, [
  ['05-context-gap', async (p) => showTask(p, 'gap', 'choice', 3)],
  ['09-fix-it', async (p) => showTask(p, 'fixit', undefined, 9)],
]);
await browser.close();
console.log('screenshots written to ' + OUT);
