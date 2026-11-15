/* ECHOES OF SPACE: cinematic intro. Loaded AFTER app.js and story.js (needs the EOS hooks added to app.js; without them it does nothing).
   FLOW  1 black screen: logos + title (+ Start button)  ->  2 fade out  ->  3 story lines on pitch black
         ->  4 fade into the real 3D planets  ->  5 machines one by one (camera visits each)  ->  6 hand-over to the interactive scene.
   Reuses the existing renderer, scene, camera and machines. No second scene. */
(() => {
'use strict';

/* ===================================================================== CONFIG
   min = minimum seconds of a beat. A beat ends when min has passed AND its narration line has finished (so any voice stays in sync).
   out = seconds of fade-out before the next beat.  kind:'story' = big centred text on black.  mid = machine id (text is built from missions data).
   cam = {pos, look} or 'home'. Machine beats fly to a live "follow" view of that machine. */
const CFG = {
  skipKey: 'eos_skip_intro',
  extFile: 'assets/intro.json',                     // optional: { logos:{nasa,bahrain}, audio:'', cues:[] }  ("" = skip)
  logos: { nasa: 'assets/logos/nasa-space-apps.png', bahrain: 'assets/logos/bahrain-space-agency.png' },
  audio: '', cues: [],                              // recorded voice: one cue (seconds) per beat, see README-intro.txt
  title: 'ECHOES OF SPACE',
  sub: '2026 NASA Space Apps Challenge',
  footer: 'Created for the NASA Space Apps Challenge. NASA does not endorse this project.',
  voice: { rate: .92, pitch: .9 },
  startPose: { pos: [150, 60, 230], look: [20, 5, -30] },
  wide: { pos: [0, 6, 34], look: [0, 0, 0] },
  follow: { dist: 5.5, lift: 1.6, fly: 1.8 },
  quickStart: 1970,                                  // QUICK intro: the year counter starts here, then runs slowly on to today (machines up to this year are already awake)        // machine camera: distance behind the machine, height, seconds to fly in
  /* QUICK intro: one or two sentences for each rover, taken from NASA pages (science.nasa.gov Mars Pathfinder and Spirit/Opportunity; NSSDCA Apollo 15 record).
     Add an id here to give another machine a line. The beat stays on screen long enough to read it (see startBeat). */
  rover: {
    'lunar-rover': 'First used on Apollo 15, it performed very successfully. The crew covered 27.9 km in three moonwalks, staying within 5 km of their lander.',
    sojourner: 'The first rover on Mars weighed just 23 pounds (10.6 kg) and stood 1 foot (30 cm) tall. Its spectrometer measured the elements in rocks and soil.',
    spirit: 'Spirit was one of two identical twin rovers. It landed in Gusev Crater, a possible former lake, and drove 4.8 miles (7.7 km) before its mission ended in 2010.',
    opportunity: 'Opportunity landed on Meridiani Planum, where minerals hinted at a wet past. It drove 28.06 miles (45.16 km) and last called home on June 10, 2018.'
  },
  phrase: { parked: 'It was left behind.', silent: 'It went silent.', grounded: 'Its flying days ended.', active: 'It is still working.' },
  /* FULL intro (about 60 s). The logo beat has no spoken line any more: it is VFX only (see vfx() and intro.css). */
  beats: [
    { id: 'logos',  min: 3.4, out: 1.4, text: '', leave: 'open' },
    { id: 's1', kind: 'story', min: 3.2, out: .9, text: 'It started in the 1960s, with a question.' },
    { id: 's2', kind: 'story', min: 3.6, out: .9, text: 'Could a machine land softly on another world?' },
    { id: 's3', kind: 'story', min: 4.6, out: .9, text: 'Landers. Rovers. Helicopters. Built to last for weeks, or months.' },
    { id: 's4', kind: 'story', min: 4.6, out: 1.4, text: 'Some were left behind. Some went silent. And they are still out there.' },
    { id: 'reveal', min: 5, cam: 'wide', text: '' },
    { id: 'm1', mid: 'surveyor-3',      min: 3.8 },
    { id: 'm2', mid: 'apollo-11-eagle', min: 3.8 },
    { id: 'm3', mid: 'viking-1',        min: 3.8 },
    { id: 'm4', mid: 'sojourner',       min: 3.8 },
    { id: 'm5', mid: 'spirit',          min: 3.8 },
    { id: 'm6', mid: 'opportunity',     min: 3.8 },
    { id: 'm7', mid: 'ingenuity',       min: 3.8 },
    { id: 'outro', min: 6, cam: 'home', text: 'But the machines are still there. Wake them up. Hear their stories.' }
  ],
  /* SHORT intro (about 12 s, captions only, no narration): logos VFX -> planets -> 3 machines -> hand-over. Edit the numbers to taste. */
  short: [
    { id: 'logos',  min: 2.4, out: .8, text: '', leave: 'open' },
    { id: 'reveal', min: 2, cam: 'wide', text: '' },
    { id: 'm1', mid: 'apollo-11-eagle', min: 1.8 },
    { id: 'm2', mid: 'sojourner',       min: 1.8 },
    { id: 'm3', mid: 'ingenuity',       min: 1.8 },
    { id: 'outro', min: 2, cam: 'home', text: 'Wake them up. Hear their stories.' }
  ]
};

/* ===================================================================== helpers */
const E = window.EOS;
if (!E || !E.rig || !E.setYear) { console.warn('Echoes intro: app.js hooks not found, intro skipped.'); return; }
const $ = id => document.getElementById(id), T = E.THREE;
const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, p) => a + (b - a) * p;
const ease = p => p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;      // easeInOut for every fade and move
const V = a => new T.Vector3(a[0], a[1], a[2]);
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = {
  get() { try { return localStorage.getItem(CFG.skipKey); } catch (e) { return null; } },
  set(on) { try { on ? localStorage.setItem(CFG.skipKey, '1') : localStorage.removeItem(CFG.skipKey); } catch (e) {} }
};
let BEATS = CFG.beats, N = BEATS.length;   // switched by begin('long' | 'short')
const MIN_YEAR = () => +($('slider') || {}).min || 1960;
const S = { mode: 'long', quiet: false, revIdx: 5, on: false, running: false, ending: false, i: -1, t0: 0, time: 0, muted: false, vol: .8, talking: false, spoken: false, voiceOn: false,
  aud: null, fx: null, kick: 0, fov0: 0, atm: false, fb: 0, leaving: 0, rip: 0, rips: [], revealed: false, base: 0, cur: null, from: null, glide: null, endT: 0, cm: null, yd: null };

/* ===================================================================== markup (built here, so index.html needs only 2 tags) */
const root = document.createElement('div'); root.id = 'iRoot'; root.hidden = true;
root.innerHTML = `
  <div id="iBlack"><canvas id="iSpace" aria-hidden="true"></canvas></div>
  <div id="iOpen">
    <div id="iFx" aria-hidden="true"><b class="fxSweep"></b></div>
    <div class="iCard"><figure id="iL1"></figure><span class="iDiv"></span><figure id="iL2"></figure></div>
    <h2 id="iName">${CFG.title}</h2><p id="iSub">${CFG.sub}</p>
    <div id="iGoRow"><button id="iGo" type="button">Full intro</button><button id="iGoShort" type="button">Quick intro &middot; 35 s</button></div>
    <p id="iFoot">${CFG.footer}</p>
  </div>
  <p id="iStory" aria-live="polite"></p>
  <div id="iBottom"><div id="iMach"></div><div id="iYear" aria-hidden="true"></div><p id="iCap" aria-live="polite"></p></div>
  <div id="iLines"></div><div id="iFlash"></div>
  <div id="iCtl">
    <button id="iSkip" type="button">Skip intro</button>
    <button id="iCaps" type="button" aria-pressed="true">Captions on</button>
    <button id="iMute" type="button" aria-pressed="false">Sound on</button>
    <label>Volume <input id="iVol" type="range" min="0" max="1" step=".05" value=".8" aria-label="Volume"></label>
  </div>`;
document.body.appendChild(root);

/* ===================================================================== PARALLAX SPACE (background of the opening screen)
   A 2D canvas inside #iBlack: 4 star layers at different depths (far = slow and still, near = fast and big), soft nebula glows, an occasional shooting star.
   Parallax follows the pointer; with no pointer (touch screens, or the mouse is idle) it sways by itself. It fades away with #iBlack and stops drawing afterwards. */
const SPACE = (() => {
  const cv = $('iSpace'), cx = cv.getContext('2d'), rnd = (a, b) => a + Math.random() * (b - a);
  let w = 0, h = 0, dpr = 1, stars = [], neb = [], shoot = null, run = false, last = 0, t = 0, px = 0, py = 0, tx = 0, ty = 0, lastPtr = -1e9, nextShoot = 3, offAt = 0, rt = 0;
  const glow = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.25, 'rgba(255,255,255,.35)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return c; })();
  function build() {
    dpr = Math.min(window.devicePixelRatio || 1, 2); w = innerWidth; h = innerHeight; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const k = Math.max(.6, w * h / 1e6 * 1.1), tint = ['#ffffff', '#cfe0ff', '#ffe3c9', '#ffb3a1']; stars = [];
    [[.1, 480, .8, 1.4], [.32, 230, 1.1, 1.9], [.62, 90, 1.4, 2.5], [1, 26, 1.9, 3.6]].forEach(([z, n, s0, s1]) => {     // [depth, count, min size, max size]
      for (let i = 0, m = Math.round(n * k); i < m; i++) stars.push({ x: Math.random(), y: Math.random(), z, s: rnd(s0, s1), a: rnd(.55, 1), ph: rnd(0, 6.28), sp: rnd(.4, 1.6), c: tint[Math.random() < .78 ? 0 : 1 + Math.floor(Math.random() * 3)] });
    });
    neb = [{ x: .2, y: .3, r: .55, c: '252,61,33', a: .17, z: .05 }, { x: .8, y: .72, r: .62, c: '70,110,255', a: .15, z: .08 }, { x: .55, y: .12, r: .42, c: '160,70,200', a: .1, z: .06 }];
  }
  function draw() {
    cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.clearRect(0, 0, w, h);
    cx.globalCompositeOperation = 'lighter';
    neb.forEach(n => {
      const X = n.x * w - px * n.z * 160 + Math.sin(t * .05 + n.x * 9) * 30, Y = n.y * h - py * n.z * 120 + Math.cos(t * .04 + n.y * 7) * 22, R = n.r * Math.max(w, h), g = cx.createRadialGradient(X, Y, 0, X, Y, R);
      g.addColorStop(0, `rgba(${n.c},${n.a})`); g.addColorStop(1, `rgba(${n.c},0)`); cx.fillStyle = g; cx.fillRect(0, 0, w, h);
    });
    const W = w + 120, H = h + 120;
    stars.forEach(s => {
      const X = ((s.x * W - t * (4 + 30 * s.z)) % W + W) % W - 60 - px * s.z * 46, Y = ((s.y * H - t * (.6 + 4 * s.z)) % H + H) % H - 60 - py * s.z * 30;
      const al = s.a * (.72 + .28 * Math.sin(t * s.sp + s.ph));
      if (s.z < .6) { cx.globalAlpha = Math.min(1, al * (.7 + s.z)); cx.fillStyle = s.c; cx.fillRect(X, Y, s.s, s.s); }
      else { const r = s.s * 3.2; cx.globalAlpha = al * .7; cx.drawImage(glow, X - r, Y - r, r * 2, r * 2); cx.globalAlpha = al; cx.fillStyle = s.c; cx.beginPath(); cx.arc(X, Y, s.s * .5, 0, 6.283); cx.fill(); }
    });
    cx.globalAlpha = 1;
    if (shoot) {
      const q = shoot.age / shoot.dur, hx = shoot.x + shoot.dx * q, hy = shoot.y + shoot.dy * q, tl = shoot.len * Math.sin(q * Math.PI), a = Math.atan2(shoot.dy, shoot.dx), g = cx.createLinearGradient(hx, hy, hx - Math.cos(a) * tl, hy - Math.sin(a) * tl);
      g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.3, 'rgba(255,190,170,.4)'); g.addColorStop(1, 'rgba(252,61,33,0)');
      cx.strokeStyle = g; cx.lineWidth = 1.6; cx.beginPath(); cx.moveTo(hx, hy); cx.lineTo(hx - Math.cos(a) * tl, hy - Math.sin(a) * tl); cx.stroke();
    }
    cx.globalCompositeOperation = 'source-over';
  }
  function frame(now) {
    if (!run) return;
    if (root.hidden) { run = false; return; }
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, .05); last = now; t += dt;
    if ($('iBlack').classList.contains('off')) { if (!offAt) offAt = now; if (now - offAt > 5000) { run = false; return; } } else offAt = 0;   // stop once it has faded out
    if (now - lastPtr > 2500) { tx = Math.sin(t * .13) * .7; ty = Math.cos(t * .09) * .4; }                    // idle: sway by itself
    const k = 1 - Math.exp(-dt * 2.5); px += (tx - px) * k; py += (ty - py) * k;
    if (shoot) { shoot.age += dt; if (shoot.age >= shoot.dur) shoot = null; }
    else if ((nextShoot -= dt) <= 0) { const a = rnd(.35, .7), d = rnd(380, 640), sx = rnd(.1, .8) * w; shoot = { x: sx, y: rnd(.05, .4) * h, dx: Math.cos(a) * d, dy: Math.sin(a) * d, len: rnd(90, 170), age: 0, dur: rnd(.8, 1.2) }; nextShoot = rnd(5, 9); }
    draw();
  }
  addEventListener('pointermove', e => { if (!run) return; lastPtr = performance.now(); tx = (e.clientX / innerWidth - .5) * 2; ty = (e.clientY / innerHeight - .5) * 2; }, { passive: true });
  addEventListener('deviceorientation', e => { if (!run || e.gamma == null) return; lastPtr = performance.now(); tx = cl(e.gamma / 30, -1, 1); ty = cl((e.beta - 45) / 30, -1, 1); }, { passive: true });
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (!run && !RM) return; build(); if (RM) draw(); }, 150); });
  return {
    start() {
      build(); offAt = 0; t = rnd(0, 50); px = py = tx = ty = 0; shoot = null; nextShoot = 3;
      if (RM) { draw(); return; }                  // reduced motion: one still frame, no drift, no parallax
      if (run) return; run = true; last = performance.now(); requestAnimationFrame(frame);
    }
  };
})();
const rep = $('replay') || Object.assign(document.createElement('button'), { id: 'replay', type: 'button', textContent: 'Replay intro' });
if (!rep.parentNode) document.body.appendChild(rep);
rep.textContent = 'Replay intro';
const srep = $('replayShort') || Object.assign(document.createElement('button'), { id: 'replayShort', type: 'button', textContent: 'Quick intro' });
if (!srep.parentNode) document.body.appendChild(srep);
const repShow = v => { rep.hidden = !v; srep.hidden = !v; };
function setLogo(slot, src, name) {               // a missing logo shows its name as text, never a broken image
  const f = $(slot); f.innerHTML = '';
  const txt = () => { f.innerHTML = ''; const b = document.createElement('b'); b.textContent = name; f.appendChild(b); };
  if (!src) return txt();
  const im = new Image(); im.alt = name; im.onerror = txt; im.src = src; f.appendChild(im);
}
function logos() { const x = CFG._ext || {}; setLogo('iL1', x.logos && x.logos.nasa !== undefined ? x.logos.nasa : CFG.logos.nasa, 'NASA Space Apps Challenge'); setLogo('iL2', x.logos && x.logos.bahrain !== undefined ? x.logos.bahrain : CFG.logos.bahrain, 'Bahrain Space Agency'); }

/* ===================================================================== VFX for the logo screen (quick: about 1.5 s). Pure CSS + a few spark elements. */
function vfx() {
  const o = $('iOpen'), box = $('iFx'); if (!o || !box) return;
  box.querySelectorAll('i').forEach(n => n.remove());
  o.classList.remove('fx'); void o.offsetWidth; o.classList.add('fx');         // restarts the CSS animations
  if (RM) return;
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('i'), a = Math.random() * 6.283, d = 120 + Math.random() * 360;
    p.style.setProperty('--x', Math.cos(a) * d + 'px'); p.style.setProperty('--y', Math.sin(a) * d * .55 + 'px');
    p.style.setProperty('--s', 3 + Math.random() * 5 + 'px'); p.style.animationDelay = Math.random() * .18 + 's'; box.appendChild(p);
  }
  A.ping(196, .2); A.impact(.45); A.swoosh(.28, .9, true); A.stat(.03); setTimeout(() => A.stat(0), 500);             // silent until the audio exists (after the Start click)
}

/* ===================================================================== AUDIO (Web Audio only; created after the Start click) */
const A = {
  ctx: null,
  init() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const x = this.ctx = new AC(); this.wd = null; if (x.resume) x.resume().catch(() => {});
      this.m = x.createGain(); this.m.gain.value = S.muted ? 0 : S.vol; this.m.connect(x.destination);
      this.mus = x.createGain(); this.mus.gain.value = 0; this.mus.connect(this.m);
      const f = x.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220; f.Q.value = 3; f.connect(this.mus);
      [55, 55.7].forEach(fr => { const o = x.createOscillator(), g = x.createGain(); o.type = 'sawtooth'; o.frequency.value = fr; g.gain.value = .25; o.connect(g); g.connect(f); o.start(); });
      const l = x.createOscillator(), lg = x.createGain(); l.frequency.value = .07; lg.gain.value = 140; l.connect(lg); lg.connect(f.frequency); l.start();   // slow filter sweep
      const nb = this.noise = x.createBuffer(1, x.sampleRate * 2, x.sampleRate), d = nb.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const ns = x.createBufferSource(), bp = x.createBiquadFilter(); ns.buffer = nb; ns.loop = true; bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = .6;
      this.st = x.createGain(); this.st.gain.value = 0; ns.connect(bp); bp.connect(this.st); this.st.connect(this.m); ns.start();                        // radio static
      this.level(.3, 3);
    } catch (e) { this.ctx = null; }
  },
  level(v, tc = .6) { S.base = v; this.duck(tc); },
  duck(tc = .6) { try { if (this.mus) this.mus.gain.setTargetAtTime(S.base * (S.talking ? .35 : 1), this.ctx.currentTime, tc); } catch (e) {} },   // music ducks under the voice
  stat(v) { try { if (this.st) this.st.gain.setTargetAtTime(v, this.ctx.currentTime, .3); } catch (e) {} },
  vol() { try { if (this.m) this.m.gain.setTargetAtTime(S.muted ? 0 : S.vol, this.ctx.currentTime, .1); } catch (e) {} },
  ping(freq, vol = .22, delay = 0) {               // sonar ping with an echo
    try {
      const x = this.ctx; if (!x) return; const t = x.currentTime + delay;
      const o = x.createOscillator(), g = x.createGain(), d = x.createDelay(), fb = x.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * .985, t + 1.2);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + 1.4);
      d.delayTime.value = .27; fb.gain.value = .32;
      o.connect(g); g.connect(this.m); g.connect(d); d.connect(fb); fb.connect(d); d.connect(this.m); o.start(t); o.stop(t + 3);
    } catch (e) {}
  },
  swell() {                                        // deep swell as the planets fade in
    try {
      const x = this.ctx; if (!x) return; const t = x.currentTime;
      const s = x.createBufferSource(), f = x.createBiquadFilter(), g = x.createGain(), o = x.createOscillator(), og = x.createGain();
      s.buffer = this.noise; f.type = 'lowpass'; f.frequency.setValueAtTime(200, t); f.frequency.exponentialRampToValueAtTime(3000, t + 3);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.35, t + 3); g.gain.linearRampToValueAtTime(0, t + 5.5);
      o.type = 'sine'; o.frequency.setValueAtTime(55, t); o.frequency.exponentialRampToValueAtTime(110, t + 3.5); og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(.3, t + 3); og.gain.linearRampToValueAtTime(0, t + 5.5);
      s.connect(f); f.connect(g); g.connect(this.m); o.connect(og); og.connect(this.m); s.start(t); s.stop(t + 5.5); o.start(t); o.stop(t + 5.5);
    } catch (e) {}
  },
  nz(type, f0, f1, v, dur, q = 1) {                // one-shot filtered noise sweep (the building block of swoosh and impact)
    try {
      const x = this.ctx; if (!x || !this.noise) return; const t = x.currentTime, s = x.createBufferSource(), f = x.createBiquadFilter(), g = x.createGain();
      s.buffer = this.noise; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + dur * .35); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(this.m); s.start(t); s.stop(t + dur + .05);
    } catch (e) {}
  },
  swoosh(v = .3, dur = .7, up = true) { this.nz('bandpass', up ? 250 : 3500, up ? 3500 : 250, v, dur, 1.1); },
  impact(v = .5) {                                 // low thump with a burst of rumble
    try {
      const x = this.ctx; if (!x) return; const t = x.currentTime, o = x.createOscillator(), g = x.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(34, t + .45);
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + .55); o.connect(g); g.connect(this.m); o.start(t); o.stop(t + .6);
      this.nz('lowpass', 1000, 120, v * .7, .4);
    } catch (e) {}
  },
  windOn(v) {                                      // thin wind bed with slow gusts (used on Mars)
    try {
      const x = this.ctx; if (!x || !this.noise) return;
      if (!this.wd) {
        const s = x.createBufferSource(), f = x.createBiquadFilter(), g = x.createGain(), l = x.createOscillator(), lg = x.createGain();
        s.buffer = this.noise; s.loop = true; f.type = 'bandpass'; f.frequency.value = 520; f.Q.value = .55; g.gain.value = 0; l.frequency.value = .14; lg.gain.value = 260;
        l.connect(lg); lg.connect(f.frequency); s.connect(f); f.connect(g); g.connect(this.m); s.start(); l.start(); this.wd = g;
      }
      this.wd.gain.setTargetAtTime(v, x.currentTime, .6);
    } catch (e) {}
  },
  fadeOut() { try { if (this.m) { this.m.gain.setTargetAtTime(0, this.ctx.currentTime, .5); const x = this.ctx; setTimeout(() => { try { x.close(); } catch (e) {} }, 2500); } } catch (e) {} this.ctx = null; }
};

/* ===================================================================== NARRATION (speechSynthesis; a missing voice or blocked audio never throws) */
const SP = {
  ok: 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window, v: null,
  pick() {
    if (!this.ok) return; let vs = []; try { vs = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang)); } catch (e) {}
    if (!vs.length) return;
    const sc = v => (/natural|neural|online/i.test(v.name) ? 4 : 0) + (/google uk|samantha|daniel|aria|jenny|libby|ryan|sonia/i.test(v.name) ? 2 : 0) + (/^en-(GB|US)/i.test(v.lang) ? 1 : 0);
    this.v = vs.sort((a, b) => sc(b) - sc(a))[0];
  },
  say(text, done) {                                // returns true if speech really started
    if (!this.ok || S.muted) { done(); return false; }
    try {
      speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); this.u = u;   // keep a reference (avoids a Chrome GC bug)
      if (!this.v) this.pick(); if (this.v) { u.voice = this.v; u.lang = this.v.lang; } else u.lang = 'en-US';
      u.rate = CFG.voice.rate; u.pitch = CFG.voice.pitch; u.volume = S.vol;
      let fin = false; const f = () => { if (fin) return; fin = true; S.talking = false; A.duck(); done(); };
      u.onend = f; u.onerror = f; S.talking = true; A.duck(); speechSynthesis.speak(u); return true;
    } catch (e) { S.talking = false; done(); return false; }
  },
  stop() { try { if (this.ok) speechSynthesis.cancel(); } catch (e) {} S.talking = false; }
};
if (SP.ok) { SP.pick(); try { speechSynthesis.onvoiceschanged = () => SP.pick(); } catch (e) {} }

/* ===================================================================== 3D helpers: ripples from Earth ("the echo"), glow on each awake machine */
const ringTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.strokeStyle = '#fff'; x.lineWidth = 6; x.beginPath(); x.arc(128, 128, 118, 0, 6.283); x.stroke(); return new T.CanvasTexture(c); })();
function ripple() {
  return;                                          // the red echo rings were removed
  const s = new T.Sprite(new T.SpriteMaterial({ map: ringTex, color: 0xfc3d21, transparent: true, opacity: .55, blending: T.AdditiveBlending, depthWrite: false, depthTest: false }));
  s.position.copy(E.FAR[0].o.position); s.renderOrder = 9; s.userData.age = 0; E.S.add(s); S.rips.push(s);   // FAR[0] is Earth
}
function ripples(dt) {
  S.rips = S.rips.filter(s => {
    const q = (s.userData.age += dt) / 5; if (q >= 1) { E.S.remove(s); s.material.dispose(); return false; }
    s.scale.setScalar(18 + q * 150); s.material.opacity = .55 * Math.pow(1 - q, 1.4); return true;
  });
}
function glows(dt, t) {
  return;                                          // the glow (aura) around each awake machine was removed
  E.M().forEach((m, i) => {
    if (!m.g) return;
    if (!m._ig) { const s = new T.Sprite(new T.SpriteMaterial({ map: E.GT, color: 0xfc3d21, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false })); s.scale.set(3.2, 3.2, 1); m.g.add(s); m._ig = s; }
    const cur = S.cm && S.cm.id === m.id, tg = m.on ? (cur ? .95 : .3 + .12 * Math.sin(t * 3 + i)) : 0, o = m._ig.material;
    o.opacity += (tg - o.opacity) * (1 - Math.exp(-dt * 4));
  });
}

/* ===================================================================== PARTICLES + ATMOSPHERE + PUNCH EFFECTS */
const ZERO = new T.Vector3();
function pfxInit() {                               // sparks, dust and floating motes in the main scene (same particle code as the stories)
  if (S.fx || !E.emitter || RM) return;
  const mk = o => { const f = E.emitter(Object.assign({ off: ZERO, floor: -1e6 }, o)); E.S.add(f.obj); return f; };
  S.fx = {
    spark: mk({ n: 400, add: true, color: 0xffc070, size: .16, grow: -.5, life: .9, speed: 5, spread: 1.4, drag: .8, op: 1, radius: .3 }),
    dust: mk({ n: 300, color: 0xd9b090, size: .5, grow: 2, life: 1.4, speed: 2.5, radial: true, up: 1.5, drag: 1.2, op: .45, radius: .4 }),
    mote: mk({ n: 220, add: true, color: 0xffffff, size: .09, life: 4, speed: .4, spread: 1, box: 40, op: .7 })
  };
}
function pfxClear() { if (!S.fx) return; Object.values(S.fx).forEach(f => { E.S.remove(f.obj); f.obj.geometry.dispose(); f.obj.material.dispose(); }); S.fx = null; }
function boom(m, n = 1) {                          // sparks and a dust ring where a machine wakes up
  if (!S.fx || !m || !m.g) return; const p = m.g.position, f = S.fx;
  f.spark.src.copy(p); f.spark.dir.set(0, 1, 0); f.spark.burst(Math.round(45 * n));
  f.dust.obj.material.uniforms.uC.value.setHex(m.body === 'moon' ? 0xbdbdbd : 0xd09070); f.dust.src.copy(p); f.dust.src.y -= .3; f.dust.burst(Math.round(34 * n));
}
function atmos() {                                 // a glowing atmosphere rim on Earth and Mars (planet scenes)
  return;                                          // the atmosphere rim was removed (delete this line to bring it back)
  if (S.atm || !E.atmo) return; S.atm = true;
  [[E.B && E.B.mars && E.B.mars.o, 0xff8a55, 1.1, 3.4], [E.FAR && E.FAR[0] && E.FAR[0].o, 0x4aa3ff, 1.17, 3]].forEach(([o, col, k, pw]) => {
    if (!o) return;
    try {
      const sz = new T.Box3().setFromObject(o).getSize(new T.Vector3()), ws = new T.Vector3(); o.getWorldScale(ws);
      o.add(E.atmo(Math.max(sz.x, sz.y, sz.z) / 2 / (ws.x || 1), col, k, pw));
    } catch (e) {}
  });
}
function punch(id, c) { const el = $(id); if (!el) return; el.classList.remove(c); void el.offsetWidth; el.classList.add(c); }
function fxBeat(m) {                               // everything that happens when the tour reaches a machine (same calm effects in both versions)
  A.windOn(m.body === 'mars' ? .07 : 0);
  boom(m, .6); S.kick = 7; E.shake && E.shake(.18);
  A.swoosh(.16, .9, S.i % 2 === 0);
}
/* QUICK intro (about 35 s): the year counter starts at CFG.quickStart (1970) and runs on slowly. Machines already there by that year are awake in the wide shot;
   then the camera visits every later machine that really loaded, oldest first, while the counter climbs to the next machine's year (see quickYear()). */
const NUMW = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
function buildShort() {
  const y0 = CFG.quickStart;
  let ms = E.M().filter(m => m.g).slice().sort((a, b) => a.year - b.year);
  const land = ms.filter(m => m.body !== 'space'); if (land.length >= 5) ms = land;
  const early = ms.filter(m => m.year <= y0), tour = ms.filter(m => m.year > y0), n = early.length;
  const cap = n ? `By ${y0}, ${n < NUMW.length ? NUMW[n] : n} ${n === 1 ? 'machine was' : 'machines were'} already out there.` : '';
  return [{ id: 'logos', min: 2.4, out: 1.2, text: '', leave: 'open' }, { id: 'reveal', min: 3.6, cam: 'wide', text: cap }]
    .concat(tour.map((m, k) => ({ id: 'q' + k, mid: m.id, min: 3.4 })))
    .concat([{ id: 'outro', min: 3.2, cam: 'home', text: 'Wake them up. Hear their stories.' }]);
}
function quickYear(b, e) {                         // the year counter runs on its own clock: it climbs to the NEXT beat's year during the second half of this beat
  const el = $('iYear'), nb = BEATS[S.i + 1];
  const a = b._m ? b._m.year : b.id === 'reveal' ? CFG.quickStart : null; if (a == null) return;
  let ty = null;
  if (nb && nb.mid) { const m = E.M().find(x => x.id === nb.mid); if (m) ty = m.year; } else if (nb && nb.id === 'outro') ty = +($('slider') || {}).max || 2026;
  let y = a; if (ty != null && ty > a) y = lerp(a, ty, ease(cl((e - b.min * .45) / (b.min * .55))));
  y = Math.round(y); if (el.textContent != y) el.textContent = y;
}

/* ===================================================================== camera */
function setCam(pos, look) { S.cur.pos.copy(pos); S.cur.look.copy(look); E.introCam = { pos: S.cur.pos, look: S.cur.look }; }
function homePose() {                              // exactly what the app's rig produces, so the hand-over has no jump
  const r = E.rig, cp = Math.cos(r.pit);
  return { pos: new T.Vector3(r.t.x + Math.sin(r.yaw) * cp * r.d, r.t.y + Math.sin(r.pit) * r.d, r.t.z + Math.cos(r.yaw) * cp * r.d), look: r.t.clone() };
}
function followPose(m) {                           // sit on the side of the machine facing away from its planet, so the planet is the backdrop
  const mp = m.g.position, b = E.B[m.body], d = b ? mp.clone().sub(b.o.position) : new T.Vector3(0, 0, 1);
  if (d.lengthSq() < 1e-4) d.set(0, 0, 1); d.normalize();
  return { pos: mp.clone().addScaledVector(d, CFG.follow.dist).add(new T.Vector3(0, CFG.follow.lift, 0)), look: mp.clone() };
}

/* ===================================================================== sequencer */
function caption(t) { $('iCap').textContent = t || ''; }
function speakBeat(i) {
  const b = BEATS[i], idx = i, words = b.text.split(/\s+/).length;
  S.voiceOn = SP.say(b.text, () => { if (S.i === idx) S.spoken = true; });
  clearTimeout(S.fb); S.fb = setTimeout(() => { if (S.i === idx) S.spoken = true; }, (b.min + words * .55 + 3) * 1000);   // fallback if onend never fires
}
function startBeat(i) {
  const b = BEATS[i];
  if (b.mid) {                                     // machine beats: text comes from the mission data
    const m = E.M().find(x => x.id === b.mid);
    if (!m) return i + 1 < N ? startBeat(i + 1) : finish(false);
    b._m = m; b.text = S.quiet ? (CFG.rover[m.id] ? m.name + '. ' + CFG.rover[m.id] : m.name) : [m.name + '.', m.date ? m.date + '.' : '', CFG.phrase[m.status] || ''].join(' ').replace(/\s+/g, ' ').trim();
  }
  if (S.quiet && b._m && CFG.rover[b._m.id]) b.min = Math.max(b.min, 2 + b.text.split(/\s+/).length / 3);   // long enough to read the rover line
  S.i = i; S.t0 = S.time; S.spoken = false; S.voiceOn = false; S.leaving = 0; S.cm = b._m || null;
  S.from = { pos: S.cur.pos.clone(), look: S.cur.look.clone() }; clearTimeout(S.fb);
  if (b.kind === 'story') { caption(''); const st = $('iStory'); st.textContent = b.text; st.classList.add('on'); } else caption(b.text);
  if (!b.text || S.aud || S.quiet) S.spoken = true; else speakBeat(i);
  enter(b);
}
function next() { S.i + 1 < N ? startBeat(S.i + 1) : finish(false); }

function enter(b) {
  const id = b.id;
  if (id === 'logos') { $('iGo').classList.add('gone'); $('iGoShort').classList.add('gone'); A.level(.3, 3); vfx(); }
  if (id === 'reveal') { $('iBlack').classList.add('off'); A.swell(); A.level(.5, 2); A.swoosh(.4, 2.4, true); A.impact(.3); S.kick = 5; ripple(); S.rip = S.time;
    if (S.quiet) { E.setYear(CFG.quickStart); $('iYear').textContent = CFG.quickStart; $('iYear').classList.add('on'); } }
  if (b._m) {                                      // wake this machine (and, by chronology, everything before it)
    const m = b._m, list = E.M(), i = list.indexOf(m), sc = [0, 2, 4, 7, 9];
    E.setYear(m.year); ripple(); S.rip = S.time; A.stat(.012); fxBeat(m);
    $('iYear').classList.add('on'); $('iMach').textContent = m.where || '';
    if (S.quiet) $('iYear').textContent = m.year;      // quick intro: the counter already climbed to this year during the previous beat
    else { const a = S.yd ? S.yd.b : m.year - 8; S.yd = { a, b: m.year, t0: S.time, dur: 1.3 }; }
    A.ping(392 * Math.pow(2, (sc[i % 5] + (i % 2) * 12) / 12), .24, .5);   // a different pitch for each machine
  }
  if (id === 'outro') {
    A.level(.3, 2); A.stat(0); A.windOn(0);
    if (S.quiet) { const mx = +($('slider') || {}).max || 2026; E.setYear(mx); $('iYear').textContent = mx; S.yd = { a: mx, b: mx, t0: S.time, dur: 1 }; $('iMach').textContent = 'Today'; A.swoosh(.25, 1.8, true); S.kick = 5; }
    else { $('iYear').classList.remove('on'); $('iMach').textContent = ''; }
  }
}

function sequence(t, dt) {
  const b = BEATS[S.i], e = t - S.t0, p = cl(e / b.min), id = b.id;
  let to = null, dur = b.min;                      // camera: eased fly to this beat's pose
  if (b.cam === 'home') to = homePose(); else if (b.cam === 'wide') to = { pos: V(CFG.wide.pos), look: V(CFG.wide.look) };
  else if (b._m && b._m.g && b._m.g.visible) { to = followPose(b._m); dur = CFG.follow.fly; }
  if (!RM && to) { const q = ease(cl(e / dur)); setCam(S.from.pos.clone().lerp(to.pos, q), S.from.look.clone().lerp(to.look, q)); }
  if (S.quiet) quickYear(b, e);
  if (S.yd) { const y = Math.round(lerp(S.yd.a, S.yd.b, ease(cl((t - S.yd.t0) / (S.yd.dur || 1.3))))); if ($('iYear').textContent != y) $('iYear').textContent = y; }
  if (!RM && S.i >= S.revIdx && S.i < N - 1 && t - S.rip > 3) { S.rip = t; ripple(); }
  if (id === 'outro') {
    if (p > (S.quiet ? .8 : .25) && S.yd) { S.yd = null; E.setYear(MIN_YEAR()); S.cm = null; $('iYear').classList.remove('on'); $('iMach').textContent = ''; }   // timeline empties, ready for the visitor
    if (p > .4 && !S.revealed) reveal();
  }
  let ready;                                       // when may this beat leave?
  if (S.aud) ready = S.i + 1 < N ? S.aud.currentTime >= CFG.cues[S.i + 1] : (e >= b.min && (S.aud.ended || S.aud.paused));
  else ready = e >= (S.quiet || S.voiceOn ? b.min : Math.max(b.min, b.text ? b.text.split(/\s+/).length * .4 : 0)) && S.spoken;
  if (!ready) return;
  if (b.out && !S.aud) {                           // fade this beat out first
    if (!S.leaving) { S.leaving = t; if (b.kind === 'story') $('iStory').classList.remove('on'); if (b.leave === 'open') { $('iOpen').classList.add('out'); caption(''); } }
    if (t - S.leaving < b.out) return;
  }
  next();
}
function reveal() {                                // normal UI fades in
  if (S.revealed) return; S.revealed = true;
  document.body.classList.remove('intro'); document.body.classList.add('intro-in'); setTimeout(() => document.body.classList.remove('intro-in'), 2000);
}

/* ===================================================================== start, finish, skip */
function begin(mode) {
  if (S.running) return;
  S.mode = mode === 'short' || mode === 'long' ? mode : S.mode; S.quiet = S.mode === 'short';
  BEATS = S.quiet ? buildShort() : CFG.beats; N = BEATS.length; root.classList.toggle('quick', S.quiet); pfxInit(); S.revIdx = Math.max(1, BEATS.findIndex(b => b.id === 'reveal'));
  A.init(); SP.pick(); logos();
  const x = CFG._ext || {}, src = x.audio !== undefined ? x.audio : CFG.audio, cues = x.cues || CFG.cues; CFG.cues = cues;
  if (!S.quiet && src && cues.length >= CFG.beats.length) {                   // optional recorded voice; any problem falls back to the browser voice silently
    try {
      const a = new Audio(src), bad = () => { if (S.aud === a) { S.aud = null; if (S.running && BEATS[S.i].text && !S.spoken) speakBeat(S.i); } };
      a.volume = S.vol; a.muted = S.muted; a.onerror = bad; S.aud = a; const pr = a.play(); if (pr && pr.catch) pr.catch(bad);
    } catch (e) { S.aud = null; }
  }
  S.running = true; startBeat(0);
}
function finish(skipped) {
  if (!S.on || S.ending) return; S.ending = true; S.running = false; clearTimeout(S.fb); SP.stop();
  if (S.aud) { try { S.aud.pause(); } catch (e) {} S.aud = null; }
  if (skipped) store.set(true);
  S.glide = null;
  if (E.gate) E.gate.cycle({ title: 'Entering the scene', hold: S.quiet ? 350 : undefined, onClosed: () => conclude(skipped, true) });   // sci-fi gate closes, the scene is swapped behind it, the gate opens
  else conclude(skipped, false);
}
function conclude(skipped, covered) {              // covered = the gate doors are hiding everything, so no fades or camera glide are needed
  E.setYear(MIN_YEAR()); S.cm = null; S.yd = null;
  $('iBlack').style.transitionDuration = covered ? '0s' : '1.1s'; root.style.transitionDuration = covered ? '0s' : '';
  $('iBlack').classList.add('off'); $('iOpen').classList.add('out'); $('iStory').classList.remove('on');
  A.fadeOut(); reveal(); root.classList.add('out');
  S.endT = S.time; S.glide = { d: skipped && !RM && !covered ? 1.6 : 0, from: { pos: S.cur.pos.clone(), look: S.cur.look.clone() } };
}
function endFrame() {                              // smooth glide to the home view (skip at any stage), then clean up
  const e = S.time - S.endT, g = S.glide;
  if (g.d > 0 && e < g.d) { const h = homePose(), q = ease(e / g.d); setCam(g.from.pos.clone().lerp(h.pos, q), g.from.look.clone().lerp(h.look, q)); }
  else E.introCam = null;
  if (e >= Math.max(g.d, 1.3)) cleanup();
}
function cleanup() {
  E.introCam = null; S.rips.forEach(s => { E.S.remove(s); s.material.dispose(); }); S.rips = [];
  E.M().forEach(m => { if (m._ig) { m.g.remove(m._ig); m._ig.material.dispose(); m._ig = null; } });
  pfxClear(); A.windOn(0); if (E.C && S.fov0) { E.C.fov = S.fov0; E.C.updateProjectionMatrix(); } S.kick = 0;
  root.hidden = true; root.classList.remove('out', 'quick'); document.body.classList.remove('intro'); S.on = false; S.ending = false; S.running = false; repShow(true);
}
function reset() {
  $('iOpen').classList.remove('out'); $('iGo').classList.remove('gone'); $('iGoShort').classList.remove('gone'); $('iStory').classList.remove('on'); $('iStory').textContent = '';
  $('iBlack').style.transitionDuration = ''; root.style.transitionDuration = ''; S.glide = null; $('iBlack').classList.remove('off'); $('iYear').classList.remove('on'); $('iMach').textContent = ''; caption('');
  S.revealed = false; S.ending = false; S.running = false; S.i = -1; S.rip = 0; S.cm = null; S.yd = null; S.leaving = 0;
  S.cur = { pos: V(CFG.startPose.pos), look: V(CFG.startPose.look) };
  [...CFG.beats, ...CFG.short].forEach(b => { if (b.mid) b.text = ''; });
}
let last = 0;
function tick(now) {
  if (!S.on) return; requestAnimationFrame(tick);
  const dt = Math.min((now - last) / 1000, .05); last = now; S.time = now / 1000;
  if (!RM) {
    ripples(dt); glows(dt, S.time);
    if (S.fx) { S.fx.mote.rate = S.running && S.i >= S.revIdx ? 35 : 0; Object.values(S.fx).forEach(f => f.step(dt)); }
    if (E.C && S.fov0 && S.kick > .05) { S.kick *= Math.exp(-dt * 6); E.C.fov = S.fov0 + S.kick; E.C.updateProjectionMatrix(); }
  }
  if (S.running) sequence(S.time, dt);
  if (S.ending && S.glide) endFrame();
}
function play(replay, mode) {                            // first visit: opening screen with Start button. Replay: starts straight away
  if (S.on || E.active) return;
  try { E.exitFocus(); } catch (e) {}
  reset(); if (E.C) S.fov0 = E.C.fov; atmos(); document.body.classList.add('intro'); repShow(false); root.hidden = false; S.on = true; logos(); vfx(); SPACE.start();
  if (!RM) setCam(S.cur.pos, S.cur.look);
  last = performance.now(); requestAnimationFrame(tick);
  if (replay) begin(mode || S.mode); else $('iGo').focus();
}

/* ===================================================================== controls */
$('iGo').onclick = () => begin('long');
$('iGoShort').onclick = () => begin('short');
$('iSkip').onclick = () => finish(true);
$('iCaps').onclick = e => { const on = root.classList.toggle('nocap') === false; e.currentTarget.setAttribute('aria-pressed', on); e.currentTarget.textContent = on ? 'Captions on' : 'Captions off'; };
$('iMute').onclick = e => {
  S.muted = !S.muted; e.currentTarget.setAttribute('aria-pressed', S.muted); e.currentTarget.textContent = S.muted ? 'Sound off' : 'Sound on';
  if (S.muted) SP.stop(); A.vol(); if (S.aud) S.aud.muted = S.muted;
};
$('iVol').oninput = e => { S.vol = +e.target.value; A.vol(); if (S.aud) S.aud.volume = S.vol; };
rep.onclick = () => play(true, 'long');
srep.onclick = () => play(true, 'short');
addEventListener('keydown', e => {                 // capture phase: while the intro runs, the 3D controls are locked
  if (!S.on) return;
  if (e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); finish(true); return; }
  if (!['INPUT', 'BUTTON'].includes(e.target.tagName)) e.stopImmediatePropagation();
}, true);
E.playIntro = mode => play(true, mode);   // E.playIntro('short') or E.playIntro('long')

/* ===================================================================== boot */
fetch(CFG.extFile).then(r => r.ok ? r.json() : null).catch(() => null).then(j => { CFG._ext = j || {}; if (S.on) logos(); });
repShow(false);
if (store.get()) repShow(true); else play(false);
})();
