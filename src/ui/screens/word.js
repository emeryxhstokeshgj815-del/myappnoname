import { h, svg, marked } from '../dom.js';
import { ICONS } from '../icons.js';
import { TOPICS, POS_SHORT } from '../../core/lexicon.js';
import { skillAccuracy } from '../../core/srs.js';
import { unmark } from '../../core/tasks.js';
import { parseDay } from '../../core/dates.js';
import { launch } from './learn.js';
import { STATE_LABEL } from './library.js';

const SOURCE_NAME = {
  'oxford-5000': 'Oxford 5000',
  'octanove-c1c2-1.0': 'Octanove C1/C2 profile',
  'cefrj-1.5': 'CEFR-J 1.5',
  'efllex-2018': 'EFLLex',
  wordfreq: 'wordfreq',
};

function fmtDay(key) {
  return parseDay(key).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function renderWord(app, params) {
  const w = app.lex.get(params[0]);
  if (!w) {
    return h('main', { class: 'screen stack' }, h('h1', null, 'Word not found'), h('a', { href: '#/library' }, 'Back to Library'));
  }
  const rec = app.state.words[w.id];
  const s = app.wordState(w.id);
  const topic = TOPICS.find((t) => t.id === w.topic);
  const fav = app.isFav(w.id);
  const canSpeak = app.speech.available;

  const favBtn = h(
    'button',
    {
      class: 'icon-btn',
      'aria-label': fav ? 'Remove from favorites' : 'Add to favorites',
      'aria-pressed': String(fav),
      onclick: () => {
        app.toggleFav(w.id);
        app.audio.play('tap');
        app.ui.focusOnRender = false;
        app.render();
        app.ui.focusOnRender = true;
      },
    },
    svg(fav ? ICONS.heartFill : ICONS.heart, fav ? 'icon flame' : 'icon'),
  );

  const skill = (label, key) => {
    const acc = skillAccuracy(rec, key);
    const pct = acc === null ? 0 : Math.round(acc * 100);
    return h('div', { class: 'skill' }, h('span', null, label), h('div', { class: 'xpbar' }, h('i', { style: { width: pct + '%' } })), h('span', { class: 'tiny' }, acc === null ? '—' : pct + '%'));
  };

  const ce = w.corpusEvidence;
  let corpusBlock;
  if (ce.source === 'efllex-2018') {
    const vals = Object.values(ce.freqPerMillionByLevel);
    const max = Math.max(...vals, 0.0001);
    corpusBlock = h(
      'div',
      null,
      h('dd', null, `Frequency per million words in EFL teaching materials by level (${ce.match === 'lemma' ? 'attested as ' + ce.efllexPos : 'same part of speech'}). A signal for selection, not a level label.`),
      h('div', { class: 'freq', 'aria-hidden': 'true' }, vals.map((v, i) => h('i', { class: 'b' + (i === 4 ? ' on' : ''), style: { height: Math.max(2, Math.round((v / max) * 100)) + '%' } }))),
      h('div', { class: 'freq-l' }, ['A1', 'A2', 'B1', 'B2', 'C1'].map((l, i) => h('span', null, `${l} ${vals[i]}`))),
    );
  } else {
    corpusBlock = h('dd', null, `Not found in EFLLex's textbook corpus; general frequency (wordfreq) Zipf ${ce.zipf}.`);
  }

  return h(
    'main',
    { class: 'screen stack screen-enter' },
    h('div', { class: 'topbar' }, h('a', { class: 'icon-btn', href: '#/library', 'aria-label': 'Back to Library' }, svg(ICONS.back)), h('span', { class: 'spacer' }), favBtn),
    h(
      'div',
      null,
      h(
        'div',
        { class: 'word-head' },
        h('h1', null, w.lemma),
        canSpeak ? h('button', { class: 'icon-btn', 'aria-label': 'Hear the word', onclick: () => app.speech.speak(w.lemma) }, svg(ICONS.speaker)) : null,
      ),
      h(
        'div',
        { class: 'word-meta' },
        h('span', { class: 'chip static' }, w.partOfSpeech),
        w.register !== 'neutral' ? h('span', { class: 'chip static' }, w.register) : null,
        h('span', { class: 'chip static' }, topic ? topic.label : w.topic),
        h('span', { class: 'chip static' }, STATE_LABEL[s]),
      ),
    ),
    h('section', { class: 'card stack-sm' }, h('p', { class: 'tr-big', lang: 'ru' }, w.translationsRu.join(', ')), h('p', null, w.definitionEn), w.senseNote ? h('p', { class: 'tiny' }, w.senseNote) : null),
    h('section', { class: 'stack-sm' }, h('h2', null, 'Examples'), h('ul', { class: 'examples' }, w.examples.map((e) => h('li', null, marked(e.text))))),
    h('section', { class: 'stack-sm' }, h('h2', null, 'Collocations'), h('div', { class: 'chips' }, w.collocations.map((c) => h('span', { class: 'chip static', style: { fontSize: '15px' } }, unmark(c))))),
    h(
      'button',
      {
        class: 'btn block',
        onclick: () => launch(app, { mode: 'word', wordId: w.id }),
      },
      svg(ICONS.play),
      rec ? 'Practise this word' : 'Learn this word now',
    ),
    rec
      ? h(
          'section',
          { class: 'card stack-sm' },
          h('h2', null, 'Your progress'),
          h('p', { class: 'small muted' }, `Next review: ${rec.due <= app.today() ? 'due now' : fmtDay(rec.due)} · correct ${rec.ok}, missed ${rec.fail}${rec.hints ? `, hinted ${rec.hints}` : ''}`),
          h('div', { class: 'skillbars' }, skill('Recognition', 'rec'), skill('Recall', 'rcl'), skill('In context', 'ctx')),
        )
      : null,
    h(
      'section',
      { class: 'card flat' },
      h('h2', null, 'Why this word'),
      h(
        'dl',
        { class: 'evidence' },
        h('dt', null, 'CEFR level evidence'),
        w.cefrEvidence.map((e) =>
          h('dd', null, `${SOURCE_NAME[e.source] || e.source}: ${e.label} for "${w.lemma}" (${e.pos}) — label covers the word and part of speech, not a specific sense.`),
        ),
        h('dt', null, 'Corpus evidence'),
        corpusBlock,
        h('dt', null, 'Sense'),
        h('dd', null, `Crux teaches one sense (${w.senseId}); it was chosen by the editor. Definitions, translations and examples are original Crux content.`),
      ),
    ),
  );
}
