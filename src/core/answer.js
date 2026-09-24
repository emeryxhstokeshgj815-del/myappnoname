// Checking typed answers.
//   * normalisation: case, surrounding spaces/punctuation, repeated spaces,
//     typographic apostrophes and quotes, common contractions;
//   * exact match with the prepared accepted answers -> "exact";
//   * listed acceptable alternatives (another word that also fits) -> "alternative";
//   * a small spelling slip (Damerau-Levenshtein 1, or 2 for long words) that is
//     NOT itself a different real English word -> "typo" (counted as known);
//   * another form of the right word where a specific form is needed
//     (abolishes for abolished) -> "form" (known word, grammar slip);
//   * anything else, including a different real word that merely looks
//     similar (adopt/adapt) -> "wrong".
// Free text is never matched by substring search.

const APOS = /[‘’ʼ′`´]/g;
const QUOTES = /[“”«»"]/g;
const CONTRACTIONS = [
  [/\bcan't\b/g, 'cannot'],
  [/\bwon't\b/g, 'will not'],
  [/\bshan't\b/g, 'shall not'],
  [/n't\b/g, ' not'],
  [/'re\b/g, ' are'],
  [/'ve\b/g, ' have'],
  [/'ll\b/g, ' will'],
  [/\bi'm\b/g, 'i am'],
];

export function normalize(s) {
  let t = String(s ?? '')
    .normalize('NFC')
    .replace(APOS, "'")
    .replace(QUOTES, '')
    .replace(/[–—]/g, '-')
    .toLowerCase();
  for (const [re, rep] of CONTRACTIONS) t = t.replace(re, rep);
  t = t.replace(/\bcan not\b/g, 'cannot');
  t = t
    .replace(/[.!?,;:]+$/g, '')
    .replace(/^[\s.,;:!?'"-]+|[\s.,;:!?'"]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return t;
}

export function editDistance(a, b) {
  // Damerau-Levenshtein (optimal string alignment)
  const n = a.length;
  const m = b.length;
  if (Math.abs(n - m) > 2) return 3;
  const d = Array.from({ length: n + 1 }, (_, i) => [i, ...Array(m).fill(0)]);
  for (let j = 1; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[n][m];
}

export function typoLimit(len) {
  if (len >= 9) return 2;
  if (len >= 5) return 1;
  return 0;
}

function tokenTypo(input, target, known) {
  if (input === target) return 0;
  const lim = typoLimit(target.length);
  if (!lim) return -1;
  if (known && known.has(input)) return -1; // a different real word
  const dist = editDistance(input, target);
  return dist <= lim ? dist : -1;
}

/**
 * @param {string} input
 * @param {string[]} accepted  prepared correct answers
 * @param {{alternatives?: string[], known?: Set<string>}} opts
 */
export function checkTyped(input, accepted, opts = {}) {
  const x = normalize(input);
  if (!x) return { result: 'empty' };
  const acc = accepted.map(normalize).filter(Boolean);
  if (acc.includes(x)) return { result: 'exact', match: x };
  const alts = (opts.alternatives || []).map(normalize).filter(Boolean);
  if (alts.includes(x)) return { result: 'alternative', match: x };
  const forms = (opts.forms || []).map(normalize);
  if (forms.includes(x)) return { result: 'form', match: acc[0] };
  const known = opts.known;
  const xt = x.split(' ');
  let best = null;
  for (const a of acc) {
    const at = a.split(' ');
    if (at.length !== xt.length) continue;
    let typos = 0;
    let ok = true;
    for (let i = 0; i < at.length; i++) {
      const t = tokenTypo(xt[i], at[i], known);
      if (t < 0) {
        ok = false;
        break;
      }
      if (t > 0) typos += 1;
    }
    if (ok && typos === 1) {
      best = a;
      break;
    }
  }
  if (best) return { result: 'typo', match: best };
  return { result: 'wrong' };
}

export function firstLetterHint(word) {
  return word
    .split('')
    .map((c, i) => (i === 0 || /[\s'-]/.test(c) ? c : '_'))
    .join(' ')
    .replace(/_ /g, '_ ');
}

export function partHint(word) {
  const n = Math.max(2, Math.ceil(word.length / 2));
  return word.slice(0, n) + '…';
}
