/* ECHOES OF SPACE: animated mission stories (Sojourner, Apollo 11 descent stage).
   Loaded after app.js. Uses window.EOS, which app.js exposes. Facts: NASA/JPL, NASA Apollo 11 records, LROC. */
(() => {
const E = window.EOS, T = E.THREE, S = E.S, C = E.C, RM = E.RM;
const $ = id => document.getElementById(id);
const V = (x, y, z) => new T.Vector3(x, y, z);
const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, p) => a + (b - a) * p;
const ease = p => p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
const sub = (p, a, b) => cl((p - a) / (b - a));
const mat = (c, o = {}) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 1, flatShading: true }, o));
const ROVER_YAW = 0;   // if your Sojourner .glb drives sideways, change this (radians)

/* The story "stage" sits far below the main scene so nothing else is in view. */
const G = new T.Group(); G.position.set(0, -300, 0); G.visible = false; S.add(G);
const OFF = G.position;
const look = (px, py, pz, lx, ly, lz) => { C.position.set(px + OFF.x, py + OFF.y, pz + OFF.z); C.lookAt(lx + OFF.x, ly + OFF.y, lz + OFF.z); };

/* ---------- small builders ---------- */
function add(g, geo, c, pos, rot) { const m = new T.Mesh(geo, mat(c, { metalness: .25 })); if (pos) m.position.set(...pos); if (rot) m.rotation.set(...rot); g.add(m); return m; }
const SEED = { earth: 3, mars: 5, moon: 8 };
function body(r, k) { return E.planet(k, r) || E.lowPoly(r, E.PAL[k], SEED[k]); }   // no atmosphere aura around planets   // the loaded assets/models/<k>.glb; low-poly only if that file is missing
function glow(col, size, op = 1) {
  const g = _glow(col, size, op); g.visible = false; return g;
}
function _glow(col, size, op = 1) {
  const s = new T.Sprite(new T.SpriteMaterial({ map: E.GT, color: col, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false }));
  s.scale.set(size, size, 1); return s;
}
/* scale a clone of a mission's model so its biggest side = size, with its base on y = 0 */
function norm(o, size) {
  const w = new T.Group(); w.add(o);
  const b = new T.Box3().setFromObject(o), s = b.getSize(V(0, 0, 0)), c = b.getCenter(V(0, 0, 0));
  o.position.x -= c.x; o.position.y -= b.min.y; o.position.z -= c.z;
  w.scale.setScalar(size / Math.max(s.x, s.y, s.z, .001)); return w;
}
const hgt = (x, z, a) => a * Math.min(1, Math.hypot(x, z) / 25) * (Math.sin(x * .11) + Math.sin(z * .13 + 1) + .5 * Math.sin((x + z) * .31));
function ground(col, amp, rocks) {
  const g = new T.Group(), geo = new T.PlaneGeometry(700, 700, 90, 90); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, hgt(p.getX(i), p.getZ(i), amp));
  geo.computeVertexNormals(); const gmat = mat(col); gmat.userData.fog = true; g.add(new T.Mesh(geo, gmat));
  let sd = 7; const rnd = () => (sd = sd * 16807 % 2147483647) / 2147483647;
  for (let i = 0; i < rocks; i++) {
    const a = rnd() * 6.283, d = 7 + rnd() * 120, x = Math.cos(a) * d, z = Math.sin(a) * d, r = .12 + rnd() * rnd() * 1.7;
    const m = new T.Mesh(new T.IcosahedronGeometry(r, 0), (() => { const q = mat(new T.Color(col).multiplyScalar(.65 + rnd() * .45)); q.userData.fog = true; return q; })());
    m.position.set(x, hgt(x, z, amp) + r * .3, z); m.rotation.set(rnd() * 3, rnd() * 3, 0); m.scale.y = .6; g.add(m);
  }
  return g;
}
function sky(top, haze, floor) {
  const c = document.createElement('canvas'); c.width = 2; c.height = 256;
  const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, top); g.addColorStop(.5, haze); g.addColorStop(.52, floor); g.addColorStop(1, floor);
  x.fillStyle = g; x.fillRect(0, 0, 2, 256);
  const m = new T.Mesh(new T.SphereGeometry(500, 24, 16), new T.MeshBasicMaterial({ map: new T.CanvasTexture(c), side: T.BackSide, depthWrite: false }));
  m.renderOrder = -1; return m;
}
function cruise() {
  const g = new T.Group();
  add(g, new T.CylinderGeometry(.45, .45, .5, 12), 0xcfcfcf, [0, 0, 0], [0, 0, Math.PI / 2]);
  add(g, new T.ConeGeometry(.45, .5, 12), 0x9a9a9a, [.5, 0, 0], [0, 0, -Math.PI / 2]);
  add(g, new T.CylinderGeometry(1, 1, .05, 24), 0x1c3d94, [-.35, 0, 0], [0, 0, Math.PI / 2]);
  return g;
}
function lander() {
  const g = new T.Group();
  add(g, new T.CylinderGeometry(1.5, 1.5, .3, 3), 0xc8c8c8, [0, .3, 0]);
  for (let i = 0; i < 3; i++) { const a = i * 2.094 + 1.047, m = add(g, new T.BoxGeometry(2.4, .06, 2.0), 0x24459a, [Math.cos(a) * 1.9, .2, Math.sin(a) * 1.9]); m.rotation.y = -a; }
  add(g, new T.CylinderGeometry(.04, .04, 1.5, 5), 0x999999, [0, 1.1, 0]);
  add(g, new T.BoxGeometry(.3, .2, .3), 0x222222, [0, 1.9, 0]);
  return g;
}
function makeRover() { const r = norm(E.clone('sojourner'), .9); const w = new T.Group(); w.add(r); r.rotation.y = ROVER_YAW; return w; }
/* Lunar Module: descent stage = clone of the model for "apollo-11-eagle"; the ascent stage is drawn on top as a simple stand-in */
function mkLM(withAscent = true) {
  const g = new T.Group(), d = norm(E.clone('apollo-11-eagle'), 4.2); g.add(d);
  g.H = new T.Box3().setFromObject(d).getSize(V(0, 0, 0)).y;
  const a = new T.Group();
  add(a, new T.CylinderGeometry(1.05, 1.2, 1.4, 8), 0xcfcfcf, [0, .7, 0]);
  add(a, new T.BoxGeometry(.5, .3, .1), 0x111111, [.4, 1, 1.0]); add(a, new T.BoxGeometry(.5, .3, .1), 0x111111, [-.4, 1, 1.0]);
  add(a, new T.CylinderGeometry(.02, .02, 1, 4), 0xaaaaaa, [0, 1.9, 0]);
  a.rest = g.H * .8; a.position.y = a.rest; if (withAscent) g.add(a);
  g.asc = a; return g;
}
function flame(h, w) { const m = new T.Mesh(new T.ConeGeometry(w, h, 12, 1, true), new T.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: .6, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); m.position.y = -h / 2; return m; }

/* ---------- ATMOSPHERE GLOW for planet bodies (Earth, Mars). Rim light that makes the planet scenes feel dramatic. ---------- */
function atmo(r, col, k = 1.15, pw = 3) {
  const m = new T.Mesh(new T.SphereGeometry(r * k, 40, 28), new T.ShaderMaterial({
    uniforms: { uC: { value: new T.Color(col) }, uP: { value: pw } },
    vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uC; uniform float uP; varying vec3 vN; void main(){ float i = pow(max(0.72 - dot(vN, vec3(0.0, 0.0, 1.0)), 0.0), uP); gl_FragColor = vec4(uC * i * 2.2, 1.0); }',
    side: T.BackSide, blending: T.AdditiveBlending, transparent: true, depthWrite: false
  }));
  m.renderOrder = 2; return m;
}
E.atmo = atmo;
const ATM = { earth: [0x4aa3ff, 1.17, 3], mars: [0xff8a55, 1.1, 3.4] };

/* ---------- PARTICLES: dust, sparks, exhaust, floating motes. One Points object per emitter, soft round sprites, no textures. ---------- */
const PV = 'attribute float aA; attribute float aS; varying float vA; uniform float uK; void main(){ vA = aA; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aS * uK / max(-mv.z, 0.1); gl_Position = projectionMatrix * mv; }';
const PFG = 'uniform vec3 uC; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.05, d) * vA; if (a < 0.01) discard; gl_FragColor = vec4(uC, a); }';
function emitter(o) {
  const n = o.n || 300, pos = new Float32Array(n * 3), vel = new Float32Array(n * 3), al = new Float32Array(n), sz = new Float32Array(n);
  const age = new Float32Array(n).fill(99), life = new Float32Array(n).fill(1), sj = new Float32Array(n).fill(1);
  const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('aA', new T.BufferAttribute(al, 1)); geo.setAttribute('aS', new T.BufferAttribute(sz, 1));
  const mt = new T.ShaderMaterial({ uniforms: { uC: { value: new T.Color(o.color || 0xffffff) }, uK: { value: 600 } }, vertexShader: PV, fragmentShader: PFG, transparent: true, depthWrite: false, blending: o.add ? T.AdditiveBlending : T.NormalBlending });
  const obj = new T.Points(geo, mt); obj.frustumCulled = false; obj.renderOrder = 6;
  const off = o.off || OFF, op = o.op == null ? .8 : o.op, floor = o.floor == null ? .04 : o.floor, rnd = Math.random;
  let k = 0, acc = 0;
  const f = { obj, opt: o, src: V(0, 0, 0), dir: V(0, 1, 0), wind: V(0, 0, 0), rate: 0 };
  function spawn() {
    const i = k; k = (k + 1) % n;
    const a = rnd() * 6.283, rr = Math.sqrt(rnd()) * (o.radius || 0), sp = (o.speed || 2) * (.4 + rnd() * .9), j = i * 3;
    if (o.box) { const c = C.position; pos[j] = c.x - off.x + (rnd() - .5) * o.box; pos[j + 1] = c.y - off.y + (rnd() - .35) * o.box * .6; pos[j + 2] = c.z - off.z + (rnd() - .5) * o.box; }
    else { pos[j] = f.src.x + Math.cos(a) * rr; pos[j + 1] = f.src.y; pos[j + 2] = f.src.z + Math.sin(a) * rr; }
    if (o.radial) { vel[j] = Math.cos(a) * sp; vel[j + 1] = (o.up || 0) * rnd() + .2; vel[j + 2] = Math.sin(a) * sp; }
    else { const s = (o.spread || 1) * sp; vel[j] = f.dir.x * sp + (rnd() - .5) * s; vel[j + 1] = f.dir.y * sp + (rnd() - .5) * s; vel[j + 2] = f.dir.z * sp + (rnd() - .5) * s; }
    age[i] = 0; life[i] = (o.life || 1) * (.6 + rnd() * .8); sj[i] = .6 + rnd() * .8;
  }
  f.burst = (m, at) => { if (at) f.src.copy(at); for (let i = 0; i < m; i++) spawn(); };
  f.clear = () => { age.fill(99); al.fill(0); sz.fill(0); geo.attributes.aA.needsUpdate = geo.attributes.aS.needsUpdate = true; };
  f.step = dt => {
    mt.uniforms.uK.value = E.R.domElement.height / (2 * Math.tan(C.fov * Math.PI / 360));
    if (!dt) return;
    acc = Math.min(n, acc + f.rate * dt); while (acc >= 1) { acc--; spawn(); }
    const dr = Math.max(0, 1 - (o.drag || 0) * dt), g = (o.grav || 0) * dt;
    for (let i = 0; i < n; i++) {
      const j = i * 3;
      if (age[i] >= life[i]) { al[i] = 0; sz[i] = 0; continue; }
      age[i] += dt; const q = age[i] / life[i];
      vel[j] *= dr; vel[j + 1] = vel[j + 1] * dr + g; vel[j + 2] *= dr;
      pos[j] += (vel[j] + f.wind.x) * dt; pos[j + 1] += (vel[j + 1] + f.wind.y) * dt; pos[j + 2] += (vel[j + 2] + f.wind.z) * dt;
      if (!o.box && pos[j + 1] < floor) { pos[j + 1] = floor; vel[j + 1] = 0; vel[j] *= .92; vel[j + 2] *= .92; }
      al[i] = op * Math.min(1, q / .08) * Math.pow(1 - q, 1.3);
      sz[i] = (o.size || 1) * sj[i] * Math.max(.05, 1 + (o.grow || 0) * q);
    }
    geo.attributes.position.needsUpdate = geo.attributes.aA.needsUpdate = geo.attributes.aS.needsUpdate = true;
  };
  return f;
}
E.emitter = emitter;   // the intro uses the same particles in the main scene

/* ---------- SOUND EFFECTS: wind, engine rumble, impact, swoosh. Same audio context as the story drone; silent when muted. ---------- */
const SX = {
  g: null, nb: null, wind: null, eng: null,
  ok() { return !!ac && !muted && !!this.g; },
  init() {
    if (this.g || !ac) return;
    this.g = ac.createGain(); this.g.gain.value = .6; this.g.connect(ac.destination);
    const b = this.nb = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.wind = this.bed('bandpass', 500, .6, .13, 240); this.eng = this.bed('lowpass', 220, 1.1, .5, 40);
  },
  bed(type, fr, q, lf, la) {   // looping noise with a slow wobble: gusts for wind, throb for the engine
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), l = ac.createOscillator(), lg = ac.createGain();
    s.buffer = this.nb; s.loop = true; f.type = type; f.frequency.value = fr; f.Q.value = q; g.gain.value = 0;
    l.frequency.value = lf; lg.gain.value = la; l.connect(lg); lg.connect(f.frequency); s.connect(f); f.connect(g); g.connect(this.g); s.start(); l.start();
    return { f, g };
  },
  set(b, v) { if (!this.ok() || !b) return; b.g.gain.setTargetAtTime(v, ac.currentTime, .3); },
  zero() { try { [this.wind, this.eng].forEach(b => b && b.g.gain.setTargetAtTime(0, ac.currentTime, .1)); } catch (e) {} },
  noise(type, f0, f1, v, dur, q = 1) {
    if (!this.ok()) return;
    const t = ac.currentTime, s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = this.nb; fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + dur * .35); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(this.g); s.start(t); s.stop(t + dur + .05);
  },
  swoosh(v = .35, up = true, dur = 1) { this.noise('bandpass', up ? 300 : 3200, up ? 3200 : 300, v, dur, 1.2); },
  hit(v = .6) {
    if (!this.ok()) return;
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(34, t + .5);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + .6); o.connect(g); g.connect(this.g); o.start(t); o.stop(t + .7);
    this.noise('lowpass', 900, 120, v * .7, .45);
  }
};

/* ---------- PER-STORY EFFECTS STATE ---------- */
let F = null, MEM = {}, FOG = null, BASE = null, MM = null;
const H = { wind: 0, eng: 0 };
function FXopen(id) {
  MM = E.M().find(x => x.id === id) || null;
  const body = MM ? MM.body : 'space', moon = body === 'moon', mars = body === 'mars', gr = moon ? -1.62 : -3.7;
  F = {
    dust: emitter({ n: 600, color: moon ? 0xb9b6b0 : 0xc98b5e, size: 1.1, grow: moon ? .6 : 2.6, life: moon ? 3 : 2.6, speed: moon ? 6 : 5, radial: true, up: moon ? 3 : 1.4, grav: gr, drag: moon ? 0 : .9, op: .55, radius: .8 }),
    spark: emitter({ n: 300, add: true, color: 0xffc070, size: .3, grow: -.6, life: .9, speed: 8, spread: 1, grav: gr * 2, drag: .25, op: 1, radius: .3 }),
    fire: emitter({ n: 500, add: true, color: 0xff8a3a, size: 1.1, grow: -.7, life: .55, speed: 9, spread: .5, op: .8, radius: .25 }),
    swirl: emitter({ n: 300, color: 0xc49a6c, size: .8, grow: 1.5, life: 1.8, speed: 1.2, up: 4, radial: true, drag: .3, op: .5, radius: 1.2 }),
    mote: emitter({ n: 200, add: !mars, color: mars ? 0xd9a070 : 0xffffff, size: mars ? .35 : .14, life: 7, speed: .5, spread: 1, box: 34, op: mars ? .5 : .55 })
  };
  Object.values(F).forEach(f => G.add(f.obj));
  BASE = { mote: mars ? 26 : moon ? 9 : 14, wind: mars ? V(2.8, .2, 1.1) : V(0, 0, 0), hum: mars ? .07 : 0, fn: moon ? 80 : 35, ff: moon ? 320 : 260 };
  FOG = moon || mars ? (S.fog = new T.Fog(moon ? 0x000000 : 0xcf9568, BASE.fn, BASE.ff)) : null;   // moon: ground fades to black (no ugly far edge). Mars: dusty horizon haze
  G.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.fog = !!(m.userData && m.userData.fog); m.needsUpdate = true; }); });   // fog only touches the ground and rocks
  st.hk = HK[id] || (id in defs ? [] : HK.generic);
  MEM = {}; SX.init();
}
function FXclose() { S.fog = null; FOG = null; F = null; st && (st.hk = null); SX.zero(); }
function FXscene(i) {
  if (!F) return;
  MEM = {}; Object.values(F).forEach(f => { f.clear(); f.rate = 0; });
  F.mote.rate = BASE.mote; F.mote.wind.copy(BASE.wind); F.mote.burst(70);
  if (FOG) { FOG.near = BASE.fn; FOG.far = BASE.ff; }
  if (i > 0) SX.swoosh(.3, true, .9);
}
function FXframe(sc, p, i, dt) {
  if (!F) return;
  SX.init(); H.wind = BASE.hum; H.eng = 0;
  Object.values(F).forEach(f => { if (f !== F.mote) f.rate = 0; });
  const h = st.hk && st.hk[i]; if (typeof h === 'function') h(p, time, dt, sc);
  Object.values(F).forEach(f => f.step(dt));
  SX.set(SX.wind, playing ? H.wind : 0); SX.set(SX.eng, playing ? H.eng : 0);
  if (FOG) { const k = .25 + .75 * cl(E.sun.intensity / 1.9); FOG.color.setRGB((MM && MM.body === 'moon' ? 0 : .81) * k, (MM && MM.body === 'moon' ? 0 : .58) * k, (MM && MM.body === 'moon' ? 0 : .41) * k); }
}

/* effect recipes used by several stories */
const bounce = (y, thr, cb) => { const dy = y - (MEM.py == null ? y : MEM.py); if (MEM.dy < 0 && dy >= 0 && y < thr) cb(); MEM.dy = dy; MEM.py = y; };
const descent = (x, y, z) => {            // landing engine plume, and dust blown outward once low enough
  F.fire.src.set(x, y + .5, z); F.fire.dir.set(0, -1, 0); F.fire.rate = 150;
  F.spark.src.set(x, y + .4, z); F.spark.dir.set(0, -1, 0); F.spark.rate = 25; H.eng = .55;
  if (y < 18) { F.dust.src.set(x, .1, z); F.dust.rate = (1 - y / 18) * 240; H.eng = .8; }
};
const touch = (x, z) => {                 // touchdown: dust cloud, sparks, thud, shake (once)
  if (MEM.td) return; MEM.td = 1;
  F.dust.src.set(x, .1, z); F.dust.burst(160); F.spark.src.set(x, .3, z); F.spark.dir.set(0, 1, 0); F.spark.burst(60); SX.hit(.9); E.shake(.5);
};
const HK = {
  'apollo-11-eagle': [null,
    (p, t, dt, sc) => { const lm = sc.g[2]; if (p < .86) descent(lm.position.x, lm.position.y, 0); else touch(0, 0); },
    null,
    (p, t, dt, sc) => {                   // liftoff
      const a = sc.g[2].asc.position, q = sub(p, .22, 1);
      if (p >= .22 && !MEM.lo) { MEM.lo = 1; F.dust.src.set(0, .1, 0); F.dust.burst(200); F.spark.src.set(0, 1.2, 0); F.spark.dir.set(0, 1, 0); F.spark.burst(90); SX.hit(.8); SX.swoosh(.5, true, 2.4); E.shake(.6); }
      if (p >= .22 && q < .98) {
        F.fire.src.set(a.x, a.y - .3, 0); F.fire.dir.set(0, -1, 0); F.fire.rate = 170; F.spark.src.set(a.x, a.y - .3, 0); F.spark.dir.set(0, -1, 0); F.spark.rate = 40; H.eng = .75 * (1 - q * .5);
        if (q < .15) { F.dust.src.set(0, .1, 0); F.dust.rate = 120 * (1 - q / .15); }
      }
    },
    null],
  sojourner: [null, null,
    (p, t, dt, sc) => {                   // arrival: entry fire, parachute, airbag bounces
      const cap = sc.g[2], bag = sc.g[4], c = cap.position;
      if (cap.visible && p < .35) { F.fire.src.copy(c); F.fire.dir.set(-1, .7, 0); F.fire.rate = 220; F.spark.src.copy(c); F.spark.dir.set(-1, .7, 0); F.spark.rate = 50; H.eng = .6; }
      if (p >= .35 && !MEM.ch) { MEM.ch = 1; SX.swoosh(.5, false, 1.2); E.shake(.3); }
      if (bag.visible) { const y = bag.position.y; bounce(y, 3.3, () => { F.dust.src.set(bag.position.x, .1, 0); F.dust.burst(45); SX.hit(.45); E.shake(.25); }); if (y < 3.2) { F.dust.src.set(bag.position.x, .1, 0); F.dust.rate = 60; } }
      if (p >= .9 && !MEM.l) { MEM.l = 1; F.dust.src.set(0, .1, 0); F.dust.burst(80); SX.hit(.5); }
    },
    (p, t, dt, sc) => { const rov = sc.g[3]; if (p < .5) { F.dust.src.set(rov.position.x, .1, rov.position.z); F.dust.rate = 35; } else if (p < .85) { F.spark.src.set(6.2, .4, -1.6); F.spark.dir.set(0, 1, 0); F.spark.rate = 30; } },
    null],
  'surveyor-3': [
    (p, t, dt, sc) => {
      const y = sc.g[1].position.y;
      if (p < .35 && y > .5) { F.fire.src.set(0, y + .2, 0); F.fire.dir.set(0, -1, 0); F.fire.rate = 120; H.eng = .5; }
      if (p >= .35 && !MEM.t) { MEM.t = 1; F.dust.src.set(0, .1, 0); F.dust.burst(120); SX.hit(.8); E.shake(.5); }
      if (p >= .35) { bounce(y, .6, () => { F.dust.src.set(0, .1, 0); F.dust.burst(60); SX.hit(.5); E.shake(.3); }); if (y < .3) { F.dust.src.set(0, .1, 0); F.dust.rate = 70; } }
    },
    (p, t) => { F.dust.src.set(2, .15, 0); F.dust.rate = 20 * (.5 + .5 * Math.sin(t * 2)); },
    null,
    (p, t, dt, sc) => { const y = sc.g[3].position.y; if (y > .3) descent(-15, y, -11); else touch(-15, -11); },
    (p) => { const f = sub(p, .55, .8); if (f > 0 && f < 1) { F.spark.src.set(.2, 1.6, 0); F.spark.dir.set(0, 1, 0); F.spark.rate = 40; F.dust.src.set(.4, .1, 0); F.dust.rate = 20; } }],
  spirit: [null,
    (p, t, dt, sc) => { const d = sc.g[4]; F.swirl.src.set(d.position.x, .2, d.position.z); F.swirl.rate = 140; H.wind = .4; F.mote.wind.set(6, .3, 2); },
    null,
    (p) => { F.dust.src.set(0, .2, 0); F.dust.rate = p < .55 ? 45 : 0; },
    null],
  opportunity: [
    (p, t, dt, sc) => { const b = sc.g[3], y = b.position.y; bounce(y, 2.5, () => { F.dust.src.set(b.position.x, .1, 0); F.dust.burst(50); SX.hit(.45); }); if (y < 2.5) { F.dust.src.set(b.position.x, .1, 0); F.dust.rate = 50; } },
    null, null,
    (p) => { H.wind = .25 + .5 * p; F.mote.rate = 40 + 200 * p; F.mote.wind.set(10 + 8 * p, 1, 4); if (FOG) { FOG.near = lerp(35, 3, p); FOG.far = lerp(260, 70, p); } },
    () => { H.wind = .3; F.mote.rate = 120; F.mote.wind.set(8, 1, 3); if (FOG) { FOG.near = 6; FOG.far = 90; } }],
  generic: [null, null,
    (p, t, dt, sc) => { const y = sc.g[sc.g.length - 2].position.y; if (y > .3) descent(0, y, 0); else touch(0, 0); },
    (p, t, dt, sc) => {
      const o = sc.g[sc.g.length - 2], fb = MM && MM.fallback ? MM.fallback.type : '';
      if (fb === 'rover' || fb === 'buggy') { F.dust.src.set(o.position.x, .1, o.position.z); F.dust.rate = 40; }
      else if (fb === 'heli' && o.position.y > .4) { F.dust.src.set(o.position.x, .1, o.position.z); F.dust.rate = 70; H.eng = .25; }
    },
    null]
};

/* ---------- THE STORIES ---------- */
const defs = {
  sojourner() {
    const earth = body(6, 'earth'), mars = body(12, 'mars'), eSmall = body(3, 'earth');
    const ship = cruise(), cruiseShip = cruise(), gM = ground(0xa65a30, .7, 90), skyDay = sky('#7a5a52', '#d9a27a', '#a65a30'), skyDusk = sky('#1a1530', '#c0653a', '#7a3d22');
    const gM2 = ground(0xa65a30, .7, 90), lan = lander(), lan2 = lander(), lan3 = lander(), rov = makeRover(), rov2 = makeRover();
    const capsule = new T.Group(); add(capsule, new T.ConeGeometry(.9, 1.1, 16), 0x8a8a8a, [0, 0, 0], [Math.PI, 0, 0]);
    const fire = glow(0xff8a3a, 5); capsule.add(fire); fire.position.y = -.8;
    const chute = new T.Mesh(new T.SphereGeometry(2.6, 20, 10, 0, 6.283, 0, 1.45), new T.MeshStandardMaterial({ color: 0xf0e0d0, side: T.DoubleSide, roughness: 1 })); chute.position.y = 5;
    const bag = new T.Mesh(new T.SphereGeometry(2.5, 16, 12), new T.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: .45, roughness: 1 }));
    const bagLan = lander(); bagLan.scale.setScalar(.45); bagLan.position.y = -.5; bag.add(bagLan);
    const yogi = new T.Mesh(new T.IcosahedronGeometry(1.1, 0), mat(0x7a4a32)); yogi.position.set(7, .6, -2); yogi.scale.set(1.3, .8, 1);
    const pulse = new T.Mesh(new T.BufferGeometry(.5, .62, 40), new T.MeshBasicMaterial({ color: 0xfc3d21, side: T.DoubleSide, transparent: true, opacity: .8, blending: T.AdditiveBlending })); pulse.rotation.x = -Math.PI / 2; pulse.position.set(6.2, .08, -1.6);
    const yogi2 = yogi.clone();
    const path = [V(1.8, 0, 1.4), V(6.0, 0, -1.2)];
    return {
      title: 'Sojourner', kicker: 'MARS PATHFINDER · 1996–1997', end: 'Every mission leaves something behind. Every object has a story.',
      scenes: [
        { n: 'A Mission Begins', d: 12, g: [earth, ship], caps: [[0, 'December 4, 1996: NASA launches Mars Pathfinder from Cape Canaveral, Florida.'], [.5, 'Inside is a lander, and a small rover named Sojourner.']],
          upd(p) { const e = ease(p); earth.position.set(0, 0, 0); earth.rotation.y = p * .6; ship.position.set(lerp(5, 17, e), lerp(2, 6, e), lerp(7, 1, e)); ship.scale.setScalar(lerp(1, .6, e)); look(lerp(-2, 3, p), 2, lerp(18, 14, p), 5, 2, 2); } },
        { n: 'The Journey to Mars', d: 14, g: [eSmall, mars, cruiseShip], caps: [[0, 'The trip takes about seven months. The goal: test a new, low-cost way to land on Mars and drive a rover there.'], [.6, 'Mars slowly grows from a point of light into a whole world.']],
          upd(p) { const e = ease(p), x = lerp(-30, 42, e); eSmall.position.set(-48, 0, 0); mars.position.set(62, -1, -5); mars.rotation.y = p * .3; cruiseShip.position.set(x, Math.sin(p * 6) * .3, 0); cruiseShip.scale.setScalar(.8); look(x - 7, 2.2, 8, x + 9, 0, -1); } },
        { n: 'Arrival', d: 13, g: [skyDay, gM, capsule, chute, bag, lan], caps: [[0, 'July 4, 1997: Pathfinder races into Mars’s atmosphere. A heat shield, a parachute and rockets slow its fall.'], [.55, 'Airbags cushion the landing. The lander bounces across the surface before it stops.'], [.88, 'Landing site: Ares Vallis, an ancient flood plain at about 19° N, 33° W. (Illustration, not to scale.)']],
          upd(p) {
            const a = sub(p, 0, .35), b = sub(p, .35, .6), q = sub(p, .6, .9);
            capsule.visible = p < .6; chute.visible = p >= .35 && p < .6; fire.visible = p < .35; bag.visible = p >= .6 && p < .9; lan.visible = p >= .9;
            const y = p < .35 ? lerp(70, 24, a) : lerp(24, 9, b); capsule.position.set(lerp(-34, -14, sub(p, 0, .6)), y, 0); capsule.rotation.z = lerp(.7, 0, a); chute.position.set(capsule.position.x, y + 2.4, 0);
            bag.position.set(lerp(-14, 0, q), 2.5 + 9 * Math.abs(Math.cos(q * Math.PI * 2.5)) * Math.pow(1 - q, 1.6), 0); bag.rotation.z = q * 5; lan.position.set(0, 0, 0);
            look(-18, 5, 24, lerp(-14, 0, sub(p, 0, .8)), Math.max(4, capsule.visible ? y * .5 : 4), 0); } },
        { n: 'Exploration', d: 17, g: [skyDay, gM2, lan2, rov, yogi2, pulse], caps: [[0, 'Sojourner rolls onto the surface. It is about the size of a microwave oven and moves slowly, one careful step at a time.'], [.38, 'It drives up to rocks and presses an instrument called APXS against them to find out what they are made of.'], [.74, 'Pathfinder’s pictures and measurements helped scientists see that this plain was probably shaped by ancient floods.']],
          upd(p, t) {
            yogi2.position.copy(yogi.position); yogi2.scale.copy(yogi.scale);
            const d = sub(p, 0, .5), s = ease(d), x = lerp(path[0].x, path[1].x, s), z = lerp(path[0].z, path[1].z, s);
            rov.position.set(x, 0, z); rov.rotation.y = -Math.atan2(path[1].z - path[0].z, path[1].x - path[0].x);
            const meas = p > .5 && p < .85; pulse.visible = meas; pulse.scale.setScalar(1 + .5 * Math.sin(t * 6));
            look(lerp(-3, x - 2, sub(p, 0, .6)) , lerp(3, 2, p), lerp(9, 5, p), x + 1, .5, z); } },
        { n: 'The Final Chapter', d: 14, g: [skyDusk, gM, lan3, rov2], caps: [[0, 'Sojourner was built to work for about 7 days. It worked for 83.'], [.3, 'Pathfinder’s last data transmission arrived on September 27, 1997. Sojourner could reach Earth only through the lander, so contact ended for both.'], [.72, 'Both machines are still at Ares Vallis. Later rovers followed the path Sojourner proved possible.']],
          upd(p) { E.sun.intensity = lerp(1.9, .8, p); E.sun.color.setHex(0xffb070); rov2.position.set(3.2, 0, 1.8); rov2.rotation.y = -2.2; look(lerp(4, -12, ease(p)), lerp(1.4, 7, ease(p)), lerp(5, 20, ease(p)), 1.6, .8, .9); } }
      ]
    };
  },

  'apollo-11-eagle'() {
    const moon = body(10, 'moon'), lm0 = mkLM(), earthSky = body(7, 'earth');
    const gL = ground(0x8d8d8d, .5, 110), lm2 = mkLM(), lm3 = mkLM(), lm4 = mkLM(), lm5 = mkLM(false);
    const ex2 = flame(3.2, .8), ex4 = flame(3.2, .7); lm2.add(ex2); ex2.position.y = .8 - 1.6; lm4.asc.add(ex4); ex4.position.y = -1.6 + .1;
    const dust = glow(0xcfcfcf, 4, 0); dust.material.blending = T.NormalBlending; lm2.add(dust);
    const earthA = earthSky.clone(), earthB = earthSky.clone(), earthC = earthSky.clone(), earthD = earthSky.clone();
    [earthA, earthB, earthC, earthD].forEach(e => { e.position.set(-120, 70, -260); });
    return {
      title: 'Apollo 11', kicker: 'APOLLO 11 · JULY 1969', end: 'Every mission leaves something behind. Every object has a story.',
      scenes: [
        { n: 'Humanity’s First Moon Landing', d: 13, g: [moon, lm0], caps: [[0, 'July 16, 1969: Apollo 11 launches toward the Moon with Neil Armstrong, Buzz Aldrin and Michael Collins.'], [.5, 'Four days later, Armstrong and Aldrin enter the Lunar Module Eagle and separate from the command module Columbia to head for the surface.']],
          upd(p) { moon.rotation.y = p * .2; const a = lerp(2.6, 1.3, p); lm0.position.set(Math.cos(a) * 14, 1.5, Math.sin(a) * 14); lm0.scale.setScalar(.35); lm0.rotation.y = -a; look(lerp(16, -2, ease(p)), 4, 28, 0, 0, 0); } },
        { n: 'The Descent', d: 15, g: [gL, earthA, lm2], caps: [[0, 'The Lunar Module is the part of the spacecraft built to land astronauts on the Moon and carry them back up.'], [.3, 'Its descent engine slows Eagle as it falls toward the Sea of Tranquility.'], [.58, 'Near the surface, Armstrong takes manual control to fly past a field of boulders and find a safe place to land.'], [.88, 'July 20, 1969: “Houston, Tranquility Base here. The Eagle has landed.”']],
          upd(p) {
            const f = sub(p, 0, .86), y = lerp(36, 0, Math.pow(f, .8)), x = lerp(-28, 0, ease(f));
            lm2.position.set(x, y, 0); lm2.rotation.z = lerp(-.5, 0, sub(p, 0, .45)); ex2.visible = p < .86; ex2.scale.set(1 + .2 * Math.sin(p * 90), 1, 1 + .2 * Math.sin(p * 90));
            const q = sub(p, .84, 1); dust.position.set(0, .8, 0); dust.material.opacity = q > 0 ? (1 - q) * .55 : 0; dust.scale.setScalar(lerp(3, 22, q));
            look(-14, 5, 17, x * .6, Math.max(3, y * .4), 0); } },
        { n: 'A Historic Achievement', d: 15, g: [gL, earthB, lm3], caps: [[0, 'Armstrong and Aldrin spend about two and a half hours walking on the surface. People have reached another world.'], [.42, 'The descent stage is their base: it holds the landing legs, the landing engine and stored equipment.'], [.78, 'They set up science experiments and collect Moon rocks to bring home.']],
          upd(p, t) { lm3.position.set(0, 0, 0); const c = p * 1.4; look(Math.sin(c) * 17, 4 + p * 2, Math.cos(c) * 17, 0, 2, 0); } },
        { n: 'What Was Left Behind', d: 16, g: [gL, earthC, lm4], caps: [[0, 'July 21: after about 21 hours on the Moon, the ascent stage fires its engine and lifts off.'], [.3, 'The descent stage serves as its launch pad, and stays behind.'], [.62, 'It was not needed for the trip home, so leaving it saved weight and fuel.'], [.86, 'The ascent stage reached lunar orbit and rejoined Collins in Columbia.']],
          upd(p) { const q = sub(p, .22, 1); lm4.position.set(0, 0, 0); lm4.asc.position.set(q * q * 4, lm4.asc.rest + q * q * 70, 0); lm4.asc.rotation.z = -q * .5; ex4.visible = p > .22 && q < .98; look(15, lerp(4, 14, ease(q)), 18, 0, lerp(3, 20, ease(q)), 0); } },
        { n: 'The Legacy', d: 15, g: [gL, earthD, lm5], caps: [[0, 'Today the descent stage still stands at Tranquility Base in the Sea of Tranquility, about 0.67° N, 23.47° E.'], [.34, 'NASA’s Lunar Reconnaissance Orbiter photographed it from lunar orbit in 2009, along with the astronauts’ footpaths.'], [.64, 'A plaque on its landing leg reads: “We came in peace for all mankind.”'], [.88, 'NASA’s Artemis program is working to return people to the Moon.']],
          upd(p) { const e = ease(p), d = lerp(10, 30, e); lm5.position.set(0, 0, 0); look(d * .55, lerp(3, 10, e), d * .85, 0, 1.2, 0); } }
      ]
    };
  }
};


/* ---------- GENERIC STORY: every other mission, built from its missions.json text and its own model ---------- */
const LABEL = { parked: 'Left behind', silent: 'Went silent', grounded: 'Grounded' };
function generic(id) {
  const m = E.M().find(x => x.id === id), moon = m.body === 'moon', fb = (m.fallback || {}).type;
  const drive = fb === 'rover' || fb === 'buggy', fly = fb === 'heli';
  const obj = new T.Group(); obj.add(norm(E.clone(id), 1.8)); const rot = obj.getObjectByName('rot');
  const earth = body(6, 'earth'), dest = body(12, moon ? 'moon' : 'mars'), ship = cruise(), eSky = body(7, 'earth');
  eSky.position.set(-120, 70, -260);
  const gnd = ground(moon ? 0x8d8d8d : 0xa65a30, .5, 80), skyM = sky('#7a5a52', '#d9a27a', '#a65a30'), skyD = sky('#1a1530', '#c0653a', '#7a3d22');
  const env = moon ? [gnd, eSky] : [gnd, skyM], env2 = moon ? [gnd, eSky] : [gnd, skyD];
  const fl = new T.Group(); fl.add(flame(2.4, .6));
  const ping = new T.Mesh(new T.BufferGeometry(1.4, 1.6, 6), new T.MeshBasicMaterial({ color: 0xfc3d21, side: T.DoubleSide, transparent: true, opacity: .8, blending: T.AdditiveBlending })); ping.rotation.x = -Math.PI / 2; ping.position.y = .1;
  const place = (x, y, z, ry) => { obj.position.set(x, y, z); obj.rotation.set(0, ry || 0, 0); };
  return {
    title: m.name, kicker: `${m.where.toUpperCase()} · ${m.year}`, end: 'Every mission leaves something behind. Every object has a story.',
    scenes: [
      { n: 'The Mission', d: 11, g: [earth, ship], caps: [[0, m.blurb], [.62, `${m.date}. Location: ${m.where}.`]],
        upd(p) { const e = ease(p); earth.scale.setScalar(1); earth.position.set(0, 0, 0); earth.rotation.y = p * .6; ship.position.set(lerp(5, 17, e), lerp(2, 6, e), lerp(7, 1, e)); ship.scale.setScalar(lerp(1, .6, e)); look(lerp(-2, 3, p), 2, lerp(18, 14, p), 5, 2, 2); } },
      { n: 'The Journey', d: 10, g: [earth, dest, ship], caps: [[0, `A stylized trip from Earth to ${moon ? 'the Moon' : 'Mars'}. Distances and speeds are not to scale.`]],
        upd(p) { const x = lerp(-30, 42, ease(p)); earth.scale.setScalar(.5); earth.position.set(-48, 0, 0); dest.position.set(62, -1, -5); dest.rotation.y = p * .3; ship.position.set(x, Math.sin(p * 6) * .3, 0); ship.scale.setScalar(.8); look(x - 7, 2.2, 8, x + 9, 0, -1); } },
      { n: 'Arrival', d: 10, g: [...env, obj, fl], caps: [[0, `Arrival at ${m.where}. This landing is a stylized illustration, not an exact record.`]],
        upd(p) { const y = lerp(34, 0, 1 - Math.pow(1 - ease(p), 1.6)); place(0, y, 0); fl.position.set(0, y, 0); fl.visible = y > .1; if (rot) rot.rotation.y += .5; look(-10, 4, 14, 0, Math.max(2, y * .5), 0); } },
      { n: 'At Work', d: 14, g: [...env, obj, ping], caps: [[0, m.facts[0]], [.5, m.facts[1]]],
        upd(p, t) {
          const a = p * 5; ping.visible = !drive && !fly; ping.scale.setScalar(1 + .25 * Math.sin(t * 4));
          if (drive) place(Math.cos(a) * 5, 0, Math.sin(a) * 5, -Math.atan2(Math.cos(a), -Math.sin(a)));
          else if (fly) { place(Math.sin(t * .5) * 3, lerp(0, 5, ease(sub(p, 0, .3))) + Math.sin(t * 2) * .2, 0); if (rot) rot.rotation.y += .7; }
          else place(0, 0, 0);
          const c = p * 1.6; look(Math.cos(c) * 11, 4, Math.sin(c) * 11 + 4, 0, 1.2, 0); } },
      { n: 'The Final Chapter', d: 12, g: [...env2, obj], caps: [[0, m.facts[2]], [.5, `Status: ${LABEL[m.status]}.`]],
        upd(p) { E.sun.intensity = lerp(1.9, .8, p); E.sun.color.setHex(0xffb070); place(drive || fly ? 4 : 0, 0, 0, 1); const e = ease(p); look(lerp(5, -10, e), lerp(1.6, 6, e), lerp(6, 18, e), 1, .8, 0); } }
    ]
  };
}

/* ---------- UNIQUE STORIES: Dawn, Kepler, NEAR Shoemaker, Pioneer 10 (facts checked against NASA/JPL records) ---------- */
function craft(o = {}, id) {   // the loaded assets/models/<id>.glb when it exists, else the simple stand-in below
  if (id && E.hasModel && E.hasModel(id)) {
    try { const w = norm(E.clone(id), o.panel ? 2 + o.panel * 2 : 2.4), c = new T.Box3().setFromObject(w).getCenter(V(0, 0, 0)); w.position.sub(c); const g = new T.Group(); g.add(w); return g; } catch (e) { /* fall through */ }
  }
  const g = new T.Group();   // no model file = nothing drawn (no stand-in spacecraft)
  return g;
}
const bas = (c, o = {}) => new T.MeshBasicMaterial(Object.assign({ color: c }, o));
const rock = (r, seed, pal, sx, sy, sz, name) => { const m = (name && E.planet(name, r)) || E.lowPoly(r, pal, seed); m.scale.set(sx, sy, sz); return m; };
const face = (o, dx, dz) => { o.rotation.y = -Math.atan2(dz, dx); };
const W = (n, d, g, caps, upd) => ({ n, d, g, caps, upd });
let _sd = 11; const rn = () => (_sd = _sd * 16807 % 2147483647) / 2147483647;
const sphere = (r, c) => new T.Mesh(new T.SphereGeometry(r, 16, 12), bas(c));

Object.assign(defs, {
  dawn() {
    const mars = body(7, 'mars'), vesta = rock(5, 4, ['#8a8580', '#a39d96', '#6e6a66'], 1.12, .9, 1, 'vesta'), ceres = E.planet('ceres', 7) || E.lowPoly(7, ['#6f6a64', '#837d75', '#5d5852'], 9);
    const d = craft({ dish: .5, panel: 2.2 }, 'dawn'), jet = new T.Mesh(new T.ConeGeometry(.2, 4, 10, 1, true), bas(0x66ccff, { transparent: true, opacity: .75, side: T.DoubleSide }));
    jet.rotation.z = Math.PI / 2; jet.position.x = -2.7; d.add(jet);
    const stream = new T.Group(); for (let i = 0; i < 40; i++) stream.add(sphere(.07, 0x9fe6ff));
    const spots = new T.Group(); ceres.add(spots);
    [[1, .25, .1], [1, .3, .2], [1, .2, .0], [1, .35, .12]].forEach(v => { const n = V(...v).normalize().multiplyScalar(7.05), s = add(spots, new T.IcosahedronGeometry(.22, 0), 0xffffff, [n.x, n.y, n.z]); });
    const orb = (r, a, y) => { d.position.set(Math.cos(a) * r, y, Math.sin(a) * r); face(d, -Math.sin(a), Math.cos(a)); };
    return {
      title: 'Dawn', kicker: 'THE SPACECRAFT THAT VISITED TWO WORLDS', end: 'Dawn is silent now, but it still circles Ceres. A quiet monument in the asteroid belt.',
      scenes: [
        W('A Boost From Mars', 11, [mars, d], [[0, 'Dawn launched on September 27, 2007. Its goal: visit the two biggest objects in the asteroid belt.'], [.5, 'In 2009 it swung past Mars. Mars’s gravity gave it a free speed boost.']],
          (p, t) => { const e = ease(p), x = lerp(-34, 34, e); jet.visible = false; d.position.set(x, 0, 11 + x * x * .008); face(d, 1, .016 * x); mars.rotation.y = p * .4; look(lerp(-8, 8, e), 8, 32, x * .35, 0, 4); }),
        W('World One: Vesta', 12, [vesta, d], [[0, 'In July 2011 Dawn reached Vesta, a rocky giant of the asteroid belt, and began to circle it.'], [.55, 'It studied Vesta for 14 months, then left in September 2012. No spacecraft had ever done that before.']],
          (p, t) => { jet.visible = false; vesta.rotation.y = p * .5; orb(9, p * 5, 1.5); const c = p * 1.2; look(Math.cos(c) * 18, 6, Math.sin(c) * 18, 0, 0, 0); }),
        W('The Ion Engine', 12, [d, stream], [[0, 'How did Dawn leave one world and travel to another? With an ion engine.'], [.5, 'It pushes out charged gas, very gently. In four days it can speed up from 0 to 60 mph. Over years, that adds up.']],
          (p, t) => { jet.visible = true; d.position.set(0, 0, 0); d.rotation.set(0, 0, 0); stream.children.forEach((s, i) => { const k = (t * 2 + i / 40 * 12) % 12; s.position.set(-3.6 - k * 1.5, Math.sin(i) * .05 * k, Math.cos(i * 2) * .05 * k); }); look(-5 + Math.sin(t * .3), 1.6, 7, -3, 0, 0); }),
        W('World Two: Ceres', 13, [ceres, d], [[0, 'In March 2015 Dawn reached Ceres, a dwarf planet. It was the first spacecraft ever to visit one.'], [.5, 'Inside Occator Crater it found bright patches. They turned out to be salty deposits.']],
          (p, t) => { jet.visible = false; ceres.rotation.y = p * .6; orb(10.5, 1 + p * 3, 3); look(lerp(15, 11, p), 3, lerp(8, 4, p), 7, .5, .4); }),
        W('The Quiet Orbit', 13, [ceres, d], [[0, 'Dawn finally ran out of the fuel it used to point itself. On November 1, 2018, NASA ended the mission.'], [.55, 'It could no longer turn its antenna to Earth. It stays in orbit around Ceres for decades.']],
          (p, t) => { const e = ease(p); jet.visible = false; E.sun.intensity = lerp(1.9, .6, p); ceres.rotation.y = p * .3; orb(10.5, 4 + p * .6, 3); look(lerp(14, 34, e), lerp(4, 12, e), lerp(14, 10, e), 0, 0, 0); })]
    };
  },
  kepler() {
    const field = (() => { const n = 2500, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([(rn() - .5) * 70, (rn() - .5) * 38, -40], i * 3); const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(a, 3)); return new T.Points(g, new T.PointsMaterial({ size: 2, sizeAttenuation: false, color: 0xffffff })); })();
    const k = craft({ panel: 1.8 }, 'kepler'); k.add(add(new T.Group(), new T.CylinderGeometry(.9, .9, 1.6, 16), 0xbfc4cc, [0, 0, 0], [0, 0, Math.PI / 2]));
    const star = new T.Mesh(new T.SphereGeometry(5, 24, 16), bas(0xffd88a)), pl = sphere(1, 0x1a2036), N = 60;
    const lg = new T.BufferGeometry(), pa = new Float32Array(N * 3); for (let i = 0; i < N; i++) { const x = -10 + 20 * i / (N - 1), dip = Math.max(0, Math.min(1, (6 - Math.abs(x)) / 2)) * 1.5; pa.set([x, -8 - dip, 0], i * 3); }
    lg.setAttribute('position', new T.BufferAttribute(pa, 3)); const curve = new T.Line(lg, new T.LineBasicMaterial({ color: 0xfc3d21 }));
    const sys = new T.Group(), ps = [];
    [[-30, 1.8, 0xffb36b], [-10, 2.6, 0xfff0c8], [10, 1.4, 0xff8f5a], [30, 2.2, 0xcfe0ff]].forEach(([cx, r, c], j) => {
      const s = sphere(r, c); s.position.set(cx, 0, 0); sys.add(s);
      for (let i = 0; i < 2 + (j % 2); i++) { const m = sphere(.35 + rn() * .3, [0xc78d5a, 0x6fa0d6, 0xb0b0b0][i]); sys.add(m); ps.push({ m, cx, R: r + 2.5 + i * 2.4, sp: .6 / (1 + i), ph: rn() * 6 }); }
    });
    return {
      title: 'Kepler', kicker: 'THE TELESCOPE THAT FOUND A GALAXY OF PLANETS', end: 'Kepler is silent, but scientists still find new planets in the data it saved.',
      scenes: [
        W('One Patch of Sky', 11, [field, k], [[0, 'Kepler launched in 2009. It stared at one small patch of sky without blinking.'], [.55, 'In that patch it watched about 150,000 stars at the same time.']],
          (p, t) => { k.position.set(0, 0, 0); k.rotation.set(0, Math.PI / 2, 0); look(0, 1, lerp(11, 5, ease(p)), 0, 0, -40); }),
        W('Catching a Shadow', 12, [star, pl, curve], [[0, 'When a planet passes in front of its star, the star gets a tiny bit dimmer.'], [.5, 'Kepler measured those tiny dips. Imagine spotting a fly crawling over a car headlight from 100 miles away.']],
          (p, t) => { const x = lerp(-10, 10, p); pl.position.set(x, 0, 6); star.rotation.y = t * .1; lg.setDrawRange(0, Math.max(2, Math.floor(p * N))); look(0, -1.5, 24, 0, -2.5, 0); }),
        W('Planets Everywhere', 14, [sys], [[0, 'Before Kepler, scientists knew of only a few hundred planets around other stars.'], [.5, 'Kepler found more than 2,600. It showed that planets are common in our galaxy.']],
          (p, t) => { const e = ease(p); ps.forEach(o => { const a = t * o.sp + o.ph; o.m.position.set(o.cx + Math.cos(a) * o.R, Math.sin(a * .5) * .4, Math.sin(a) * o.R * .7); }); look(lerp(-24, 24, e), 8, 38, lerp(-24, 24, e), 0, 0); }),
        W('A Wheel Breaks', 11, [field, k], [[0, 'In 2013 a second pointing wheel broke. Kepler could not stay steady enough to keep staring.'], [.55, 'The team found a clever new way to use it, but its fuel kept slowly running down.']],
          (p, t) => { k.position.set(0, 0, 0); const w = .15 + .5 * p; k.rotation.set(Math.sin(t * 3) * w, Math.PI / 2 + Math.sin(t * 2.1) * w, Math.sin(t * 2.7) * w); look(6, 3, 10, 0, 0, 0); }),
        W('Out of Fuel', 13, [k], [[0, 'On October 30, 2018, NASA announced that Kepler had run out of fuel.'], [.55, 'It was retired in a safe orbit around the Sun, trailing behind Earth.']],
          (p, t) => { const e = ease(p); k.position.set(0, 0, 0); k.rotation.set(0, t * .1, 0); E.sun.intensity = lerp(1.9, .6, p); look(lerp(8, 50, e), lerp(3, 14, e), lerp(10, 40, e), 0, 0, 0); })]
    };
  },
  'near-shoemaker'() {
    const dark = rock(7, 2, ['#2b2b2e', '#3a3a3d', '#1f1f22'], 1.2, .9, 1), eros = rock(5, 6, ['#8a7a6a', '#a39283', '#6e6358'], 2.4, .9, .9, 'eros'), gE = ground(0x77706a, .4, 140);
    const n = craft({ panel: 2, dish: .6 }, 'near-shoemaker');
    return {
      title: 'NEAR Shoemaker', kicker: 'THE SPACECRAFT THAT LANDED WHEN IT WAS NEVER MEANT TO', end: 'NEAR Shoemaker still rests on Eros, the first spacecraft to land on an asteroid.',
      scenes: [
        W('A Dark Surprise', 11, [dark, n], [[0, 'NEAR launched on February 17, 1996. Its target was the asteroid Eros.'], [.5, 'On the way, on June 27, 1997, it flew past a coal-black asteroid called Mathilde.']],
          (p, t) => { const e = ease(p), x = lerp(-30, 30, e); n.position.set(x, 0, 14); face(n, 1, 0); dark.rotation.y = p * .5; look(0, 4, 32, 0, 0, 4); }),
        W('Circling Eros', 12, [eros, n], [[0, 'On February 14, 2000, NEAR became the first spacecraft ever to orbit an asteroid.'], [.5, 'Over a year it circled Eros about 230 times, mapping every bump.']],
          (p, t) => { const a = p * 8; n.position.set(Math.cos(a) * 14, 1, Math.sin(a) * 9); face(n, -Math.sin(a) * 14, Math.cos(a) * 9); eros.rotation.y = p * .6; const c = p * 1.4; look(Math.cos(c) * 24, 9, Math.sin(c) * 24, 0, 0, 0); }),
        W('Down We Go', 12, [gE, n], [[0, 'Near the end, the team asked: could NEAR try to land? It was never designed to.'], [.55, 'On February 12, 2001, it touched down gently, about as slowly as a person walking.']],
          (p, t) => { const e = 1 - Math.pow(1 - ease(p), 1.5), y = lerp(30, .7, e); n.position.set(0, y, 0); n.rotation.set(0, 0, 0); look(9, lerp(10, 3, e), 15, 0, y * .6, 0); }),
        W('Two Weeks on Eros', 13, [gE, n], [[0, 'It had landed south of a saddle-shaped feature called Himeros. And it was still working.'], [.5, 'For about two weeks it kept measuring what the surface was made of.']],
          (p, t) => { n.position.set(0, .7, 0); n.rotation.set(0, 0, .12); const c = p * 1.5; look(Math.cos(c) * 9, 2.6, Math.sin(c) * 9, 0, .8, 0); }),
        W('The Long Cold Night', 13, [gE, n], [[0, 'On February 28, 2001, NEAR sent its last signal. The extreme cold had stopped it.'], [.55, 'It rests on Eros today, and it will for a very long time.']],
          (p, t) => { const e = ease(p); n.position.set(0, .7, 0); E.sun.intensity = lerp(1.9, .3, p); E.sun.color.setHex(0xff9a60); look(lerp(9, 22, e), lerp(3, 14, e), lerp(9, 22, e), 0, .8, 0); })]
    };
  },
  'pioneer-10'() {
    const belt = new T.Group(); for (let i = 0; i < 110; i++) { const r = .25 + rn() * rn() * 1.8, m = new T.Mesh(new T.IcosahedronGeometry(r, 0), mat(0x8a8176)); m.position.set((rn() - .5) * 40, (rn() - .5) * 18, 70 - rn() * 90); m.rotation.set(rn() * 3, rn() * 3, 0); belt.add(m); }
    const jup = E.planet('jupiter', 16) || E.lowPoly(16, ['#c9a27a', '#e6d3b5', '#a9764f', '#d8b890', '#8f5e3c'], 4, 2, true), p10 = craft({ dish: 1.4 }, 'pioneer-10');
    const plate = new T.Group(); add(plate, new T.BoxGeometry(6, 3.5, .1), 0xd4a63a);
    for (let i = 0; i < 14; i++) { const a = -1.1 + i * .16; add(plate, new T.BoxGeometry(1.7, .03, .02), 0x3a2a10, [-1.9 + Math.cos(a) * .9, 1 + Math.sin(a) * .9 - .6, .07], [0, 0, a]); }
    [[.9], [1.7]].forEach(([x], j) => { add(plate, new T.CylinderGeometry(.09, .09, .9, 6), 0x3a2a10, [x, -.5, .07], [Math.PI / 2 * 0, 0, 0]); add(plate, new T.SphereGeometry(.17, 8, 6), 0x3a2a10, [x, .15, .07]); });
    add(plate, new T.BoxGeometry(2.4, .04, .02), 0x3a2a10, [1.3, -1.25, .07]);
    const earth = body(2.2, 'earth'), dots = new T.Group(); for (let i = 0; i < 12; i++) dots.add(sphere(.25, 0xfc3d21));
    return {
      title: 'Pioneer 10', kicker: 'THE FIRST MESSENGER TO THE STARS', end: 'Pioneer 10 is still sailing away from the Sun, carrying a hello from Earth.',
      scenes: [
        W('Through the Belt', 12, [belt, p10], [[0, 'Pioneer 10 launched in March 1972. Nobody knew if a spacecraft could survive the asteroid belt.'], [.55, 'It became the first to cross it, and it made it through safely.']],
          (p, t) => { const z = lerp(60, -10, ease(p)); p10.position.set(0, 0, z); p10.rotation.set(0, Math.PI / 2, 0); look(6, 3, z + 14, 0, 0, z - 10); }),
        W('Jupiter Up Close', 12, [jup, p10], [[0, 'In December 1973 Pioneer 10 became the first spacecraft to fly past Jupiter.'], [.5, 'It measured the giant planet’s radiation and sent back the first close-up views.']],
          (p, t) => { const e = ease(p); jup.rotation.y = t * .1; p10.position.set(lerp(-44, 44, e), lerp(12, -4, e), 24); p10.rotation.set(0, 0, 0); look(0, 2, 52, 0, 0, 0); }),
        W('A Message for Anyone', 12, [plate], [[0, 'Pioneer 10 carries a gold plaque, a hello for anyone who may find it one day.'], [.5, 'It shows a man and a woman, and a map that points back to Earth.']],
          (p, t) => { plate.rotation.set(0, Math.sin(t * .4) * .25, 0); look(0, 0, lerp(11, 7, ease(p)), 0, 0, 0); }),
        W('A Whisper Home', 12, [p10, earth, dots], [[0, 'Its dish always pointed back at Earth. Its radio signal got fainter every year.'], [.5, 'NASA’s last signal from Pioneer 10 arrived on January 23, 2003.']],
          (p, t) => { p10.position.set(40, 0, 0); p10.rotation.set(0, 0, Math.PI / 2); earth.position.set(-40, 0, 0); earth.rotation.y = t * .2; dots.children.forEach((s, i) => { const d = (t * 8 + i * 6.6) % 80; s.position.set(40 - d, 0, 0); s.scale.setScalar(Math.max(.15, 1 - d / 80 * .85)); }); look(0, 6, 62, 0, 0, 0); }),
        W('Onward', 13, [p10], [[0, 'Today Pioneer 10 drifts through the dark, headed roughly toward the constellation Taurus.'], [.55, 'Its trip to the stars is only just beginning.']],
          (p, t) => { p10.position.set(0, 0, lerp(0, -260, ease(p))); p10.rotation.set(0, Math.PI / 2, 0); E.sun.intensity = lerp(1.9, 1.1, p); look(4, 2, 12, 0, 0, -20); })]
    };
  }
});
/* ---------- MORE UNIQUE STORIES: Surveyor 3, Spirit, Opportunity (checked against NASA/JPL records) ---------- */
const hop = (q, n) => Math.abs(Math.sin(q * Math.PI * n)) * Math.pow(1 - q, 1.4);
const skyDim = (s, v) => { s.material.color.setScalar(v); };
Object.assign(defs, {
  'surveyor-3'() {
    const gm = ground(0x8d8d8d, .5, 80), sv = norm(E.clone('surveyor-3'), 3), lm = mkLM(true), fl = new T.Group();
    fl.add(flame(3, .8));
    const arm = new T.Group(), bm = new T.Mesh(new T.CylinderGeometry(.05, .05, 2.2, 6), mat(0xaaaaaa)), tr = new T.Mesh(new T.BoxGeometry(1, .1, .5), mat(0x3b3b3b)), tv = new T.Mesh(new T.BoxGeometry(.5, .4, .4), mat(0x222222));
    bm.position.y = -1.1; arm.add(bm); arm.position.set(.6, 1.6, 0); tr.position.set(2.1, .02, 0);
    return {
      title: 'Surveyor 3', kicker: 'THE ROBOT THAT GOT A VISIT FROM ASTRONAUTS', end: 'Surveyor 3 is still there, the only probe ever visited by people on another world.',
      scenes: [
        W('Bounce, Bounce, Stay', 11, [gm, sv, tv], [[0, 'Surveyor 3 landed on the Moon on April 20, 1967. Its job was to test if a spacecraft could land safely.'], [.5, 'It did not stay put at first. It bounced twice before it settled upright.']],
          (p, t) => { let y = 0, q = 0; if (p < .35) y = lerp(26, 0, Math.pow(p / .35, 2)); else { q = (p - .35) / .65; y = 4 * hop(q, 2) * 1.0; } sv.position.set(0, y, 0); sv.rotation.z = Math.sin(q * 12) * .08 * (1 - q); tv.position.set(0, y + 2.45, 0); look(11, 4, 17, 0, 1.5, 0); }),
        W('The Little Shovel', 12, [gm, sv, tv, arm, tr], [[0, 'Its robot arm had a scoop. It dug small trenches to test how strong the Moon’s soil was.'], [.5, 'Its camera sent back 6,315 pictures in two weeks, so scientists could see where people might land.']],
          (p, t) => { sv.position.set(0, 0, 0); sv.rotation.z = 0; tv.position.set(0, 2.45, 0); arm.rotation.z = lerp(.55, 1, .5 + .5 * Math.sin(t * 2)); tr.scale.x = .3 + p * 2.5; look(5, 2.2, 6.5, 1.4, 1, 0); }),
        W('The Long Lunar Night', 12, [gm, sv, tv], [[0, 'Then came the lunar night: two weeks of freezing cold and darkness.'], [.55, 'Surveyor 3 sent its last data on May 4, 1967. It never woke up again.']],
          (p, t) => { sv.position.set(0, 0, 0); tv.position.set(0, 2.45, 0); E.sun.intensity = lerp(1.9, .1, ease(p)); E.sun.color.setHex(0xff9a60); look(lerp(7, 18, p), lerp(3, 9, p), lerp(9, 20, p), 0, 1.2, 0); }),
        W('Intrepid Arrives', 12, [gm, sv, tv, lm, fl], [[0, 'Two and a half years later, on November 19, 1969, the Apollo 12 lunar module Intrepid came down nearby.'], [.5, 'Surveyor was the landing target. They touched down about 600 feet away. This picture is not to scale.']],
          (p, t) => { const y = lerp(34, 0, 1 - Math.pow(1 - ease(p), 1.6)); lm.position.set(-15, y, -11); fl.position.set(-15, y, -11); fl.visible = y > .2; look(10, 7, 22, -5, 4, -5); }),
        W('A Visit', 13, [gm, sv, tv, lm], [[0, 'On November 20, 1969, Pete Conrad and Alan Bean walked over to visit it.'], [.5, 'They cut off its TV camera and scoop and brought them home. No other probe has ever been visited by people on another world.']],
          (p, t) => { const e = ease(sub(p, 0, .5)), e2 = ease(sub(p, .1, .6)); lm.position.set(-15, 0, -11); const f = sub(p, .55, .8); tv.position.set(.2 * f, lerp(2.45, 1.2, f), 0); look(7, 2.5, 9, 0, 1.2, 0); })]
    };
  },
  spirit() {
    const gM = ground(0xa65a30, .7, 90), skyD = sky('#7a5a52', '#d9a27a', '#a65a30'), skyW = sky('#1a1530', '#c0653a', '#7a3d22'), r = norm(E.clone('spirit'), 1.8);
    const dust = new T.Mesh(new T.BoxGeometry(1.8, .04, 1.3), bas(0xb8864f, { transparent: true, opacity: .85 })); dust.position.y = 1;
    const devil = new T.Group(); for (let i = 0; i < 10; i++) { const m = new T.Mesh(new T.SphereGeometry(.45 + i * .16, 10, 8), bas(0xc49a6c, { transparent: true, opacity: .45 })); m.scale.y = .35; m.position.y = .3 + i * .5; devil.add(m); }
    const hills = new T.Group(); for (let i = 0; i < 6; i++) { const c = new T.Mesh(new T.ConeGeometry(12 + rn() * 8, 14 + rn() * 12, 6), mat(0x8a4a2a)); c.position.set(75 + i * 6, 6, -30 + i * 12); hills.add(c); }
    const sand = new T.Mesh(new T.CircleGeometry(2.6, 18), mat(0xd9b27c)); sand.rotation.x = -Math.PI / 2; sand.position.y = .03;
    return {
      title: 'Spirit', kicker: 'THE ROVER THAT WORKED 20 TIMES LONGER THAN PLANNED', end: 'Spirit sits at Troy, silent, in the crater where it first opened its eyes.',
      scenes: [
        W('First Look', 12, [gM, skyD, r], [[0, 'Spirit landed in Gusev Crater on January 4, 2004. It was built to work for 90 days.'], [.5, 'Its first picture was the sharpest ever taken on another planet. Now it looked all the way around.']],
          (p, t) => { r.position.set(0, 0, 0); skyDim(skyD, 1); const a = p * 6.28; look(0, 3, 0, Math.cos(a) * 10, 2.2, Math.sin(a) * 10); }),
        W('Dust Devils', 13, [gM, skyD, r, dust, devil], [[0, 'Dust slowly covered Spirit’s solar panels, so it got less power.'], [.5, 'In 2005 a dust devil swept across and blew them clean. Its power jumped from about 60% to 93%.']],
          (p, t) => { r.position.set(0, 0, 0); r.rotation.set(0, 0, 0); const e = ease(p); devil.position.set(lerp(-34, 8, e), 0, lerp(-9, -.5, e)); devil.rotation.y = t * 5; dust.material.opacity = lerp(.85, .08, sub(p, .72, .92)); look(8, 3, 12, 0, 1, 0); }),
        W('Up Into the Hills', 14, [gM, skyD, r, hills], [[0, 'Spirit climbed the Columbia Hills. Rocks there had been changed by water long ago.'], [.5, 'Near a plateau called Home Plate it found soils made of many layers of minerals.']],
          (p, t) => { const x = lerp(0, 40, ease(p)); r.position.set(x, 0, 0); r.rotation.set(0, 0, 0); look(x - 12, 3.5, 8, x + 30, 6, 0); }),
        W('Stuck at Troy', 14, [gM, skyD, r, sand], [[0, 'In 2009 Spirit’s wheels broke through a hard crust into hidden soft sand at a place called Troy.'], [.5, 'The team spent months trying to free it. In January 2010 they decided it would work as a still science station.']],
          (p, t) => { const e = ease(p); r.position.set(0, -lerp(0, .35, e), 0); r.rotation.set(0, 0, lerp(0, .12, e)); const c = p * 1.2; look(Math.cos(c) * 9, 3, Math.sin(c) * 9, 0, .6, 0); }),
        W('Winter Sleep', 14, [gM, skyW, r, sand], [[0, 'Winter came to Mars. Spirit’s tilted panels caught too little sunlight.'], [.5, 'Its last message reached Earth on March 22, 2010. NASA kept calling until May 2011.']],
          (p, t) => { const e = ease(p); r.position.set(0, -.35, 0); r.rotation.set(0, 0, .12); E.sun.intensity = lerp(1.9, .3, p); E.sun.color.setHex(0xff9a60); look(lerp(8, 24, e), lerp(3, 11, e), lerp(8, 20, e), 0, .6, 0); })]
    };
  },
  opportunity() {
    const gM = ground(0xa65a30, .7, 90), skyD = sky('#7a5a52', '#d9a27a', '#a65a30'), r = norm(E.clone('opportunity'), 1.8);
    const pit = new T.Mesh(new T.CircleGeometry(9, 28), mat(0x5a2f1b)); pit.rotation.x = -Math.PI / 2; pit.position.y = .04;
    const ball = new T.Mesh(new T.SphereGeometry(2.2, 16, 12), bas(0xf0f0f0, { transparent: true, opacity: .5 }));
    const out = new T.Mesh(new T.BoxGeometry(16, .5, 8), mat(0x7a5a48)); out.position.y = .25;
    const bg = new T.SphereGeometry(.12, 8, 6), berries = new T.Group(); for (let i = 0; i < 90; i++) { const b = new T.Mesh(bg, mat(0x6d7a8c)); b.position.set((rn() - .5) * 14, .55, (rn() - .5) * 6); berries.add(b); }
    const map = new T.Group(), plane = new T.Mesh(new T.PlaneGeometry(100, 60), mat(0x7a3f24)); plane.rotation.x = -Math.PI / 2; map.add(plane);
    const P = [[-35, 5, 1.6], [-20, 0, 3], [5, -6, 5], [35, 6, 9]]; P.forEach(([x, z, rd]) => { const d = new T.Mesh(new T.CircleGeometry(rd, 24), mat(0x4a2615)); d.rotation.x = -Math.PI / 2; d.position.set(x, .1, z); map.add(d); });
    const M2 = 90, la = new Float32Array(M2 * 3), samp = i => { const f = i / (M2 - 1) * 3, s = Math.min(2, Math.floor(f)), u = f - s; return [lerp(P[s][0], P[s + 1][0], u), lerp(P[s][1], P[s + 1][1], u)]; };
    for (let i = 0; i < M2; i++) { const [x, z] = samp(i); la.set([x, .3, z], i * 3); }
    const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.BufferAttribute(la, 3)); map.add(new T.Line(lg, new T.LineBasicMaterial({ color: 0xfc3d21 })));
    const mk = sphere(1, 0xfc3d21); map.add(mk);
    const da = new Float32Array(900); for (let i = 0; i < 300; i++) da.set([(rn() - .5) * 50, rn() * 12, (rn() - .5) * 50], i * 3);
    const dg = new T.BufferGeometry(); dg.setAttribute('position', new T.BufferAttribute(da, 3)); const dp = new T.Points(dg, new T.PointsMaterial({ color: 0xc49a6c, size: 3, sizeAttenuation: false, transparent: true, opacity: 0 }));
    return {
      title: 'Opportunity', kicker: 'THE ROVER THAT DROVE A MARATHON ON MARS', end: 'Opportunity rests in Perseverance Valley. It drove about 45 km, farther than any other Mars rover has gone.',
      scenes: [
        W('A Hole in One', 12, [gM, skyD, pit, ball, r], [[0, 'Opportunity landed on Mars wrapped in giant airbags. It bounced about two dozen times.'], [.55, 'Then it rolled into a small crater called Eagle. Scientists called it a hole in one.']],
          (p, t) => { skyDim(skyD, 1); const x = lerp(-60, 0, p), y = 2.2 + 6 * hop(p, 5); ball.position.set(x, y, 0); ball.rotation.z = -x * .4; r.position.set(x, y - .9, 0); ball.scale.setScalar(Math.max(.001, 1 - sub(p, .88, .97))); look(lerp(-40, 8, p), 4, 18, x * .6, 2, 0); }),
        W('Blueberries', 12, [gM, skyD, out, berries, r], [[0, 'Soon Opportunity found small round pebbles in the rock. Scientists nicknamed them blueberries.'], [.5, 'They are signs that water once soaked these rocks.']],
          (p, t) => { skyDim(skyD, 1); r.position.set(lerp(-14, -7, ease(p)), 0, 3.5); look(lerp(3, 1, p), 1.5, 6, 0, .5, 0); }),
        W('Crater Hopping', 14, [map], [[0, 'Opportunity hopped from crater to crater: Eagle, then Endurance, then huge Victoria.'], [.55, 'Its long drive ended at Endeavour Crater. In all it rolled about 45 kilometers.']],
          (p, t) => { lg.setDrawRange(0, Math.max(2, Math.floor(p * M2))); const [x, z] = samp(Math.min(M2 - 1, p * (M2 - 1))); mk.position.set(x, .6, z); look(0, 62, 14, 0, 0, 0); }),
        W('The Great Dust Storm', 14, [gM, skyD, r, dp], [[0, 'In 2018 Opportunity was exploring Perseverance Valley when a giant dust storm grew across all of Mars.'], [.5, 'The dust blotted out the Sun. Its solar panels could not make power.']],
          (p, t) => { r.position.set(0, 0, 0); r.rotation.set(0, 0, 0); dp.material.opacity = p * .9; dp.rotation.y = t * .3; skyDim(skyD, lerp(1, .15, p)); E.sun.intensity = lerp(1.9, .25, p); look(-9, 2.5, 9, 0, 1, 0); }),
        W('Mission Complete', 14, [gM, skyD, r, dp], [[0, 'Opportunity’s last message came on June 10, 2018. NASA sent more than 835 commands, but it never answered.'], [.55, 'On February 13, 2019, NASA declared the mission complete. It had planned for 90 days and got almost 15 years.']],
          (p, t) => { const e = ease(p); r.position.set(0, 0, 0); dp.material.opacity = lerp(.9, .35, p); skyDim(skyD, lerp(.15, .08, p)); E.sun.intensity = lerp(.25, .05, p); E.sun.color.setHex(0xff9a60); look(lerp(9, 26, e), lerp(2.5, 12, e), lerp(9, 22, e), 0, 1, 0); })]
    };
  }
});
const OPEN = { 'surveyor-3': 'type', 'apollo-11-eagle': 'wide', sojourner: 'rise', spirit: 'slide', opportunity: 'drop', dawn: 'wide', kepler: 'type', 'near-shoemaker': 'slide', 'pioneer-10': 'rise' };

window.EOS_UNIQUE = id => id in defs;

/* ---------- PLAYER ---------- */
let st = null, time = 0, total = 0, starts = [], all = [], idx = -1, capK = -1, playing = false, done = false, muted = false;
let ac = null, vol = null;
function audio(on) {
  try {
    if (!ac) {
      if (!on || muted) return;
      ac = new (window.AudioContext || window.webkitAudioContext)(); vol = ac.createGain(); vol.gain.value = .05; vol.connect(ac.destination);
      [55, 82.4, 110.7].forEach((f, i) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = i ? 'sine' : 'triangle'; o.frequency.value = f; o.detune.value = i * 5; g.gain.value = .6 / (i + 1); o.connect(g); g.connect(vol); o.start(); });
    }
    if (on && !muted) ac.resume(); else ac.suspend();
  } catch (e) { /* sound is optional */ }
}
function sync() {
  $('sPlay').textContent = done ? '\u21BB' : playing ? '\u275A\u275A' : '\u25B6';
  $('sPlay').setAttribute('aria-label', done ? 'Replay' : playing ? 'Pause' : 'Play');
  $('sSnd').textContent = muted ? 'Sound off' : 'Sound on'; $('sSnd').setAttribute('aria-pressed', muted);
}
function open(id) {
  if (!E.M().some(m => m.id === id)) return;
  G.clear(); st = (defs[id] || generic)(id); all = [];
  st.scenes.forEach(s => s.g.forEach(o => { if (!all.includes(o)) { all.push(o); G.add(o); } }));
  starts = []; total = 0; st.scenes.forEach(s => { starts.push(total); total += s.d; }); FXopen(id);
  E.hideWorld(true); E.M().forEach(m => m.g.visible = false);
  E.amb.intensity = .45; G.visible = true; time = 0; idx = -1; capK = -1; done = false; playing = !RM;
  document.body.classList.add('story'); $('story').hidden = false; $('sNote').textContent = 'Based on NASA records. Scenery and spacecraft are illustrations, not to scale.';
  $('sTitle').textContent = st.title; $('sKick').textContent = st.kicker; $('sTitleBox').dataset.o = OPEN[id] || 'fade';
  E.active = { update }; sync(); audio(playing); $('sPlay').focus();
}
function close() {
  if (!st) return; FXclose(); st = null; E.active = null; G.visible = false; G.clear();
  E.hideWorld(false); E.sun.color.setHex(0xfff2e0); audio(false);
  document.body.classList.remove('story'); $('story').hidden = true;
}
function update(dt) {
  if (playing) time = Math.min(total, time + dt);
  let i = starts.length - 1; while (i > 0 && time < starts[i]) i--;
  const sc = st.scenes[i];
  if (i !== idx) { idx = i; capK = -1; all.forEach(o => o.visible = sc.g.includes(o)); FXscene(i); E.sun.color.setHex(0xfff2e0); E.sun.intensity = 1.9; $('sChap').textContent = `Chapter ${i + 1} of ${st.scenes.length} · ${sc.n}`; }
  const p = cl((time - starts[i]) / sc.d); sc.upd(p, time); FXframe(sc, p, i, playing ? dt : 0);
  let k = 0; sc.caps.forEach((c, j) => { if (p >= c[0]) k = j; });
  if (k !== capK) { capK = k; $('sCap').textContent = sc.caps[k][1]; }
  $('sFade').style.opacity = RM ? 0 : 1 - cl(Math.min(time - starts[i], starts[i] + sc.d - time) / .7);
  $('sFill').style.width = (time / total * 100) + '%';
  $('sBar').setAttribute('aria-valuenow', Math.round(time / total * 100));
  $('sTitleBox').classList.toggle('on', time < 5);
  $('sEnd').classList.toggle('on', done);
  if (time >= total && playing) { playing = false; done = true; $('sEnd').textContent = st.end; sync(); }
}
/* PREVIEW (side panel): a 16:9 still of the story, rendered once per machine with the story's own scene code and camera, then cached.
   It picks the middle chapter at its half-way moment (the machine is in view, in its own setting), crops the render to 16:9 from the centre
   and returns a JPEG. The visible world is hidden while it draws and put back afterwards. */
const PVC = {};
window.EOS_PREVIEW = id => {
  if (st) return '';
  if (PVC[id]) return PVC[id];
  const vis = E.M().map(m => m.g.visible), sunC = E.sun.color.getHex(), sunI = E.sun.intensity, ambI = E.amb.intensity;
  try {
    const s = (defs[id] || generic)(id), objs = [];
    G.clear(); s.scenes.forEach(sc => sc.g.forEach(o => { if (!objs.includes(o)) { objs.push(o); G.add(o); } }));
    const sc = s.scenes[Math.floor((s.scenes.length - 1) / 2)];
    objs.forEach(o => { o.visible = sc.g.includes(o); });
    E.hideWorld(true); E.M().forEach(m => { m.g.visible = false; }); G.visible = true;
    E.sun.color.setHex(0xfff2e0); E.sun.intensity = 1.9; E.amb.intensity = .45;
    const fog = S.fog; S.fog = null;
    sc.upd(.5, 3); E.R.render(S, C); S.fog = fog;
    const src = E.R.domElement, W = src.width, H = src.height, k = 16 / 9;
    let cw = W, ch = Math.round(W / k); if (ch > H) { ch = H; cw = Math.round(H * k); }
    const cv = document.createElement('canvas'); cv.width = 960; cv.height = 540;
    cv.getContext('2d').drawImage(src, Math.round((W - cw) / 2), Math.round((H - ch) / 2), cw, ch, 0, 0, 960, 540);
    const url = cv.toDataURL('image/jpeg', .82);
    return (PVC[id] = url.length > 2000 ? url : '');
  } catch (e) { return ''; }
  finally {
    G.visible = false; G.clear(); E.hideWorld(false); E.M().forEach((m, i) => { m.g.visible = vis[i]; });
    E.sun.color.setHex(sunC); E.sun.intensity = sunI; E.amb.intensity = ambI;
  }
};
const toggle = () => { if (done) { time = 0; done = false; playing = true; } else playing = !playing; sync(); audio(playing); };
$('sPlay').onclick = toggle;
$('sRe').onclick = () => { time = 0; done = false; playing = true; sync(); audio(true); };
$('sSkip').onclick = () => { const n = idx + 1; if (n >= starts.length) { time = total; } else time = starts[n] + .01; done = false; };
$('sSnd').onclick = () => { muted = !muted; if (muted) audio(false); else audio(playing); sync(); };
$('sX').onclick = close;
$('sBar').onclick = e => { const r = e.currentTarget.getBoundingClientRect(); time = cl((e.clientX - r.left) / r.width) * total * .999; done = false; };
addEventListener('keydown', e => {
  if (!st) return;
  if (e.key === 'Escape') { e.stopPropagation(); close(); }
  else if (e.key === ' ' && !['BUTTON', 'INPUT'].includes(e.target.tagName)) { e.preventDefault(); toggle(); }
}, true);

window.EOS_PLAY = open;
})();
