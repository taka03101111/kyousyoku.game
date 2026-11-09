(function () {
  'use strict';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let audioContext, soundEnabled = false;
  let pending = [];
  function delay(fn, ms) {
    const id = setTimeout(() => { pending = pending.filter(item => item !== id); fn(); }, ms);
    pending.push(id); return id;
  }
  function clear() {
    pending.forEach(clearTimeout); pending = [];
    document.getElementById('particles').replaceChildren();
    document.getElementById('announcement').hidden = true;
  }
  function tone(kind) {
    if (!soundEnabled) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      void audioContext.resume().catch(() => {});
      const notes = kind === 'correct' ? [523, 659, 784] : kind === 'win' ? [523, 659, 784, 1047] : kind === 'wrong' ? [220, 164] : [440];
      notes.forEach((frequency, i) => {
        const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
        const start = audioContext.currentTime + i * .1;
        oscillator.type = 'sine'; oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.07, start + .015); gain.gain.exponentialRampToValueAtTime(.001, start + .22);
        oscillator.connect(gain); gain.connect(audioContext.destination); oscillator.start(start); oscillator.stop(start + .23);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      });
    } catch { /* Audio is optional; game remains playable. */ }
  }
  function announce(text, ms = 850) {
    const node = document.getElementById('announcement'); node.textContent = text; node.hidden = false;
    delay(() => { node.hidden = true; }, reduced.matches ? 350 : ms);
  }
  function particles() {
    if (reduced.matches) return;
    const container = document.getElementById('particles');
    for (let i = 0; i < 46; i++) {
      const item = document.createElement('i');
      item.style.setProperty('--x', `${Math.random() * 100}vw`);
      item.style.setProperty('--drift', `${Math.random() * 280 - 140}px`);
      item.style.setProperty('--delay', `${Math.random() * .6}s`);
      item.style.setProperty('--rotation', `${Math.random() * 720}deg`);
      item.style.background = ['#b69aff', '#63e8ef', '#f0d38c'][i % 3]; container.append(item);
    }
    delay(() => container.replaceChildren(), 3600);
  }
  window.Effects = { delay, clear, tone, announce, particles, reduced, setSound(value) { soundEnabled = value; if (value) tone('tap'); } };
})();
