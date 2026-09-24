import { h, svg, clear, marked } from '../dom.js';
import { ICONS } from '../icons.js';
import { buildExercise, feedbackFor, kickerFor } from '../exercises.js';
import { submitAnswer, advance, currentTask, isSessionOver, finishSession, addSprintTask } from '../../core/engine.js';
import { MODES } from '../../core/session.js';

export function renderSession(app) {
  const session = app.state.session;
  if (!session || session.finished) {
    setTimeout(() => app.navigate(session && session.finished ? 'summary' : 'learn', { replace: true }), 0);
    return h('main', { class: 'screen' }, h('p', { class: 'muted' }, 'Loading…'));
  }
  const lex = app.lex;
  const mode = MODES[session.mode];
  const hintsAllowed = !!mode.hints;
  let alive = true;
  let phase = 'answer';
  let ex = null;
  let taskId = null;
  let enterGuard = false;
  let sprintTimer = null;
  let autoNext = null;

  // ---------- header ----------
  const fill = h('i');
  const bar = h('div', { class: 'sess-bar', role: 'progressbar', 'aria-label': 'Session progress', 'aria-valuemin': '0' }, fill);
  const count = h('span', { class: 'sess-count' });
  const timerEl = session.mode === 'sprint' ? h('span', { class: 'timer', role: 'timer', 'aria-live': 'off' }) : null;
  const soundBtn = h('button', {
    class: 'icon-btn',
    'aria-label': 'Sound effects',
    'aria-pressed': String(!!app.state.settings.sound),
    onclick: () => {
      app.state.settings.sound = !app.state.settings.sound;
      soundBtn.setAttribute('aria-pressed', String(app.state.settings.sound));
      soundBtn.replaceChildren(svg(app.state.settings.sound ? ICONS.soundOn : ICONS.soundOff));
      app.save();
    },
  }, svg(app.state.settings.sound ? ICONS.soundOn : ICONS.soundOff));
  const closeBtn = h('button', { class: 'icon-btn', 'aria-label': session.mode === 'sprint' ? 'End sprint' : 'Leave session (you can resume it later)', onclick: leave }, svg(ICONS.close));
  const header = h('header', { class: 'sess-head' }, closeBtn, bar, timerEl || count, soundBtn);

  const main = h('main', { class: 'sess-main', id: 'task-area' });
  const action = h('div', { class: 'action-inner' });
  const view = h('div', { class: 'session' }, header, main, h('footer', { class: 'action-bar' }, action));

  function updateHeader() {
    if (session.mode === 'sprint') {
      const left = Math.max(0, Math.ceil((session.endsAt - Date.now()) / 1000));
      timerEl.textContent = `0:${String(left).padStart(2, '0')}`;
      timerEl.classList.toggle('low', left <= 10);
      const pct = 100 - (left / (MODES.sprint.seconds || 60)) * 100;
      fill.style.width = pct + '%';
      bar.setAttribute('aria-valuemax', '60');
      bar.setAttribute('aria-valuenow', String(60 - left));
      return;
    }
    const total = session.tasks.length;
    const doneN = Object.keys(session.results).length;
    count.textContent = `${Math.min(session.pos + 1, total)}/${total}`;
    fill.style.width = (doneN / total) * 100 + '%';
    bar.setAttribute('aria-valuemax', String(total));
    bar.setAttribute('aria-valuenow', String(doneN));
  }

  // ---------- action bar ----------
  function setActions() {
    clear(action);
    if (phase === 'feedback') {
      if (session.mode === 'sprint') {
        action.appendChild(h('span', { class: 'note' }, 'Next question…'));
        return;
      }
      const btn = h('button', { class: 'btn main', onclick: next }, 'Continue', svg(ICONS.next));
      action.appendChild(btn);
      setTimeout(() => alive && btn.focus({ preventScroll: true }), 30);
      return;
    }
    if (!ex) return;
    if (ex.kind === 'intro' && !ex.revealed()) {
      const b = h('button', { class: 'btn main', onclick: () => { app.audio.play('tap'); ex.reveal(); setActions(); } }, 'Got it — check me');
      action.appendChild(b);
      setTimeout(() => alive && b.focus({ preventScroll: true }), 30);
      return;
    }
    const typing = ex.kind === 'typed' || (ex.kind === 'fixit' && ex.typing);
    if (typing) {
      if (hintsAllowed && ex.hintsAllowed) {
        const lvl = ex.hintLevel || 0;
        action.appendChild(
          h(
            'button',
            {
              class: 'btn secondary',
              'aria-label': lvl >= 2 ? 'Show the answer (counts as not known)' : 'Get a hint',
              onclick: () => {
                app.audio.play('tap');
                ex.hint();
                if (phase === 'answer') setActions();
              },
            },
            svg(ICONS.hint),
            lvl >= 2 ? 'Show' : 'Hint',
          ),
        );
      }
      const check = h('button', { class: 'btn main', disabled: ex.canSubmit() ? null : true, onclick: () => ex.submitNow() }, 'Check');
      action.appendChild(check);
      return;
    }
    const note = typeof ex.note === 'string' ? ex.note : '';
    action.appendChild(h('span', { class: 'note' }, note || ' '));
  }

  // ---------- flow ----------
  function show() {
    if (!alive) return;
    clearTimeout(autoNext);
    if (isSessionOver(session)) {
      finish();
      return;
    }
    let task = currentTask(session);
    if (!task && session.mode === 'sprint') task = addSprintTask(app.state, lex, session);
    if (!task) {
      finish();
      return;
    }
    taskId = task.id;
    const graded = session.results[task.id];
    updateHeader();
    clear(main);
    const feedbackEl = h('div', { class: 'feedback', 'aria-live': 'polite' });
    ex = buildExercise(task, {
      app,
      hintsAllowed,
      alive: () => alive && taskId === task.id,
      submit: (response) => submit(task, response, feedbackEl),
      onInput: () => phase === 'answer' && setActions(),
      onEnter: () => {
        if (phase === 'answer' && ex.canSubmit && ex.canSubmit()) {
          enterGuard = true;
          ex.submitNow();
        }
      },
    });
    main.appendChild(h('div', { class: 'pop-in' }, h('p', { class: 'kicker' }, kickerFor(task)), ex.el, feedbackEl));
    if (graded) {
      phase = 'feedback';
      ex.onResult(graded);
      renderFeedback(task, graded, feedbackEl);
    } else phase = 'answer';
    setActions();
    if (phase === 'answer' && ex.focus) setTimeout(() => alive && taskId === task.id && ex.focus(), 40);
  }

  function submit(task, response, feedbackEl) {
    if (!alive || phase !== 'answer' || task.id !== taskId) return;
    const { result, events } = submitAnswer(app.state, lex, session, task.id, response, { today: app.today() });
    if (!result) {
      if (events.timeUp) finish();
      return;
    }
    phase = 'feedback';
    app.audio.play(result.outcome === 'bad' ? 'incorrect' : 'correct');
    ex.onResult(result);
    renderFeedback(task, result, feedbackEl);
    updateHeader();
    setActions();
    app.save();
    app.celebrate(events);
    if (session.mode === 'sprint') {
      const delay = result.outcome === 'good' ? 600 : 1400;
      const id = task.id;
      autoNext = setTimeout(() => {
        if (alive && taskId === id && phase === 'feedback') next();
      }, delay);
    }
  }

  function renderFeedback(task, res, el) {
    const fb = feedbackFor(task, res, lex);
    const icon = fb.tone === 'good' ? ICONS.check : fb.tone === 'mid' ? ICONS.info : ICONS.cross;
    const box = h(
      'div',
      { class: `fb ${fb.tone} pop-in` },
      h('div', { class: 'head' }, svg(icon), h('span', null, fb.title), res.xp > 0 ? h('span', { class: 'xp' }, `+${res.xp} XP`) : null),
      fb.lines,
      fb.ru
        ? res.outcome === 'good' && session.mode !== 'sprint' && ['nuance', 'collocation', 'reply', 'fixit'].includes(task.mech)
          ? h('details', null, h('summary', null, 'Почему'), h('p', { class: 'ru', lang: 'ru' }, fb.ru))
          : h('p', { class: 'ru', lang: 'ru' }, fb.ru)
        : null,
      fb.example && res.outcome !== 'good' ? h('p', { class: 'ex' }, marked(fb.example)) : null,
    );
    clear(el).appendChild(box);
    if (session.mode !== 'sprint') setTimeout(() => alive && box.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 60);
  }

  function next() {
    if (!alive || phase !== 'feedback') return;
    clearTimeout(autoNext);
    app.audio.play('tap');
    advance(session);
    if (session.mode === 'sprint' && !isSessionOver(session) && session.pos >= session.tasks.length) addSprintTask(app.state, lex, session);
    app.save();
    show();
    window.scrollTo(0, 0);
  }

  function finish() {
    if (!alive) return;
    alive = false;
    cleanup();
    const summary = finishSession(app.state, lex, session, { today: app.today() });
    app.audio.play('complete');
    app.save(true);
    app.celebrate(summary.events, 700);
    app.navigate('summary', { replace: true });
  }

  function leave() {
    app.audio.play('tap');
    if (session.mode === 'sprint') {
      finish();
      return;
    }
    app.save(true);
    app.navigate('learn');
  }

  function onKey(e) {
    if (!alive) return;
    if (e.key === 'Enter') {
      if (enterGuard || e.repeat) return;
      const onControl = e.target && ['BUTTON', 'A', 'SELECT', 'TEXTAREA'].includes(e.target.tagName);
      if (onControl) return; // the focused control handles Enter itself
      // otherwise Enter runs the primary action of the action bar
      if (phase === 'feedback' && session.mode !== 'sprint') {
        e.preventDefault();
        next();
      } else if (phase === 'answer' && ex) {
        if (ex.kind === 'intro' && !ex.revealed()) {
          e.preventDefault();
          ex.reveal();
          setActions();
        } else if (ex.canSubmit && ex.canSubmit()) {
          e.preventDefault();
          enterGuard = true;
          ex.submitNow();
        }
      }
      return;
    }
    if (phase === 'answer' && ex && ex.choose && /^[1-4]$/.test(e.key) && !(e.target && e.target.tagName === 'INPUT')) {
      if (ex.kind === 'intro' && !ex.revealed()) return;
      e.preventDefault();
      ex.choose(Number(e.key) - 1);
    }
    if (e.key === 'Escape') leave();
  }
  function onKeyUp(e) {
    if (e.key === 'Enter') enterGuard = false;
  }

  function cleanup() {
    clearInterval(sprintTimer);
    clearTimeout(autoNext);
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('keyup', onKeyUp);
    app.speech.cancel();
  }

  document.addEventListener('keydown', onKey);
  document.addEventListener('keyup', onKeyUp);
  // Keep the action bar above an on-screen keyboard that overlays the page (iOS).
  const vv = window.visualViewport;
  const onViewport = () => {
    const kb = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
    view.style.setProperty('--kb', (kb > 60 ? kb : 0) + 'px');
  };
  vv?.addEventListener('resize', onViewport);
  vv?.addEventListener('scroll', onViewport);
  app.onCleanup(() => {
    alive = false;
    cleanup();
    vv?.removeEventListener('resize', onViewport);
    vv?.removeEventListener('scroll', onViewport);
  });

  if (session.mode === 'sprint') {
    sprintTimer = setInterval(() => {
      if (!alive) return;
      updateHeader();
      if (Date.now() >= session.endsAt) {
        clearInterval(sprintTimer);
        // let a last feedback show briefly, then finish
        setTimeout(() => alive && finish(), phase === 'feedback' ? 700 : 0);
      }
    }, 250);
  }

  app.ui.focusOnRender = false;
  setTimeout(() => {
    app.ui.focusOnRender = true;
  }, 0);
  show();
  return view;
}
