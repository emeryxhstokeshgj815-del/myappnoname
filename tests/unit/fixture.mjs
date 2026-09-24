// Synthetic dictionary for engine tests (not real content).
import { createLexicon } from '../../src/core/lexicon.js';

const TOPICS = ['thinking', 'people', 'work', 'society', 'science', 'education', 'culture', 'world'];
const RU = ['алфавит', 'берег', 'вершина', 'гроза', 'дорога', 'ель', 'жемчуг', 'звезда', 'игла', 'камень', 'луна', 'море', 'небо', 'облако', 'поле', 'река', 'солнце', 'трава', 'утро', 'фонарь', 'холм', 'цветок', 'чаша', 'шторм', 'щит', 'эхо', 'юла', 'ягода', 'арка', 'буря', 'вьюга', 'гавань', 'долина', 'жилище', 'залив', 'искра', 'корабль', 'лесница', 'мост', 'нора'];

export function makeData(n = 40) {
  const words = [];
  for (let i = 0; i < n; i++) {
    const lemma = 'word' + String.fromCharCode(97 + (i % 26)) + String.fromCharCode(97 + Math.floor(i / 26));
    const w = {
      id: lemma + '-n',
      lemma,
      partOfSpeech: 'noun',
      senseId: lemma + '.n.1',
      definitionEn: 'a test meaning number ' + i,
      translationsRu: [RU[i % RU.length] + (i >= RU.length ? 'ы' : '')],
      acceptedAnswers: [lemma],
      forms: [lemma, lemma + 's'],
      topic: TOPICS[i % TOPICS.length],
      register: 'neutral',
      ambiguous: i % 5 === 0,
      senseNote: '',
      situation: 'A situation number ' + i + ' described here.',
      examples: [0, 1, 2].map((k) => ({ text: `Sentence ${k} about the [[${lemma}]] number ${i}.`, distractors: ['alpha', 'beta', 'gamma'], alternatives: [] })),
      trio: { texts: [0, 1, 2].map((k) => `Trio ${k}: the [[${lemma}]] again ${i}.`), alternatives: [] },
      collocations: [`a big [[${lemma}]]`, `the [[${lemma}]] of`, `[[${lemma}]] matters`],
      badCollocation: { text: `do a [[${lemma}]]`, noteRu: 'Так не говорят.' },
      collocationTask: { prompt: `___ a ${lemma}`, answer: 'make', distractors: ['do', 'take', 'get'], explanationRu: 'Объяснение.' },
      nuance: { rival: 'other', text: `This is the [[${lemma}]] here.`, rivalForm: 'other', explanationRu: 'Разница.', reverse: { text: 'This is the [[other]] there.', targetForm: lemma, explanationRu: 'Наоборот.' } },
      fixIt: { text: `This is the [[thing]] number ${i}.`, answer: [lemma], explanationRu: 'Исправление.' },
      cefrEvidence: [{ source: 'oxford-5000', label: 'C1', pos: 'noun', granularity: 'word+pos' }],
      corpusEvidence: { source: 'wordfreq', zipf: 3 },
      sourceReferences: ['crux-editorial'],
      rank: i + 1,
    };
    if (i % 2 === 0) w.wordFormation = { base: lemma + 'ize', text: `The [[${lemma}]] grew.`, answer: [lemma] };
    if (i % 3 === 0) w.reply = { context: 'Someone says hello.', options: [`Nice ${lemma}!`, 'Wrong one.', 'Too formal one.'], answer: 0, explanationRu: 'Ответ.' };
    if (i % 4 === 0) w.rewrite = { original: 'Original sentence.', frame: 'Frame ____ here.', accepted: [`the ${lemma}`], explanationRu: 'Перефраз.' };
    words.push(w);
  }
  return { meta: { version: 'test' }, words, known: 'alpha beta gamma other thing' };
}

export function makeLex(n) {
  return createLexicon(makeData(n));
}
