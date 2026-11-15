/* ECHOES OF SPACE: sci-fi blast gate.
   It is the loading screen. The doors start sealed (markup is in index.html, so nothing shows before it), the ring fills with the REAL loading
   progress of the missions and every .glb (EOS.loader), then the bolts retract, the doors part with a screen shake and the scene is revealed.
   It also closes again when the intro ends or is skipped, so the hand-over to the interactive scene is a gate opening too.
   API:  EOS.gate.cycle({ title, hold, onClosed })  close the doors, run onClosed (swap the scene behind them), then open.
   Nothing here can trap the visitor: opening is forced after MAX_WAIT even if a file never finishes. */
(() => {
'use strict';
const CFG = {
  minBoot: 1700,      // ms the gate stays sealed at page load (so the opening never looks like a flicker)
  hold: 900,          // ms it stays sealed after it closes for a hand-over
  maxWait: 60000,     // give up waiting for files after this long and open anyway
  title: 'Echoes of Space'
};
const g = document.getElementById('gate');
if (!g) return;
const E = window.EOS;
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = s => g.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, RM ? 0 : ms));
const wrap = $('.gWrap'), arc = $('.gArc'), pct = $('.gPct b'), titleEl = $('.gTitle'), statusEl = $('.gStatus'), itemEl = $('.gItem'), stateEl = $('.gState');
const html = document.documentElement;
html.classList.add('gated');   // pauses the intro's entrance animations until the doors open (see gate.css note in index.html)

/* ---- ring ticks ---- */
{
  const ns = 'http://www.w3.org/2000/svg', t = $('.gTicks');
  for (let i = 0; i < 72; i++) {
    const a = i / 72 * Math.PI * 2, big = i % 6 === 0, r1 = 96, r2 = big ? 103 : 100, l = document.createElementNS(ns, 'line');
    l.setAttribute('x1', 110 + Math.cos(a) * r1); l.setAttribute('y1', 110 + Math.sin(a) * r1);
    l.setAttribute('x2', 110 + Math.cos(a) * r2); l.setAttribute('y2', 110 + Math.sin(a) * r2);
    if (big) l.setAttribute('class', 'big'); t.appendChild(l);
  }
}

/* ---- sound (tiny synth). Only when the browser allows sound and the visitor has not muted it in the intro. Silent otherwise. ---- */
const SFX = {
  x: null, nb: null,
  ctx() {
    try {
      if (RM || !(navigator.userActivation && navigator.userActivation.hasBeenActive)) return null;
      const m = document.getElementById('iMute'); if (m && m.getAttribute('aria-pressed') === 'true') return null;
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      const x = this.x = this.x || new AC(); if (x.state === 'suspended') x.resume().catch(() => {});
      if (!this.nb) { const b = this.nb = x.createBuffer(1, x.sampleRate, x.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      return x;
    } catch (e) { return null; }
  },
  noise(x, type, freq, vol, dur, t0 = 0) {
    const s = x.createBufferSource(), f = x.createBiquadFilter(), v = x.createGain(), t = x.currentTime + t0;
    s.buffer = this.nb; s.loop = true; f.type = type; f.frequency.value = freq;
    v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(vol, t + Math.min(.25, dur / 4)); v.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(f); f.connect(v); v.connect(x.destination); s.start(t); s.stop(t + dur + .1);
  },
  thunk(vol = .5) {          // heavy metal clunk: a falling low tone plus a short burst of noise
    try {
      const x = this.ctx(); if (!x) return; const t = x.currentTime, o = x.createOscillator(), v = x.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(34, t + .4);
      v.gain.setValueAtTime(vol, t); v.gain.exponentialRampToValueAtTime(.0001, t + .5);
      o.connect(v); v.connect(x.destination); o.start(t); o.stop(t + .6); this.noise(x, 'lowpass', 500, vol * .6, .25);
    } catch (e) {}
  },
  open() {                   // pneumatic hiss then a long rumble while the doors travel
    try { const x = this.ctx(); if (!x) return; this.noise(x, 'highpass', 3200, .22, .7); this.noise(x, 'lowpass', 150, .6, 2.3, .05); } catch (e) {}
  }
};

/* ---- shake: the page's camera shake (EOS.shake) plus a jitter of the doors themselves ---- */
const J = { amp: 0, t0: 0, dur: 0 };
function quake(dur, amp) { if (RM) return; J.amp = amp; J.t0 = performance.now(); J.dur = dur; requestAnimationFrame(jit); }
function jit(now) {
  const k = 1 - (now - J.t0) / J.dur;
  if (k <= 0) { wrap.style.transform = ''; return; }
  const a = J.amp * k * k;
  wrap.style.transform = `translate(${((Math.random() - .5) * 2 * a).toFixed(1)}px,${((Math.random() - .5) * 2 * a).toFixed(1)}px)`;
  requestAnimationFrame(jit);
}
const camShake = v => { try { E && E.shake && E.shake(v); } catch (e) {} };

/* ---- progress meter ---- */
const M = { on: false, done: false, shown: 0, target: 0, t0: 0 };
function stage(p) { return p >= 1 ? 'Systems online' : p > .55 ? 'Loading 3D models' : p > .18 ? 'Loading mission data' : 'Establishing link'; }
function meter(now) {
  if (!M.on) return;
  const real = E && E.loader ? E.loader.progress() : 0, creep = Math.min(.3, (now - M.t0) / 7000);   // creeps a little so it never looks stuck before the first file starts
  const p = M.done ? 1 : Math.min(.97, Math.max(real * .97, creep));
  M.target = Math.max(M.target, p);
  M.shown += (M.target - M.shown) * (M.done ? .2 : .1);
  if (M.target - M.shown < .002) M.shown = M.target;
  arc.style.strokeDashoffset = (100 - M.shown * 100).toFixed(2);
  pct.textContent = Math.round(M.shown * 100);
  statusEl.textContent = stage(M.done && M.shown > .995 ? 1 : Math.min(M.shown, .99));
  const cur = E && E.loader && E.loader.cur; itemEl.textContent = M.done ? '' : cur ? cur.split('/').pop() : '';
  requestAnimationFrame(meter);
}
function startMeter() { M.on = true; M.done = false; M.shown = M.target = 0; M.t0 = performance.now(); requestAnimationFrame(meter); }

/* ---- door sequences ---- */
let busy = false;
function setTitle(t, state) { titleEl.textContent = t; stateEl.textContent = state; }
async function open() {
  if (g.hidden) return;
  html.classList.remove('gated');                       // let the intro's entrance animations start
  stateEl.textContent = 'Unlocked';
  g.classList.add('unlock'); SFX.thunk(.55); camShake(.6); quake(550, 6);
  await sleep(700);
  g.classList.add('opening'); SFX.open(); camShake(1); quake(2300, 8);
  await sleep(2300);
  g.hidden = true; g.classList.remove('unlock', 'opening', 'closing'); wrap.style.transform = ''; M.on = false;
  const go = document.getElementById('iGo');            // the intro's Start button gets keyboard focus back
  if (go && go.offsetParent && !go.classList.contains('gone')) { try { go.focus(); } catch (e) {} }
}
function close() {
  return new Promise(res => {
    g.hidden = false; stateEl.textContent = 'Sealing';
    g.classList.add('instant', 'opening', 'unlock'); void g.offsetWidth;   // start from "open" without animating
    g.classList.add('closing'); g.classList.remove('instant'); void g.offsetWidth;
    g.classList.remove('opening', 'unlock');                              // doors slam shut
    setTimeout(() => { SFX.thunk(.8); camShake(.9); quake(500, 10); stateEl.textContent = 'Sealed'; res(); }, RM ? 0 : 820);
  });
}
const withTimeout = p => Promise.race([p, new Promise(r => setTimeout(r, CFG.maxWait))]);

/* ---- hand-over: used by the intro when it ends or is skipped ---- */
async function cycle(o = {}) {
  if (busy || !g) { try { o.onClosed && o.onClosed(); } catch (e) { console.error(e); } return; }
  busy = true; setTitle(o.title || 'Entering the scene', 'Sealing');
  statusEl.textContent = 'Sealing doors'; itemEl.textContent = ''; pct.textContent = '0'; arc.style.strokeDashoffset = 100;   // fresh readout for the hand-over
  await close();
  try { o.onClosed && o.onClosed(); } catch (e) { console.error(e); }
  startMeter();
  if (E && E.ready) await withTimeout(E.ready);
  M.done = true;
  await sleep(o.hold || CFG.hold);
  await open(); busy = false;
}

/* ---- keep the controls behind the doors from reacting while sealed ---- */
const swallow = e => { if (e.ctrlKey || e.metaKey || e.altKey || /^F\d+$/.test(e.key)) return;   // reload, dev tools etc. still work
  if (!g.hidden && !g.classList.contains('opening')) { e.stopImmediatePropagation(); e.preventDefault(); } };
addEventListener('keydown', swallow, true); addEventListener('keyup', swallow, true);

/* ---- page load: sealed gate = loading screen ---- */
async function boot() {
  busy = true; setTitle(CFG.title, 'Sealed'); startMeter();
  setTimeout(() => { try { document.activeElement && document.activeElement.blur(); } catch (e) {} }, 0);   // the intro focuses its Start button; not while sealed
  const t0 = performance.now();
  if (!E || !E.ready) { statusEl.textContent = 'Could not start'; await sleep(1200); }
  else {
    await withTimeout(E.ready);
    if (document.fonts && document.fonts.ready) await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]);   // Montserrat is in before the doors open
  }
  M.done = true;
  const left = CFG.minBoot - (performance.now() - t0); if (left > 0) await sleep(left);
  await sleep(500);   // let the ring reach 100%
  if (E && E.rig && !document.body.classList.contains('intro') && !RM) E.rig.d = E.rig.tD * 1.35;   // returning visitor: the camera drifts in as the doors part
  await open(); busy = false;
}

if (E) E.gate = { cycle, open, close };
boot();
})();
