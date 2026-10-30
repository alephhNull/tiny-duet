// Song playback through an <audio> element (plays even when an iPhone is on silent),
// with a smooth clock kept in sync with it. Small music-box sounds are synthesized.
export class Sound {
  constructor(url) {
    this.el = new Audio(url);
    this.el.preload = 'auto';
    this.el.playsInline = true;
    this.el.setAttribute('playsinline', '');
    this.playing = false;
    this.base = 0;
    this.perf = 0;
    this.frozen = 0;
    this.unlocked = false;
    this.ctx = null;
    this.hidden = false;
  }

  // must run inside a user gesture
  unlock() {
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch (e) {}
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        this.ctx = new AC();
        this.out = this.ctx.createGain();
        this.out.gain.value = 0.55;
        this.out.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    if (!this.unlocked && !this.playing) {
      this.unlocked = true;
      const el = this.el;
      el.muted = true;
      const p = el.play();
      if (p && p.then) {
        p.then(() => {
          if (!this.playing) {
            el.pause();
            el.currentTime = 0;
          }
          el.muted = false;
        }).catch(() => {
          el.muted = false;
          this.unlocked = false;
        });
      }
    }
  }

  play(from = 0) {
    const el = this.el;
    try {
      el.currentTime = from;
    } catch (e) {}
    el.muted = false;
    el.volume = 1;
    const p = el.play();
    if (p && p.catch) p.catch(() => {});
    this.playing = true;
    this.base = from;
    this.perf = performance.now();
  }

  // retry inside a later gesture if the browser refused the first play()
  ensurePlaying() {
    if (this.playing && !this.hidden && this.el.paused && !this.el.ended && this.time() < 125) {
      const p = this.el.play();
      if (p && p.catch) p.catch(() => {});
    }
  }

  stop() {
    this.el.pause();
    this.playing = false;
  }

  setHidden(h) {
    if (h === this.hidden) return;
    this.hidden = h;
    if (!this.playing) return;
    if (h) {
      this.frozen = this.time();
      this.el.pause();
    } else {
      this.base = this.frozen;
      this.perf = performance.now();
      const p = this.el.play();
      if (p && p.catch) p.catch(() => {});
    }
  }

  time() {
    if (!this.playing) return this.frozen;
    if (this.hidden) return this.frozen;
    const now = performance.now();
    let t = this.base + (now - this.perf) / 1000;
    const el = this.el;
    if (!el.paused && el.readyState >= 2 && !el.seeking) {
      const d = el.currentTime - t;
      if (Math.abs(d) > 0.3) {
        this.base = el.currentTime;
        this.perf = now;
        t = el.currentTime;
      } else {
        this.base += d * 0.04;
      }
    }
    this.frozen = t;
    return t;
  }

  // ---- synthesized music-box sounds ----
  tick(strength = 1) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime;
    const len = 0.03;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 6);
    const src = c.createBufferSource();
    src.buffer = buf;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3200 + Math.random() * 600;
    bp.Q.value = 4;
    const g = c.createGain();
    g.gain.value = 0.9 * strength;
    src.connect(bp).connect(g).connect(this.out);
    src.start(t);
    // a tiny wooden knock under the click
    const o = c.createOscillator();
    o.frequency.setValueAtTime(420, t);
    o.frequency.exponentialRampToValueAtTime(160, t + 0.05);
    const og = c.createGain();
    og.gain.setValueAtTime(0.25 * strength, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    o.connect(og).connect(this.out);
    o.start(t);
    o.stop(t + 0.08);
  }

  chime(freq, when = 0, vol = 0.35) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + when;
    const parts = [
      [1, 1, 1.6],
      [2.0, 0.35, 0.9],
      [3.01, 0.12, 0.5],
      [5.4, 0.06, 0.25],
    ];
    for (const [m, a, dec] of parts) {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq * m;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol * a, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      o.connect(g).connect(this.out);
      o.start(t);
      o.stop(t + dec + 0.05);
    }
  }
}
