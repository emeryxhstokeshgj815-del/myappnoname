// Renderers for the 12 exercise types. Each returns a small controller:
//   { el, kind, note, choose(i), canSubmit(), response(), hint(), onResult(result), focus() }
// The session screen owns grading, sounds, feedback and navigation.

import { h, svg, marked, gapped } from './dom.js';
import { ICONS } from './icons.js';
import { MECHANICS, splitMarked, unmark } from '../core/tasks.js';
import { firstLetterHint, partHint } from '../core/answer.js';
import { POS_SHORT } from '../core/lexicon.js';

const KEYS = ['1', '2', '3', '4'];

export function kickerFor(task) {
  if (task.mech === 'intro') return 'New word';
  const base = MECHANICS[task.mech]?.label || task.mech;
  if (task.mech === 'quickpick') return `${base} · ${task.variant === 'ru-en' ? 'RU → EN' : 'EN → RU'}`;
  if (task.mech === 'gap') return `${base} · ${task.variant === 'typed' ? 'type' : 'choose'}`;
  if (task.mech === 'collocation') return `${base} · ${task.variant === 'odd' ? 'odd one out' : 'complete'}`;
  return base;
}

function optionList(options, onPick, { cls = 'options', ariaLabel = 'Answer options' } = {}) {
  const buttons = options.map((label, i) =>
    h(
      'button',
      { class: 'opt', 'data-i': String(i), onclick: () => onPick(i) },
      h('span', { class: 'key', 'aria-hidden': 'true' }, KEYS[i] || ''),
      h('span', { class: 'txt' }, label),
      h('span', { class: 'mark' }, svg(ICONS.check)),
    ),
  );
  const el = h('div', { class: cls, role: 'group', 'aria-label': ariaLabel }, buttons);
  return { el, buttons };
}

function markOptions(buttons, answerIndex, chosen) {
  buttons.forEach((b, i) => {
    b.disabled = true;
    b.setAttribute('aria-disabled', 'true');
    const markEl = b.querySelector('.mark');
    if (i === answerIndex) {
      b.classList.add('is-correct');
      markEl.innerHTML = '';
      markEl.appendChild(svg(ICONS.check));
      b.setAttribute('aria-label', b.textContent.slice(1) + ' — correct answer');
      if (i === chosen) b.classList.add('bounce');
    } else if (i === chosen) {
      b.classList.add('is-wrong', 'shake');
      markEl.innerHTML = '';
      markEl.appendChild(svg(ICONS.cross));
      b.setAttribute('aria-label', b.textContent.slice(1) + ' — your answer, incorrect');
    } else b.classList.add('is-dim');
  });
}

function choiceController(el, buttons, task, submit, note) {
  let done = false;
  return {
    el,
    kind: 'choice',
    note,
    choose(i) {
      if (done || i < 0 || i >= buttons.length) return;
      done = true;
      buttons[i].classList.add('pressed');
      submit({ choice: i });
    },
    onResult(res) {
      done = true;
      markOptions(buttons, task.answerIndex, res.chosen);
    },
    focus() {
      buttons[0]?.focus({ preventScroll: true });
    },
  };
}

function typedController({ el, input, task, submit, hintsAllowed, hintEl, answerForHint, onResultExtra }) {
  let hint = 0;
  let done = false;
  const ctl = {
    el,
    kind: 'typed',
    input,
    canSubmit: () => !done && input.value.trim().length > 0,
    response: () => ({ text: input.value, hint }),
    hintsAllowed,
    get hintLevel() {
      return hint;
    },
    hint() {
      if (done || !hintsAllowed) return hint;
      hint += 1;
      const ans = answerForHint;
      if (hint === 1) hintEl.textContent = firstLetterHint(ans);
      else if (hint === 2) hintEl.textContent = partHint(ans);
      if (hint >= 3) {
        done = true;
        submit({ text: input.value, hint: 3 });
      }
      input.focus({ preventScroll: true });
      return hint;
    },
    onResult(res) {
      done = true;
      input.disabled = true;
      input.classList.add(res.correct && res.outcome !== 'bad' ? 'good' : res.outcome === 'hint' ? 'good' : 'bad');
      if (!res.correct) input.classList.add('shake');
      onResultExtra && onResultExtra(res);
    },
    focus() {
      input.focus({ preventScroll: false });
    },
    submitNow() {
      if (!ctl.canSubmit()) return;
      done = true;
      submit(ctl.response());
    },
  };
  return ctl;
}

function answerInput(label, onEnter) {
  const input = h('input', {
    class: 'answer-input',
    type: 'text',
    autocomplete: 'off',
    autocapitalize: 'off',
    autocorrect: 'off',
    spellcheck: 'false',
    enterkeyhint: 'done',
    'aria-label': label,
    placeholder: 'Type your answer',
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      e.stopPropagation();
      onEnter(e);
    }
  });
  return input;
}

function fillGap(container, text, cls) {
  const gap = container.querySelector('.gap');
  if (gap) {
    gap.textContent = text;
    gap.classList.add('filled', cls);
  }
}

/**
 * @param {object} task
 * @param {object} ctx { app, submit, hintsAllowed, onInput, onEnter }
 */
export function buildExercise(task, ctx) {
  const { app, submit } = ctx;
  const lex = app.lex;
  const word = lex.get(task.wordId);
  const instr = (t) => h('p', { class: 'instr' }, t);

  switch (task.mech) {
    case 'intro': {
      const card = h(
        'div',
        { class: 'intro-card pop-in' },
        h('span', { class: 'new-pill' }, 'New'),
        h('div', { class: 'w', style: { marginTop: '8px' } }, word.lemma, ' ', h('span', { class: 'tiny' }, word.partOfSpeech)),
        h('div', { class: 't', lang: 'ru' }, word.translationsRu.join(', ')),
        h('div', { class: 'd' }, word.definitionEn),
        h('div', { class: 'ex' }, marked(word.examples[0].text)),
        h('div', { class: 'chips', style: { marginTop: '10px' } }, word.collocations.slice(0, 3).map((c) => h('span', { class: 'chip static' }, unmark(c)))),
      );
      const holder = h('div');
      const el = h('div', { class: 'task' }, card, holder);
      const opts = optionList(task.options, (i) => ctl.choose(i));
      let revealed = false;
      const ctl = {
        el,
        kind: 'intro',
        get note() {
          return revealed ? 'Choose the translation' : '';
        },
        revealed: () => revealed,
        reveal() {
          if (revealed) return;
          revealed = true;
          // hide the meaning so the quick check is a real (if short-term) recall
          for (const sel of ['.t', '.d', '.chips']) card.querySelector(sel)?.remove();
          holder.appendChild(h('div', { class: 'pop-in', style: { marginTop: '16px' } }, h('p', { class: 'prompt' }, 'Quick check: what does ', h('b', null, word.lemma), ' mean here?'), opts.el));
          opts.buttons[0].focus({ preventScroll: true });
          setTimeout(() => opts.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 50);
        },
        choose(i) {
          if (!revealed || ctl.done) return;
          ctl.done = true;
          submit({ choice: i });
        },
        onResult(res) {
          if (!revealed) ctl.reveal();
          markOptions(opts.buttons, task.answerIndex, res.chosen);
        },
        focus() {},
      };
      return ctl;
    }

    case 'quickpick': {
      const opts = optionList(task.options, (i) => ctl.choose(i));
      const prompt =
        task.variant === 'ru-en'
          ? [instr('Choose the English word'), h('p', { class: 'prompt', lang: 'ru' }, task.prompt), h('p', { class: 'tiny' }, word.partOfSpeech)]
          : [
              instr('Choose the Russian translation'),
              h('p', { class: 'prompt word' }, task.prompt, ' ', h('span', { class: 'tiny' }, POS_SHORT[word.partOfSpeech])),
              task.context ? h('p', { class: 'context' }, marked(task.context)) : null,
            ];
      const ctl = choiceController(h('div', { class: 'task' }, ...prompt, opts.el), opts.buttons, task, submit, 'Choose an answer');
      return ctl;
    }

    case 'gap':
    case 'listen':
    case 'wordform': {
      const sentence = h('p', { class: 'sentence' }, marked(task.sentence, { gap: true }));
      if (task.mech === 'gap' && task.variant === 'choice') {
        const opts = optionList(task.options, (i) => ctl.choose(i));
        const ctl = choiceController(h('div', { class: 'task' }, instr('Choose the word that fits'), sentence, opts.el), opts.buttons, task, (r) => {
          fillGap(sentence, task.options[r.choice], r.choice === task.answerIndex ? 'good' : 'bad');
          submit(r);
        }, 'Choose an answer');
        const orig = ctl.onResult;
        ctl.onResult = (res) => {
          orig(res);
          fillGap(sentence, task.options[task.answerIndex], 'good');
        };
        return ctl;
      }
      const hintEl = h('p', { class: 'hintline', 'aria-live': 'polite' });
      const input = answerInput(task.mech === 'wordform' ? 'Derived word' : 'Missing word', () => ctx.onEnter());
      input.addEventListener('input', () => ctx.onInput());
      const parts = [];
      if (task.mech === 'listen') {
        let played = false;
        const play = (rate) => {
          played = true;
          app.speech.speak(task.speak, { rate });
        };
        parts.push(
          instr('Listen and type the missing word'),
          h(
            'div',
            { class: 'listen-ctl' },
            h('button', { class: 'btn secondary', onclick: () => play(0.95) }, svg(ICONS.speaker), 'Play'),
            h('button', { class: 'btn secondary', onclick: () => play(0.7) }, svg(ICONS.slow), 'Slower'),
          ),
          sentence,
        );
        setTimeout(() => {
          if (!played && ctx.alive()) play(0.95);
        }, 250);
      } else if (task.mech === 'wordform') {
        parts.push(instr('Form a word from the word in capitals so that it fits the sentence'), sentence, h('span', { class: 'base-word' }, task.base));
      } else {
        parts.push(instr('Type the missing word'), sentence);
      }
      const el = h('div', { class: 'task' }, ...parts, input, hintEl);
      return typedController({
        el,
        input,
        task,
        submit,
        hintsAllowed: ctx.hintsAllowed,
        hintEl,
        answerForHint: task.answer,
        onResultExtra: (res) => fillGap(sentence, task.answer, res.outcome === 'bad' ? 'bad' : 'good'),
      });
    }

    case 'recall': {
      const hintEl = h('p', { class: 'hintline', 'aria-live': 'polite' });
      const input = answerInput('English word', () => ctx.onEnter());
      input.addEventListener('input', () => ctx.onInput());
      const el = h(
        'div',
        { class: 'task' },
        instr('Type the English word'),
        h(
          'div',
          { class: 'clue', style: { marginTop: '10px' } },
          h('div', { class: 'c' }, h('b', null, 'Meaning'), word.definitionEn),
          h('div', { class: 'c', lang: 'ru' }, h('b', null, 'Перевод'), word.translationsRu.join(', ')),
          h('div', { class: 'c' }, h('b', null, 'Situation'), word.situation),
        ),
        h('p', { class: 'tiny', style: { marginTop: '8px' } }, word.partOfSpeech),
        input,
        hintEl,
      );
      return typedController({ el, input, task, submit, hintsAllowed: ctx.hintsAllowed, hintEl, answerForHint: word.lemma });
    }

    case 'collocation': {
      const opts = optionList(task.options, (i) => ctl.choose(i));
      let head;
      let prompt = null;
      if (task.variant === 'odd') {
        head = instr('Which combination is NOT natural?');
      } else {
        head = instr('Complete the natural collocation');
        prompt = h('p', { class: 'prompt' }, gapped(task.prompt));
      }
      const ctl = choiceController(h('div', { class: 'task' }, head, prompt, opts.el), opts.buttons, task, (r) => {
        if (prompt) fillGap(prompt, task.options[r.choice], r.choice === task.answerIndex ? 'good' : 'bad');
        submit(r);
      }, 'Choose an answer');
      const orig = ctl.onResult;
      ctl.onResult = (res) => {
        orig(res);
        if (prompt) fillGap(prompt, task.options[task.answerIndex], 'good');
      };
      return ctl;
    }

    case 'nuance': {
      const sentence = h('p', { class: 'sentence' }, marked(task.sentence, { gap: true }));
      const opts = optionList(task.options, (i) => ctl.choose(i), { cls: 'duel', ariaLabel: 'Two close words' });
      const ctl = choiceController(h('div', { class: 'task' }, instr('Which word fits best here?'), sentence, opts.el), opts.buttons, task, (r) => {
        fillGap(sentence, task.options[r.choice], r.choice === task.answerIndex ? 'good' : 'bad');
        submit(r);
      }, 'Pick one');
      const orig = ctl.onResult;
      ctl.onResult = (res) => {
        orig(res);
        fillGap(sentence, task.options[task.answerIndex], 'good');
      };
      return ctl;
    }

    case 'reply': {
      const opts = optionList(task.options, (i) => ctl.choose(i), { ariaLabel: 'Replies' });
      const ctl = choiceController(
        h('div', { class: 'task' }, instr('Choose the most natural reply'), h('div', { class: 'chat', style: { marginTop: '10px' } }, task.context), opts.el),
        opts.buttons,
        task,
        submit,
        'Choose a reply',
      );
      return ctl;
    }

    case 'trio': {
      const hintEl = h('p', { class: 'hintline', 'aria-live': 'polite' });
      const input = answerInput('The word that fits all three sentences', () => ctx.onEnter());
      input.addEventListener('input', () => ctx.onInput());
      const list = h('ol', { class: 'trio' }, task.sentences.map((s) => h('li', null, marked(s, { gap: true }))));
      const el = h('div', { class: 'task' }, instr('One word fits all three sentences. Type it once.'), h('div', { style: { marginTop: '10px' } }, list), input, hintEl);
      return typedController({
        el,
        input,
        task,
        submit,
        hintsAllowed: ctx.hintsAllowed,
        hintEl,
        answerForHint: task.answer,
        onResultExtra: (res) => list.querySelectorAll('.gap').forEach((g) => {
          g.textContent = task.answer;
          g.classList.add('filled', res.outcome === 'bad' ? 'bad' : 'good');
        }),
      });
    }

    case 'rewrite': {
      const hintEl = h('p', { class: 'hintline', 'aria-live': 'polite' });
      const input = answerInput('Words for the gap', () => ctx.onEnter());
      input.addEventListener('input', () => ctx.onInput());
      const frame = h('p', { class: 'sentence' }, gapped(task.frame));
      const el = h(
        'div',
        { class: 'task' },
        instr('Complete the second sentence so that it means the same as the first. Use the word in capitals.'),
        h('p', { class: 'sentence', style: { marginTop: '10px' } }, task.original),
        h('span', { class: 'base-word' }, task.keyword),
        h('div', { style: { marginTop: '12px' } }, frame),
        input,
        hintEl,
      );
      return typedController({
        el,
        input,
        task,
        submit,
        hintsAllowed: ctx.hintsAllowed,
        hintEl,
        answerForHint: task.answer,
        onResultExtra: (res) => fillGap(frame, res.outcome === 'bad' ? task.answer : res.check === 'exact' || res.check === 'typo' ? input.value.trim() : task.answer, res.outcome === 'bad' ? 'bad' : 'good'),
      });
    }

    case 'fixit': {
      let picked = null;
      let done = false;
      const tokenEls = task.tokens.map((t, i) =>
        h('button', { class: 'tok' + (t.sp ? ' sp' : ''), 'data-i': String(i), onclick: () => pick(i) }, t.text),
      );
      const hintEl = h('p', { class: 'hintline', 'aria-live': 'polite' });
      const input = answerInput('Correct word', () => ctx.onEnter());
      input.addEventListener('input', () => ctx.onInput());
      const step2 = h('div', { hidden: true }, h('p', { class: 'instr', style: { marginTop: '14px' } }, 'Replace ', h('b', null, `“${task.wrongText}”`), ' with:'), input, hintEl);
      const el = h('div', { class: 'task' }, instr('One word is used wrongly. Tap it, then type the right word.'), h('div', { class: 'tokens', role: 'group', 'aria-label': 'Words of the sentence' }, tokenEls), step2);
      let hint = 0;
      function pick(i) {
        if (done || picked !== null) return;
        app.audio.play('tap');
        picked = i;
        tokenEls[i].classList.add('picked');
        if (i !== task.wrongIndex) {
          done = true;
          submit({ token: i });
          return;
        }
        tokenEls.forEach((b) => (b.disabled = true));
        step2.hidden = false;
        ctx.onInput();
        input.focus();
      }
      const ctl = {
        el,
        kind: 'fixit',
        get note() {
          return picked === null ? 'Tap the wrong word' : '';
        },
        get typing() {
          return picked !== null && !done;
        },
        canSubmit: () => !done && picked === task.wrongIndex && input.value.trim().length > 0,
        response: () => ({ token: picked, text: input.value, hint }),
        hintsAllowed: ctx.hintsAllowed,
        get hintLevel() {
          return hint;
        },
        hint() {
          if (done || picked !== task.wrongIndex || !ctx.hintsAllowed) return hint;
          hint += 1;
          if (hint === 1) hintEl.textContent = firstLetterHint(task.answer);
          else if (hint === 2) hintEl.textContent = partHint(task.answer);
          else {
            done = true;
            submit({ token: picked, text: input.value, hint: 3 });
          }
          return hint;
        },
        submitNow() {
          if (!ctl.canSubmit()) return;
          done = true;
          submit(ctl.response());
        },
        onResult(res) {
          done = true;
          tokenEls.forEach((b) => (b.disabled = true));
          tokenEls[task.wrongIndex].classList.add('is-wrong');
          if (res.wrongToken && picked !== null) tokenEls[picked].classList.add('shake');
          const fix = h('button', { class: 'tok is-target sp', disabled: true }, task.answer);
          tokenEls[task.wrongIndex].after(fix);
          input.disabled = true;
          if (!step2.hidden) input.classList.add(res.outcome === 'bad' ? 'bad' : 'good');
        },
        focus() {
          tokenEls[0]?.focus({ preventScroll: true });
        },
      };
      return ctl;
    }

    case 'match': {
      const labels = task.labels;
      let sel = null;
      const matched = new Set();
      const missed = new Set();
      let done = false;
      const left = task.left.map((id) => h('button', { class: 'opt', 'data-id': id, onclick: () => tap('L', id) }, h('span', { class: 'txt' }, labels[id].en)));
      const right = task.right.map((id) => h('button', { class: 'opt', 'data-id': id, lang: 'ru', onclick: () => tap('R', id) }, h('span', { class: 'txt' }, labels[id].ru)));
      const el = h(
        'div',
        { class: 'task' },
        instr('Match each word with its translation. Tap a word, then its pair.'),
        h('div', { class: 'match' }, h('div', { class: 'col', role: 'group', 'aria-label': 'English words' }, left), h('div', { class: 'col', role: 'group', 'aria-label': 'Translations', lang: 'ru' }, right)),
      );
      const btn = (side, id) => (side === 'L' ? left : right).find((b) => b.dataset.id === id);
      function tap(side, id) {
        if (done || matched.has(id + side)) return;
        app.audio.play('tap');
        if (!sel || sel.side === side) {
          if (sel) btn(sel.side, sel.id).classList.remove('selected');
          sel = { side, id };
          btn(side, id).classList.add('selected');
          return;
        }
        const a = sel;
        sel = null;
        btn(a.side, a.id).classList.remove('selected');
        const lid = a.side === 'L' ? a.id : id;
        const rid = a.side === 'R' ? a.id : id;
        if (lid === rid) {
          matched.add(lid + 'L');
          matched.add(rid + 'R');
          for (const b of [btn('L', lid), btn('R', rid)]) {
            b.classList.add('done', 'bounce');
            b.disabled = true;
          }
          if (matched.size === left.length * 2) {
            done = true;
            submit({ mistakes: [...missed] });
          }
        } else {
          missed.add(lid);
          missed.add(rid);
          for (const b of [btn('L', lid), btn('R', rid)]) {
            b.classList.remove('flash', 'shake');
            void b.offsetWidth;
            b.classList.add('flash', 'shake');
            setTimeout(() => b.classList.remove('flash'), 450);
          }
          app.audio.play('incorrect');
        }
      }
      return {
        el,
        kind: 'match',
        note: 'Match all pairs',
        onResult() {
          done = true;
          [...left, ...right].forEach((b) => {
            b.disabled = true;
            b.classList.add('done');
          });
        },
        focus() {
          left[0]?.focus({ preventScroll: true });
        },
      };
    }
    default:
      return { el: h('p', null, 'Unknown exercise'), kind: 'choice', note: '' };
  }
}

// ---------- feedback text ----------------------------------------------------------

function ruWord(word) {
  return `«${word.lemma}» — ${word.translationsRu.join(', ')}`;
}

export function feedbackFor(task, res, lex) {
  const word = lex.get(task.wordId);
  let tone = res.outcome === 'good' ? 'good' : res.outcome === 'hint' ? 'mid' : 'bad';
  let title;
  if (res.outcome === 'good') title = res.typo ? 'Correct — mind the spelling' : 'Correct';
  else if (res.alternative) title = 'Also possible';
  else if (res.formSlip) title = 'Right word, wrong form';
  else if (res.outcome === 'hint') title = 'Correct, with a hint';
  else if (res.revealed) title = 'Here is the answer';
  else if (res.wrongToken) title = 'That word is fine';
  else title = 'Not quite';

  const lines = [];
  let ru = '';
  let example = null;
  const answerLine = (label, ans) => lines.push(h('p', { class: 'ans' }, label, ' ', h('b', null, ans)));

  switch (task.mech) {
    case 'match': {
      const missed = Object.entries(res.perWord || {}).filter(([, v]) => v === 'bad').map(([id]) => lex.get(id));
      title = missed.length ? 'All matched' : 'All matched first time';
      tone = missed.length ? 'mid' : 'good';
      if (missed.length) ru = 'Повторите: ' + missed.map((w) => `${w.lemma} — ${w.translationsRu[0]}`).join('; ');
      break;
    }
    case 'intro':
    case 'quickpick': {
      const correct = task.options[task.answerIndex];
      if (res.outcome !== 'good') {
        answerLine('Answer:', correct);
        const chosenId = task.optionIds?.[res.chosen];
        if (chosenId && chosenId !== task.wordId) {
          const other = lex.get(chosenId);
          ru = `${ruWord(word)}. Вы выбрали «${task.options[res.chosen]}» — это ${task.variant === 'ru-en' ? 'слово со значением «' + other.translationsRu[0] + '»' : 'перевод слова «' + other.lemma + '»'}.`;
        } else ru = ruWord(word) + '.';
      } else ru = ruWord(word) + '.';
      example = word.examples.find((e) => e.text !== task.context)?.text;
      break;
    }
    case 'recall':
      if (res.outcome !== 'good' || res.typo) answerLine('Answer:', word.lemma);
      ru = ruWord(word) + '.';
      example = word.examples[0].text;
      break;
    case 'gap':
    case 'listen':
    case 'trio': {
      if (res.outcome !== 'good' || res.typo) answerLine('Answer:', task.answer);
      if (res.alternative) ru = `Ваш вариант тоже возможен здесь, но тренируем слово «${word.lemma}» (${word.translationsRu[0]}).`;
      else if (res.formSlip) ru = `Нужна форма «${task.answer}» — посмотрите на грамматику предложения.`;
      else if (res.outcome === 'bad' && task.mech === 'gap' && task.options && res.chosen !== undefined && res.chosen !== task.answerIndex) {
        ru = `${ruWord(word)}. «${task.options[res.chosen]}» здесь не подходит по смыслу.`;
      } else ru = ruWord(word) + '.';
      const other = word.examples.find((e) => e.text !== task.sentence && !task.sentences?.includes(e.text));
      example = task.mech === 'trio' ? null : other?.text;
      if (task.mech === 'listen') lines.push(h('p', { class: 'ex' }, unmark(task.sentence)));
      break;
    }
    case 'wordform':
      if (res.outcome !== 'good' || res.typo) answerLine('Answer:', task.answer);
      ru = `${task.base.toLowerCase()} → ${task.answer}. ${ruWord(word)}.`;
      break;
    case 'collocation':
      if (res.outcome !== 'good') answerLine(task.variant === 'odd' ? 'Not natural:' : 'Answer:', task.options[task.answerIndex]);
      ru = task.explanationRu;
      lines.push(h('p', { class: 'ex' }, 'Natural: ' + task.collocations.map(unmark).join(' · ')));
      break;
    case 'nuance':
      if (res.outcome !== 'good') answerLine('Answer:', task.options[task.answerIndex]);
      ru = task.explanationRu;
      break;
    case 'reply':
      if (res.outcome !== 'good') answerLine('Best reply:', task.options[task.answerIndex]);
      ru = task.explanationRu;
      break;
    case 'fixit':
      if (res.wrongToken) lines.push(h('p', { class: 'ans' }, 'The mistake was ', h('b', null, `“${task.wrongText}”`), ' → ', h('b', null, task.answer)));
      else if (res.outcome !== 'good' || res.typo) answerLine('Correction:', task.answer);
      lines.push(h('p', { class: 'ex' }, task.corrected));
      ru = task.explanationRu;
      break;
    case 'rewrite':
      if (res.outcome !== 'good' || res.typo) answerLine('Answer:', task.accepted.join(' / '));
      ru = task.explanationRu || ruWord(word) + '.';
      break;
    default:
      break;
  }
  return { tone, title, lines, ru, example };
}
