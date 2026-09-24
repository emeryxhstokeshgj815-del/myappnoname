// App shell: state, persistence, routing, toasts and celebrations.

import { createLexicon } from '../core/lexicon.js';
import { loadState, saveState, storageAvailable, emptyState } from '../core/store.js';
import { dayKey } from '../core/dates.js';
import { wordState } from '../core/srs.js';
import { dueIds, mistakeIds } from '../core/session.js';
import { ACHIEVEMENTS } from '../core/achievements.js';
import { buildTask, MECHANICS } from '../core/tasks.js';
import { makeRng } from '../core/rng.js';
import { createAudio } from './audio.js';
import { createSpeech } from './speech.js';
import { h, clear, svg } from './dom.js';
import { ICONS, badgeSvg } from './icons.js';

import { renderLearn } from './screens/learn.js';
import { renderPlay } from './screens/play.js';
import { renderLibrary } from './screens/library.js';
import { renderWord } from './screens/word.js';
import { renderProgress } from './screens/progress.js';
import { renderSettings } from './screens/settings.js';
import { renderInfo } from './screens/info.js';
import { renderSession } from './screens/session.js';
import { renderSummary } from './screens/summary.js';

const TABS = [
  { id: 'learn', label: 'Learn', icon: 'learn' },
  { id: 'play', label: 'Play', icon: 'play' },
  { id: 'library', label: 'Library', icon: 'library' },
  { id: 'progress', label: 'Progress', icon: 'progress' },
];

function safeLocalStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function createApp(root, data, sounds) {
  const lex = createLexicon(data);
  const ids = new Set(lex.words.map((w) => w.id));
  const ls = safeLocalStorage();
  const loaded = loadState(ls, ids);

  const app = {
    lex,
    state: loaded.state,
    storage: { status: loaded.status, error: loaded.error || null, available: storageAvailable(ls), saveFailed: false },
    route: { name: 'learn', params: [] },
    ui: { lastDay: dayKey(), library: { q: '', topic: 'all', state: 'all', pos: 'all', limit: 60 }, free: null, cleanup: [] },
    today: () => dayKey(),
  };

  app.audio = createAudio(sounds, () => app.state.settings);
  app.speech = createSpeech(() => app.state.settings);

  // ---------- persistence ----------
  let saveTimer = null;
  app.save = (immediate = false) => {
    if (!app.storage.available) return false;
    clearTimeout(saveTimer);
    const run = () => {
      const ok = saveState(ls, app.state);
      if (!ok && !app.storage.saveFailed) {
        app.storage.saveFailed = true;
        app.toast({ title: 'Progress could not be saved', sub: 'Storage is full or blocked in this browser.', kind: 'warn' });
      } else if (ok) app.storage.saveFailed = false;
      return ok;
    };
    if (immediate) return run();
    saveTimer = setTimeout(run, 150);
    return true;
  };
  const flush = () => app.save(true);
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
    else checkDay();
  });

  app.replaceState = (next) => {
    app.state = next;
    app.save(true);
  };
  app.resetProgress = () => {
    const settings = app.state.settings;
    app.state = emptyState();
    app.state.settings = settings;
    app.save(true);
  };

  // ---------- derived helpers ----------
  app.wordState = (id) => wordState(app.state.words[id]);
  app.isFav = (id) => !!app.state.favorites[id];
  app.toggleFav = (id) => {
    if (app.state.favorites[id]) delete app.state.favorites[id];
    else app.state.favorites[id] = true;
    app.save();
  };
  app.dueCount = () => dueIds(app.state, app.today()).length;
  app.mistakeCount = () => mistakeIds(app.state).length;
  app.knownCount = () => Object.values(app.state.words).filter((r) => r.ok >= 1).length;
  app.newLeftToday = () => {
    const d = app.state.days[app.today()] || {};
    const unseen = lex.words.length - Object.keys(app.state.words).length;
    return Math.min(unseen, Math.max(0, (app.state.settings.newPerDay ?? 10) - (d.newWords || 0)));
  };

  // ---------- day change ----------
  function checkDay() {
    const t = dayKey();
    if (t !== app.ui.lastDay) {
      app.ui.lastDay = t;
      if (app.route.name !== 'session') app.render();
    }
  }
  setInterval(checkDay, 30000);

  // ---------- toasts & celebrations ----------
  const toasts = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
  document.body.appendChild(toasts);
  // Toasts are queued and shown one at a time; each is a single short line.
  const queue = [];
  let showing = false;
  function pump() {
    if (showing || !queue.length) return;
    showing = true;
    const { title, sub = '', icon = null, badge = null, ms = 2400 } = queue.shift();
    const el = h('div', { class: 'toast' });
    if (badge) el.appendChild(h('span', { html: badgeSvg(badge, true) }));
    else if (icon) el.appendChild(svg(ICONS[icon] || ICONS.info));
    el.appendChild(h('span', null, title, sub ? h('span', { class: 'sub' }, ' — ' + sub) : null));
    el.title = sub ? `${title} — ${sub}` : title;
    toasts.replaceChildren(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => {
        el.remove();
        showing = false;
        pump();
      }, 260);
    }, ms);
  }
  app.toast = (t) => {
    if (queue.length < 4) queue.push(t);
    pump();
  };
  app.celebrate = (events, delay = 350) => {
    if (!events) return;
    const items = [];
    if (events.levelUp) items.push({ sound: 'levelup', toast: { title: `Level ${events.levelUp}`, sub: 'Game level up — keep going.', icon: 'star' } });
    for (const id of events.unlocked || []) {
      const a = ACHIEVEMENTS.find((x) => x.id === id);
      if (a) items.push({ sound: 'achievement', toast: { title: `Achievement: ${a.title}`, sub: a.desc, badge: a.icon } });
    }
    items.forEach((it, i) => {
      setTimeout(() => {
        app.audio.play(it.sound);
        app.toast(it.toast);
      }, delay + i * 2700);
    });
  };

  // ---------- routing ----------
  const screens = {
    learn: renderLearn,
    play: renderPlay,
    library: renderLibrary,
    word: renderWord,
    progress: renderProgress,
    settings: renderSettings,
    info: renderInfo,
    session: renderSession,
    summary: renderSummary,
  };

  function parseHash() {
    const raw = (location.hash || '').replace(/^#\/?/, '');
    const [name, ...params] = raw.split('/').map(decodeURIComponent);
    return { name: screens[name] ? name : 'learn', params };
  }

  app.navigate = (path, { replace = false } = {}) => {
    const target = '#/' + path;
    if (location.hash === target) {
      app.render();
      return;
    }
    if (replace) {
      history.replaceState(null, '', target);
      app.render();
    } else location.hash = target;
  };

  app.render = () => {
    for (const fn of app.ui.cleanup.splice(0)) {
      try {
        fn();
      } catch {
        /* ignore */
      }
    }
    app.route = parseHash();
    clear(root);
    const view = screens[app.route.name](app, app.route.params);
    root.appendChild(view);
    const tabName = { word: 'library', settings: 'learn', info: 'learn' }[app.route.name] || app.route.name;
    if (TABS.some((t) => t.id === tabName) && !['session', 'summary'].includes(app.route.name)) {
      root.appendChild(tabbar(tabName));
    }
    const focusTarget = root.querySelector('[data-autofocus]') || root.querySelector('h1');
    if (focusTarget && app.ui.focusOnRender !== false) {
      if (!focusTarget.hasAttribute('tabindex') && focusTarget.tagName === 'H1') focusTarget.setAttribute('tabindex', '-1');
      try {
        focusTarget.focus({ preventScroll: true });
      } catch {
        /* ignore */
      }
    }
    window.scrollTo(0, 0);
  };
  app.onCleanup = (fn) => app.ui.cleanup.push(fn);

  function tabbar(active) {
    return h(
      'nav',
      { class: 'tabbar', 'aria-label': 'Main' },
      h(
        'div',
        { class: 'tabbar-inner' },
        TABS.map((t) =>
          h(
            'a',
            { class: 'tab', href: '#/' + t.id, 'aria-current': t.id === active ? 'page' : null, onclick: () => app.audio.play('tap') },
            svg(ICONS[t.icon]),
            h('span', null, t.label),
          ),
        ),
      ),
    );
  }

  // Hooks for automated browser tests (build a task of a given type on demand).
  app.debug = {
    buildTask: (mech, wordId, variant) => {
      const word = lex.get(wordId);
      return buildTask(mech, word, { lex, rng: makeRng(12345), rec: app.state.words[wordId], variant, pool: Object.keys(app.state.words) });
    },
    MECHANICS,
  };

  window.addEventListener('hashchange', () => app.render());
  return app;
}
