import { createApp } from './ui/app.js';

function boot() {
  const root = document.getElementById('app');
  const dataEl = document.getElementById('crux-data');
  const soundEl = document.getElementById('crux-sounds');
  let data;
  let sounds = {};
  try {
    data = JSON.parse(dataEl.textContent);
  } catch (e) {
    root.textContent = 'The dictionary could not be loaded: ' + e.message;
    return;
  }
  try {
    sounds = JSON.parse(soundEl.textContent);
  } catch {
    sounds = {};
  }
  const app = createApp(root, data, sounds);
  window.__crux = app; // handy for debugging and automated tests
  app.render();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
