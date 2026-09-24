import { h, svg } from '../dom.js';
import { ICONS } from '../icons.js';
import { TOPICS } from '../../core/lexicon.js';
import { MECHANICS, CORE_MECHANICS } from '../../core/tasks.js';
import { MIN_KNOWN } from '../../core/session.js';
import { launch } from './learn.js';

export function renderPlay(app) {
  const st = app.state;
  const known = app.knownCount();
  const mistakes = app.mistakeCount();
  const len = st.settings.length === 20 ? 20 : 10;
  if (!app.ui.free) {
    app.ui.free = { open: false, topics: [], mechanics: [], length: len };
  }
  const free = app.ui.free;
  const voice = app.speech.available;

  const modeRow = ({ icon, title, sub, disabled, onclick }) =>
    h(
      'button',
      { class: 'link-row mode-card', disabled: disabled || null, 'aria-disabled': disabled ? 'true' : null, onclick: disabled ? null : onclick },
      svg(ICONS[icon], 'icon lead'),
      h('span', { class: 'spacer' }, title, h('span', { class: 'sub' }, sub)),
      disabled ? null : svg(ICONS.next),
    );

  const rerender = () => {
    app.audio.play('tap');
    app.ui.focusOnRender = false;
    app.render();
    app.ui.focusOnRender = true;
  };
  const toggle = (list, v) => {
    const i = list.indexOf(v);
    if (i >= 0) list.splice(i, 1);
    else list.push(v);
    rerender();
  };

  const mechList = [...CORE_MECHANICS, 'listen'];

  return h(
    'main',
    { class: 'screen stack screen-enter' },
    h('div', { class: 'topbar' }, h('h1', null, 'Play')),
    modeRow({
      icon: 'clock',
      title: 'Sprint · 60 seconds',
      sub: known >= MIN_KNOWN.sprint ? 'Quick answers on words you already know.' : `Unlocks after ${MIN_KNOWN.sprint} words you have answered correctly (${known} now).`,
      disabled: known < MIN_KNOWN.sprint,
      onclick: () => launch(app, { mode: 'sprint' }),
    }),
    modeRow({
      icon: 'lab',
      title: 'Mistake Lab',
      sub: mistakes ? `${mistakes} ${mistakes === 1 ? 'word' : 'words'} you missed, in new contexts.` : 'No open mistakes right now.',
      disabled: !mistakes,
      onclick: () => launch(app, { mode: 'mistakes', length: len }),
    }),
    modeRow({
      icon: 'crown',
      title: 'Boss Round',
      sub: known >= MIN_KNOWN.boss ? `Mixed check of learned words, no hints · ${len} tasks.` : `Unlocks after ${MIN_KNOWN.boss} learned words (${known} now).`,
      disabled: known < MIN_KNOWN.boss,
      onclick: () => launch(app, { mode: 'boss', length: len }),
    }),
    h(
      'section',
      { class: 'card' },
      h(
        'button',
        {
          class: 'link-row',
          style: { boxShadow: 'none', padding: '4px 0', minHeight: '48px' },
          'aria-expanded': String(free.open),
          onclick: () => {
            free.open = !free.open;
            rerender();
          },
        },
        svg(ICONS.sliders, 'icon lead'),
        h('span', { class: 'spacer' }, 'Free Practice', h('span', { class: 'sub' }, 'Choose topics, exercise types and length.')),
        svg(free.open ? ICONS.back : ICONS.next),
      ),
      free.open
        ? h(
            'div',
            { class: 'config stack' },
            h('h3', { id: 'ft' }, 'Topics'),
            h(
              'div',
              { class: 'chips', role: 'group', 'aria-labelledby': 'ft' },
              h('button', { class: 'chip', 'aria-pressed': String(!free.topics.length), onclick: () => { free.topics.length = 0; rerender(); } }, 'General mix'),
              TOPICS.map((t) => h('button', { class: 'chip', 'aria-pressed': String(free.topics.includes(t.id)), onclick: () => toggle(free.topics, t.id) }, t.label)),
            ),
            h('h3', { id: 'fm' }, 'Exercises'),
            h(
              'div',
              { class: 'chips', role: 'group', 'aria-labelledby': 'fm' },
              h('button', { class: 'chip', 'aria-pressed': String(!free.mechanics.length), onclick: () => { free.mechanics.length = 0; rerender(); } }, 'All types'),
              mechList.map((m) =>
                h(
                  'button',
                  {
                    class: 'chip',
                    'aria-pressed': String(free.mechanics.includes(m)),
                    disabled: m === 'listen' && !voice ? true : null,
                    title: m === 'listen' && !voice ? 'No offline English voice on this device' : null,
                    onclick: () => toggle(free.mechanics, m),
                  },
                  MECHANICS[m].label,
                ),
              ),
            ),
            h(
              'div',
              { class: 'row' },
              h('h3', { id: 'fl' }, 'Length'),
              h('span', { class: 'spacer' }),
              h(
                'div',
                { class: 'seg', role: 'radiogroup', 'aria-labelledby': 'fl' },
                [10, 20].map((n) =>
                  h('button', { role: 'radio', 'aria-checked': String(free.length === n), onclick: () => { free.length = n; rerender(); } }, `${n} tasks`),
                ),
              ),
            ),
            h(
              'button',
              {
                class: 'btn block',
                onclick: () => launch(app, { mode: 'free', length: free.length, config: { topics: free.topics.slice(), mechanics: free.mechanics.slice() } }),
              },
              'Start practice',
            ),
          )
        : null,
    ),
    h(
      'p',
      { class: 'tiny' },
      voice
        ? 'Listen & Type is on: an offline English voice was found on this device.'
        : 'Listen & Type is off: this device has no offline English speech voice, so that exercise is skipped. Everything else works offline.',
    ),
  );
}
