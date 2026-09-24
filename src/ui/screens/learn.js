import { h, svg } from '../dom.js';
import { ICONS } from '../icons.js';
import { levelInfo } from '../../core/xp.js';
import { streakInfo } from '../../core/streak.js';
import { startSession } from '../../core/engine.js';

export function greeting(date = new Date()) {
  const hr = date.getHours();
  if (hr < 5) return 'Good night';
  if (hr < 12) return 'Good morning';
  if (hr < 18) return 'Good afternoon';
  return 'Good evening';
}

export function storageBanner(app) {
  const s = app.storage;
  if (!s.available) {
    return h('div', { class: 'banner', role: 'alert' }, svg(ICONS.info), h('span', null, 'This browser is not letting Crux save data (private mode or blocked storage). You can study, but progress will be lost when the page closes. Export your progress in Settings to keep it.'));
  }
  if (s.status === 'damaged') {
    return h('div', { class: 'banner', role: 'alert' }, svg(ICONS.info), h('span', null, 'Saved progress was damaged and could not be read. A copy was kept in browser storage; Crux started fresh.'));
  }
  if (s.saveFailed) {
    return h('div', { class: 'banner', role: 'alert' }, svg(ICONS.info), h('span', null, 'The last save failed (storage full or blocked). Export your progress in Settings.'));
  }
  return null;
}

export function launch(app, opts) {
  const today = app.today();
  const session = startSession(app.state, app.lex, { ...opts, today, voice: app.speech.available });
  if (!session.tasks.length && opts.mode !== 'sprint') {
    app.toast({ title: 'Nothing to practise here yet', icon: 'info' });
    return;
  }
  app.state.session = session;
  app.save(true);
  app.navigate('session');
}

export function renderLearn(app) {
  const st = app.state;
  const today = app.today();
  const due = app.dueCount();
  const fresh = app.newLeftToday();
  const lv = levelInfo(st.stats.xp);
  const streak = streakInfo(st.days, today);
  const established = Object.keys(st.words).filter((id) => app.wordState(id) === 'established').length;
  const active = st.session && !st.session.finished && st.session.mode !== 'sprint' ? st.session : null;
  const mistakes = app.mistakeCount();
  const len = st.settings.length === 20 ? 20 : 10;

  const setLen = (n) => {
    st.settings.length = n;
    app.save();
    app.audio.play('tap');
    app.render();
  };

  return h(
    'main',
    { class: 'screen stack screen-enter' },
    h(
      'div',
      { class: 'topbar' },
      h('h1', { class: 'brand' }, 'Crux', h('span', { class: 'brand-dot' }, '.')),
      h('span', { class: 'spacer' }),
      h('a', { class: 'icon-btn', href: '#/settings', 'aria-label': 'Settings' }, svg(ICONS.settings)),
    ),
    h('p', { class: 'greet' }, `${greeting()}. C1 words, a few minutes at a time.`),
    storageBanner(app),
    h(
      'section',
      { class: 'today', 'aria-label': 'Today' },
      h('div', { class: 'stat' }, h('div', { class: 'num' }, String(due)), h('div', { class: 'lab' }, due === 1 ? 'word to review' : 'words to review')),
      h('div', { class: 'stat' }, h('div', { class: 'num' }, String(fresh)), h('div', { class: 'lab' }, 'new words left today')),
    ),
    h(
      'div',
      { class: 'mini', 'aria-label': 'Progress' },
      h('span', { class: 'item' }, svg(ICONS.flame, 'icon flame'), streak.current ? `${streak.current}-day streak` : 'No streak yet'),
      h('span', { class: 'item' }, svg(ICONS.star), `Level ${lv.level}`),
      h('span', { class: 'item' }, svg(ICONS.check), `${established} established`),
    ),
    h('div', { class: 'xpbar', role: 'progressbar', 'aria-label': `Level ${lv.level} progress`, 'aria-valuemin': 0, 'aria-valuemax': lv.span, 'aria-valuenow': lv.into }, h('i', { style: { width: `${Math.round(lv.pct * 100)}%` } })),
    active
      ? h(
          'button',
          { class: 'btn secondary block', onclick: () => app.navigate('session') },
          svg(ICONS.replay),
          `Resume session · ${Math.min(active.pos + 1, active.tasks.length)}/${active.tasks.length}`,
        )
      : null,
    h(
      'div',
      { class: 'row' },
      h('span', { class: 'muted small', id: 'len-label' }, 'Session length'),
      h('span', { class: 'spacer' }),
      h(
        'div',
        { class: 'seg', role: 'radiogroup', 'aria-labelledby': 'len-label' },
        [10, 20].map((n) => h('button', { role: 'radio', 'aria-checked': String(len === n), onclick: () => setLen(n) }, `${n} tasks`)),
      ),
    ),
    h(
      'button',
      {
        class: 'btn block big',
        'data-autofocus': true,
        onclick: () => {
          app.audio.play('tap');
          launch(app, { mode: 'daily', length: len });
        },
      },
      svg(ICONS.play),
      due || fresh ? 'Start Daily Mix' : 'Practise more',
    ),
    mistakes
      ? h(
          'button',
          { class: 'link-row', onclick: () => launch(app, { mode: 'mistakes', length: len }) },
          svg(ICONS.lab, 'icon lead'),
          h('span', { class: 'spacer' }, 'Mistake Lab', h('span', { class: 'sub' }, `${mistakes} ${mistakes === 1 ? 'word' : 'words'} to fix in new contexts`)),
          svg(ICONS.next),
        )
      : null,
    !Object.keys(st.words).length
      ? h('p', { class: 'tiny' }, 'Crux shows each new word with a short card, checks it right away and asks for it again a few tasks later. Reviews then come back after 1, 3, 7, 14, 30 and 60 days.')
      : null,
  );
}
