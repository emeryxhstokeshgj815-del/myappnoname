// UI sound effects (Kenney "Interface Sounds", CC0), embedded as WAV.
// Sounds start only after a user gesture, respect the on/off switch and volume,
// are throttled so rapid taps never pile up, and fail silently: learning works
// the same without audio.

const BASE_GAIN = { tap: 0.28, correct: 0.55, incorrect: 0.42, complete: 0.55, achievement: 0.5, levelup: 0.5 };
const MIN_GAP_MS = { tap: 70, correct: 120, incorrect: 120, complete: 400, achievement: 400, levelup: 400 };
const MAX_VOICES = 3;

export function createAudio(sources, getSettings) {
  let ctx = null;
  let unlocked = false;
  let failed = false;
  const buffers = {};
  const lastAt = {};
  let voices = 0;
  const fallback = {};

  function b64ToBuf(b64) {
    const bin = atob(b64);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return buf.buffer;
  }

  async function decodeAll() {
    for (const [name, b64] of Object.entries(sources)) {
      try {
        const ab = b64ToBuf(b64);
        buffers[name] = await new Promise((res, rej) => {
          const p = ctx.decodeAudioData(ab, res, rej);
          if (p && p.then) p.then(res, rej);
        });
      } catch {
        /* one broken sound must not break the others */
      }
    }
  }

  function unlock() {
    if (unlocked || failed) return;
    unlocked = true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        ctx = new AC();
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        decodeAll();
      } else {
        for (const [name, b64] of Object.entries(sources)) fallback[name] = 'data:audio/wav;base64,' + b64;
      }
    } catch {
      failed = true;
    }
  }

  function play(name) {
    const s = getSettings();
    if (!s.sound || !unlocked || failed) return false;
    const now = performance.now();
    if (lastAt[name] && now - lastAt[name] < (MIN_GAP_MS[name] || 100)) return false;
    if (voices >= MAX_VOICES) return false;
    lastAt[name] = now;
    const vol = Math.max(0, Math.min(1, s.volume ?? 0.6)) * (BASE_GAIN[name] ?? 0.5);
    if (vol <= 0.001) return false;
    try {
      if (ctx && buffers[name]) {
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        const src = ctx.createBufferSource();
        src.buffer = buffers[name];
        const g = ctx.createGain();
        g.gain.value = vol;
        src.connect(g).connect(ctx.destination);
        voices += 1;
        src.onended = () => {
          voices = Math.max(0, voices - 1);
        };
        src.start();
        return true;
      }
      if (fallback[name]) {
        const a = new Audio(fallback[name]);
        a.volume = vol;
        voices += 1;
        a.onended = a.onerror = () => {
          voices = Math.max(0, voices - 1);
        };
        a.play().catch(() => {
          voices = Math.max(0, voices - 1);
        });
        return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  }

  const gesture = () => unlock();
  window.addEventListener('pointerdown', gesture, { capture: true, passive: true });
  window.addEventListener('keydown', gesture, { capture: true });

  return {
    play,
    unlock,
    get available() {
      return !failed && !!(window.AudioContext || window.webkitAudioContext || window.Audio);
    },
    get ready() {
      return unlocked && (!!ctx || Object.keys(fallback).length > 0);
    },
  };
}
