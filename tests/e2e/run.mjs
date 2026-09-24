// Browser scenarios for Crux (Playwright + Chromium, headless).
// usage: node tests/e2e/run.mjs [path/to/index.html] [--json report.json]
import { chromium } from 'playwright';
import { writeFileSync, readFileSync, mkdtempSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const FILE = resolve(args.find((a) => a.endsWith('.html')) || join(ROOT, 'index.html'));
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const URL = 'file://' + FILE;
const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;

const browser = await chromium.launch();
const results = [];

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const DEBUG_DIR = process.env.E2E_DEBUG_DIR || null;
let lastPage = null;
async function test(name, fn) {
  if (only && !only.test(name)) return;
  const t0 = Date.now();
  lastPage = null;
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - t0 });
    console.log('  ok   ' + name);
  } catch (e) {
    if (DEBUG_DIR && lastPage) {
      try {
        const slug = name.replace(/[^a-z0-9]+/gi, '-').slice(0, 40);
        await lastPage.screenshot({ path: `${DEBUG_DIR}/${slug}.png`, fullPage: true });
        writeFileSync(`${DEBUG_DIR}/${slug}.txt`, (await lastPage.evaluate(() => location.hash + '\n' + document.body.innerText)).slice(0, 4000));
      } catch {
        /* page may be closed */
      }
    }
    results.push({ name, ok: false, ms: Date.now() - t0, error: String(e && e.message || e).slice(0, 500) });
    console.log('  FAIL ' + name + '\n       ' + String(e && e.message || e).split('\n')[0]);
  }
}

const INIT = () => {
  window.__soundStarts = 0;
  const AC = window.AudioContext;
  if (AC) {
    const orig = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...a) {
      window.__soundStarts += 1;
      return orig.apply(this, a);
    };
  }
};

const FAKE_VOICE = () => {
  const voice = { name: 'Test English', lang: 'en-GB', localService: true, voiceURI: 'test-en', default: true };
  window.__spoken = [];
  const fake = {
    getVoices: () => [voice],
    speak: (u) => {
      window.__spoken.push(u.text);
      setTimeout(() => u.onend && u.onend(), 10);
    },
    cancel: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true });
  window.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text;
    }
  };
};

async function open(opts = {}) {
  const context = await browser.newContext({
    viewport: opts.viewport || { width: 390, height: 844 },
    timezoneId: opts.timezoneId || 'Europe/Moscow',
    reducedMotion: opts.reducedMotion || 'no-preference',
    hasTouch: !!opts.touch,
  });
  if (opts.offline) await context.setOffline(true);
  const page = await context.newPage();
  lastPage = page;
  const problems = [];
  const external = [];
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push('console: ' + m.text());
  });
  page.on('request', (r) => {
    const u = r.url();
    if (!/^(file|data|blob|about):/.test(u)) external.push(u);
  });
  await page.addInitScript(INIT);
  if (opts.voice) await page.addInitScript(FAKE_VOICE);
  if (opts.clock) await page.clock.install({ time: opts.clock });
  await page.goto(URL + (opts.hash || ''));
  await page.waitForSelector(opts.waitFor || '#app > *');
  return { context, page, problems, external };
}

const state = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__crux.state)));
const current = (page) => page.evaluate(() => {
  const s = window.__crux.state.session;
  return s ? s.tasks[s.pos] || null : null;
});

// Answer the task on screen through the UI. mode: 'correct' | 'wrong' | 'hint'
async function answer(page, mode = 'correct') {
  const t = await current(page);
  assert(t, 'no current task');
  if (t.mech === 'intro') {
    const got = await page.$('button:has-text("Got it")');
    if (got) await got.click();
  }
  if (t.mech === 'match') {
    if (mode === 'wrong') {
      await page.click(`.match .col:first-child .opt[data-id="${t.left[0]}"]`);
      await page.click(`.match .col:last-child .opt[data-id="${t.right.find((x) => x !== t.left[0])}"]`);
      await page.waitForTimeout(500);
    }
    for (const id of t.left) {
      await page.click(`.match .col:first-child .opt[data-id="${id}"]`);
      await page.click(`.match .col:last-child .opt[data-id="${id}"]`);
    }
  } else if (t.mech === 'fixit') {
    if (mode === 'wrong') await page.click(`.tok[data-i="${(t.wrongIndex + 1) % t.tokens.length}"]`);
    else {
      await page.click(`.tok[data-i="${t.wrongIndex}"]`);
      if (mode === 'hint') await page.click('button:has-text("Hint")');
      await page.fill('.answer-input', t.answer);
      await page.click('button:has-text("Check")');
    }
  } else if (t.options && t.answerIndex !== undefined) {
    const i = mode === 'wrong' ? (t.answerIndex + 1) % t.options.length : t.answerIndex;
    await page.click(`.opt[data-i="${i}"]`);
  } else {
    if (mode === 'hint') await page.click('button:has-text("Hint")');
    await page.fill('.answer-input', mode === 'wrong' ? 'qqqqzz' : t.accepted[0]);
    await page.keyboard.press('Enter');
  }
  await page.waitForSelector('.fb');
  return t;
}

async function next(page) {
  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(60);
}

async function playSession(page, mode = 'correct', max = 40) {
  for (let i = 0; i < max; i++) {
    if (page.url().includes('#/summary')) return i;
    await answer(page, typeof mode === 'function' ? mode(i) : mode);
    await next(page);
  }
  return max;
}

async function startDaily(page) {
  await page.click('button:has-text("Start Daily Mix"), button:has-text("Practise more")');
  await page.waitForSelector('.sess-main');
}

// ---------------------------------------------------------------------------------

console.log('Crux browser scenarios on ' + FILE);

await test('first launch: home renders, no errors, no network requests', async () => {
  const { page, problems, external, context } = await open();
  const txt = await page.textContent('main');
  assert(/Crux/.test(txt) && /to review/.test(txt), 'home content missing');
  assert(await page.isVisible('button:has-text("Start Daily Mix")'), 'no start button');
  assert(!(await page.$('.banner')), 'unexpected storage warning');
  assert(problems.length === 0, problems.join('; '));
  assert(external.length === 0, 'external requests: ' + external.join(', '));
  await context.close();
});

await test('daily mix: new word card, correct answer, wrong answer with Russian explanation and example', async () => {
  const { page, problems, context } = await open();
  await startDaily(page);
  assert(await page.isVisible('.intro-card'), 'no intro card');
  await answer(page, 'correct');
  assert(/Correct/.test(await page.textContent('.fb .head')), 'no correct feedback');
  assert(await page.isVisible('.opt.is-correct'), 'correct option not marked');
  await next(page);
  const t = await answer(page, 'wrong');
  const fb = await page.textContent('.fb');
  assert(/Not quite|That word is fine|Here is the answer|All matched/.test(fb), 'no incorrect feedback: ' + fb);
  assert(/[А-Яа-яЁё]/.test(fb), 'no Russian explanation');
  if (!['nuance', 'collocation', 'reply', 'match', 'rewrite', 'wordform'].includes(t.mech)) assert(await page.$('.fb .ex'), 'no example after a mistake (' + t.mech + ')');
  assert(await page.isVisible('.fb.bad .head .icon, .fb.mid .head .icon'), 'no icon: state must not rely on colour only');
  assert(problems.length === 0, problems.join('; '));
  await context.close();
});

await test('hints: first letter, then half; hinted answer is not counted as recall', async () => {
  const { page, context } = await open();
  await startDaily(page);
  // find a typed task
  for (let i = 0; i < 12; i++) {
    const t = await current(page);
    if (t && ['recall', 'trio', 'gap', 'listen', 'wordform', 'rewrite'].includes(t.mech) && (t.mech !== 'gap' || t.variant === 'typed')) {
      await page.click('button:has-text("Hint")');
      const h1 = await page.textContent('.hintline');
      assert(h1 && h1.trim().length > 0, 'hint not shown');
      await page.fill('.answer-input', t.accepted[0]);
      await page.keyboard.press('Enter');
      await page.waitForSelector('.fb');
      assert(/with a hint/.test(await page.textContent('.fb .head')), 'hinted answer not marked');
      const st = await state(page);
      assert(st.words[t.wordId].rclDays.length === 0, 'hinted answer counted as recall');
      await context.close();
      return;
    }
    await answer(page, 'correct');
    await next(page);
  }
  throw new Error('no typed task found');
});

await test('mistake: the word comes back later in the session with a different exercise', async () => {
  const { page, context } = await open();
  await startDaily(page);
  await playSession(page, 'correct');
  // make everything due and start again
  await page.evaluate(() => {
    const app = window.__crux;
    for (const r of Object.values(app.state.words)) r.due = app.today();
    app.state.session = null;
    app.save(true);
    app.navigate('learn');
  });
  await startDaily(page);
  let t = await current(page);
  while (t.mech === 'match' || t.mech === 'intro') {
    await answer(page, 'correct');
    await next(page);
    t = await current(page);
  }
  await answer(page, 'wrong');
  const s = (await state(page)).session;
  const later = s.tasks.slice(s.pos + 1).filter((x) => x.wordId === t.wordId);
  assert(later.length === 1, 'expected one follow-up, got ' + later.length);
  assert(later[0].mech !== t.mech, 'follow-up uses the same exercise');
  await context.close();
});

await test('all exercise types render and can be answered', async () => {
  const { page, problems, context } = await open({ voice: true });
  await startDaily(page);
  await playSession(page, 'correct');
  const mechs = ['quickpick', 'recall', 'gap', 'collocation', 'wordform', 'nuance', 'fixit', 'trio', 'reply', 'match', 'rewrite', 'listen'];
  const done = [];
  for (const m of mechs) {
    const variants = m === 'gap' ? ['choice', 'typed'] : m === 'collocation' ? ['complete', 'odd'] : m === 'quickpick' ? ['en-ru', 'ru-en'] : [undefined];
    for (const v of variants) {
      const ok = await page.evaluate(({ m, v }) => {
        const app = window.__crux;
        const known = Object.keys(app.state.words);
        const word = app.lex.words.find((w) => {
          if (m === 'wordform') return w.wordFormation;
          if (m === 'reply') return w.reply;
          if (m === 'rewrite') return w.rewrite;
          return true;
        });
        if (!word) return false;
        const s = { id: 'dbg' + m + (v || ''), seed: 1, mode: 'free', length: 1, day: app.today(), startedAt: Date.now(), endsAt: null, config: {}, voice: true, tasks: [], counter: 1, pos: 0, results: {}, requeued: [], usage: {}, xp: 0, graded: 0, correct: 0, hints: 0, mistakes: [], finished: false };
        const t = app.debug.buildTask(m, word.id, v);
        t.id = s.id + ':0';
        if (m === 'match' && known.length < 4) return false;
        s.tasks.push(t);
        app.state.session = s;
        app.navigate('session');
        return true;
      }, { m, v });
      if (!ok) continue;
      await page.waitForSelector('.sess-main .task');
      if (m === 'listen') {
        await page.waitForTimeout(400);
        const spoken = await page.evaluate(() => window.__spoken.length);
        assert(spoken > 0, 'listen: nothing spoken');
      }
      await answer(page, 'correct');
      const head = await page.textContent('.fb .head');
      assert(/Correct|All matched/.test(head), `${m}/${v}: ${head}`);
      done.push(m + (v ? '/' + v : ''));
      await next(page);
      await page.waitForURL(/#\/summary/);
      await page.evaluate(() => {
        window.__crux.state.session = null;
      });
    }
  }
  assert(done.length >= 15, 'only ' + done.join(','));
  assert(problems.length === 0, problems.join('; '));
  await context.close();
});

await test('session end, summary with one clear next action, and a new session starts', async () => {
  const { page, context } = await open();
  await startDaily(page);
  await playSession(page, (i) => (i === 2 ? 'wrong' : 'correct'));
  await page.waitForSelector('text=Words to revisit');
  const btns = await page.$$('main .btn.big');
  assert(btns.length === 1, 'expected one primary button');
  const label = await btns[0].textContent();
  assert(/Fix mistakes|Continue|Learn new words/.test(label), 'unexpected next action: ' + label);
  await btns[0].click();
  await page.waitForSelector('.sess-main');
  const s = (await state(page)).session;
  assert(s && !s.finished && s.pos === 0, 'new session not started');
  await context.close();
});

await test('progress survives reload; an unfinished session can be resumed', async () => {
  const { page, context } = await open();
  await startDaily(page);
  await answer(page, 'correct');
  await next(page);
  await answer(page, 'correct');
  const before = await state(page);
  await page.reload();
  await page.waitForSelector('#app > *');
  const after = await state(page);
  assert(after.stats.xp === before.stats.xp && after.stats.xp > 0, 'xp not persisted');
  assert(Object.keys(after.words).length === Object.keys(before.words).length, 'words not persisted');
  // the answered task is shown as answered; answering again is impossible
  await page.waitForSelector('.fb');
  await page.goto(URL + '#/learn');
  await page.waitForSelector('text=Resume session');
  await page.click('text=Resume session');
  await page.waitForSelector('.sess-main');
  await context.close();
});

await test('no duplicate XP: double taps and reload after answering', async () => {
  const { page, context } = await open();
  await startDaily(page);
  await page.click('button:has-text("Got it")');
  const t = await current(page);
  await page.evaluate((i) => {
    const b = document.querySelector(`.opt[data-i="${i}"]`);
    b.click();
    b.click();
    b.click();
  }, t.answerIndex);
  await page.waitForSelector('.fb');
  const xp1 = (await state(page)).stats.xp;
  const graded1 = (await state(page)).stats.graded;
  await page.reload();
  await page.waitForSelector('.fb');
  // pressing keys on a graded task does nothing
  await page.keyboard.press('1');
  await page.keyboard.press('2');
  const st = await state(page);
  assert(st.stats.xp === xp1, `xp changed ${xp1} -> ${st.stats.xp}`);
  assert(st.stats.graded === graded1 && graded1 === 1, 'graded count wrong: ' + graded1);
  await context.close();
});

await test('achievement unlocks with a short non-blocking toast', async () => {
  const { page, context } = await open();
  await startDaily(page);
  await playSession(page, 'correct');
  await page.waitForSelector('.toast:has-text("First Steps")', { timeout: 5000 });
  const pe = await page.evaluate(() => getComputedStyle(document.querySelector('.toasts')).pointerEvents);
  assert(pe === 'none', 'toast blocks input');
  const st = await state(page);
  assert(st.achievements['first-session'], 'achievement not stored');
  const starts = await page.evaluate(() => window.__soundStarts);
  assert(starts > 0, 'no sounds played');
  await page.goto(URL + '#/progress');
  await page.waitForSelector('.badge');
  assert((await page.$$('.badge:not(.locked)')).length >= 1, 'badge not shown');
  assert((await page.$$('.badge.locked .xpbar')).length >= 10, 'locked badges without progress');
  await context.close();
});

await test('study day follows the local date across midnight', async () => {
  const { page, context } = await open({ clock: new Date('2026-05-10T23:57:00+03:00'), timezoneId: 'Europe/Moscow' });
  await page.clock.resume();
  await startDaily(page);
  await answer(page, 'correct');
  await next(page);
  await page.clock.setSystemTime(new Date('2026-05-11T00:03:00+03:00'));
  await answer(page, 'correct');
  const st = await state(page);
  assert(st.days['2026-05-10'] && st.days['2026-05-10'].graded === 1, 'day 1 missing: ' + JSON.stringify(st.days));
  assert(st.days['2026-05-11'] && st.days['2026-05-11'].graded === 1, 'day 2 missing: ' + JSON.stringify(st.days));
  await context.close();
});

await test('streak needs real study, not app opening', async () => {
  const { page, context } = await open({ clock: new Date('2026-06-01T10:00:00+03:00') });
  await page.clock.resume();
  await startDaily(page);
  await playSession(page, 'correct');
  await page.evaluate(() => window.__crux.navigate('learn'));
  await page.waitForSelector('text=1-day streak');
  await page.clock.setSystemTime(new Date('2026-06-02T10:00:00+03:00'));
  await page.reload();
  await page.waitForSelector('.brand');
  assert(/1-day streak/.test(await page.textContent('main')), 'streak should still show yesterday');
  await page.clock.setSystemTime(new Date('2026-06-04T10:00:00+03:00'));
  await page.reload();
  await page.waitForSelector('.brand');
  assert(/No streak yet/.test(await page.textContent('main')), 'opening the app must not keep a streak');
  const txt = await page.textContent('main');
  assert(!/lost|shame|fail/i.test(txt), 'guilt message');
  await context.close();
});

await test('library: search English and Russian, filters, empty result', async () => {
  const { page, context } = await open({ hash: '#/library' });
  const total = await page.evaluate(() => window.__crux.lex.words.length);
  assert((await page.textContent('main')).includes(`${total} words`), 'count');
  const w = await page.evaluate(() => window.__crux.lex.words[5]);
  await page.fill('input[type=search]', w.lemma);
  await page.waitForTimeout(50);
  assert((await page.textContent('.wordlist')).includes(w.lemma), 'english search');
  await page.fill('input[type=search]', w.translationsRu[0]);
  await page.waitForTimeout(50);
  assert((await page.textContent('.wordlist')).includes(w.lemma), 'russian search');
  await page.fill('input[type=search]', '');
  await page.selectOption('select >> nth=0', w.topic);
  await page.waitForTimeout(50);
  const rows = await page.$$eval('.wordrow', (els) => els.length);
  assert(rows > 0 && rows < total, 'topic filter');
  await page.selectOption('select >> nth=1', 'established');
  await page.waitForTimeout(50);
  assert(await page.isVisible('text=No words match'), 'empty state');
  await page.click('text=Clear search and filters');
  await page.waitForTimeout(80);
  assert((await page.textContent('main')).includes(`${total} words`), 'clear filters');
  await page.click('.wordrow >> nth=0');
  await page.waitForSelector('text=Why this word');
  assert(await page.isVisible('text=CEFR level evidence'), 'evidence');
  await context.close();
});

await test('favorites and Anki/Quizlet export', async () => {
  const { page, context } = await open({ hash: '#/library' });
  await page.click('.wordrow >> nth=0');
  await page.click('button[aria-label="Add to favorites"]');
  const st = await state(page);
  assert(Object.keys(st.favorites).length === 1, 'favorite not saved');
  await page.goto(URL + '#/settings');
  await page.waitForSelector('text=Anki TSV');
  await page.click('button[role=radio]:has-text("Favorites")');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Anki TSV")')]);
  const path = await dl.path();
  const text = readFileSync(path, 'utf8');
  assert(text.trim().split('\n').length === 1 && text.split('\t').length === 4, 'anki tsv: ' + text.slice(0, 80));
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Quizlet TSV")')]);
  const t2 = readFileSync(await dl2.path(), 'utf8');
  assert(t2.trim().split('\t').length === 2, 'quizlet tsv');
  await context.close();
});

await test('export JSON, corrupted import is rejected without losing progress, valid import restores', async () => {
  const { page, context } = await open();
  await startDaily(page);
  await playSession(page, 'correct');
  await page.goto(URL + '#/settings');
  await page.waitForSelector('text=Export progress');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Export progress")')]);
  const good = readFileSync(await dl.path(), 'utf8');
  const before = await state(page);
  const dir = mkdtempSync(join(tmpdir(), 'crux-'));
  const badPath = join(dir, 'broken.json');
  writeFileSync(badPath, good.slice(0, good.length / 2));
  await page.setInputFiles('#import-file', badPath);
  await page.waitForSelector('text=Import failed');
  const mid = await state(page);
  assert(mid.stats.xp === before.stats.xp && Object.keys(mid.words).length === Object.keys(before.words).length, 'progress changed after bad import');
  const foreign = join(dir, 'foreign.json');
  writeFileSync(foreign, JSON.stringify({ app: 'Other', words: [] }));
  await page.setInputFiles('#import-file', foreign);
  await page.waitForTimeout(200);
  assert(/Import failed/.test(await page.textContent('main')), 'foreign file accepted');
  // reset, then restore from the good file
  await page.click('button:has-text("Reset progress")');
  await page.click('button:has-text("Delete progress")');
  assert((await state(page)).stats.xp === 0, 'reset failed');
  const goodPath = join(dir, 'good.json');
  writeFileSync(goodPath, good);
  await page.setInputFiles('#import-file', goodPath);
  await page.waitForTimeout(300);
  const after = await state(page);
  assert(after.stats.xp === before.stats.xp, 'import did not restore xp');
  await context.close();
});

await test('reset asks for confirmation inline (no modal)', async () => {
  const { page, context } = await open({ hash: '#/settings' });
  await page.click('button:has-text("Reset progress")');
  assert(await page.isVisible('text=Delete all progress?'), 'no confirmation');
  assert(!(await page.$('dialog[open], [role=dialog]')), 'modal used');
  await page.click('button:has-text("Cancel")');
  assert(!(await page.isVisible('text=Delete all progress?')), 'cancel failed');
  await context.close();
});

await test('sound: switch off stops effects; settings persist', async () => {
  const { page, context } = await open();
  await startDaily(page);
  await answer(page, 'correct');
  await page.waitForTimeout(100);
  const n1 = await page.evaluate(() => window.__soundStarts);
  assert(n1 > 0, 'no sound when on');
  await page.click('button[aria-label="Sound effects"]');
  await next(page);
  const n2 = await page.evaluate(() => window.__soundStarts);
  await answer(page, 'correct');
  await page.waitForTimeout(100);
  const n3 = await page.evaluate(() => window.__soundStarts);
  assert(n3 === n2, 'sound played while off');
  await page.reload();
  await page.waitForSelector('#app > *');
  assert((await state(page)).settings.sound === false, 'sound setting not saved');
  await context.close();
});

await test('works offline (network disabled)', async () => {
  const { page, problems, external, context } = await open({ offline: true });
  await startDaily(page);
  await playSession(page, 'correct');
  await page.waitForSelector('.sum-stats');
  assert(problems.length === 0 && external.length === 0, problems.concat(external).join('; '));
  await context.close();
});

await test('sprint: 60-second timer ends the round; old timers never touch the next session', async () => {
  const { page, context } = await open({ clock: new Date('2026-07-01T12:00:00+03:00') });
  await page.clock.resume();
  await startDaily(page);
  await playSession(page, 'correct');
  await page.evaluate(() => {
    window.__crux.state.session = null;
    window.__crux.navigate('play');
  });
  await page.click('text=Sprint · 60 seconds');
  await page.waitForSelector('.timer');
  await answer(page, 'correct');
  await page.waitForTimeout(800);
  // leave early, then start a Daily Mix: nothing from the sprint may advance it
  await page.click('button[aria-label="End sprint"]');
  await page.waitForURL(/#\/summary/);
  await page.click('main .btn.big');
  await page.goto(URL + '#/learn');
  await startDaily(page);
  const t0 = await current(page);
  await page.clock.runFor(65000);
  const t1 = await current(page);
  assert(t0.id === t1.id, 'task changed by a stale timer');
  // a full sprint ends by itself
  await page.evaluate(() => {
    window.__crux.state.session = null;
    window.__crux.navigate('play');
  });
  await page.click('text=Sprint · 60 seconds');
  await page.waitForSelector('.timer');
  await page.clock.runFor(61000);
  await page.waitForURL(/#\/summary/, { timeout: 5000 });
  assert(/Time!/.test(await page.textContent('h1')), 'sprint summary');
  await context.close();
});

await test('leaving the task page and coming back keeps the same task', async () => {
  const { page, context } = await open();
  await startDaily(page);
  await answer(page, 'correct');
  await next(page);
  const t = await current(page);
  await page.click('button[aria-label^="Leave session"]');
  await page.click('a[href="#/library"]');
  await page.waitForSelector('.wordlist');
  await page.click('a[href="#/learn"]');
  await page.click('text=Resume session');
  await page.waitForSelector('.sess-main');
  const t2 = await current(page);
  assert(t.id === t2.id, 'task changed');
  await answer(page, 'correct');
  await context.close();
});

await test('keyboard: digits choose, Enter checks and continues, focus is visible', async () => {
  const { page, context } = await open();
  await startDaily(page);
  await page.keyboard.press('Enter'); // primary action: "Got it"
  await page.waitForSelector('.opt');
  const t = await current(page);
  await page.waitForTimeout(80);
  await page.keyboard.press(String(t.answerIndex + 1));
  await page.waitForSelector('.fb');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  const t2 = await current(page);
  assert(t2.id !== t.id, 'Enter did not continue');
  const outline = await page.evaluate(() => {
    const b = document.querySelector('.btn');
    b.focus();
    return getComputedStyle(b).outlineStyle;
  });
  assert(outline !== 'none', 'no visible focus style');
  await context.close();
});

await test('listen & type is switched off without an offline English voice', async () => {
  const { page, context } = await open({ hash: '#/play' });
  const txt = await page.textContent('main');
  assert(/Listen & Type is off/.test(txt), 'no explanation');
  await context.close();
});

for (const width of [320, 390, 768, 1280]) {
  await test(`layout at ${width}px: no horizontal scroll, touch targets, readable text`, async () => {
    const { page, context } = await open({ viewport: { width, height: 800 } });
    await startDaily(page);
    await playSession(page, 'correct');
    for (const hash of ['#/learn', '#/play', '#/library', '#/progress', '#/settings', '#/info/learning', '#/info/sources']) {
      await page.goto(URL + hash);
      await page.waitForTimeout(80);
      const m = await page.evaluate(() => {
        const over = document.documentElement.scrollWidth - document.documentElement.clientWidth;
        const small = [...document.querySelectorAll('button, a.btn, a.link-row, .tab, select, input:not([type=file])')]
          .filter((el) => el.offsetParent !== null && !el.closest('.chips.static'))
          .map((el) => ({ width: el.offsetWidth, height: el.offsetHeight })) // layout size, ignores entry animations
          .filter((r) => r.height < 44 || r.width < 44).length;
        const fs = parseFloat(getComputedStyle(document.body).fontSize);
        return { over, small, fs };
      });
      assert(m.over <= 0, `${hash}: horizontal overflow ${m.over}px`);
      assert(m.small === 0, `${hash}: ${m.small} controls smaller than 44px`);
      assert(m.fs >= 16, `${hash}: body font ${m.fs}px`);
    }
    await context.close();
  });
}

await test('reduced motion is respected', async () => {
  const { page, context } = await open({ reducedMotion: 'reduce' });
  await startDaily(page);
  const d = await page.evaluate(() => getComputedStyle(document.querySelector('.pop-in')).animationDuration);
  assert(parseFloat(d) < 0.05, 'animation not reduced: ' + d);
  await context.close();
});

await test('storage unavailable: clear warning, learning still works', async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('blocked');
      },
    });
  });
  await page.goto(URL);
  await page.waitForSelector('.banner');
  assert(/not letting Crux save/.test(await page.textContent('.banner')), 'no warning');
  await startDaily(page);
  await answer(page, 'correct');
  await context.close();
});

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} scenarios passed`);
if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ file: FILE, when: new Date().toISOString(), browser: 'Chromium (Playwright ' + (await import('playwright/package.json', { with: { type: 'json' } })).default.version + ')', results }, null, 1));
process.exit(failed.length ? 1 : 0);
