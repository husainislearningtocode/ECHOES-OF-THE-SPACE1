(() => {
const MIN = 1960, MAX = 2026;
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = id => document.getElementById(id);

/* ---------- STATUS LABELS (all mission content lives in missions.json) ---------- */
const ST = {
  parked:   { l: 'Left behind', c: '#ffb84d' },
  silent:   { l: 'Went silent', c: '#d9d9d9' },
  grounded: { l: 'Grounded',    c: '#fc3d21' },
  active:   { l: 'Still working', c: '#7dff9a' }
};
let M = [];  // filled from missions.json
const isRover = m => m.rover !== undefined ? !!m.rover : ['rover', 'buggy'].includes((m.fallback || {}).type);

/* ---------- GLB LOADING for planets and machines. LD feeds the loading gate (gate.js) with real progress. ---------- */
const LD = { items: new Map(), cur: '', jobs: [] };
LD.track = key => { const it = { l: 0, t: 0, d: false }; LD.items.set(key, it); LD.cur = key; return it; };
LD.progress = () => { let a = 0, b = 0; LD.items.forEach(it => { const w = it.t || 1e6; a += (it.d ? 1 : it.t ? it.l / it.t : 0) * w; b += w; }); return b ? a / b : 0; };
let readyRes; const ready = new Promise(r => { readyRes = r; });
const GL = THREE.GLTFLoader ? new THREE.GLTFLoader() : null;
if (GL && THREE.DRACOLoader) {   // lets you use Draco-compressed .glb files too (many Sketchfab downloads are)
  const dr = new THREE.DRACOLoader(); dr.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/gltf/'); GL.setDRACOLoader(dr);
}
const GLB = new Map();   // one download + parse per file, even when two machines share it (Spirit and Opportunity)
function loadGLB(url) {
  if (GLB.has(url)) return GLB.get(url);
  const it = LD.track(url);
  const p = new Promise((ok, no) => GL
    ? GL.load(url, g => { it.d = true; ok(g); }, e => { it.l = e.loaded; it.t = e.total || 0; }, err => { it.d = true; no(err); })
    : no(new Error('GLTFLoader is not loaded')));
  LD.jobs.push(p.catch(() => {}));
  GLB.set(url, p); return p;
}
/* HEAD request so a missing file is detected without an error from the loader. A server that answers a missing file with an HTML page counts as missing. */
const modelExists = url => url ? fetch(url, { method: 'HEAD' }).then(r => r.ok && !/text\/html/i.test(r.headers.get('content-type') || '')).catch(() => false) : Promise.resolve(false);

/* ---------- SCREEN SHAKE (camera only). shake(.3) = small bump, shake(1) = big hit. Off when the visitor prefers reduced motion. ---------- */
let trauma = 0, arrival = false;
const shake = (amt = .5) => { if (!RM) trauma = Math.min(1, trauma + amt); };

/* ---------- SCENE ---------- */
const R = new THREE.WebGLRenderer({ canvas: $('scene'), antialias: true });
R.setPixelRatio(Math.min(devicePixelRatio, 2));
const S = new THREE.Scene();
const C = new THREE.PerspectiveCamera(50, 1, .1, 2500);
const home = new THREE.Vector3(0, 2.5, 22);
function resize() {
  R.setSize(innerWidth, innerHeight);
  C.aspect = innerWidth / innerHeight; C.updateProjectionMatrix();
  home.z = C.aspect < 1 ? 38 : 22;
}
addEventListener('resize', resize); resize();

const amb = new THREE.AmbientLight(0xd0d0d0, .55); S.add(amb);
/* the Sun is a real point light far to the left, so every planet is lit from the side that faces it */
const sun = new THREE.PointLight(0xfff2e0, 1.9, 0, 0); sun.position.set(-400, 110, 120); S.add(sun);

/* ---------- LOW-POLY PLANETS: flat-shaded facets with per-face colour. No image files, no outside assets. ---------- */
const PAL = {
  earth: ['#2a5fa8', '#2a5fa8', '#2f6fbf', '#3f8a4f', '#e8eef5'],
  mars:  ['#b5502b', '#c8663a', '#9a4324', '#d98a57'],
  moon:  ['#8c8c8c', '#a5a5a5', '#707070', '#bdbdbd']
};
function lowPoly(r, pal, seed = 1, detail = 2, bands = false) {
  const g = new THREE.IcosahedronGeometry(r, detail * 3 + 2), p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  let sd = Math.abs(Math.floor(seed)) * 977 + 13; const rnd = () => (sd = sd * 16807 % 2147483647) / 2147483647;
  for (let f = 0; f < p.count; f += 3) {
    const x = (p.getX(f) + p.getX(f + 1) + p.getX(f + 2)) / 3 / r, y = (p.getY(f) + p.getY(f + 1) + p.getY(f + 2)) / 3 / r, z = (p.getZ(f) + p.getZ(f + 1) + p.getZ(f + 2)) / 3 / r;
    const n = bands ? y * 3 + Math.sin(x * 5 + z * 3 + seed) * .25 : Math.sin(x * 3.1 + seed) + Math.sin(y * 4.3 + seed * 2) + Math.sin(z * 3.7 - seed);
    c.set(pal[Math.min(pal.length - 1, Math.max(0, Math.floor((n + 3) / 6 * pal.length)))]).offsetHSL(0, 0, (rnd() - .5) * .07);
    for (let j = 0; j < 3; j++) c.toArray(col, (f + j) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
}
function planet(r, pal, seed, x, y, z) { const o = lowPoly(r, pal, seed); o.position.set(x, y, z); S.add(o); return o; }
function glow(o, r, col) { return;
  o.add(new THREE.Mesh(new THREE.SphereGeometry(r * 1.13, 48, 48), new THREE.ShaderMaterial({
    uniforms: { c: { value: new THREE.Color(col) } },
    vertexShader: 'varying vec3 n;void main(){n=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform vec3 c;varying vec3 n;void main(){float i=pow(max(.72-dot(n,vec3(0,0,1.)),0.),3.);gl_FragColor=vec4(c,1.)*i*1.6;}',
    blending: THREE.AdditiveBlending, side: THREE.BackSide, transparent: true, depthWrite: false
  })));
}
const B = {
  mars: { r: 3.2, o: planet(3.2, PAL.mars, 3, -9, 0, 0) },
  moon: { r: 1.7, o: planet(1.7, PAL.moon, 8, 9, -.5, -2) }
};
B.mars.o.rotation.z = .35; B.moon.o.rotation.z = .1;
glow(B.mars.o, 3.2, 0xff7a4a); glow(B.moon.o, 1.7, 0x9fb4ff);
/* deep space: an invisible anchor that far-away machines (asteroids, probes, telescopes) circle */
B.space = { r: 1.6, o: new THREE.Object3D() }; B.space.o.position.set(0, 8, -14); S.add(B.space.o);

/* stars: procedural points and soft glows (no images) */
let stars;
{
  const n = 5000, p = new Float32Array(n * 3), c = new Float32Array(n * 3), col = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const r = 300 + Math.random() * 500, a = Math.random() * 6.283, b = Math.acos(2 * Math.random() - 1);
    p.set([r * Math.sin(b) * Math.cos(a), r * Math.cos(b), r * Math.sin(b) * Math.sin(a)], i * 3);
    col.setHSL(Math.random() < .12 ? .02 : 0, Math.random() < .12 ? .7 : 0, .68 + Math.random() * .32); c.set([col.r, col.g, col.b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  stars = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.7, vertexColors: true, sizeAttenuation: false, transparent: true, opacity: .9 }));
  S.add(stars);
}
const GT = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
})();
[[0x8c1408, -250, 90, -420, 520], [0xfc3d21, 320, -70, -470, 380], [0x555555, 20, 210, -520, 620]].forEach(([c, x, y, z, s]) => {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: GT, color: c, transparent: true, opacity: .2, blending: THREE.AdditiveBlending, depthWrite: false }));
  sp.position.set(x, y, z); sp.scale.set(s, s, 1); S.add(sp);
});

/* ---------- THE WIDER SOLAR SYSTEM (decoration only: far away, not clickable, out of reach) ---------- */
const FAR = [];
function far(name, r, pal, x, y, z, spin, o = {}) {
  const b = lowPoly(r, pal, x + 5, o.bands ? 2 : 1, o.bands);
  b.position.set(x, y, z); b.rotation.z = o.tilt || .2; S.add(b);
  if (o.glow) glow(b, r, o.glow);
  if (o.ring) {
    const rg = new THREE.Mesh(new THREE.RingGeometry(r * 1.3, r * 2.2, 10),
      new THREE.MeshBasicMaterial({ color: 0xcbb68a, side: THREE.DoubleSide, transparent: true, opacity: .75 }));
    rg.rotation.x = Math.PI / 2; b.add(rg);
  }
  FAR.push({ name, o: b, r, spin }); return b;
}
far('Earth', 8, PAL.earth, 34, 12, -52, .03, { glow: 0x5aa9ff });
far('Mercury', 3, ['#8d8d8d', '#a0a0a0', '#6f6f6f'], -330, 80, 40, .01);
far('Venus', 7, ['#d9b077', '#e6c590', '#c49a62'], -250, 60, -420, .01, { glow: 0xffd9a0 });
far('Jupiter', 40, ['#c9a27a', '#e6d3b5', '#a9764f', '#d8b890', '#8f5e3c'], 380, 90, -520, .06, { tilt: .05, bands: true });
far('Saturn', 32, ['#e0c890', '#f0dfb0', '#c8aa70', '#d9bc84'], 520, 140, 200, .05, { tilt: .45, ring: true, bands: true });
far('Uranus', 14, ['#9fe0e8', '#86cfd9', '#b4eef2'], -120, -150, -700, .03, { tilt: 1.4, glow: 0x9ff0ff, bands: true });
far('Neptune', 13, ['#3d5bd6', '#4d6bff', '#2f48b0'], -520, -90, -330, .03, { glow: 0x4d6bff, bands: true });
{
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(26, 1), new THREE.MeshBasicMaterial({ color: 0xfff3d0 }));
  body.position.copy(sun.position); S.add(body);
  [[0xffd27a, 260, .9], [0xff9a40, 900, .35]].forEach(([c, sz, op]) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: GT, color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }));
    sp.position.copy(sun.position); sp.scale.set(sz, sz, 1); S.add(sp);
  });
  FAR.push({ name: 'The Sun', o: body, r: 26, spin: 0 });
}
FAR.forEach(f => { f.el = document.createElement('div'); f.el.className = 'tag far'; f.el.textContent = f.name; document.body.appendChild(f.el); });

/* NASA texture skins: drop the files into assets/textures/. If a file is missing, the mid-poly colours stay. */
function skin(o, url) {
  new THREE.TextureLoader().load(url, t => {
    const m = o.material; m.map = t; m.vertexColors = false; m.flatShading = false; m.color.set(0xffffff); m.needsUpdate = true;
  }, undefined, () => {});
}
skin(B.moon.o, 'assets/textures/moon.jpg'); skin(B.mars.o, 'assets/textures/mars.jpg'); skin(FAR[0].o, 'assets/textures/earth.jpg');

/* ---------- PLANET MODELS: every planet, moon and asteroid comes from assets/models/<name>.glb ----------
   Scene bodies: mars, moon, earth, mercury, venus, jupiter, saturn, uranus, neptune, sun.   Story-only bodies: vesta, ceres, eros.
   Optional per-body "scale", "rotation" (degrees) and "model" (another path) in assets/planets.json.
   A loaded model replaces the low-poly body in the main scene AND in every mission story (EOS.planet).
   A low-poly body is used only when its file is missing (the console lists the missing files). */
const PM = {}, MISSING = [];
function planetObj(name, r) {   // a fresh copy of a loaded planet model, sized to radius r; null if that file did not load
  const e = PM[name]; if (!e) return null;
  const g = new THREE.Group(), w = new THREE.Group(); w.add(e.o.clone(true));
  w.scale.setScalar(2 * r / e.size * (e.cfg.scale || 1));
  w.rotation.set(...(e.cfg.rotation || [0, 0, 0]).map(d => d * Math.PI / 180));
  g.add(w); return g;
}
{
  const bodies = { mars: { o: B.mars.o, r: B.mars.r }, moon: { o: B.moon.o, r: B.moon.r } };
  FAR.forEach(f => { bodies[f.name === 'The Sun' ? 'sun' : f.name.toLowerCase()] = { o: f.o, r: f.r }; });
  const prep = (name, cfg) => {
    const url = cfg.model || `assets/models/${name}.glb`;
    return modelExists(url).then(ok => {
      if (!ok) { MISSING.push(url); return null; }
      return loadGLB(url).then(g => {
        const o = g.scene.clone(true), box = new THREE.Box3().setFromObject(o), sz = box.getSize(new THREE.Vector3());
        o.position.sub(box.getCenter(new THREE.Vector3()));
        if (name === 'sun') o.traverse(n => { if (n.isMesh && n.material && !Array.isArray(n.material)) n.material = new THREE.MeshBasicMaterial({ map: n.material.map || null, color: n.material.map ? 0xffffff : n.material.color }); });   // the Sun lights itself
        return (PM[name] = { o, size: Math.max(sz.x, sz.y, sz.z) || 1, cfg });
      });
    }).catch(e => { console.warn(`Could not use the ${name} model (${url}):`, e); return null; });
  };
  LD.jobs.push(fetch('assets/planets.json').then(r => r.ok ? r.json() : {}).catch(() => ({}))
    .then(cfg => Promise.all([...Object.keys(bodies), 'vesta', 'ceres', 'eros'].map(n => prep(n, cfg[n] || {}).then(e => {
      const p = bodies[n]; if (!e || !p) return;               // story-only bodies have no scene body
      p.o.children.forEach(c => { c.visible = false; });       // the low-poly ring, if any
      p.o.material.visible = false;                            // the low-poly body stays as an invisible click target
      p.o.add(planetObj(n, p.r));
    })))));
}

/* ---------- LOW-POLY MODELS ---------- */
const mat = (c, m = .35) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, metalness: m, roughness: .6 });
function part(g, c, p = [0, 0, 0], r = [0, 0, 0]) {
  const o = new THREE.Mesh(g, mat(c)); o.position.set(...p); o.rotation.set(...r); return o;
}
const Bx = (w, h, d) => new THREE.BoxGeometry(w, h, d), Cy = (a, b, h, s = 8) => new THREE.CylinderGeometry(a, b, h, s);
const SOL = 0x1c3d94, DISH = [0, 0, 0];

function model(t, pan) {
  const g = new THREE.Group(), A = (...a) => g.add(part(...a));
  const legs = (n, len, rad, c) => {
    for (let i = 0; i < n; i++) {
      const a = i / n * 6.283, l = part(Cy(.04, .04, len, 4), c, [Math.cos(a) * rad, .25, Math.sin(a) * rad]);
      l.rotation.order = 'YXZ'; l.rotation.y = -a; l.rotation.z = .5; g.add(l);
      A(Cy(.14, .14, .04, 6), c, [Math.cos(a) * (rad + len * .24), .25 - len * .44, Math.sin(a) * (rad + len * .24)]);
    }
  };
  if (t === 'rover') {
    A(Bx(1.2, .35, .8), 0xdcdcdc, [0, .35, 0]);
    A(Bx(1.3, .05, .95), pan ? SOL : 0xaaaaaa, [0, .56, 0]);
    for (const x of [-.5, 0, .5]) for (const z of [-.52, .52]) A(Cy(.2, .2, .12, 7), 0x2a2a2a, [x, .2, z], [Math.PI / 2, 0, 0]);
    A(Cy(.04, .04, .7, 5), 0x999999, [.45, .95, 0]);
    A(Bx(.22, .16, .26), 0x1a1a1a, [.45, 1.35, 0]);
    A(Cy(.03, .03, .9, 4), 0xcccccc, [-.5, .9, .3], [0, 0, .25]);
  } else if (t === 'lander') {
    A(Cy(.55, .7, .35, 6), 0xd8d8d8, [0, .6, 0]);
    A(Cy(.8, .8, .06, 6), 0x444444, [0, .82, 0]);
    A(Cy(.01, .32, .1, 10), 0xffffff, [.3, 1.05, 0]);
    if (pan) { A(Cy(.9, .9, .04, 12), SOL, [-1.25, .9, 0], [0, 0, .2]); A(Cy(.9, .9, .04, 12), SOL, [1.25, .9, 0], [0, 0, -.2]); }
    legs(3, .7, .55, 0xbbbbbb);
  } else if (t === 'descent') {
    A(Cy(.8, .8, .7, 8), 0xd9a441, [0, .6, 0]);
    A(Cy(.8, .8, .04, 8), 0xb8832a, [0, .97, 0]);
    A(Cy(.28, .4, .22, 8), 0x555555, [0, .15, 0]);
    legs(4, .9, .75, 0xe0e0e0);
  } else if (t === 'tripod') {
    A(Cy(.3, .3, .4, 6), 0xcccccc, [0, .7, 0]);
    A(Cy(.04, .04, .9, 5), 0x999999, [0, 1.4, 0]);
    A(Bx(.7, .04, .5), SOL, [0, 1.9, 0], [0, 0, .1]);
    legs(3, .8, .45, 0xcccccc);
  } else if (t === 'buggy') {
    A(Bx(1.4, .12, .8), 0xcccccc, [0, .35, 0]);
    for (const x of [-.6, .6]) for (const z of [-.5, .5]) A(Cy(.25, .25, .1, 10), 0x666666, [x, .25, z], [Math.PI / 2, 0, 0]);
    for (const z of [-.2, .2]) A(Bx(.25, .4, .25), 0xe8e8e8, [-.1, .6, z]);
    A(Cy(.03, .03, .9, 4), 0x999999, [.6, .8, 0]);
    A(Cy(.02, .35, .12, 10), 0xffffff, [.6, 1.3, 0], [.4, 0, 0]);
  } else if (t === 'pack') {
    A(Bx(.7, .5, .5), 0xb0b0b0, [0, .35, 0]);
    A(Bx(.6, .04, .6), SOL, [0, .62, 0]);
    A(Cy(.12, .12, .7, 8), 0x333333, [.7, .35, 0], [0, 0, Math.PI / 2]);
    A(Cy(.03, .03, 1, 4), 0x999999, [0, 1.1, 0]);
    A(Cy(.01, .3, .1, 10), 0xffffff, [0, 1.65, 0]);
    A(Bx(.5, .3, .05), 0x88aacc, [-.55, .3, 0], [0, .6, 0]);
    A(new THREE.SphereGeometry(.2, 6, 4), 0xdddddd, [0, .15, .5]);
  } else if (t === 'heli') {
    A(Bx(.45, .4, .45), 0xe8e8e8, [0, .6, 0]);
    A(Cy(.03, .03, .6, 4), 0x888888, [0, 1.05, 0]);
    A(Bx(.5, .05, .5), SOL, [0, .84, 0]);
    const rot = new THREE.Group(); rot.name = 'rot'; rot.position.y = 1.35;
    rot.add(part(Bx(2.2, .02, .14), 0x222222), part(Bx(.14, .02, 2.2), 0x222222)); g.add(rot);
    legs(4, .6, .35, 0x333333);
  }
  return g;
}

/* ---------- BUILD MISSIONS FROM missions.json ---------- */
const SIZE = 2; // machine models are scaled so their biggest side is ~2 units
function build(m, list) {
  const i = list.indexOf(m), b = B[m.body], fb = m.fallback || {};
  m.g = new THREE.Group(); m.holder = new THREE.Group(); m.g.add(m.holder);
  const low = model(fb.type || 'rover', fb.panels); low.scale.setScalar(fb.scale || .95);
  const rover = isRover(m);   // rovers only exist when their .glb does, so they never show the stand-in shape
  m.rot = null;
  m.ring = new THREE.Object3D();   // the status ring under each machine was removed; this empty stand-in keeps the older references below harmless
  m.a = i / list.length * 6.283; m.R = b.r * 1.7 + 1.1 + (i % 2) * .9; m.ph = i * 1.7;
  m.s = 0; m.on = false; m.g.scale.setScalar(0); m.g.visible = false; m.g.userData.m = m; S.add(m.g);
  if (m.model && GL) loadGLB(m.model).then(gltf => {
    const o = gltf.scene.clone(true), box = new THREE.Box3().setFromObject(o), sz = box.getSize(new THREE.Vector3());
    o.position.sub(box.getCenter(new THREE.Vector3()));
    const w = new THREE.Group(); w.add(o);
    w.scale.setScalar(SIZE / Math.max(sz.x, sz.y, sz.z) * (m.modelScale || 1));
    w.rotation.set(...(m.modelRotation || [0, 0, 0]).map(d => d * Math.PI / 180));
    m.holder.remove(low); m.holder.add(w); m.rot = null; m.loaded = true;
    m.ring.position.y = -SIZE / 2 * (m.modelScale || 1) - .1;
  }).catch(() => { MISSING.push(m.model); m.failed = true; console.warn(`No usable 3D model at "${m.model}". ${m.name} is not loaded.`); });
}

/* ---------- CAMERA RIG (drag to look around, wheel or pinch to zoom) ---------- */
const clock = new THREE.Clock(), ray = new THREE.Raycaster(), v2 = new THREE.Vector2(), cv = $('scene'), _z = new THREE.Vector3();
const rig = { t: new THREE.Vector3(), tT: new THREE.Vector3(), d: home.z, tD: home.z, yaw: 0, tYaw: 0, pit: .12, tPit: .12 };
let year = MIN, focus = null, focusB = null;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const near = (a, ref) => { while (a - ref > Math.PI) a -= 6.283; while (a - ref < -Math.PI) a += 6.283; return a; };
const LIM = () => focus ? [2.6, 14] : focusB ? [B[focusB].r * 1.6, 30] : [8, 48];
const zoom = f => { const [a, b] = LIM(); const before = rig.tD; rig.tD = clamp(rig.tD * f, a, b); if ((focus || focusB) && rig.tD !== before) shake(.07); };   // zooming close to a planet or machine rumbles a little

/* keeps every machine visible: if one would hide behind a planet (seen from the camera), slide it out to the edge */
const _a = new THREE.Vector3(), _r = new THREE.Vector3();
function unhide(p) {
  for (const k in B) {
    if (k === 'space') continue;
    const b = B[k], c = b.o.position; _a.copy(c).sub(C.position);
    const dist = _a.length(); if (dist < b.r * 1.6) continue;
    _a.divideScalar(dist); _r.copy(p).sub(c);
    const along = _r.dot(_a); if (along <= 0) continue;
    _r.addScaledVector(_a, -along);
    const lim = (dist + along) * b.r / Math.sqrt(dist * dist - b.r * b.r) * 1.08 + 1.1;
    if (_r.length() >= lim) continue;
    if (_r.length() < .01) _r.crossVectors(_a, C.up);
    _r.setLength(lim); p.copy(c).add(_r).addScaledVector(_a, along);
  }
}
function proj(v, el, a = 1) {
  const p = v.clone().project(C);
  el.style.opacity = p.z < 1 && !focus && !focusB ? a : 0;
  el.style.transform = `translate(-50%,-50%) translate(${(p.x * .5 + .5) * innerWidth}px,${(-p.y * .5 + .5) * innerHeight}px)`;
}

/* ---------- SPOTLIGHT ON THE SELECTED MACHINE (SH = beam height, SA = beam angle) ---------- */
const SH = 7, SA = .45, spot = new THREE.SpotLight(0xfff4dc, 0, 0, SA, .55, 0), spotG = new THREE.Group();
S.add(spot, spot.target, spotG);
{
  const cg = new THREE.ConeGeometry(Math.tan(SA), 1, 48, 1, true); cg.translate(0, -.5, 0);
  const cone = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ color: 0xfff1c9, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  cone.scale.setScalar(SH);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(Math.tan(SA) * SH * .8, 48),
    new THREE.MeshBasicMaterial({ map: GT, color: 0xfff1c9, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  pool.rotation.x = -Math.PI / 2; pool.position.y = -SH;
  spotG.add(cone, pool); spotG.visible = false; spotG.userData = { cone, pool };
}
let lit = 0, spotOn = null;

/* ---------- HOOKS FOR story.js (animated mission stories) ---------- */
const EOS = window.EOS = {
  THREE, S, C, R, B, amb, sun, FAR, lowPoly, PAL, GT, RM, active: null,
  M: () => M,
  clone: id => { const m = M.find(x => x.id === id), c = m.holder.children[0]; return c ? c.clone(true) : new THREE.Group(); },   // copy of a mission's current model (real .glb or low-poly stand-in)
  hideWorld: v => [B.mars.o, B.moon.o, ...FAR.map(f => f.o)].forEach(o => { o.visible = !v; }),
  /* INTRO HOOKS (intro.js) */
  rig, setYear, exitFocus: exit, toast, introCam: null,
  /* GATE HOOKS (gate.js) */
  ready, loader: LD, shake,
  /* ASSET HOOKS (story.js): the loaded planet and machine models from assets/ */
  planet: planetObj, hasModel: id => { const m = M.find(x => x.id === id); return !!(m && m.loaded); }
};

function loop() {
  const dt = Math.min(clock.getDelta(), .05), t = clock.elapsedTime;
  if (EOS.active) { EOS.active.update(dt); R.render(S, C); return requestAnimationFrame(loop); }
  stars.rotation.y += dt * .004;
  B.mars.o.rotation.y += dt * .05; B.moon.o.rotation.y += dt * .02;
  FAR.forEach(f => { f.o.rotation.y += dt * f.spin; proj(f.o.position.clone().add(new THREE.Vector3(0, -f.r * 1.25 - 1.5, 0)), f.el, .75); });

  M.forEach(m => {
    m.s += ((m.on ? 1 : 0) - m.s) * (1 - Math.exp(-dt * 6));
    m.g.visible = m.s > .01; if (!m.g.visible) return;
    const b = B[m.body].o.position;
    if (!RM && focus !== m) m.a += dt * .12;
    m.g.position.set(b.x + Math.cos(m.a) * m.R, b.y + Math.sin(m.a * 2 + m.ph) * .8 + Math.sin(t * 1.3 + m.ph) * .12, b.z + Math.sin(m.a) * m.R * .85);
    if (focus !== m) unhide(m.g.position);
    m.g.scale.setScalar(m.s * (1 + (1 - m.s) * .5));
    if (!RM) m.holder.rotation.y += dt * .4;
    m.ring.rotation.z += dt;
    m.ring.scale.setScalar(m.year === year ? 1 + .2 * Math.sin(t * 5) : 1);
    if (m.rot && !RM) m.rot.rotation.y += dt * 3;
  });

  if (focus) spotOn = focus;
  lit = 0;
  if (spotOn) {
    const p = spotOn.g.position;
    spotG.position.set(p.x, p.y - 1.1 + SH, p.z); spot.position.copy(spotG.position);
    spot.target.position.set(p.x, p.y - 1.1, p.z); spot.target.updateMatrixWorld();
  }
  spotG.visible = false;
  spot.intensity = 3.2 * lit; spotG.userData.cone.material.opacity = .13 * lit; spotG.userData.pool.material.opacity = .45 * lit;
  amb.intensity = .55; sun.intensity = 1.9;   // dim the scene so the spotlight stands out

  rig.tT.copy(focus ? focus.g.position : focusB ? B[focusB].o.position : _z);
  const k = 1 - Math.exp(-dt * 4);
  rig.t.lerp(rig.tT, focus ? 1 - Math.exp(-dt * 10) : k);
  rig.d += (rig.tD - rig.d) * k; rig.yaw += (rig.tYaw - rig.yaw) * k; rig.pit += (rig.tPit - rig.pit) * k;
  const cp = Math.cos(rig.pit);
  C.position.set(rig.t.x + Math.sin(rig.yaw) * cp * rig.d, rig.t.y + Math.sin(rig.pit) * rig.d, rig.t.z + Math.cos(rig.yaw) * cp * rig.d);
  C.lookAt(rig.t);
  if (EOS.introCam) { C.position.copy(EOS.introCam.pos); C.lookAt(EOS.introCam.look); }   // INTRO: cinematic camera overrides the rig
  if (arrival && Math.abs(rig.d - rig.tD) < rig.tD * .05) { arrival = false; shake(.4); }   // a thud as the camera lands on its target
  if (trauma > 0) {   // shake = small random rotation and nudge, strength grows with trauma squared
    const k = trauma * trauma, q = t * 41;
    C.position.x += Math.sin(q * 1.3) * .035 * k * rig.d; C.position.y += Math.sin(q * 1.9 + 2) * .035 * k * rig.d;
    C.rotateZ(Math.sin(q * 1.1 + 1) * .045 * k); C.rotateX(Math.sin(q * 1.7) * .03 * k); C.rotateY(Math.sin(q * 2.3 + 4) * .03 * k);
    trauma = Math.max(0, trauma - dt * 1.5);
  }

  proj(B.mars.o.position.clone().add(new THREE.Vector3(0, -B.mars.r - 1, 0)), $('tagMars'));
  proj(B.space.o.position.clone().add(new THREE.Vector3(0, -B.space.r - 1, 0)), $('tagSpace'));
  proj(B.moon.o.position.clone().add(new THREE.Vector3(0, -B.moon.r - 1, 0)), $('tagMoon'));
  R.render(S, C);
  requestAnimationFrame(loop);
}
loop();

/* ---------- INTERACTION ---------- */
function pick(e) {
  v2.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(v2, C);
  const h = ray.intersectObjects(M.filter(m => m.s > .5).map(m => m.g), true)[0];
  if (h) { let o = h.object; while (!o.userData.m) o = o.parent; return { m: o.userData.m }; }
  const p = ray.intersectObjects([B.mars.o, B.moon.o])[0];
  return p ? { b: p.object === B.mars.o ? 'mars' : 'moon' } : null;
}
const ptrs = new Map(); let drag = 0, pd = 0;
const pdist = () => { const [a, b] = [...ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
cv.addEventListener('pointerdown', e => {
  cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  drag = 0; if (ptrs.size === 2) pd = pdist();
});
cv.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId), tip = $('tip');
  if (p) {
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size === 1) { rig.tYaw -= dx * .005; rig.tPit = clamp(rig.tPit + dy * .005, -1.25, 1.25); drag += Math.abs(dx) + Math.abs(dy); }
    else if (ptrs.size === 2) { const d = pdist(); zoom(pd / d); pd = d; drag += 9; }
    cv.style.cursor = 'grabbing'; tip.style.opacity = 0; return;
  }
  const h = pick(e); cv.style.cursor = h ? 'pointer' : 'grab';
  if (h && !focus) {
    tip.textContent = h.m ? `${h.m.name} (${h.m.year})` : (h.b === 'mars' ? 'Mars: click to zoom in' : 'The Moon: click to zoom in');
    tip.style.transform = `translate(${e.clientX + 14}px,${e.clientY + 14}px)`; tip.style.opacity = 1;
  } else tip.style.opacity = 0;
});
const up = e => { ptrs.delete(e.pointerId); cv.style.cursor = 'grab'; };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
cv.addEventListener('wheel', e => { e.preventDefault(); zoom(Math.exp(e.deltaY * .001)); }, { passive: false });
cv.addEventListener('click', e => {
  if (drag > 6) return;
  const h = pick(e); if (!h) return;
  if (h.m) openM(h.m); else openB(h.b);
});
addEventListener('keydown', e => {
  if (e.key === 'Escape') return exit();
  if (['INPUT', 'BUTTON'].includes(e.target.tagName)) return;
  const s = { ArrowLeft: [-.15, 0], ArrowRight: [.15, 0], ArrowUp: [0, -.12], ArrowDown: [0, .12] }[e.key];
  if (s) { rig.tYaw += s[0]; rig.tPit = clamp(rig.tPit + s[1], -1.25, 1.25); }
  if (e.key === '+' || e.key === '=') zoom(.85);
  if (e.key === '-') zoom(1.18);
});

function exit() {
  if (focus || focusB) shake(.25);
  focus = null; focusB = null; $('panel').classList.remove('open'); $('back').classList.remove('on');
  rig.tYaw = near(0, rig.yaw); rig.tPit = .12; rig.tD = home.z;
}
$('back').onclick = $('close').onclick = exit;
function openB(n) {
  focus = null; focusB = n; $('panel').classList.remove('open'); $('back').classList.add('on');
  rig.tD = B[n].r * 3.6 + 2; shake(.55); arrival = true;
  toast(n === 'mars' ? 'Mars. Drag to look around, or move the timeline to wake its machines.' : 'The Moon. Drag to look around, or move the timeline to wake its machines.');
}
function openM(m) {
  focus = m; focusB = null; render(m); $('back').classList.add('on'); $('tip').style.opacity = 0;
  const d = m.g.position.clone().sub(B[m.body].o.position);   // start on the side facing away from the planet
  rig.tYaw = near(Math.atan2(d.x, d.z), rig.yaw); rig.tPit = .25; rig.tD = 5.5; shake(.5); arrival = true;
}
/* ---------- GALLERY: images per machine, from assets/gallery.json ----------
   { "base": "assets/images/", "missions": { "<id>": [ "https://...jpg", "photo.jpg", { "type": "url"|"file", "src": "...", "caption": "...", "credit": "..." } ] } }
   A URL (http, https, //, data:) is used as it is. Anything else is a file inside "base" (or a full path that starts with assets/ or ./).
   "type" is optional and only forces one reading. An image that fails to load is dropped. */
let GAL = { base: 'assets/images/', missions: {} }, galTok = 0, lbList = [], lbI = 0;
const galP = fetch('assets/gallery.json').then(r => r.ok ? r.json() : {}).catch(() => ({})).then(j => { GAL = Object.assign(GAL, j || {}); });
const galSrc = it => {
  const s = String(it.src || ''), isUrl = it.type === 'url' || (it.type !== 'file' && /^(https?:)?\/\/|^data:/i.test(s));
  return isUrl || /^(assets\/|\.\/|\.\.\/|\/)/.test(s) ? s : (GAL.base || 'assets/images/') + s;
};
function showGallery(m) {
  const tok = ++galTok, box = $('gallery'), list = $('gList'); box.hidden = true; list.innerHTML = '';
  const add = it => {
    const b = document.createElement('button'), im = new Image();
    b.type = 'button'; b.className = 'gPic'; b._it = it; b.setAttribute('aria-label', 'Open image: ' + (it.caption || m.name));
    im.alt = it.caption || m.name; im.decoding = 'async'; im.referrerPolicy = 'no-referrer';
    im.onload = () => { if (tok === galTok) box.hidden = false; };
    im.onerror = () => { if (it.alt && im.src !== it.alt) { im.src = it.alt; return; } b.remove(); if (!list.children.length) box.hidden = true; };
    im.src = galSrc(it); b.appendChild(im); b.onclick = () => lbOpen(b); list.appendChild(b);
  };
  galP.then(() => {
    if (tok !== galTok) return;
    const raw = (GAL.missions || {})[m.id] || m.images || [], items = (Array.isArray(raw) ? raw : []).map(x => typeof x === 'string' ? { src: x } : x).filter(x => x && x.src);
    items.forEach(add);
    // assets/gallery.json "queries": { "<id>": "search words" } adds pictures from NASA's open Image and Video Library (images-api.nasa.gov) until there are at most "perMachine" (default 4)
    const q = (GAL.queries || {})[m.id], want = (GAL.perMachine || 4) - items.length;
    if (q && want > 0) {
      fetch('https://images-api.nasa.gov/search?media_type=image&q=' + encodeURIComponent(q)).then(r => r.json()).then(j => {
        if (tok !== galTok) return;
        ((j.collection || {}).items || []).filter(i => i.links && i.links[0] && i.data && i.data[0]).slice(0, want).forEach(i => {
          const th = i.links[0].href, d = i.data[0];
          add({ type: 'url', src: th.replace('~thumb.', '~medium.'), alt: th, caption: d.title || m.name, credit: ['NASA', d.center].filter(Boolean).join('/') });
        });
      }).catch(() => {});
    }
    if (!list.children.length && !q) box.hidden = true;
    else if (list.children.length) box.hidden = false;
  });
}
function lbShow() {
  const b = lbList[lbI]; if (!b) return lbClose();
  $('lbImg').src = b.firstChild.src; $('lbImg').alt = b._it.caption || '';
  $('lbCap').textContent = [b._it.caption, b._it.credit].filter(Boolean).join(' \u00B7 ');
  $('lbPrev').hidden = $('lbNext').hidden = lbList.length < 2;
}
function lbOpen(b) { lbList = [...$('gList').children]; lbI = Math.max(0, lbList.indexOf(b)); lbShow(); $('lightbox').hidden = false; $('lbX').focus(); }
function lbClose() { $('lightbox').hidden = true; $('lbImg').removeAttribute('src'); }
const lbStep = d => { lbI = (lbI + d + lbList.length) % lbList.length; lbShow(); };
$('lbX').onclick = lbClose; $('lbPrev').onclick = () => lbStep(-1); $('lbNext').onclick = () => lbStep(1);
$('lightbox').onclick = e => { if (e.target === e.currentTarget || e.target.tagName === 'FIGURE') lbClose(); };
addEventListener('keydown', e => {   // capture phase: while the viewer is open, Esc and the arrows belong to it
  if ($('lightbox').hidden) return;
  if (e.key === 'Escape') lbClose(); else if (e.key === 'ArrowLeft') lbStep(-1); else if (e.key === 'ArrowRight') lbStep(1); else return;
  e.stopImmediatePropagation(); e.preventDefault();
}, true);

function render(m) {
  const s = ST[m.status];
  $('pChip').textContent = s.l; $('pChip').style.setProperty('--c', s.c);
  $('pTitle').textContent = m.name;
  $('pMeta').textContent = `${m.date}, ${m.where}`;
  $('pBlurb').textContent = m.blurb; $('pHow').textContent = m.how || '';
  $('pFacts').innerHTML = m.facts.map(f => `<li>${f}</li>`).join('');
  $('pSrc').href = m.url;
  showGallery(m);
  const pv = $('preview'); pv.hidden = !(m.body !== 'space' || (window.EOS_UNIQUE && window.EOS_UNIQUE(m.id))); pv.onclick = () => window.EOS_PLAY && window.EOS_PLAY(m.id);
  $('pvImg').src = (window.EOS_PREVIEW && window.EOS_PREVIEW(m.id)) || '';
  const w = $('watch'), has = !!window.EOS_PLAY;
  const ok = m.body !== 'space' || (window.EOS_UNIQUE && window.EOS_UNIQUE(m.id)); w.hidden = !has || !ok; w.onclick = () => window.EOS_PLAY(m.id);
  $('panel').classList.add('open');
}
/* ---------- TIMELINE ---------- */
let toastT;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3200);
}
function fleet() {
  const f = $('fleet'); f.innerHTML = '';
  M.filter(m => m.on).forEach((m, i) => {
    const b = document.createElement('button'); b.type = 'button';
    b.style.animationDelay = i * 30 + 'ms';
    b.innerHTML = `<i style="--c:${ST[m.status].c}"></i>${m.name}`;
    b.onclick = () => openM(m); f.appendChild(b);
  });
}
function setYear(y) {
  year = y; $('year').textContent = y; $('slider').value = y;
  const only = $('only').checked, fresh = [];
  M.forEach(m => { const on = only ? m.year === y : m.year <= y; if (on && !m.on) fresh.push(m); m.on = on; });
  if (focus && !focus.on) exit();
  const n = M.filter(m => m.on).length;
  $('count').textContent = `${n} ${n === 1 ? 'machine' : 'machines'} awake`;
  fleet();
  if (fresh.length) toast(fresh.length > 3 ? `${fresh.length} machines wake up` : `${y}: ${fresh.map(m => m.name).join(' and ')} arrives`);
}
const hint = () => $('hint').classList.add('off');
$('slider').oninput = e => { hint(); setYear(+e.target.value); };
$('only').onchange = () => setYear(year);
let timer = null;
$('play').onclick = () => {
  hint();
  if (timer) { clearInterval(timer); timer = null; $('play').innerHTML = '&#9654;'; return; }
  if (year >= MAX) setYear(MIN);
  $('play').innerHTML = '&#10074;&#10074;';
  timer = setInterval(() => { if (year >= MAX) $('play').click(); else setYear(year + 1); }, 300);
};

/* ---------- START: everything about the missions comes from missions.json ---------- */
const skipped = [];
fetch('assets/missions/index.json').then(r => { if (!r.ok) throw 0; return r.json(); })
  .then(ids => Promise.all(ids.map(id => fetch(`assets/missions/${id}.json`).then(r => r.json()))))
  .then(list => Promise.all(list.map(m => modelExists(m.model).then(ok => ok ? m : (skipped.push(m.name), null)))))   // a machine is only loaded when its .glb exists: no file, no machine, no stand-in
  .then(list => {
  M = list.filter(Boolean);
  if (skipped.length) console.info(`Machines without a .glb (not loaded): ${skipped.join(', ')}. Add the file named in assets/missions/<id>.json ("model") and reload.`);
  M.forEach(m => build(m, M.filter(x => x.body === m.body)));
  const ticks = () => {
    $('ticks').innerHTML = '';
    [...new Set(M.map(m => m.year))].forEach(y => {
      const i = document.createElement('i');
      i.style.left = `calc(11px + (100% - 22px) * ${(y - MIN) / (MAX - MIN)})`; $('ticks').appendChild(i);
    });
  };
  ticks(); setYear(MIN);
  return new Promise(r => setTimeout(r, 0)).then(() => Promise.all(LD.jobs)).then(() => new Promise(r => setTimeout(r, 0))).then(() => {
    const bad = M.filter(m => !m.loaded);   // the file was there but could not be read: remove those machines too, by code
    if (bad.length) {
      bad.forEach(m => { S.remove(m.g); M.splice(M.indexOf(m), 1); });
      ['moon', 'mars', 'space'].forEach(b => { const l = M.filter(x => x.body === b); l.forEach((m, i) => { m.a = i / l.length * 6.283; }); });
      ticks(); setYear(MIN);
      console.info(`Machines removed because their .glb could not be read: ${bad.map(m => m.name).join(', ')}`);
    }
    if (MISSING.length) console.info(`Model files not found in assets/ (those machines are not loaded): ${[...new Set(MISSING)].join(', ')}`);
    readyRes();
  });   // everything that was asked for has loaded (or failed)
}).catch(e => {
  readyRes();
  console.error('Echoes of Space failed to start:', e);
  const t = $('toast'); clearTimeout(toastT);
  t.textContent = e === 0 || e instanceof SyntaxError || (e && /fetch|NetworkError|Failed/i.test(e.message || ''))
    ? 'Could not load assets/missions/index.json. Open the site through a local server (see README.txt).'
    : 'Start-up error: ' + ((e && e.message) || e) + ' (press F12 for details)';
  t.classList.add('on');
});
})();
