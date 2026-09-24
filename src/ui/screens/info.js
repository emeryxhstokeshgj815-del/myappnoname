import { h, svg } from '../dom.js';
import { ICONS } from '../icons.js';
import { XP } from '../../core/xp.js';

function learning() {
  return [
    h('h1', null, 'How learning works'),
    h('p', { class: 'muted' }, 'Crux uses a simple, transparent spaced-repetition heuristic. It is a sensible starting point, not a scientifically optimal schedule.'),
    h(
      'section',
      { class: 'card stack-sm' },
      h('h2', null, 'New words'),
      h('p', null, 'A new word appears as a short card (meaning, translation, example) with a quick check. A few tasks later in the same session you are asked to produce it yourself.'),
    ),
    h(
      'section',
      { class: 'card stack-sm' },
      h('h2', null, 'Intervals'),
      h('p', null, 'After a correct answer without hints the next review moves up the ladder: 1 → 3 → 7 → 14 → 30 → 60 days. Only the first answer of the day moves a word up, so repeating it many times in one day does not inflate progress.'),
      h('p', null, 'A mistake moves the word two steps down (never below 1 day) and brings it back tomorrow. In the same session it returns once more with a different exercise and sentence — never in an endless loop.'),
      h('p', null, 'An answer given after a hint keeps the interval and brings the word back tomorrow. It never counts as recall from memory.'),
    ),
    h(
      'section',
      { class: 'card stack-sm' },
      h('h2', null, 'Word states'),
      h('p', null, h('b', null, 'New'), ' — not seen yet. ', h('b', null, 'Learning'), ' — seen, intervals up to 3 days. ', h('b', null, 'Review'), ' — correct on 2+ days and a 7-day interval. ', h('b', null, 'Established'), ' — correct on 3+ different days, typed from memory on 2+ days, remembered after a gap of 7+ days, and the last answer was right.'),
      h('p', null, 'Three skills are tracked separately: recognition (choosing), recall (typing from memory) and use in context (sentences, collocations, nuance).'),
    ),
    h(
      'section',
      { class: 'card stack-sm' },
      h('h2', null, 'XP and streaks'),
      h('p', null, `Typed from memory: ${XP.typed} XP (${XP.typo} with a small typo). Correct choice: ${XP.choice} XP. After a hint: ${XP.hinted} XP. Wrong or revealed answers: 0. Each task can pay out once; the same word pays full XP twice a day, then 1 XP. Sprint: ${XP.sprint} XP per correct answer, up to ${XP.sprintCap}. Finishing a session of 10+ tasks: +${XP.session}.`),
      h('p', null, 'A study day needs a finished session or 10 answers on your device’s local date. Game levels measure practice only — they are not CEFR levels.'),
      h('p', null, 'Sprint and Match are practice: they train skills but do not change review dates.'),
    ),
  ];
}

function sources(app) {
  const meta = app.lex.meta || {};
  return [
    h('h1', null, 'Sources & licenses'),
    h('p', { class: 'muted' }, `Dictionary build ${meta.version || ''}: ${meta.uniqueLemmas || app.lex.words.length} words (unique lemmas), ${meta.senses || app.lex.words.length} senses.`),
    h(
      'section',
      { class: 'card stack-sm' },
      h('h2', null, 'Word selection'),
      h('p', null, 'Candidates come from EFLLex, a CEFR-graded frequency list built from EFL textbooks and graded readers (Dürlich & François, LREC 2018, CEFRLex project, CENTAL, UCLouvain; CC BY-NC-SA 4.0). EFLLex frequencies are not level labels.'),
      h('p', null, 'Each word is checked against a CEFR-labelled list for the same part of speech: the Oxford 5000 (C1 label; © Oxford University Press, used for verification only) or, where Oxford has no entry, the Octanove Vocabulary Profile C1/C2 (Octanove Labs, CC BY-SA 4.0). Lower labels in the CEFR-J Vocabulary Profile 1.5 (Tono Laboratory, TUFS) are shown on each word page. Words missing from EFLLex are backed by general frequencies from wordfreq (CC BY-SA 4.0).'),
      h('p', null, 'These lists label words and parts of speech, not individual senses. The sense taught for each word was chosen by the Crux editor.'),
    ),
    h(
      'section',
      { class: 'card stack-sm' },
      h('h2', null, 'Learning content'),
      h('p', null, 'Definitions, Russian translations, example sentences, collocations and all exercises were written for Crux; they are not quotations from dictionaries or corpora. Word-formation links were checked against Princeton WordNet 3.0. Crux content is licensed CC BY-NC-SA 4.0.'),
    ),
    h(
      'section',
      { class: 'card stack-sm' },
      h('h2', null, 'Sounds'),
      h('p', null, 'Interface Sounds 1.0 by Kenney (www.kenney.nl), CC0 1.0 Universal. Files used: select_002 (tap), confirmation_001 (correct), question_004 (incorrect), confirmation_004 (session complete), confirmation_002 (achievement), confirmation_003 (level up).'),
      h('p', null, 'Listen & Type uses your device’s own speech voice, which is separate from these sound effects.'),
    ),
  ];
}

export function renderInfo(app, params) {
  const page = params[0] === 'sources' ? sources(app) : learning();
  return h(
    'main',
    { class: 'screen stack screen-enter' },
    h('div', { class: 'topbar' }, h('a', { class: 'icon-btn', href: '#/settings', 'aria-label': 'Back to Settings' }, svg(ICONS.back))),
    ...page,
  );
}
