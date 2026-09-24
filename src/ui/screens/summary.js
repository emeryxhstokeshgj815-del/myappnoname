import { h, svg } from '../dom.js';
import { ICONS } from '../icons.js';
import { MODES } from '../../core/session.js';
import { streakInfo } from '../../core/streak.js';
import { launch } from './learn.js';

export function renderSummary(app) {
  const session = app.state.session;
  if (!session || !session.finished || !session.summary) {
    setTimeout(() => app.navigate('learn', { replace: true }), 0);
    return h('main', { class: 'screen' });
  }
  const s = session.summary;
  const acc = Math.round(s.accuracy * 100);
  const today = app.today();
  const streak = streakInfo(app.state.days, today);
  const len = app.state.settings.length === 20 ? 20 : 10;
  const mistakes = app.mistakeCount();
  const due = app.dueCount();

  const close = () => {
    app.state.session = null;
    app.save(true);
  };

  let primary;
  if (mistakes > 0 && s.mode !== 'mistakes' && s.hard.length) {
    primary = { label: `Fix mistakes now (${mistakes})`, run: () => { close(); launch(app, { mode: 'mistakes', length: len }); } };
  } else if (due > 0) {
    primary = { label: `Continue: ${due} due`, run: () => { close(); launch(app, { mode: 'daily', length: len }); } };
  } else if (app.newLeftToday() > 0) {
    primary = { label: `Learn new words (${app.newLeftToday()} left today)`, run: () => { close(); launch(app, { mode: 'daily', length: len }); } };
  } else {
    primary = { label: 'Done', run: () => { close(); app.navigate('learn'); } };
  }

  const title = s.mode === 'sprint' ? 'Time!' : s.accuracy >= 0.9 ? 'Excellent session' : s.accuracy >= 0.6 ? 'Session complete' : 'Session complete — good practice';
  return h(
    'main',
    { class: 'screen no-tabs stack screen-enter' },
    h('p', { class: 'kicker' }, MODES[s.mode]?.label || 'Session'),
    h('h1', { tabindex: '-1' }, title),
    h(
      'div',
      { class: 'sum-stats' },
      h('div', { class: 'stat' }, h('div', { class: 'num' }, `${acc}%`), h('div', { class: 'lab' }, 'correct')),
      h('div', { class: 'stat' }, h('div', { class: 'num' }, `+${s.xp}`), h('div', { class: 'lab' }, 'XP')),
      h('div', { class: 'stat' }, h('div', { class: 'num' }, String(s.answered)), h('div', { class: 'lab' }, s.mode === 'sprint' ? 'answers' : 'tasks')),
    ),
    streak.todayDone ? h('p', { class: 'muted row' }, svg(ICONS.flame, 'icon flame'), `Study day counted · ${streak.current}-day streak`) : null,
    s.hard.length
      ? h(
          'section',
          { class: 'stack-sm' },
          h('h2', null, 'Words to revisit'),
          h(
            'div',
            { class: 'hard-list' },
            s.hard.map((id) => {
              const w = app.lex.get(id);
              return w ? h('a', { class: 'chip', href: '#/word/' + encodeURIComponent(id), onclick: () => close() }, h('b', null, w.lemma), ' ', h('span', { class: 'tiny' }, w.translationsRu[0])) : null;
            }),
          ),
        )
      : h('p', { class: 'muted' }, s.mode === 'sprint' ? 'Sprint answers train your reflexes; they do not change review dates.' : 'No mistakes this time.'),
    h('button', { class: 'btn block big', 'data-autofocus': true, onclick: primary.run }, primary.label, svg(ICONS.next)),
    primary.label !== 'Done' ? h('button', { class: 'btn ghost block', onclick: () => { close(); app.navigate('learn'); } }, 'Back to Learn') : null,
  );
}
