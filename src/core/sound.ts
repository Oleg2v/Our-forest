/* ==========================================================================
   Sound — "צלילי היער". CONTRACT (owned by the chrome agent; keep this API).
   Off by default; one toggle in the header; choice remembered (storage, try/catch).
   Everything quiet and soft. Must never throw and must no-op while off.

   Implementation: 100% procedural WebAudio — no audio files, no network.
   · a quiet ambient bed that follows the time of day in Israel
     (morning birds · day cicadas · evening crickets · night near-silence + a rare owl · rain · memorial)
   · one-shot effects: filtered noise, FM chirps, resonant "wooden" clicks, bell partials
   · a small procedural reverb ("the forest") shared by birds, bells and sparkles
   The AudioContext is created lazily on the first user gesture after sound is on,
   suspended while the tab is hidden, and released (suspended) when sound is off.
   ========================================================================== */
import { storage } from './storage';
import { env } from './env';
import { bus } from './bus';
import { dayPeriod } from './format';

export type SoundName =
  | 'hover'      // soft wooden click on hover
  | 'click'      // UI click
  | 'rustle'     // leaves rustle (tree tap, menu)
  | 'water'      // short pour
  | 'absorb'     // water soaking into soil
  | 'crack'      // seed cracking (dry, quiet)
  | 'paper'      // paper rustle (herbarium, certificate)
  | 'sparkle'    // engraving sparks / glowing leaf
  | 'chime'      // success / tree born
  | 'pop'        // sprout pops out (footer, contact)
  | 'whoosh'     // page transition
  | 'bird';      // single bird call
export type Ambient = 'forest' | 'morning' | 'day' | 'evening' | 'night' | 'rain' | 'memorial' | null;
export interface LoopHandle { setVolume(v: number): void; stop(fadeSec?: number): void }

/* ------------------------------------------------------------------ state */
const KEY = 'sound:on';
let on = storage.get<boolean>(KEY, false) === true;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let fxBus: GainNode | null = null;
let ambBus: GainNode | null = null;
let space: GainNode | null = null;     // send into the reverb
let whiteBuf: AudioBuffer | null = null;
let pinkBuf: AudioBuffer | null = null;
let brownBuf: AudioBuffer | null = null;
let cicadaBuf: AudioBuffer | null = null;
/** page override; undefined = automatic by time of day */
let ambientRequest: Ambient | undefined;
let bed: Bed | null = null;
let bedKind: Ambient = null;
let lastPlay: Partial<Record<SoundName, number>> = {};
let suspendTimer = 0;

const MASTER = 0.8;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
const safe = (fn: () => void) => { try { fn(); } catch { /* sound must never throw */ } };

/* ------------------------------------------------------------------ graph */
function makeNoise(c: AudioContext, kind: 'white' | 'pink' | 'brown', seconds = 3): AudioBuffer {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === 'white') d[i] = w;
    else if (kind === 'pink') {
      // Paul Kellet's refined pink filter
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
    } else {
      last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5;
    }
  }
  // tiny fades so loops never click
  const f = Math.min(400, len >> 3);
  for (let i = 0; i < f; i++) { const k = i / f; d[i] *= k; d[len - 1 - i] *= k; }
  return buf;
}

/** cicada texture: buzzing pulses (~46 Hz) under slow swells, pre-rendered once */
function makeCicada(c: AudioContext): AudioBuffer {
  const sec = 4, len = c.sampleRate * sec;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  const sr = c.sampleRate;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const pulse = Math.pow(0.5 + 0.5 * Math.sin(2 * Math.PI * 46 * t), 6);
    const swell = 0.55 + 0.45 * Math.sin(2 * Math.PI * (1 / sec) * t * 2);
    d[i] = (Math.random() * 2 - 1) * pulse * swell;
  }
  const f = 2000;
  for (let i = 0; i < f; i++) { const k = i / f; d[i] *= k; d[len - 1 - i] *= k; }
  return buf;
}

/** procedural impulse response — a soft, short forest space */
function makeImpulse(c: AudioContext, seconds = 2.2, decay = 3.2): AudioBuffer {
  const len = Math.floor(c.sampleRate * seconds);
  const ir = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const k = i / len;
      // early reflections are sparse (tree trunks), the tail is diffuse
      const early = i < c.sampleRate * 0.08 && Math.random() < 0.004 ? (Math.random() * 2 - 1) * 0.9 : 0;
      d[i] = ((Math.random() * 2 - 1) * Math.pow(1 - k, decay) + early) * (1 - Math.exp(-i / 60));
    }
  }
  return ir;
}

function ensure(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const AC: typeof AudioContext | undefined = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    // iOS: respect the silent switch (polite, ambient category)
    try { const s = (navigator as any).audioSession; if (s) s.type = 'ambient'; } catch { /* ignore */ }
    const c = new AC({ latencyHint: 'interactive' });
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.25;
    comp.connect(c.destination);
    master = c.createGain(); master.gain.value = 0.0001; master.connect(comp);
    fxBus = c.createGain(); fxBus.gain.value = 0.9; fxBus.connect(master);
    ambBus = c.createGain(); ambBus.gain.value = 0.7; ambBus.connect(master);
    // reverb send: convolver → gentle low-pass → master
    const conv = c.createConvolver(); conv.buffer = makeImpulse(c);
    const verbLp = c.createBiquadFilter(); verbLp.type = 'lowpass'; verbLp.frequency.value = 4200;
    const verbOut = c.createGain(); verbOut.gain.value = 0.55;
    space = c.createGain(); space.gain.value = 1;
    space.connect(conv).connect(verbLp).connect(verbOut).connect(master);
    whiteBuf = makeNoise(c, 'white');
    pinkBuf = makeNoise(c, 'pink');
    brownBuf = makeNoise(c, 'brown', 4);
    ctx = c;
    return c;
  } catch {
    ctx = null;
    return null;
  }
}

const running = () => !!ctx && ctx.state === 'running' && on && !document.hidden;

function fadeMaster(to: number, sec: number) {
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  master.gain.cancelScheduledValues(t);
  master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), t);
  master.gain.setTargetAtTime(Math.max(0.0001, to), t, sec / 4);
}

/* ------------------------------------------------------------------ helpers */
function noiseSrc(buf: AudioBuffer | null, loop = true): AudioBufferSourceNode {
  const c = ctx!;
  const s = c.createBufferSource();
  s.buffer = buf ?? whiteBuf;
  s.loop = loop;
  return s;
}
function startNoise(s: AudioBufferSourceNode, when: number, dur?: number) {
  const len = s.buffer?.duration ?? 1;
  s.start(when, Math.random() * Math.max(0, len - (dur ?? 0) - 0.05));
  if (dur != null) s.stop(when + dur + 0.05);
}
function filter(type: BiquadFilterType, freq: number, q = 0.707): BiquadFilterNode {
  const f = ctx!.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; return f;
}
function gain(v = 0): GainNode { const g = ctx!.createGain(); g.gain.value = v; return g; }
function panner(p: number): AudioNode {
  const c = ctx!;
  if (typeof c.createStereoPanner === 'function') { const s = c.createStereoPanner(); s.pan.value = Math.max(-1, Math.min(1, p)); return s; }
  return gain(1);
}
/** route a node to a bus with optional pan and reverb send */
function out(node: AudioNode, dest: AudioNode, pan = 0, send = 0) {
  const p = panner(pan);
  node.connect(p); p.connect(dest);
  if (send > 0 && space) { const s = gain(send); p.connect(s); s.connect(space); }
}
/** classic percussive envelope on a gain param */
function perc(g: AudioParam, t: number, peak: number, attack: number, decay: number) {
  g.cancelScheduledValues(t);
  g.setValueAtTime(0.0001, t);
  g.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  g.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

/* ------------------------------------------------------------------ voices */
/** resonant wooden knock: damped inharmonic partials + a tiny contact noise */
function knock(f0: number, vol: number, decay: number, dest: AudioNode, pan = 0) {
  const c = ctx!, t = c.currentTime + 0.005;
  const partials: [number, number][] = [[1, 1], [2.57, 0.32], [4.18, 0.1]];
  for (const [m, g0] of partials) {
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f0 * m * 1.06, t);
    o.frequency.exponentialRampToValueAtTime(f0 * m, t + 0.018);
    const g = gain(); perc(g.gain, t, vol * g0, 0.0015, decay / Math.sqrt(m));
    o.connect(g); out(g, dest, pan);
    o.start(t); o.stop(t + decay + 0.06);
  }
  const n = noiseSrc(whiteBuf, false); const bp = filter('bandpass', f0 * 3.2, 1.4); const ng = gain();
  perc(ng.gain, t, vol * 0.22, 0.001, 0.012);
  n.connect(bp).connect(ng); out(ng, dest, pan);
  startNoise(n, t, 0.03);
}

/** one bird phrase: FM chirps with a pitch contour, through the forest reverb */
function birdPhrase(dest: AudioNode, vol = 1, opts: { pan?: number; distance?: number } = {}) {
  const c = ctx!;
  const distance = opts.distance ?? rnd(0.2, 0.9);
  const pan = opts.pan ?? rnd(-0.8, 0.8);
  const lp = filter('lowpass', 9000 - distance * 5200, 0.5);
  const hp = filter('highpass', 1400, 0.7);
  const level = gain(vol * (0.05 - distance * 0.028));
  hp.connect(lp).connect(level);
  out(level, dest, pan, 0.25 + distance * 0.5);
  const species = Math.floor(Math.random() * 4);
  let t = c.currentTime + 0.02;
  const base = rnd(2400, 3800);
  const notes = species === 3 ? Math.floor(rnd(6, 11)) : Math.floor(rnd(2, 6));
  for (let i = 0; i < notes; i++) {
    const o = c.createOscillator(); o.type = 'sine';
    const mod = c.createOscillator(); const modG = gain(rnd(80, 420));
    mod.frequency.value = rnd(28, 95); mod.connect(modG).connect(o.frequency);
    const len = species === 3 ? rnd(0.025, 0.045) : rnd(0.05, 0.16);
    const f = base * (species === 1 ? 1 + i * 0.07 : species === 2 ? 1.25 - i * 0.06 : rnd(0.9, 1.15));
    if (species === 0) { o.frequency.setValueAtTime(f * 0.78, t); o.frequency.exponentialRampToValueAtTime(f * 1.25, t + len); }
    else if (species === 2) { o.frequency.setValueAtTime(f * 1.3, t); o.frequency.exponentialRampToValueAtTime(f * 0.8, t + len); }
    else { o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * rnd(1.05, 1.4), t + len * 0.6); o.frequency.exponentialRampToValueAtTime(f * 0.95, t + len); }
    const g = gain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + Math.min(0.012, len * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(hp);
    o.start(t); mod.start(t); o.stop(t + len + 0.02); mod.stop(t + len + 0.02);
    t += len + (species === 3 ? rnd(0.012, 0.03) : rnd(0.04, 0.14));
  }
}

function owl(dest: AudioNode) {
  const c = ctx!;
  const lp = filter('lowpass', 900, 0.6);
  const level = gain(0.06);
  lp.connect(level); out(level, dest, rnd(-0.6, 0.6), 0.8);
  const hoot = (t: number, len: number, f: number) => {
    const o = c.createOscillator(); o.type = 'sine';
    const vib = c.createOscillator(); const vg = gain(4); vib.frequency.value = 5.5; vib.connect(vg).connect(o.frequency);
    o.frequency.setValueAtTime(f * 1.04, t); o.frequency.linearRampToValueAtTime(f, t + len * 0.3); o.frequency.linearRampToValueAtTime(f * 0.92, t + len);
    const g = gain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.07); g.gain.setValueAtTime(1, t + len - 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(lp);
    o.start(t); vib.start(t); o.stop(t + len + 0.05); vib.stop(t + len + 0.05);
  };
  const t0 = c.currentTime + 0.05, f = rnd(330, 390);
  hoot(t0, 0.32, f);
  hoot(t0 + 0.55, 0.6, f * 0.97);
  if (Math.random() < 0.5) hoot(t0 + 1.45, 0.28, f * 0.99);
}

/* ------------------------------------------------------------------ one-shots */
type Voice = (vol: number, rate: number) => void;
const voices: Record<SoundName, Voice> = {
  hover: (v, r) => knock(rnd(820, 980) * r, 0.045 * v, 0.07, fxBus!, rnd(-0.2, 0.2)),
  click: (v, r) => knock(rnd(470, 540) * r, 0.085 * v, 0.11, fxBus!),

  rustle: (v) => {
    const c = ctx!, t0 = c.currentTime + 0.01;
    const src = noiseSrc(pinkBuf); const bp = filter('bandpass', 3800, 0.9); const hp = filter('highpass', 1500); const g = gain(0.0001);
    src.connect(hp).connect(bp).connect(g); out(g, fxBus!, rnd(-0.4, 0.4), 0.15);
    const grains = Math.floor(rnd(9, 15)); let t = t0;
    for (let i = 0; i < grains; i++) {
      const p = rnd(0.25, 1) * 0.12 * v;
      g.gain.setTargetAtTime(p, t, 0.004);
      g.gain.setTargetAtTime(0.0001, t + rnd(0.01, 0.03), rnd(0.015, 0.04));
      bp.frequency.setValueAtTime(rnd(2600, 6000), t);
      t += rnd(0.018, 0.06);
    }
    startNoise(src, t0, t - t0 + 0.25);
  },

  water: (v) => {
    const c = ctx!, t0 = c.currentTime + 0.01, dur = rnd(0.8, 1.1);
    // stream bed
    const src = noiseSrc(pinkBuf); const lp = filter('lowpass', 1400, 0.4); const bp = filter('bandpass', 700, 0.8); const g = gain(0.0001);
    src.connect(bp).connect(lp).connect(g); out(g, fxBus!, 0, 0.2);
    g.gain.setTargetAtTime(0.09 * v, t0, 0.06); g.gain.setTargetAtTime(0.0001, t0 + dur - 0.2, 0.12);
    startNoise(src, t0, dur + 0.4);
    // bubbles
    for (let i = 0; i < 18; i++) bubble(t0 + Math.random() * dur, rnd(450, 1300), 0.03 * v);
  },

  absorb: (v) => {
    const c = ctx!, t0 = c.currentTime + 0.01;
    const src = noiseSrc(brownBuf); const lp = filter('lowpass', 900, 0.8); const g = gain(0.0001);
    src.connect(lp).connect(g); out(g, fxBus!);
    lp.frequency.setValueAtTime(900, t0); lp.frequency.exponentialRampToValueAtTime(110, t0 + 1.5);
    g.gain.setTargetAtTime(0.14 * v, t0, 0.05); g.gain.setTargetAtTime(0.0001, t0 + 0.6, 0.35);
    startNoise(src, t0, 2);
    for (let i = 0; i < 4; i++) bubble(t0 + 0.15 + i * rnd(0.18, 0.35), rnd(170, 320), 0.035 * v);
  },

  crack: (v) => {
    const c = ctx!, t0 = c.currentTime + 0.01;
    const times = [0, rnd(0.025, 0.04), rnd(0.07, 0.11)];
    times.forEach((dt, i) => {
      const n = noiseSrc(whiteBuf, false); const hp = filter('highpass', 1800); const bp = filter('bandpass', rnd(2200, 3600), 2); const g = gain();
      perc(g.gain, t0 + dt, (0.14 - i * 0.035) * v, 0.0008, rnd(0.008, 0.02));
      n.connect(hp).connect(bp).connect(g); out(g, fxBus!, rnd(-0.15, 0.15));
      startNoise(n, t0 + dt, 0.05);
    });
    const o = c.createOscillator(); o.frequency.setValueAtTime(150, t0); o.frequency.exponentialRampToValueAtTime(80, t0 + 0.06);
    const g = gain(); perc(g.gain, t0, 0.06 * v, 0.002, 0.06); o.connect(g); out(g, fxBus!);
    o.start(t0); o.stop(t0 + 0.1);
  },

  paper: (v) => {
    const c = ctx!, t0 = c.currentTime + 0.01;
    const src = noiseSrc(whiteBuf); const hp = filter('highpass', 2400); const bp = filter('bandpass', 5200, 0.6); const g = gain(0.0001);
    src.connect(hp).connect(bp).connect(g); out(g, fxBus!, rnd(-0.3, 0.3));
    let t = t0; const n = Math.floor(rnd(10, 18));
    for (let i = 0; i < n; i++) {
      g.gain.setTargetAtTime(rnd(0.02, 0.07) * v, t, 0.002);
      g.gain.setTargetAtTime(0.0001, t + rnd(0.006, 0.02), 0.01);
      bp.frequency.setValueAtTime(rnd(3000, 7500), t);
      t += rnd(0.012, 0.045);
    }
    startNoise(src, t0, t - t0 + 0.1);
  },

  sparkle: (v) => {
    const c = ctx!, t0 = c.currentTime + 0.01;
    const scale = [2093, 2349, 2637, 3136, 3520, 4186, 4699, 5274];
    const n = Math.floor(rnd(6, 10));
    for (let i = 0; i < n; i++) {
      const t = t0 + Math.random() * 0.6;
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = pick(scale);
      const g = gain(); perc(g.gain, t, rnd(0.012, 0.028) * v, 0.002, rnd(0.12, 0.35));
      o.connect(g); out(g, fxBus!, rnd(-0.7, 0.7), 0.5);
      o.start(t); o.stop(t + 0.5);
    }
  },

  chime: (v) => {
    const c = ctx!, t0 = c.currentTime + 0.02;
    const notes = [587.33, 880, 1318.5]; // D5 · A5 · E6 — open, pentatonic, warm
    const lp = filter('lowpass', 5200, 0.5); const level = gain(0.07 * v);
    lp.connect(level); out(level, fxBus!, 0, 0.55);
    notes.forEach((f, i) => {
      const t = t0 + i * 0.13;
      [[1, 1], [2.76, 0.28], [5.4, 0.08]].forEach(([m, a]) => {
        const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f * m;
        const g = gain(); perc(g.gain, t, a, 0.004, 2.2 / Math.sqrt(m));
        o.connect(g).connect(lp); o.start(t); o.stop(t + 2.4);
      });
    });
  },

  pop: (v) => {
    const c = ctx!, t = c.currentTime + 0.01;
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(820, t + 0.045); o.frequency.exponentialRampToValueAtTime(520, t + 0.13);
    const g = gain(); perc(g.gain, t, 0.09 * v, 0.004, 0.14);
    o.connect(g); out(g, fxBus!, 0, 0.15); o.start(t); o.stop(t + 0.2);
    knock(1500, 0.02 * v, 0.03, fxBus!);
  },

  whoosh: (v) => {
    const c = ctx!, t0 = c.currentTime + 0.01, d = 0.95;
    const src = noiseSrc(pinkBuf); const bp = filter('bandpass', 260, 1.1); const g = gain(0.0001);
    const p = typeof c.createStereoPanner === 'function' ? c.createStereoPanner() : null;
    src.connect(bp).connect(g);
    if (p) { g.connect(p).connect(fxBus!); p.pan.setValueAtTime(0.6, t0); p.pan.linearRampToValueAtTime(-0.6, t0 + d); }
    else g.connect(fxBus!);
    bp.frequency.setValueAtTime(260, t0); bp.frequency.exponentialRampToValueAtTime(2000, t0 + d * 0.45); bp.frequency.exponentialRampToValueAtTime(520, t0 + d);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.11 * v, t0 + d * 0.42); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    startNoise(src, t0, d + 0.1);
  },

  bird: (v) => birdPhrase(fxBus!, v * 1.4, { distance: rnd(0.1, 0.4) }),
};

function bubble(t: number, f: number, vol: number) {
  const c = ctx!;
  const o = c.createOscillator(); o.type = 'sine';
  const len = rnd(0.03, 0.07);
  o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * rnd(1.4, 1.9), t + len);
  const g = gain(); perc(g.gain, t, vol, 0.003, len);
  o.connect(g); out(g, fxBus!, rnd(-0.3, 0.3));
  o.start(t); o.stop(t + len + 0.02);
}

/* ------------------------------------------------------------------ ambient beds */
interface Bed { stop(fade?: number): void }

/** continuous wind: brown/pink noise through a slowly wandering low-pass, with gusts */
function windLayer(level: number, dest: AudioNode): { g: GainNode; stop(f?: number): void; setLevel(v: number): void } {
  const c = ctx!;
  const src = noiseSrc(brownBuf); const lp = filter('lowpass', 500, 0.6); const g = gain(0.0001);
  const hiss = noiseSrc(pinkBuf); const bp = filter('bandpass', 1800, 0.5); const hg = gain(0.0001);
  src.connect(lp).connect(g); hiss.connect(bp).connect(hg).connect(g);
  out(g, dest);
  let base = level;
  g.gain.setTargetAtTime(base, c.currentTime, 1.2);
  hg.gain.setTargetAtTime(0.06, c.currentTime, 1.5);
  src.start(); hiss.start();
  let alive = true; let timer = 0;
  const gust = () => {
    if (!alive) return;
    if (running()) {
      const t = c.currentTime, d = rnd(2, 5);
      lp.frequency.setTargetAtTime(rnd(280, 950), t, d / 3);
      bp.frequency.setTargetAtTime(rnd(1200, 2600), t, d / 3);
      g.gain.setTargetAtTime(base * rnd(0.55, 1.5), t, d / 3);
    }
    timer = window.setTimeout(gust, rnd(2200, 5200));
  };
  gust();
  return {
    g,
    setLevel(v) { base = v; },
    stop(f = 1.2) {
      alive = false; clearTimeout(timer);
      const t = c.currentTime; g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0.0001, t, f / 4);
      setTimeout(() => safe(() => { src.stop(); hiss.stop(); g.disconnect(); }), f * 1000 + 200);
    },
  };
}

/** call `fn` again and again with random gaps while the bed lives (skips while not running) */
function every(minMs: number, maxMs: number, fn: () => void, firstMs?: number) {
  let alive = true; let timer = 0;
  const tick = () => { if (!alive) return; if (running()) safe(fn); timer = window.setTimeout(tick, rnd(minMs, maxMs)); };
  timer = window.setTimeout(tick, firstMs ?? rnd(minMs * 0.3, minMs));
  return () => { alive = false; clearTimeout(timer); };
}

function cicadaLayer(dest: AudioNode) {
  const c = ctx!;
  if (!cicadaBuf) cicadaBuf = makeCicada(c);
  const src = noiseSrc(cicadaBuf); const bp = filter('bandpass', 5200, 3.5); const hp = filter('highpass', 3200); const g = gain(0.0001);
  src.connect(hp).connect(bp).connect(g); out(g, dest, rnd(-0.4, 0.4));
  src.start();
  // phrases: swell in, hold, fade — then rest
  const stopPhrases = every(7000, 15000, () => {
    const t = c.currentTime, hold = rnd(3, 7);
    bp.frequency.setValueAtTime(rnd(4600, 6000), t);
    g.gain.setTargetAtTime(rnd(0.05, 0.085), t, 0.9);
    g.gain.setTargetAtTime(0.0001, t + hold, 1.2);
  }, 600);
  return { stop(f = 1) { stopPhrases(); const t = c.currentTime; g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0.0001, t, f / 4); setTimeout(() => safe(() => src.stop()), f * 1000 + 200); } };
}

/** crickets: persistent sine voices pulsed by a look-ahead scheduler (cheap) */
function cricketLayer(dest: AudioNode, density = 1) {
  const c = ctx!;
  const voicesList = [0, 1].map((i) => {
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = i ? rnd(4300, 4500) : rnd(4700, 4950);
    const g = gain(0.0001); o.connect(g); out(g, dest, i ? -0.5 : 0.45, 0.35); o.start();
    return { o, g, next: c.currentTime + rnd(0.2, 1.2) };
  });
  const timer = window.setInterval(() => {
    if (!running()) return;
    const horizon = c.currentTime + 0.6;
    for (const v of voicesList) {
      while (v.next < horizon) {
        const pulses = Math.floor(rnd(3, 5)); const amp = rnd(0.012, 0.02) * density;
        for (let p = 0; p < pulses; p++) {
          const t = v.next + p * 0.032;
          v.g.gain.setValueAtTime(0.0001, t); v.g.gain.linearRampToValueAtTime(amp, t + 0.006); v.g.gain.linearRampToValueAtTime(0.0001, t + 0.018);
        }
        v.next += rnd(0.55, 1.1) / density + (Math.random() < 0.12 ? rnd(1.5, 4) : 0);
      }
    }
  }, 250);
  return { stop() { clearInterval(timer); voicesList.forEach((v) => safe(() => { v.g.gain.cancelScheduledValues(c.currentTime); v.g.gain.setTargetAtTime(0.0001, c.currentTime, 0.1); v.o.stop(c.currentTime + 0.5); })); } };
}

function rainLayer(dest: AudioNode) {
  const c = ctx!;
  const src = noiseSrc(pinkBuf); const hp = filter('highpass', 700); const lp = filter('lowpass', 6500, 0.4); const g = gain(0.0001);
  src.connect(hp).connect(lp).connect(g); out(g, dest);
  g.gain.setTargetAtTime(0.11, c.currentTime, 1.5); src.start();
  const stopDrops = every(40, 140, () => {
    const t = c.currentTime;
    const n = noiseSrc(whiteBuf, false); const bp = filter('bandpass', rnd(2400, 6200), 6); const dg = gain();
    perc(dg.gain, t, rnd(0.02, 0.06), 0.001, rnd(0.01, 0.03));
    n.connect(bp).connect(dg); out(dg, dest, rnd(-0.9, 0.9), 0.2); startNoise(n, t, 0.05);
  }, 100);
  return { stop(f = 1.5) { stopDrops(); const t = c.currentTime; g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0.0001, t, f / 4); setTimeout(() => safe(() => src.stop()), f * 1000 + 200); } };
}

function makeBed(kind: Exclude<Ambient, null>): Bed {
  const dest = ambBus!;
  const parts: { stop(f?: number): void }[] = [];
  const stops: (() => void)[] = [];
  switch (kind) {
    case 'morning':
      parts.push(windLayer(0.035, dest));
      stops.push(every(1800, 5200, () => birdPhrase(dest, 1), 900));
      stops.push(every(4000, 9000, () => birdPhrase(dest, 0.7, { distance: rnd(0.6, 1) })));
      break;
    case 'day':
      parts.push(windLayer(0.045, dest));
      parts.push(cicadaLayer(dest));
      stops.push(every(12000, 26000, () => birdPhrase(dest, 0.8)));
      break;
    case 'evening':
      parts.push(windLayer(0.03, dest));
      parts.push(cricketLayer(dest, 1));
      stops.push(every(15000, 32000, () => birdPhrase(dest, 0.6, { distance: rnd(0.6, 1) })));
      break;
    case 'night':
      parts.push(windLayer(0.016, dest));
      parts.push(cricketLayer(dest, 0.35));
      stops.push(every(26000, 60000, () => owl(dest), rnd(7000, 14000)));
      break;
    case 'rain':
      parts.push(rainLayer(dest));
      parts.push(windLayer(0.03, dest));
      break;
    case 'memorial':
      parts.push(windLayer(0.018, dest));
      stops.push(every(30000, 60000, () => birdPhrase(dest, 0.45, { distance: 1 })));
      break;
    case 'forest':
    default:
      parts.push(windLayer(0.04, dest));
      stops.push(every(4500, 11000, () => birdPhrase(dest, 0.9), 1500));
      break;
  }
  return { stop(f = 1.2) { stops.forEach((s) => s()); parts.forEach((p) => safe(() => p.stop(f))); } };
}

function autoAmbient(): Exclude<Ambient, null> {
  const p = dayPeriod();
  return p === 'morning' ? 'morning' : p === 'noon' ? 'day' : p === 'evening' ? 'evening' : 'night';
}

function syncBed() {
  if (!ctx || !on || ctx.state !== 'running') return;
  const want: Ambient = ambientRequest === undefined ? autoAmbient() : ambientRequest;
  if (bed && bedKind === want) return;
  bed?.stop(1.6); bed = null; bedKind = want;
  if (want) bed = makeBed(want);
}

/* ------------------------------------------------------------------ lifecycle */
async function start() {
  const c = ensure(); if (!c) return;
  clearTimeout(suspendTimer);
  try { if (c.state !== 'running') await c.resume(); } catch { /* needs a gesture */ }
  if (c.state !== 'running') return;
  fadeMaster(MASTER, 1.6);
  syncBed();
}
function stop() {
  if (!ctx) return;
  fadeMaster(0.0001, 0.6);
  bed?.stop(0.6); bed = null; bedKind = null;
  clearTimeout(suspendTimer);
  suspendTimer = window.setTimeout(() => { if (!on && ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); }, 900);
}

/* unlock on the first user gesture (iOS/Chrome autoplay policy) */
const GESTURES = ['pointerdown', 'keydown', 'touchend', 'click'] as const;
function onGesture() {
  if (!on) return;
  start().then(() => { if (ctx?.state === 'running') GESTURES.forEach((e) => window.removeEventListener(e, onGesture, true)); });
}
if (typeof window !== 'undefined') {
  GESTURES.forEach((e) => window.addEventListener(e, onGesture, { capture: true, passive: true }));
  document.addEventListener('visibilitychange', () => safe(() => {
    if (!ctx) return;
    if (document.hidden) { if (ctx.state === 'running') ctx.suspend().catch(() => {}); }
    else if (on) ctx.resume().then(syncBed).catch(() => {});
  }));
  // bfcache restore: the context may be gone/suspended
  window.addEventListener('pageshow', (e) => { if ((e as PageTransitionEvent).persisted && on) start(); });
}

/* ------------------------------------------------------------------ API */
export const sound = {
  isOn(): boolean { return on; },
  setOn(next: boolean): void {
    safe(() => {
      next = !!next;
      if (next === on) { if (next) start(); return; }
      on = next;
      storage.set(KEY, on);
      if (on) start(); else stop();
      bus.emit('sound:change', { on });
    });
  },
  toggle(): boolean { sound.setOn(!on); return on; },
  /** must be called from a user gesture before audio can start (iOS) */
  unlock(): void { safe(() => { if (on) start(); }); },
  play(name: SoundName, opts: { volume?: number; rate?: number } = {}): void {
    if (!running()) return;
    safe(() => {
      const now = performance.now();
      const gap = name === 'hover' ? 70 : name === 'click' ? 40 : 25;
      if (now - (lastPlay[name] ?? 0) < gap) return;
      lastPlay[name] = now;
      voices[name]?.(Math.max(0, Math.min(2, opts.volume ?? 1)), opts.rate ?? 1);
    });
  },
  /** continuous sound (e.g. pouring water while holding) */
  loop(name: 'water' | 'wind', opts: { volume?: number } = {}): LoopHandle {
    const noop: LoopHandle = { setVolume() {}, stop() {} };
    if (!running()) return noop;
    try {
      const c = ctx!;
      let vol = Math.max(0, Math.min(2, opts.volume ?? 1));
      if (name === 'wind') {
        const w = windLayer(0.05 * vol, fxBus!);
        return { setVolume(v) { vol = v; w.setLevel(0.05 * v); }, stop(f = 0.8) { w.stop(f); } };
      }
      // water: steady pour + a bubble scheduler
      const src = noiseSrc(pinkBuf); const bp = filter('bandpass', 750, 0.7); const lp = filter('lowpass', 1600, 0.4); const g = gain(0.0001);
      src.connect(bp).connect(lp).connect(g); out(g, fxBus!, 0, 0.2);
      g.gain.setTargetAtTime(0.09 * vol, c.currentTime, 0.08);
      src.start();
      const stopBubbles = every(30, 110, () => bubble(c.currentTime + 0.01, rnd(420, 1250), 0.026 * vol), 40);
      let stopped = false;
      return {
        setVolume(v) { vol = Math.max(0, Math.min(2, v)); safe(() => g.gain.setTargetAtTime(0.09 * vol, c.currentTime, 0.08)); },
        stop(f = 0.4) {
          if (stopped) return; stopped = true; stopBubbles();
          safe(() => { g.gain.cancelScheduledValues(c.currentTime); g.gain.setTargetAtTime(0.0001, c.currentTime, f / 4); });
          setTimeout(() => safe(() => src.stop()), f * 1000 + 200);
        },
      };
    } catch { return noop; }
  },
  /** background bed by time of day / weather */
  setAmbient(kind: Ambient): void { safe(() => { ambientRequest = kind; syncBed(); }); },
  /** short vibration on Android (navigator.vibrate) — respects motion + sound-independent */
  haptic(pattern: number | number[] = 12): void {
    safe(() => { if (env.isAndroid && typeof navigator.vibrate === 'function' && env.motionAllowed()) navigator.vibrate(pattern); });
  },
};
