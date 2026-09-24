import { h, svg } from '../dom.js';
import { ICONS, badgeSvg } from '../icons.js';
import { levelInfo } from '../../core/xp.js';
import { streakInfo } from '../../core/streak.js';
import { ACHIEVEMENTS, metrics, progressOf } from '../../core/achievements.js';
import { TOPICS } from '../../core/lexicon.js';
import { addDays, parseDay } from '../../core/dates.js';

const STATE_COLORS = { new: '#d6d0c4', learning: '#f59e0b', review: '#6366f1', established: '#15803d' };

export function renderProgress(app) {
  const st = app.state;
  const today = app.today();
  const lv = levelInfo(st.stats.xp);
  const streak = streakInfo(st.days, today);
  const total = app.lex.words.length;
  const counts = { new: 0, learning: 0, review: 0, established: 0 };
  const topicLearned = {};
  for (const w of app.lex.words) {
    const s = app.wordState(w.id);
    counts[s] += 1;
    if (s !== 'new') topicLearned[w.topic] = (topicLearned[w.topic] || 0) + 1;
  }
  let skills = { rec: [0, 0], rcl: [0, 0], ctx: [0, 0] };
  for (const r of Object.values(st.words)) for (const k of Object.keys(skills)) if (r.sk[k]) skills[k] = [skills[k][0] + r.sk[k][0], skills[k][1] + r.sk[k][1]];
  const m = metrics(st, app.lex, today);
  const days = [];
  for (let i = 13; i >= 0; i--) days.push(addDays(today, -i));
  const maxXp = Math.max(10, ...days.map((d) => st.days[d]?.graded || 0));
  const unlocked = ACHIEVEMENTS.filter((a) => st.achievements[a.id]).length;

  const skillRow = (label, [ok, fail]) => {
    const n = ok + fail;
    const pct = n ? Math.round((ok / n) * 100) : 0;
    return h('div', { class: 'skill' }, h('span', null, label), h('div', { class: 'xpbar' }, h('i', { style: { width: pct + '%' } })), h('span', { class: 'tiny' }, n ? pct + '%' : '—'));
  };

  return h(
    'main',
    { class: 'screen stack screen-enter' },
    h('div', { class: 'topbar' }, h('h1', null, 'Progress'), h('span', { class: 'spacer' }), h('a', { class: 'icon-btn', href: '#/settings', 'aria-label': 'Settings' }, svg(ICONS.settings))),
    h(
      'section',
      { class: 'card stack-sm' },
      h('div', { class: 'row' }, h('h2', null, `Level ${lv.level}`), h('span', { class: 'spacer' }), h('span', { class: 'muted small' }, `${st.stats.xp} XP`)),
      h('div', { class: 'xpbar', role: 'progressbar', 'aria-label': 'XP to next level', 'aria-valuemin': 0, 'aria-valuemax': lv.span, 'aria-valuenow': lv.into }, h('i', { style: { width: Math.round(lv.pct * 100) + '%' } })),
      h('p', { class: 'tiny' }, `${lv.to - st.stats.xp} XP to level ${lv.level + 1}. Game levels measure practice, not your CEFR level.`),
    ),
    h(
      'section',
      { class: 'today' },
      h('div', { class: 'stat' }, h('div', { class: 'num' }, String(streak.current)), h('div', { class: 'lab' }, `day streak · best ${Math.max(streak.best, st.stats.bestStreak || 0)}`)),
      h('div', { class: 'stat' }, h('div', { class: 'num' }, String(streak.studyDays)), h('div', { class: 'lab' }, 'study days')),
    ),
    h('p', { class: 'tiny' }, streak.todayDone ? 'Today counts as a study day.' : 'A day counts after one finished session or 10 answers.'),
    h(
      'section',
      { class: 'card' },
      h('h2', null, 'Words'),
      h('div', { class: 'states', role: 'img', 'aria-label': `New ${counts.new}, Learning ${counts.learning}, Review ${counts.review}, Established ${counts.established}` }, ['established', 'review', 'learning', 'new'].map((k) => h('i', { style: { width: (counts[k] / total) * 100 + '%', background: STATE_COLORS[k] } }))),
      h('div', { class: 'legend' }, ['new', 'learning', 'review', 'established'].map((k) => h('span', { style: { '--c': STATE_COLORS[k] } }, `${k[0].toUpperCase() + k.slice(1)} ${counts[k]}`))),
      h('p', { class: 'tiny', style: { marginTop: '10px' } }, 'Established = correct on at least 3 different days, typed from memory on 2 of them, and remembered after a gap of 7+ days.'),
    ),
    h('section', { class: 'card stack-sm' }, h('h2', null, 'Skills'), skillRow('Recognition', skills.rec), skillRow('Recall', skills.rcl), skillRow('In context', skills.ctx)),
    h(
      'section',
      { class: 'card stack-sm' },
      h('h2', null, 'Last 14 days'),
      h('div', { class: 'activity', role: 'img', 'aria-label': 'Answers per day for the last 14 days' }, days.map((d) => h('i', { class: d === today ? 'today' : '', title: `${parseDay(d).toDateString()}: ${st.days[d]?.graded || 0} answers`, style: { height: Math.max(4, ((st.days[d]?.graded || 0) / maxXp) * 100) + '%' } }))),
    ),
    h(
      'section',
      { class: 'card stack-sm' },
      h('h2', null, 'Topics'),
      TOPICS.map((t) => {
        const n = (app.lex.byTopic.get(t.id) || []).length;
        const got = topicLearned[t.id] || 0;
        return h('div', { class: 'skill' }, h('span', { class: 'small' }, t.label), h('div', { class: 'xpbar' }, h('i', { style: { width: (n ? (got / n) * 100 : 0) + '%' } })), h('span', { class: 'tiny' }, `${got}/${n}`));
      }),
    ),
    h('div', { class: 'row' }, h('h2', null, 'Achievements'), h('span', { class: 'spacer' }), h('span', { class: 'muted small' }, `${unlocked}/${ACHIEVEMENTS.length}`)),
    h(
      'div',
      { class: 'badges' },
      ACHIEVEMENTS.map((a) => {
        const p = progressOf(a, m);
        const got = st.achievements[a.id];
        return h(
          'div',
          { class: 'badge' + (got ? '' : ' locked') },
          h('span', { html: badgeSvg(a.icon, !!got) }),
          h(
            'div',
            { style: { minWidth: 0, flex: 1 } },
            h('div', { class: 't' }, a.title),
            h('div', { class: 'd' }, a.desc),
            got
              ? h('div', { class: 'tiny' }, 'Unlocked ' + new Date(got).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }))
              : h('div', { class: 'p' }, h('div', { class: 'xpbar', role: 'progressbar', 'aria-label': `${a.title} progress`, 'aria-valuemin': 0, 'aria-valuemax': p.target, 'aria-valuenow': p.value }, h('i', { style: { width: (p.value / p.target) * 100 + '%' } })), h('div', { class: 'tiny' }, `${p.value}/${p.target}`)),
          ),
        );
      }),
    ),
  );
}
