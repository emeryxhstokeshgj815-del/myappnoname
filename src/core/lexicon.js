// Read-only access to the embedded dictionary plus derived indexes.

export const TOPICS = [
  { id: 'thinking', label: 'Thinking & argument' },
  { id: 'people', label: 'People & relationships' },
  { id: 'work', label: 'Work & money' },
  { id: 'society', label: 'Society' },
  { id: 'science', label: 'Science & tech' },
  { id: 'education', label: 'Education' },
  { id: 'culture', label: 'Culture' },
  { id: 'world', label: 'The world around us' },
];

export const POS_SHORT = {
  noun: 'n',
  verb: 'v',
  adjective: 'adj',
  adverb: 'adv',
  preposition: 'prep',
  conjunction: 'conj',
};

const RU_STOP = new Set(['что', 'кого', 'чего', 'чем', 'быть', 'очень', 'как', 'для', 'себя', 'свой', 'который', 'делать']);

// Crude Russian stemmer, only used to keep near-synonyms out of the same
// multiple-choice question (e.g. two words both translated "отменять").
export function ruStems(translations) {
  const out = new Set();
  for (const t of translations || []) {
    const clean = t.toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/ё/g, 'е');
    for (let w of clean.split(/[^а-я-]+/)) {
      if (w.length < 4 || RU_STOP.has(w)) continue;
      w = w.replace(/(ся|сь)$/, '');
      w = w.replace(/(ировать|ывать|ивать|овать|евать|ать|ять|ить|еть|уть|ти|ость|ение|ание|ние|ство|ный|ной|ний|ий|ый|ая|ое|ые|ой|ть)$/, '');
      if (w.length >= 3) out.add(w.slice(0, 5));
    }
  }
  return out;
}

export function createLexicon(data) {
  const words = data.words;
  const byId = new Map(words.map((w) => [w.id, w]));
  const byTopic = new Map();
  const byPos = new Map();
  for (const w of words) {
    if (!byTopic.has(w.topic)) byTopic.set(w.topic, []);
    byTopic.get(w.topic).push(w);
    if (!byPos.has(w.partOfSpeech)) byPos.set(w.partOfSpeech, []);
    byPos.get(w.partOfSpeech).push(w);
  }
  const stems = new Map(words.map((w) => [w.id, ruStems(w.translationsRu)]));
  const lemmaToId = new Map(words.map((w) => [w.lemma, w.id]));

  // Words that must not appear as each other's distractors.
  const confusable = new Map(words.map((w) => [w.id, new Set()]));
  const stemIndex = new Map();
  for (const w of words) {
    for (const s of stems.get(w.id)) {
      if (!stemIndex.has(s)) stemIndex.set(s, []);
      stemIndex.get(s).push(w.id);
    }
  }
  for (const ids of stemIndex.values()) {
    if (ids.length < 2 || ids.length > 40) continue;
    for (const a of ids) for (const b of ids) if (a !== b) confusable.get(a).add(b);
  }
  const link = (a, b) => {
    if (!a || !b || a === b) return;
    confusable.get(a).add(b);
    confusable.get(b).add(a);
  };
  for (const w of words) {
    const lemmaSet = new Set([
      w.nuance?.rival,
      ...(w.examples || []).flatMap((e) => e.alternatives || []),
      ...(w.trio?.alternatives || []),
    ].filter(Boolean).map((x) => x.toLowerCase()));
    for (const l of lemmaSet) link(w.id, lemmaToId.get(l));
  }
  // same first 5 letters and part of speech = likely one family (accountable/accountability)
  const byPrefix = new Map();
  for (const w of words) {
    const k = w.partOfSpeech + ':' + w.lemma.slice(0, 5);
    if (!byPrefix.has(k)) byPrefix.set(k, []);
    byPrefix.get(k).push(w.id);
  }
  for (const ids of byPrefix.values()) {
    for (const a of ids) for (const b of ids) if (a !== b) link(a, b);
  }

  // Common English word forms (for telling a typo from a different real word);
  // built on first use to keep start-up fast.
  let knownSet = null;
  const getKnown = () => {
    if (knownSet) return knownSet;
    knownSet = new Set();
    for (const w of words) {
      for (const f of w.forms || []) knownSet.add(f.toLowerCase());
      for (const e of w.examples || []) for (const d of e.distractors || []) knownSet.add(d.toLowerCase());
    }
    if (typeof data.known === 'string') for (const k of data.known.split(' ')) if (k) knownSet.add(k);
    return knownSet;
  };

  const searchText = new Map(
    words.map((w) => [w.id, `${w.lemma} ${(w.acceptedAnswers || []).join(' ')} | ${(w.translationsRu || []).join(' ').toLowerCase()}`]),
  );

  function search(q, filters = {}, progressState = () => 'new', isFav = () => false) {
    const query = (q || '').trim().toLowerCase().replace(/ё/g, 'е');
    return words.filter((w) => {
      if (filters.topic && filters.topic !== 'all' && w.topic !== filters.topic) return false;
      if (filters.pos && filters.pos !== 'all' && w.partOfSpeech !== filters.pos) return false;
      if (filters.state && filters.state !== 'all') {
        if (filters.state === 'favorites') {
          if (!isFav(w.id)) return false;
        } else if (progressState(w.id) !== filters.state) return false;
      }
      if (!query) return true;
      return searchText.get(w.id).replace(/ё/g, 'е').includes(query);
    }).sort((a, b) => {
      if (!query) return a.lemma.localeCompare(b.lemma);
      const as = a.lemma.startsWith(query) ? 0 : a.lemma.includes(query) ? 1 : 2;
      const bs = b.lemma.startsWith(query) ? 0 : b.lemma.includes(query) ? 1 : 2;
      return as - bs || a.lemma.localeCompare(b.lemma);
    });
  }

  return {
    meta: data.meta || {},
    words,
    byId,
    byTopic,
    byPos,
    confusable,
    get known() {
      return getKnown();
    },
    search,
    get: (id) => byId.get(id),
  };
}
