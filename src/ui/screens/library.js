import { h, svg, clear } from '../dom.js';
import { ICONS } from '../icons.js';
import { TOPICS, POS_SHORT } from '../../core/lexicon.js';

const STATES = [
  ['all', 'All words'],
  ['new', 'New'],
  ['learning', 'Learning'],
  ['review', 'Review'],
  ['established', 'Established'],
  ['favorites', 'Favorites'],
];
const POS = [['all', 'Any part of speech'], ['noun', 'Nouns'], ['verb', 'Verbs'], ['adjective', 'Adjectives'], ['adverb', 'Adverbs'], ['preposition', 'Prepositions'], ['conjunction', 'Conjunctions']];
export const STATE_LABEL = { new: 'New', learning: 'Learning', review: 'Review', established: 'Established' };

export function renderLibrary(app) {
  const f = app.ui.library;
  const list = h('ul', { class: 'wordlist', 'aria-label': 'Words' });
  const count = h('p', { class: 'muted small', 'aria-live': 'polite' });
  const more = h('div');

  const select = (label, key, options) =>
    h(
      'label',
      null,
      h('span', { class: 'sr-only' }, label),
      h(
        'select',
        {
          class: 'sel',
          onchange: (e) => {
            f[key] = e.target.value;
            f.limit = 60;
            update();
          },
        },
        options.map(([v, l]) => h('option', { value: v, selected: f[key] === v ? true : null }, l)),
      ),
    );

  function update() {
    const res = app.lex.search(f.q, { topic: f.topic, state: f.state, pos: f.pos }, (id) => app.wordState(id), (id) => app.isFav(id));
    clear(list);
    clear(more);
    count.textContent = res.length === app.lex.words.length ? `${res.length} words` : `${res.length} of ${app.lex.words.length} words`;
    if (!res.length) {
      list.style.display = 'none';
      more.appendChild(
        h(
          'div',
          { class: 'empty' },
          h('p', null, 'No words match.'),
          h(
            'button',
            {
              class: 'btn secondary',
              style: { marginTop: '12px' },
              onclick: () => {
                Object.assign(f, { q: '', topic: 'all', state: 'all', pos: 'all', limit: 60 });
                app.render();
              },
            },
            'Clear search and filters',
          ),
        ),
      );
      return;
    }
    list.style.display = '';
    for (const w of res.slice(0, f.limit)) {
      const s = app.wordState(w.id);
      list.appendChild(
        h(
          'li',
          null,
          h(
            'button',
            { class: 'wordrow', onclick: () => app.navigate('word/' + encodeURIComponent(w.id)) },
            h('span', { class: 'grow' }, h('span', { class: 'lemma' }, w.lemma), ' ', h('span', { class: 'tiny' }, POS_SHORT[w.partOfSpeech]), h('span', { class: 'tr' }, w.translationsRu.slice(0, 2).join(', '))),
            app.isFav(w.id) ? svg(ICONS.heartFill, 'icon flame') : null,
            h('span', { class: 'state-dot ' + s }, STATE_LABEL[s]),
          ),
        ),
      );
    }
    if (res.length > f.limit) {
      more.appendChild(
        h(
          'button',
          {
            class: 'btn secondary block',
            onclick: () => {
              f.limit += 120;
              update();
            },
          },
          `Show more (${res.length - f.limit} left)`,
        ),
      );
    }
  }

  const input = h('input', {
    type: 'search',
    value: f.q,
    placeholder: 'Search English or Russian',
    'aria-label': 'Search words in English or Russian',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
    oninput: (e) => {
      f.q = e.target.value;
      f.limit = 60;
      update();
    },
  });

  const view = h(
    'main',
    { class: 'screen stack screen-enter' },
    h('div', { class: 'topbar' }, h('h1', null, 'Library')),
    h('div', { class: 'search' }, svg(ICONS.search), input),
    h(
      'div',
      { class: 'filters' },
      select('Topic', 'topic', [['all', 'All topics'], ...TOPICS.map((t) => [t.id, t.label])]),
      select('Learning state', 'state', STATES),
      select('Part of speech', 'pos', POS),
    ),
    count,
    list,
    more,
  );
  update();
  return view;
}
