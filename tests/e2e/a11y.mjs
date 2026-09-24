// Accessibility scan (axe-core) of the main screens and a few exercise types.
// usage: node tests/e2e/a11y.mjs [index.html] [--json out.json]
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const FILE = resolve(args.find((a) => a.endsWith('.html')) || join(ROOT, 'index.html'));
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const AXE = readFileSync(join(ROOT, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');
const URL = 'file://' + FILE;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(URL);
await page.waitForSelector('.brand');
const report = [];
async function scan(label) {
  await page.waitForTimeout(300);
  await page.addScriptTag({ content: AXE });
  const res = await page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: v.nodes[0]?.target?.join(' ') }));
  });
  report.push({ screen: label, violations: res });
  console.log(label.padEnd(24), res.length ? res.map((v) => `${v.id}(${v.impact},${v.nodes})`).join(', ') : 'no violations');
}
await scan('learn');
await page.click('button:has-text("Start Daily Mix")');
await page.waitForSelector('.intro-card');
await scan('session: new word');
await page.click('button:has-text("Got it")');
await scan('session: quick check');
const t = await page.evaluate(() => { const s = window.__crux.state.session; return s.tasks[s.pos]; });
await page.click(`.opt[data-i="${(t.answerIndex + 1) % 4}"]`);
await page.waitForSelector('.fb');
await scan('session: feedback');
for (const h of ['#/play', '#/library', '#/progress', '#/settings', '#/info/learning', '#/info/sources']) {
  await page.goto(URL + h);
  await scan(h.slice(2));
}
await page.goto(URL + '#/word/' + (await page.evaluate(() => window.__crux.lex.words[0].id)));
await scan('word');
await browser.close();
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(report, null, 1));
const total = report.reduce((a, r) => a + r.violations.length, 0);
console.log(total ? `${total} violation types found` : 'axe: no WCAG A/AA violations found');
process.exit(0);
