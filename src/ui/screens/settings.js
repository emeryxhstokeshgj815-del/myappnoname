import { h, svg, download } from '../dom.js';
import { ICONS } from '../icons.js';
import { exportJson, importJson, exportTsv } from '../../core/store.js';

export function renderSettings(app) {
  const st = app.state;
  const s = st.settings;
  const rerender = () => {
    app.ui.focusOnRender = false;
    app.render();
    app.ui.focusOnRender = true;
  };
  const set = (k, v) => {
    s[k] = v;
    app.save();
    rerender();
  };
  const seg = (labelId, key, options) =>
    h(
      'div',
      { class: 'seg', role: 'radiogroup', 'aria-labelledby': labelId },
      options.map(([v, l]) =>
        h('button', { role: 'radio', 'aria-checked': String(s[key] === v), onclick: () => { app.audio.play('tap'); set(key, v); } }, l),
      ),
    );

  const importStatus = h('p', { class: 'small', role: 'status', 'aria-live': 'polite' });
  const fileInput = h('input', {
    type: 'file',
    accept: 'application/json,.json',
    class: 'sr-only',
    id: 'import-file',
    onchange: async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      let text = '';
      try {
        text = await file.text();
      } catch {
        importStatus.textContent = 'The file could not be read. Your current progress is unchanged.';
        return;
      }
      const res = importJson(text, new Set(app.lex.words.map((w) => w.id)));
      if (!res.ok) {
        importStatus.textContent = 'Import failed: ' + res.errors.join(' ') + ' Your current progress is unchanged.';
        importStatus.style.color = 'var(--bad)';
        e.target.value = '';
        return;
      }
      app.replaceState(res.state);
      app.toast({ title: 'Progress imported', sub: `${Object.keys(res.state.words).length} words${res.dropped ? `, ${res.dropped} unknown skipped` : ''}`, icon: 'check' });
      e.target.value = '';
      rerender();
    },
  });

  let confirmOpen = app.ui.resetConfirm || false;
  const resetBlock = confirmOpen
    ? h(
        'div',
        { class: 'confirm-box stack-sm', role: 'group', 'aria-label': 'Confirm reset' },
        h('p', null, h('b', null, 'Delete all progress?'), ' Words, XP, streak and achievements on this device will be erased. Settings stay. Consider exporting first.'),
        h(
          'div',
          { class: 'row wrap' },
          h('button', { class: 'btn danger', onclick: () => { app.resetProgress(); app.ui.resetConfirm = false; app.toast({ title: 'Progress deleted', icon: 'trash' }); rerender(); } }, svg(ICONS.trash), 'Delete progress'),
          h('button', { class: 'btn secondary', 'data-autofocus': true, onclick: () => { app.ui.resetConfirm = false; rerender(); } }, 'Cancel'),
        ),
      )
    : h('button', { class: 'btn secondary block', onclick: () => { app.ui.resetConfirm = true; rerender(); } }, svg(ICONS.trash), 'Reset progress…');

  const voices = app.speech.voices;
  const exportScope = app.ui.exportScope || 'all';
  const wordsFor = (scope) => {
    if (scope === 'favorites') return app.lex.words.filter((w) => app.isFav(w.id));
    if (scope === 'studied') return app.lex.words.filter((w) => app.state.words[w.id]);
    return app.lex.words;
  };
  const stamp = () => app.today();

  return h(
    'main',
    { class: 'screen stack screen-enter' },
    h('div', { class: 'topbar' }, h('a', { class: 'icon-btn', href: '#/learn', 'aria-label': 'Back' }, svg(ICONS.back)), h('h1', null, 'Settings')),
    h(
      'section',
      { class: 'card stack-sm' },
      h('h2', null, 'Sound'),
      h(
        'div',
        { class: 'setting' },
        h('span', { class: 'grow', id: 'snd' }, 'Sound effects', h('span', { class: 'tiny', style: { display: 'block' } }, app.audio.available ? 'Kenney "Interface Sounds" (CC0), stored inside the app.' : 'Audio is not supported in this browser.')),
        h('button', { class: 'switch', role: 'switch', 'aria-checked': String(!!s.sound), 'aria-labelledby': 'snd', onclick: () => { set('sound', !s.sound); if (s.sound) app.audio.play('correct'); } }),
      ),
      h(
        'label',
        { class: 'setting' },
        h('span', { style: { minWidth: '72px' } }, 'Volume'),
        h('input', {
          type: 'range',
          min: '0',
          max: '1',
          step: '0.05',
          value: String(s.volume),
          'aria-label': 'Sound volume',
          disabled: !s.sound ? true : null,
          onchange: (e) => {
            s.volume = Number(e.target.value);
            app.save();
            app.audio.play('correct');
          },
        }),
      ),
    ),
    h(
      'section',
      { class: 'card stack-sm' },
      h('h2', null, 'Learning'),
      h('div', { class: 'setting' }, h('span', { class: 'grow', id: 'npd' }, 'New words per day'), seg('npd', 'newPerDay', [[5, '5'], [10, '10'], [15, '15'], [20, '20']])),
      h('div', { class: 'setting' }, h('span', { class: 'grow', id: 'dl' }, 'Session length'), seg('dl', 'length', [[10, '10'], [20, '20']])),
      h('div', { class: 'setting' }, h('span', { class: 'grow', id: 'qd' }, 'Quick Pick direction'), seg('qd', 'quickDir', [['en-ru', 'EN→RU'], ['ru-en', 'RU→EN'], ['mixed', 'Mixed']])),
      h(
        'div',
        { class: 'setting' },
        h('span', { class: 'grow' }, 'Listen & Type voice', h('span', { class: 'tiny', style: { display: 'block' } }, voices.length ? 'Offline voices on this device. Speech is used only for this exercise.' : 'No offline English voice found, so Listen & Type is switched off. You can install an English voice in your system settings.')),
      ),
      voices.length
        ? h(
            'label',
            null,
            h('span', { class: 'sr-only' }, 'Voice'),
            h(
              'select',
              { class: 'sel', onchange: (e) => { s.voice = e.target.value; app.save(); app.speech.speak('Nevertheless, the results were encouraging.'); } },
              voices.map((v) => h('option', { value: v.voiceURI, selected: v.voiceURI === s.voice ? true : null }, `${v.name} (${v.lang})`)),
            ),
          )
        : null,
      h('a', { class: 'link-row', href: '#/info/learning' }, svg(ICONS.info, 'icon lead'), h('span', { class: 'spacer' }, 'How learning works', h('span', { class: 'sub' }, 'Intervals, word states, XP rules')), svg(ICONS.next)),
    ),
    h(
      'section',
      { class: 'card stack-sm' },
      h('h2', null, 'Your data'),
      h('p', { class: 'small muted' }, app.storage.available ? 'Progress is saved on this device after every answer.' : 'Storage is unavailable: progress lives only in this tab.'),
      h('button', { class: 'btn secondary block', onclick: () => download(`crux-progress-${stamp()}.json`, exportJson(app.state)) }, svg(ICONS.download), 'Export progress (JSON)'),
      h('label', { class: 'btn secondary block file-label', for: 'import-file', tabindex: '0', role: 'button', onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } } }, svg(ICONS.upload), 'Import progress (JSON)'),
      fileInput,
      importStatus,
      h('h3', { id: 'ex' }, 'Export words for Anki or Quizlet'),
      h(
        'div',
        { class: 'seg block', role: 'radiogroup', 'aria-labelledby': 'ex' },
        [['all', 'All'], ['studied', 'Studied'], ['favorites', 'Favorites']].map(([v, l]) => h('button', { role: 'radio', 'aria-checked': String(exportScope === v), onclick: () => { app.ui.exportScope = v; rerender(); } }, l)),
      ),
      h(
        'div',
        { class: 'row wrap' },
        h('button', { class: 'btn secondary', onclick: () => { const ws = wordsFor(exportScope); if (!ws.length) { app.toast({ title: 'No words in this list', icon: 'info' }); return; } download(`crux-${exportScope}-anki-${stamp()}.tsv`, exportTsv(ws, 'anki'), 'text/tab-separated-values'); } }, svg(ICONS.download), 'Anki TSV'),
        h('button', { class: 'btn secondary', onclick: () => { const ws = wordsFor(exportScope); if (!ws.length) { app.toast({ title: 'No words in this list', icon: 'info' }); return; } download(`crux-${exportScope}-quizlet-${stamp()}.tsv`, exportTsv(ws, 'quizlet'), 'text/tab-separated-values'); } }, svg(ICONS.download), 'Quizlet TSV'),
      ),
      h('p', { class: 'tiny' }, 'Anki: word · translation and definition · example · part of speech. Quizlet: term · definition.'),
      resetBlock,
    ),
    h('a', { class: 'link-row', href: '#/info/sources' }, svg(ICONS.library, 'icon lead'), h('span', { class: 'spacer' }, 'Sources & licenses', h('span', { class: 'sub' }, 'Word lists, corpus, sounds')), svg(ICONS.next)),
  );
}
