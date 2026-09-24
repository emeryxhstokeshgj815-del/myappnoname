// Exercise ("mechanic") definitions and task builders. A task is a plain,
// serialisable object: everything needed to render and check it is decided
// when the task is created (options, order, accepted answers), so a reload
// shows exactly the same question and cannot be used to re-roll it.

export const MECHANICS = {
  quickpick: { label: 'Quick Pick', skills: ['rec'], active: false },
  recall: { label: 'Recall', skills: ['rcl'], active: true },
  gap: { label: 'Context Gap', skills: ['ctx'], active: false },
  collocation: { label: 'Collocation Builder', skills: ['ctx'], active: false },
  wordform: { label: 'Word Formation', skills: ['rcl', 'ctx'], active: true },
  nuance: { label: 'Nuance Duel', skills: ['ctx', 'rec'], active: false },
  fixit: { label: 'Fix It', skills: ['ctx', 'rcl'], active: true },
  trio: { label: 'One Word, Three Contexts', skills: ['rcl', 'ctx'], active: true },
  reply: { label: 'Real-Life Reply', skills: ['ctx', 'rec'], active: false },
  match: { label: 'Match', skills: ['rec'], active: false, practice: true },
  rewrite: { label: 'Rewrite', skills: ['rcl', 'ctx'], active: true },
  listen: { label: 'Listen & Type', skills: ['rcl'], active: true, needsVoice: true },
};

export const CORE_MECHANICS = ['quickpick', 'recall', 'gap', 'collocation', 'wordform', 'nuance', 'fixit', 'trio', 'reply', 'match', 'rewrite'];
export const PRODUCTION = new Set(['recall', 'wordform', 'fixit', 'trio', 'rewrite', 'listen']);
export const CHOICE_ONLY = new Set(['quickpick', 'collocation', 'nuance', 'reply', 'match']);

const MARK = /\[\[([^\]]+)\]\]/;

export function splitMarked(text) {
  const m = MARK.exec(text);
  if (!m) return { before: text, target: '', after: '' };
  return { before: text.slice(0, m.index), target: m[1], after: text.slice(m.index + m[0].length) };
}

export function unmark(text) {
  return String(text || '').replace(/\[\[([^\]]+)\]\]/g, '$1');
}

export function hasMechanic(word, mech) {
  switch (mech) {
    case 'quickpick':
    case 'recall':
    case 'gap':
    case 'match':
    case 'listen':
      return true;
    case 'collocation':
      return !!word.collocationTask || (!!word.badCollocation && (word.collocations || []).length >= 3);
    case 'wordform':
      return !!word.wordFormation;
    case 'nuance':
      return !!word.nuance;
    case 'fixit':
      return !!word.fixIt;
    case 'trio':
      return !!word.trio && word.trio.texts.length === 3;
    case 'reply':
      return !!word.reply;
    case 'rewrite':
      return !!word.rewrite;
    default:
      return false;
  }
}

function contextKeyFor(word, i) {
  return `${word.id}#ex${i}`;
}

// Pick the example sentence the learner has seen least recently.
function pickExample(word, rec, rng, avoid = []) {
  const recent = rec?.ctx || [];
  const idx = word.examples.map((_, i) => i).filter((i) => !avoid.includes(i));
  const fresh = idx.filter((i) => !recent.includes(contextKeyFor(word, i)));
  const pool = fresh.length ? fresh : idx.sort((a, b) => recent.indexOf(contextKeyFor(word, b)) - recent.indexOf(contextKeyFor(word, a)));
  return fresh.length ? rng.pick(pool) : pool[0];
}

// Distractor words for translation / matching drills.
export function pickOtherWords(lex, word, n, rng, { samePos = true, exclude = [] } = {}) {
  const conf = lex.confusable.get(word.id) || new Set();
  const banned = new Set([word.id, ...exclude]);
  const usedLabels = new Set([ruLabel(word)]);
  const pool = samePos ? lex.byPos.get(word.partOfSpeech) || lex.words : lex.words;
  const sameTopic = rng.shuffle(pool.filter((w) => w.topic === word.topic));
  const rest = rng.shuffle(pool);
  const out = [];
  const tryAdd = (w) => {
    if (out.length >= n || banned.has(w.id) || conf.has(w.id)) return;
    for (const o of out) if (lex.confusable.get(o.id)?.has(w.id)) return;
    const lab = ruLabel(w);
    if (usedLabels.has(lab)) return;
    usedLabels.add(lab);
    banned.add(w.id);
    out.push(w);
  };
  for (const w of sameTopic.slice(0, 12)) {
    if (out.length >= 1) break;
    tryAdd(w);
  }
  for (const w of rest) tryAdd(w);
  if (out.length < n) for (const w of rng.shuffle(lex.words)) tryAdd(w);
  return out;
}

export function ruLabel(word) {
  return word.translationsRu.slice(0, 2).join(', ');
}

function withAnswer(options, correctIndex) {
  return { options, answerIndex: correctIndex };
}

function shuffleWithAnswer(rng, correct, others) {
  const all = rng.shuffle([correct, ...others]);
  return withAnswer(all, all.indexOf(correct));
}

/**
 * Build a task for `word` with mechanic `mech`.
 * ctx: { lex, rng, rec, variant, prevCtxKey, voice, pool }
 */
export function buildTask(mech, word, ctx) {
  const { lex, rng, rec } = ctx;
  const base = { mech, wordId: word.id, skills: MECHANICS[mech].skills.slice(), active: MECHANICS[mech].active };
  switch (mech) {
    case 'quickpick': {
      const dir = ctx.variant || (ctx.dirPref === 'en-ru' || ctx.dirPref === 'ru-en' ? ctx.dirPref : rng.next() < 0.5 ? 'en-ru' : 'ru-en');
      const others = pickOtherWords(lex, word, 3, rng);
      const t = { ...base, variant: dir, contextKey: `${word.id}#qp-${dir}` };
      if (dir === 'en-ru') {
        const o = shuffleWithAnswer(rng, word.id, others.map((w) => w.id));
        t.prompt = word.lemma;
        t.options = o.options.map((id) => ruLabel(lex.get(id)));
        t.optionIds = o.options;
        t.answerIndex = o.answerIndex;
        if (word.ambiguous || ctx.showContext) {
          const i = pickExample(word, rec, rng);
          t.context = word.examples[i].text;
        }
      } else {
        const o = shuffleWithAnswer(rng, word.id, others.map((w) => w.id));
        t.prompt = ruLabel(word);
        t.options = o.options.map((id) => lex.get(id).lemma);
        t.optionIds = o.options;
        t.answerIndex = o.answerIndex;
      }
      return t;
    }
    case 'recall': {
      return {
        ...base,
        contextKey: `${word.id}#recall`,
        accepted: uniq([word.lemma, ...(word.acceptedAnswers || []), ...(word.forms || [])]),
        answer: word.lemma,
      };
    }
    case 'gap': {
      const i = pickExample(word, rec, rng);
      const ex = word.examples[i];
      const target = splitMarked(ex.text).target;
      const typed = ctx.variant ? ctx.variant === 'typed' : !!ctx.preferTyped;
      const t = {
        ...base,
        variant: typed ? 'typed' : 'choice',
        contextKey: contextKeyFor(word, i),
        sentence: ex.text,
        answer: target,
        accepted: [target],
        alternatives: ex.alternatives || [],
        forms: word.forms || [],
      };
      if (typed) {
        t.active = true;
        t.skills = ['ctx', 'rcl'];
      } else {
        const o = shuffleWithAnswer(rng, target, ex.distractors);
        t.options = o.options;
        t.answerIndex = o.answerIndex;
      }
      return t;
    }
    case 'collocation': {
      const canOdd = !!word.badCollocation && (word.collocations || []).length >= 3;
      const canComplete = !!word.collocationTask;
      let variant = ctx.variant;
      if (!variant || (variant === 'odd' && !canOdd) || (variant === 'complete' && !canComplete)) {
        variant = canComplete && (!canOdd || rng.next() < 0.6) ? 'complete' : 'odd';
      }
      if (variant === 'complete') {
        const c = word.collocationTask;
        const o = shuffleWithAnswer(rng, c.answer, c.distractors);
        return {
          ...base,
          variant,
          contextKey: `${word.id}#col`,
          prompt: c.prompt,
          options: o.options,
          answerIndex: o.answerIndex,
          explanationRu: c.explanationRu,
          collocations: word.collocations,
        };
      }
      const good = rng.shuffle(word.collocations).slice(0, 3).map(unmark);
      const bad = unmark(word.badCollocation.text);
      const o = shuffleWithAnswer(rng, bad, good);
      return {
        ...base,
        variant: 'odd',
        contextKey: `${word.id}#odd`,
        options: o.options,
        answerIndex: o.answerIndex,
        explanationRu: word.badCollocation.noteRu,
        collocations: word.collocations,
      };
    }
    case 'wordform': {
      const wf = word.wordFormation;
      return {
        ...base,
        contextKey: `${word.id}#wf`,
        sentence: wf.text,
        base: wf.base.toUpperCase(),
        answer: wf.answer[0],
        accepted: wf.answer,
      };
    }
    case 'nuance': {
      const n = word.nuance;
      const reverse = !!n.reverse && (ctx.variant ? ctx.variant === 'reverse' : rng.next() < 0.35);
      if (reverse) {
        const target = splitMarked(n.reverse.text).target;
        const o = shuffleWithAnswer(rng, target, [n.reverse.targetForm]);
        return {
          ...base,
          variant: 'reverse',
          contextKey: `${word.id}#nur`,
          sentence: n.reverse.text,
          options: o.options,
          answerIndex: o.answerIndex,
          rival: n.rival,
          explanationRu: n.reverse.explanationRu,
        };
      }
      const target = splitMarked(n.text).target;
      const o = shuffleWithAnswer(rng, target, [n.rivalForm]);
      return {
        ...base,
        variant: 'standard',
        contextKey: `${word.id}#nu`,
        sentence: n.text,
        options: o.options,
        answerIndex: o.answerIndex,
        rival: n.rival,
        explanationRu: n.explanationRu,
      };
    }
    case 'fixit': {
      const f = word.fixIt;
      const { before, target, after } = splitMarked(f.text);
      const tokens = [
        ...tokenize(before),
        { text: target, wrong: true, sp: /\s$/.test(before) },
        ...tokenize(after, /^\s/.test(after)),
      ];
      if (tokens.length) tokens[0].sp = false;
      return {
        ...base,
        contextKey: `${word.id}#fx`,
        tokens,
        wrongIndex: tokens.findIndex((t) => t.wrong),
        wrongText: target,
        accepted: f.answer,
        answer: f.answer[0],
        forms: word.forms || [],
        explanationRu: f.explanationRu,
        corrected: f.text.replace(MARK, f.answer[0]),
      };
    }
    case 'trio': {
      const texts = word.trio.texts;
      const target = splitMarked(texts[0]).target;
      return {
        ...base,
        contextKey: `${word.id}#trio`,
        sentences: rng.shuffle(texts),
        answer: target,
        accepted: [target],
        alternatives: word.trio.alternatives || [],
        forms: word.forms || [],
      };
    }
    case 'reply': {
      const r = word.reply;
      const correct = r.options[r.answer];
      const others = r.options.filter((_, i) => i !== r.answer);
      const o = shuffleWithAnswer(rng, correct, others);
      return {
        ...base,
        contextKey: `${word.id}#rp`,
        context: r.context,
        options: o.options,
        answerIndex: o.answerIndex,
        explanationRu: r.explanationRu,
      };
    }
    case 'rewrite': {
      const r = word.rewrite;
      return {
        ...base,
        contextKey: `${word.id}#rw`,
        original: r.original,
        keyword: word.lemma.toUpperCase(),
        frame: r.frame,
        accepted: r.accepted,
        answer: r.accepted[0],
        explanationRu: r.explanationRu || '',
      };
    }
    case 'listen': {
      const i = pickExample(word, rec, rng);
      const ex = word.examples[i];
      const target = splitMarked(ex.text).target;
      return {
        ...base,
        contextKey: contextKeyFor(word, i) + ':listen',
        sentence: ex.text,
        speak: unmark(ex.text),
        answer: target,
        accepted: [target],
        forms: word.forms || [],
      };
    }
    case 'match': {
      const pool = (ctx.pool || []).filter((id) => id !== word.id).map((id) => lex.get(id)).filter(Boolean);
      const chosen = [word];
      const conflict = (w) => chosen.some((c) => c.id === w.id || lex.confusable.get(c.id)?.has(w.id) || ruLabel(c) === ruLabel(w));
      for (const w of rng.shuffle(pool)) {
        if (chosen.length >= 4) break;
        if (!conflict(w)) chosen.push(w);
      }
      if (chosen.length < 4) {
        for (const w of pickOtherWords(lex, word, 6, rng, { samePos: false })) {
          if (chosen.length >= 4) break;
          if (!conflict(w)) chosen.push(w);
        }
      }
      const left = rng.shuffle(chosen.map((w) => w.id));
      const right = rng.shuffle(chosen.map((w) => w.id));
      return {
        ...base,
        contextKey: `${word.id}#match`,
        wordIds: chosen.map((w) => w.id),
        left,
        right,
        labels: Object.fromEntries(chosen.map((w) => [w.id, { en: w.lemma, ru: ruLabel(w) }])),
      };
    }
    default:
      throw new Error('unknown mechanic ' + mech);
  }
}

// Split into word tokens; `sp` tells whether a space precedes the token.
export function tokenize(text, leadingSpace = true) {
  const out = [];
  const re = /(\s+)|([^\s]+)/g;
  let m;
  let space = leadingSpace;
  while ((m = re.exec(text))) {
    if (m[1]) space = true;
    else {
      out.push({ text: m[2], sp: space });
      space = false;
    }
  }
  return out;
}

function uniq(a) {
  return [...new Set(a.map((x) => String(x).toLowerCase()))];
}
