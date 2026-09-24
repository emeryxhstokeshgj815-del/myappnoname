// Achievements: each has a clear condition and a measurable progress value.
// `metrics(state)` derives everything from saved progress, so badges can be
// re-evaluated at any time (after import, on reload) without extra state.

import { wordState } from './srs.js';
import { streakInfo } from './streak.js';
import { levelInfo } from './xp.js';
import { CORE_MECHANICS } from './tasks.js';

export const ACHIEVEMENTS = [
  { id: 'first-session', title: 'First Steps', desc: 'Finish your first session.', metric: 'sessions', target: 1, icon: 'spark' },
  { id: 'sessions-10', title: 'Regular', desc: 'Finish 10 sessions.', metric: 'sessions', target: 10, icon: 'stack' },
  { id: 'days-7', title: 'Seven Days', desc: 'Study on 7 different days.', metric: 'studyDays', target: 7, icon: 'calendar' },
  { id: 'days-30', title: 'Thirty Days', desc: 'Study on 30 different days.', metric: 'studyDays', target: 30, icon: 'calendar2' },
  { id: 'streak-7', title: 'Week Streak', desc: 'Study 7 days in a row.', metric: 'bestStreak', target: 7, icon: 'flame' },
  { id: 'streak-30', title: 'Month Streak', desc: 'Study 30 days in a row.', metric: 'bestStreak', target: 30, icon: 'flame2' },
  { id: 'recall-50', title: 'Fifty Recalled', desc: 'Type 50 different words from memory without hints.', metric: 'recalledWords', target: 50, icon: 'keys' },
  { id: 'recall-250', title: 'Deep Recall', desc: 'Type 250 different words from memory without hints.', metric: 'recalledWords', target: 250, icon: 'keys2' },
  { id: 'long-review', title: 'Long Memory', desc: 'Remember a word after a gap of 7 days or more.', metric: 'longReviews', target: 1, icon: 'hourglass' },
  { id: 'long-review-25', title: 'Built to Last', desc: 'Pass 25 reviews after gaps of 7 days or more.', metric: 'longReviews', target: 25, icon: 'pillar' },
  { id: 'established-10', title: 'Rooted', desc: 'Bring 10 words to Established.', metric: 'established', target: 10, icon: 'sprout' },
  { id: 'established-100', title: 'Deep Roots', desc: 'Bring 100 words to Established.', metric: 'established', target: 100, icon: 'tree' },
  { id: 'fixed-20', title: 'Error Fixer', desc: 'Answer correctly 20 times on words you had missed before.', metric: 'fixed', target: 20, icon: 'wrench' },
  { id: 'all-mechanics', title: 'Full Toolkit', desc: 'Answer correctly in all 11 core exercise types.', metric: 'mechanicsUsed', target: CORE_MECHANICS.length, icon: 'grid' },
  { id: 'topics-5', title: 'Explorer', desc: 'Reach Review with 5+ words in each of 5 topics.', metric: 'topicsCovered', target: 5, icon: 'compass' },
  { id: 'sprint-15', title: 'Sprinter', desc: 'Give 15 correct answers in one Sprint.', metric: 'sprintBest', target: 15, icon: 'bolt' },
  { id: 'boss-80', title: 'Boss Beaten', desc: 'Finish a Boss Round with 80% or more.', metric: 'bossPassed', target: 1, icon: 'crown' },
  { id: 'perfect-10', title: 'Clean Sheet', desc: 'Finish a session of 10+ tasks with no mistakes and no hints.', metric: 'perfect', target: 1, icon: 'check' },
  { id: 'colloc-30', title: 'Good Company', desc: 'Get 30 Collocation Builder answers right.', metric: 'm:collocation', target: 30, icon: 'link' },
  { id: 'nuance-25', title: 'Fine Line', desc: 'Win 25 Nuance Duels.', metric: 'm:nuance', target: 25, icon: 'scales' },
  { id: 'fixit-25', title: 'Proofreader', desc: 'Fix 25 sentences in Fix It.', metric: 'm:fixit', target: 25, icon: 'pen' },
  { id: 'wordform-20', title: 'Word Family', desc: 'Get 20 Word Formation answers right.', metric: 'm:wordform', target: 20, icon: 'tree2' },
  { id: 'listen-20', title: 'Good Ear', desc: 'Get 20 Listen & Type answers right (needs an offline English voice).', metric: 'm:listen', target: 20, icon: 'ear' },
  { id: 'words-100', title: 'Hundred Words', desc: 'Meet 100 new words.', metric: 'wordsMet', target: 100, icon: 'book' },
  { id: 'answers-1000', title: 'Thousand Answers', desc: 'Give 1,000 graded answers.', metric: 'graded', target: 1000, icon: 'medal' },
  { id: 'level-5', title: 'Level 5', desc: 'Reach level 5 (a game level, not a CEFR level).', metric: 'level', target: 5, icon: 'star' },
  { id: 'comeback', title: 'Welcome Back', desc: 'Finish a session after a break of 3 days or more.', metric: 'comeback', target: 1, icon: 'door' },
];

export function metrics(state, lex, today) {
  const recs = Object.values(state.words);
  const st = state.stats;
  const streak = streakInfo(state.days, today);
  const topicCount = {};
  let established = 0;
  let recalled = 0;
  let fixed = 0;
  for (const [id, r] of Object.entries(state.words)) {
    const s = wordState(r);
    if (s === 'established') established += 1;
    if (r.rclDays.length) recalled += 1;
    fixed += r.fixed || 0;
    if ((s === 'review' || s === 'established') && lex) {
      const w = lex.get(id);
      if (w) topicCount[w.topic] = (topicCount[w.topic] || 0) + 1;
    }
  }
  const m = {
    sessions: st.sessions || 0,
    studyDays: streak.studyDays,
    bestStreak: Math.max(streak.best, st.bestStreak || 0),
    recalledWords: recalled,
    longReviews: st.longReviews || 0,
    established,
    fixed,
    mechanicsUsed: CORE_MECHANICS.filter((k) => (st.mech?.[k] || 0) > 0).length,
    topicsCovered: Object.values(topicCount).filter((n) => n >= 5).length,
    sprintBest: st.sprintBest || 0,
    bossPassed: st.bossPassed || 0,
    perfect: st.perfect || 0,
    wordsMet: recs.length,
    graded: st.graded || 0,
    level: levelInfo(st.xp || 0).level,
    comeback: st.comeback || 0,
  };
  for (const [k, v] of Object.entries(st.mech || {})) m['m:' + k] = v;
  return m;
}

export function progressOf(a, m) {
  const v = m[a.metric] || 0;
  return { value: Math.min(v, a.target), target: a.target, done: v >= a.target };
}

// Returns ids of achievements that are complete but not yet recorded.
export function newlyUnlocked(state, lex, today) {
  const m = metrics(state, lex, today);
  return ACHIEVEMENTS.filter((a) => !state.achievements[a.id] && progressOf(a, m).done).map((a) => a.id);
}
