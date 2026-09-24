// Listen & Type uses the device's own English speech voice (Web Speech API).
// Only voices that run locally (voice.localService === true) are used, so the
// exercise works offline; without one, only this exercise is switched off.
// These voices are not the sound effects: effects are embedded audio files.

export function createSpeech(getSettings) {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  let voices = [];
  const listeners = new Set();

  function refresh() {
    if (!synth) return;
    try {
      voices = synth.getVoices().filter((v) => /^en([-_]|$)/i.test(v.lang) && v.localService);
    } catch {
      voices = [];
    }
    listeners.forEach((fn) => fn(voices));
  }

  if (synth) {
    refresh();
    try {
      synth.addEventListener?.('voiceschanged', refresh);
      if (!synth.addEventListener) synth.onvoiceschanged = refresh;
    } catch {
      /* ignore */
    }
    setTimeout(refresh, 400);
    setTimeout(refresh, 1500);
  }

  function pickVoice() {
    const pref = getSettings().voice;
    return voices.find((v) => v.voiceURI === pref) || voices.find((v) => /en[-_]GB/i.test(v.lang)) || voices.find((v) => /en[-_]US/i.test(v.lang)) || voices[0];
  }

  function speak(text, { rate = 0.95, onend } = {}) {
    if (!synth || !voices.length) return false;
    try {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = pickVoice();
      if (v) {
        u.voice = v;
        u.lang = v.lang;
      }
      u.rate = rate;
      if (onend) u.onend = onend;
      synth.speak(u);
      return true;
    } catch {
      return false;
    }
  }

  function cancel() {
    try {
      synth?.cancel();
    } catch {
      /* ignore */
    }
  }

  return {
    get supported() {
      return !!synth;
    },
    get available() {
      return voices.length > 0;
    },
    get voices() {
      return voices.slice();
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    speak,
    cancel,
    refresh,
  };
}
