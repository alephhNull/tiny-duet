import * as THREE from 'three';
import '@fontsource/vazirmatn/400.css';
import '@fontsource/vazirmatn/600.css';
import { LetterArt, ALL_TEXT, COLORS, FONT } from './art.js';
import music from './music.json';
import { Sound } from '../audio.js';
import { clamp, lerp, smooth, seg, backOut, easeInOut, rng, heartGeometry } from '../util.js';

// ------------------------------------------------------------------ telegram
const tg = window.Telegram && window.Telegram.WebApp;
if (tg) {
  try {
    tg.ready();
    tg.expand();
    if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
    tg.setHeaderColor && tg.setHeaderColor('#f1e1d3');
    tg.setBackgroundColor && tg.setBackgroundColor('#f1e1d3');
    tg.setBottomBarColor && tg.setBottomBarColor('#f1e1d3');
    if ((tg.platform === 'ios' || tg.platform === 'android') && tg.requestFullscreen) tg.requestFullscreen();
  } catch (e) {}
}
function haptic(kind = 'light') {
  try {
    const h = tg && tg.HapticFeedback;
    if (h && tg.platform !== 'unknown') return h.impactOccurred(kind);
  } catch (e) {}
  const ua = navigator.userActivation;
  if (navigator.vibrate && (!ua || ua.hasBeenActive)) navigator.vibrate(kind === 'heavy' ? 25 : 8);
}

// ------------------------------------------------------------------ renderer
const phone = (tg && (tg.platform === 'ios' || tg.platform === 'android')) || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, phone ? 1.75 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.NeutralToneMapping;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#f1e1d3');
const camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.1, 100);
scene.add(new THREE.HemisphereLight('#fff6ec', '#c9a891', 1.6));
const sunL = new THREE.DirectionalLight('#fff3e2', 1.6);
sunL.position.set(-3, 8, 4);
scene.add(sunL);

const tex = (canvas) => {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
};
const canvas2d = (w, h, fn) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  fn(c.getContext('2d'), w, h);
  return c;
};
const flatMat = (map, opts = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.95, ...opts });
const flatPlane = (w, h) => new THREE.PlaneGeometry(w, h).rotateX(-Math.PI / 2);

// the table: warm and paper-coloured, lighter where the lamp falls
const table = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), flatMat(tex(canvas2d(512, 512, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  gr.addColorStop(0, '#fbefe3');
  gr.addColorStop(0.35, '#f3e2d2');
  gr.addColorStop(1, '#e7cdb9');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
  const R = rng(2);
  for (let i = 0; i < 4000; i++) {
    g.fillStyle = `rgba(150,110,80,${R() * 0.05})`;
    g.fillRect(R() * w, R() * h, 2, 2);
  }
}))));
table.position.y = -0.01;
scene.add(table);

const shadowTex = tex(canvas2d(128, 128, (g) => {
  g.filter = 'blur(14px)';
  g.fillStyle = 'rgba(80,45,25,0.55)';
  g.fillRect(28, 28, 72, 72);
}));
const shadow = (w, h) => {
  const m = new THREE.Mesh(flatPlane(w * 1.7, h * 1.7), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.5 }));
  m.renderOrder = -1;
  scene.add(m);
  return m;
};

// a few crayons lying around
function makeCrayon(color) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.55 });
  const wrapM = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.25), roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.62, 16), m);
  body.position.y = 0.43;
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.016, 0.12, 16), m);
  tip.position.y = 0.06;
  const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.063, 0.063, 0.4, 16), wrapM);
  wrap.position.y = 0.46;
  for (const y of [0.3, 0.62]) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.025, 16), new THREE.MeshStandardMaterial({ color: '#2b2630', roughness: 0.7 }));
    band.position.y = y;
    g.add(band);
  }
  g.add(body, tip, wrap);
  return g;
}
[[-1.9, -2.9, 0.6, COLORS.red], [1.7, -3.1, -0.3, COLORS.blue], [2.0, 2.9, 2.2, COLORS.yellow], [-1.6, 3.2, 1.1, COLORS.green], [0.4, 3.6, 2.8, COLORS.pink], [-0.3, -3.4, -1.0, COLORS.violet]].forEach(([x, z, r, c]) => {
  const k = makeCrayon(c);
  k.rotation.set(0, r, Math.PI / 2);
  k.position.set(x, 0.06, z);
  scene.add(k);
});

// ------------------------------------------------------------------ the envelope
const EW = 3.3, EH = 2.2, TOP = -EH / 2, NOTCH = TOP + 1.05, TIP = TOP + 1.2;
const envelope = new THREE.Group();
scene.add(envelope);
const envShadow = shadow(EW, EH);
const linerTex = tex(canvas2d(256, 256, (g, w, h) => {
  g.fillStyle = '#fde6ec';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#f27aa6';
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    if ((x + y) % 2) continue;
    g.save();
    g.translate(x * 32 + 16, y * 32 + 16);
    g.beginPath();
    g.moveTo(0, 5);
    g.bezierCurveTo(-9, -2, -5, -10, 0, -5);
    g.bezierCurveTo(5, -10, 9, -2, 0, 5);
    g.fill();
    g.restore();
  }
}));
linerTex.wrapS = linerTex.wrapT = THREE.RepeatWrapping;
linerTex.repeat.set(3, 2);
envelope.add(new THREE.Mesh(flatPlane(EW, EH), flatMat(linerTex)));

const pocketCanvas = canvas2d(660, 440, (g, w, h) => {
  g.fillStyle = '#f4cfc3';
  g.fillRect(0, 0, w, h);
  const R = rng(5);
  for (let i = 0; i < 1500; i++) {
    g.fillStyle = `rgba(160,100,80,${R() * 0.07})`;
    g.fillRect(R() * w, R() * h, 2, 2);
  }
  g.strokeStyle = 'rgba(170,110,95,0.35)';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, h);
  g.lineTo(w * 0.5, h * 0.52);
  g.lineTo(w, h);
  g.moveTo(0, 0);
  g.lineTo(w * 0.42, h * 0.62);
  g.moveTo(w, 0);
  g.lineTo(w * 0.58, h * 0.62);
  g.stroke();
});
const pocketTex = tex(pocketCanvas);
const pocketShape = new THREE.Shape();
pocketShape.moveTo(-EW / 2, -TOP);
pocketShape.lineTo(0, -NOTCH);
pocketShape.lineTo(EW / 2, -TOP);
pocketShape.lineTo(EW / 2, -EH / 2);
pocketShape.lineTo(-EW / 2, -EH / 2);
pocketShape.closePath();
const pocketGeo = new THREE.ShapeGeometry(pocketShape);
const pa = pocketGeo.attributes.position, pu = pocketGeo.attributes.uv;
for (let i = 0; i < pa.count; i++) pu.setXY(i, pa.getX(i) / EW + 0.5, pa.getY(i) / EH + 0.5);
pocketGeo.rotateX(-Math.PI / 2);
const pocket = new THREE.Mesh(pocketGeo, flatMat(pocketTex));
pocket.position.y = 0.028;
envelope.add(pocket);

// a doodled heart and a little Koko sticker on the envelope
function writeOnPocket() {
  const g = pocketCanvas.getContext('2d');
  g.save();
  g.strokeStyle = COLORS.red;
  g.lineWidth = 5;
  g.lineCap = 'round';
  g.beginPath();
  const hx = 540, hy = 365;
  g.moveTo(hx, hy + 12);
  g.bezierCurveTo(hx - 22, hy - 4, hx - 12, hy - 24, hx, hy - 10);
  g.bezierCurveTo(hx + 12, hy - 24, hx + 22, hy - 4, hx, hy + 12);
  g.stroke();
  g.translate(120, 360);
  g.fillStyle = '#fffaf2';
  g.beginPath();
  g.arc(0, 0, 50, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = COLORS.koko;
  g.beginPath();
  g.arc(0, 6, 32, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(-22, -18, 12, 8, -0.6, 0, Math.PI * 2);
  g.ellipse(22, -18, 12, 8, 0.6, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#2a2630';
  g.beginPath();
  g.arc(-11, 4, 6, 0, Math.PI * 2);
  g.arc(11, 4, 6, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(-13, 2, 2, 0, Math.PI * 2);
  g.arc(9, 2, 2, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = COLORS.pink;
  g.beginPath();
  g.arc(0, 15, 3.5, 0, Math.PI * 2);
  g.fill();
  g.restore();
  pocketTex.needsUpdate = true;
}

// the flap, hinged along the top edge
const flapHinge = new THREE.Group();
flapHinge.position.set(0, 0.034, TOP);
envelope.add(flapHinge);
const triShape = new THREE.Shape();
triShape.moveTo(-EW / 2, 0);
triShape.lineTo(EW / 2, 0);
triShape.lineTo(0, -(TIP - TOP));
triShape.closePath();
const triGeo = new THREE.ShapeGeometry(triShape);
const ta = triGeo.attributes.position, tu = triGeo.attributes.uv;
for (let i = 0; i < ta.count; i++) tu.setXY(i, ta.getX(i) / EW + 0.5, 1 + ta.getY(i) / EH);
triGeo.rotateX(-Math.PI / 2);
flapHinge.add(new THREE.Mesh(triGeo, flatMat(pocketTex)), new THREE.Mesh(triGeo, flatMat(linerTex, { side: THREE.BackSide })));

// wax seal in two halves: one stays on the pocket, one leaves with the flap
const waxM = new THREE.MeshStandardMaterial({ color: '#c8242f', roughness: 0.35 });
const sealHalf = (start) => new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.27, 0.06, 28, 1, false, start, Math.PI), waxM);
const sealA = sealHalf(Math.PI / 2);
sealA.position.set(0, 0.03, TIP - 0.08 - TOP);
flapHinge.add(sealA);
const sealHeart = new THREE.Mesh(heartGeometry(0.1, 0.03, 0.02), new THREE.MeshStandardMaterial({ color: '#e0414b', roughness: 0.3 }));
sealHeart.rotation.x = -Math.PI / 2;
sealHeart.position.set(0, 0.065, TIP - 0.12 - TOP);
flapHinge.add(sealHeart);
const sealB = sealHalf(-Math.PI / 2);
sealB.position.set(0, 0.062, TIP - 0.08);
envelope.add(sealB);

// ------------------------------------------------------------------ the letter, folded in three
const LW = 3.0, LH = 4.2, P3 = LH / 3;
const letter = new THREE.Group();
scene.add(letter);
const letterShadow = shadow(LW, LH);
const backTex = tex(canvas2d(64, 64, (g) => {
  g.fillStyle = '#fbf6ec';
  g.fillRect(0, 0, 64, 64);
}));
function panel(v0, v1, pivotZ, a, b) {
  const pivot = new THREE.Group();
  pivot.position.z = pivotZ;
  const geo = new THREE.PlaneGeometry(LW, b - a);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, v0 + uv.getY(i) * (v1 - v0));
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, (a + b) / 2);
  const front = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.95, transparent: true, alphaTest: 0.5 }));
  const backGeo = new THREE.PlaneGeometry(LW, b - a);
  backGeo.rotateX(Math.PI / 2);
  backGeo.translate(0, -0.001, (a + b) / 2);
  pivot.add(front, new THREE.Mesh(backGeo, flatMat(backTex)));
  letter.add(pivot);
  return { pivot, front };
}
const pMid = panel(1 / 3, 2 / 3, 0, -P3 / 2, P3 / 2);
const pTop = panel(2 / 3, 1, -P3 / 2, -P3, 0);
const pBot = panel(0, 1 / 3, P3 / 2, 0, P3);
pTop.pivot.position.y = 0.004;
pBot.pivot.position.y = 0.008;

// ------------------------------------------------------------------ crayon hearts that drift up on the music
const heartSprites = [];
const heartTexes = [COLORS.red, COLORS.pink, COLORS.violet, COLORS.yellow].map((c) => tex(canvas2d(128, 128, (g) => {
  g.translate(64, 70);
  g.strokeStyle = c;
  g.fillStyle = c;
  g.lineWidth = 9;
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(0, 30);
  g.bezierCurveTo(-52, -6, -30, -50, 0, -22);
  g.bezierCurveTo(30, -50, 52, -6, 0, 30);
  g.globalAlpha = 0.55;
  g.fill();
  g.globalAlpha = 1;
  g.stroke();
  g.globalCompositeOperation = 'destination-out';
  const R = rng(c.length);
  for (let i = 0; i < 260; i++) g.fillRect(R() * 128 - 64, R() * 128 - 64, 2 + R() * 2, 1);
})));
function popHeart(pos) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTexes[Math.floor(Math.random() * heartTexes.length)], transparent: true, depthWrite: false }));
  s.position.copy(pos);
  s.userData = { v: new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.9 + Math.random() * 0.5, (Math.random() - 0.5) * 0.3), life: 0, max: 2 + Math.random(), s: 0.2 + Math.random() * 0.15, r: Math.random() * 6 };
  scene.add(s);
  heartSprites.push(s);
}

// ------------------------------------------------------------------ sound
// relative to this page, so it works both locally and under the site's sub-path
const sound = new Sound(new URL('je-te-veux.mp3', location.href).href);
function paper(dur = 0.5, vol = 0.25) {
  const c = sound.ctx;
  if (!c) return;
  const t = c.currentTime;
  const b = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = b;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 0.6;
  bp.frequency.setValueAtTime(900, t);
  bp.frequency.exponentialRampToValueAtTime(3800, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp).connect(g).connect(sound.out);
  src.start(t);
}
function crack() {
  const c = sound.ctx;
  if (!c) return;
  sound.tick(1.2);
  const t = c.currentTime;
  const o = c.createOscillator();
  o.frequency.setValueAtTime(180, t);
  o.frequency.exponentialRampToValueAtTime(60, t + 0.12);
  const g = c.createGain();
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  o.connect(g).connect(sound.out);
  o.start(t);
  o.stop(t + 0.2);
}

// ------------------------------------------------------------------ layout
let fitDist = 12;
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  fitDist = Math.max(1.9 / (tanV * camera.aspect), 2.45 / tanV);
}
window.addEventListener('resize', resize);
if (tg && tg.onEvent) tg.onEvent('viewportChanged', resize);
resize();

// ------------------------------------------------------------------ opening the envelope (tap it, or pull the flap up)
const params = new URLSearchParams(location.search);
let held = params.has('m') ? parseFloat(params.get('m')) : null;
let opened = false, cracked = false;
let flapK = 0, flapGoal = 0;
let drag = null;
let lastInteract = performance.now();
let M = -1;
let pulse = 0, onsetIdx = 0;
const fired = new Set();

function breakSeal() {
  if (cracked) return;
  cracked = true;
  crack();
  haptic('heavy');
}
function open() {
  if (opened) return;
  breakSeal();
  opened = true;
  sound.play(0);
}

const cv = renderer.domElement;
cv.addEventListener('pointerdown', (e) => {
  sound.unlock();
  lastInteract = performance.now();
  drag = { id: e.pointerId, y: e.clientY, t: performance.now(), moved: 0, k0: flapK };
  try { cv.setPointerCapture(e.pointerId); } catch (err) {}
});
cv.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id || opened) return;
  lastInteract = performance.now();
  drag.moved = Math.max(drag.moved, Math.abs(drag.y - e.clientY));
  flapGoal = flapK = clamp(drag.k0 + (drag.y - e.clientY) / (window.innerHeight * 0.3), 0, 0.95);
  if (flapK > 0.08) breakSeal();
});
function up(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const tap = drag.moved < 12 && performance.now() - drag.t < 450;
  drag = null;
  sound.unlock();
  sound.ensurePlaying();
  if (!opened) {
    if (tap || flapK > 0.3) open();
    else flapGoal = 0;
  }
}
cv.addEventListener('pointerup', up);
cv.addEventListener('pointercancel', () => (drag = null));
cv.addEventListener('touchend', () => {
  sound.unlock();
  sound.ensurePlaying();
}, { passive: true });
// keep the music playing even when the page isn't in front
document.addEventListener('gesturestart', (e) => e.preventDefault());

// ------------------------------------------------------------------ loop
const clock = new THREE.Clock();
let time = 0, artClock = 0, art, artTex;
const fadeEl = document.getElementById('fade');
let fadeK = 1;
const v = new THREE.Vector3(), camTarget = new THREE.Vector3();

function frame() {
  const dt = Math.min(clock.getDelta(), 1 / 20);
  time += dt;
  if (held !== null) {
    opened = cracked = true;
    M = held;
  } else M = opened ? sound.time() : -1;

  pulse *= Math.exp(-dt * 6);
  while (onsetIdx < music.onsets.length && music.onsets[onsetIdx][0] <= M) {
    if (M - music.onsets[onsetIdx][0] < 0.3) pulse = Math.min(1, pulse + music.onsets[onsetIdx][2]);
    onsetIdx++;
  }

  // ---------------- envelope: the flap peeks to invite a pull; once opened it lifts right away
  if (!opened) {
    const idle = (performance.now() - lastInteract) / 1000;
    const peek = !drag && idle > 1.5 ? Math.max(0, Math.sin(time * 2.2)) ** 6 * 0.08 : 0;
    if (!drag) flapK = lerp(flapK, flapGoal + peek, 1 - Math.exp(-dt * 10));
  } else flapK = Math.max(flapK, lerp(flapK, 1, 1 - Math.exp(-dt * 7)));
  flapHinge.rotation.x = -flapK * Math.PI * 0.86;
  flapHinge.position.y = 0.034 + Math.sin(flapK * Math.PI) * 0.02;
  const c = cracked ? clamp(flapK * 4) : 0;
  sealB.rotation.y = c * 0.25;
  sealB.position.x = c * 0.03;

  // the letter slides all the way out (under the raised flap and clear of it), rises, the envelope
  // leaves underneath it, and only then does the letter come down in the middle and unfold
  const leave = easeInOut(seg(M, 1.55, 2.35));
  envelope.position.set(0, 0, 0.35 + leave * 5.2);
  envelope.rotation.y = Math.sin(time * 0.8) * 0.015 * (1 - leave) + leave * 0.25;
  envelope.visible = leave < 0.999;
  envShadow.position.set(0.08, 0.001, envelope.position.z + 0.08);
  envShadow.material.opacity = 0.42 * (1 - leave);

  const out = easeInOut(seg(M, 0.45, 1.45));
  const rise = easeInOut(seg(M, 1.35, 1.75));
  const center = easeInOut(seg(M, 1.9, 2.6));
  const down = easeInOut(seg(M, 2.45, 2.95));
  const lift = 0.9 * rise * (1 - down);
  letter.position.set(0, 0.008 + lift + 0.012 * down, lerp(lerp(0.63, -2.8, out), 0, center));
  const unBot = backOut(seg(M, 2.85, 3.45), 1.1);
  const unTop = backOut(seg(M, 3.3, 3.95), 1.1);
  pBot.pivot.rotation.x = -Math.PI * (1 - unBot);
  pTop.pivot.rotation.x = Math.PI * (1 - unTop);
  for (const t of [2.9, 3.35]) {
    if (M > t && !fired.has(t)) {
      fired.add(t);
      paper(0.5, 0.26);
      haptic('light');
    }
  }
  letterShadow.position.set(0.1 + lift * 0.4, 0.002, letter.position.z + 0.1 + lift * 0.3);
  letterShadow.scale.set(1, 1, lerp(1 / 3, 1, unBot * 0.5 + unTop * 0.5));
  letterShadow.material.opacity = (0.45 - lift * 0.35) * smooth(1.2, 1.8, M);

  // ---------------- the drawing stays gently alive
  if (art) {
    const a = art.anim;
    a.tail = Math.sin(time * 2.6) * 0.24;
    a.blink = time % 3.4 < 0.14 ? 1 : 0;
    a.kokoBlink = (time + 1.3) % 4.1 < 0.16 ? 1 : 0;
    a.hands = Math.sin(time * 2.2) * 6;
    a.sun += dt * 0.25;
    a.heart = 1 + pulse * 0.16;
    artClock += dt;
    if (M > 1 && artClock > 0.1) {
      artClock = 0;
      art.draw(time);
      artTex.needsUpdate = true;
    }
    if (M > 3.5 && M < music.end && pulse > 0.9 && Math.random() < 0.06) {
      v.set((Math.random() - 0.5) * 2.4, 0.1, 0.4 + Math.random() * 1.4).applyMatrix4(letter.matrixWorld);
      popHeart(v);
    }
  }
  for (let i = heartSprites.length - 1; i >= 0; i--) {
    const s = heartSprites[i], u = s.userData;
    u.life += dt;
    s.position.addScaledVector(u.v, dt);
    u.v.multiplyScalar(1 - dt * 0.8);
    const k = u.life / u.max;
    s.scale.setScalar(u.s * Math.min(1, u.life * 6));
    s.material.opacity = 1 - smooth(0.6, 1, k);
    s.material.rotation = Math.sin(time * 2 + u.r) * 0.3;
    if (k >= 1) {
      scene.remove(s);
      s.material.dispose();
      heartSprites.splice(i, 1);
    }
  }

  // ---------------- camera: looking down at the table
  const settled = smooth(2.2, 3.9, M);
  const follow = smooth(0.4, 1.4, M) * (1 - smooth(1.9, 2.8, M));
  const pitch = lerp(1.05, 1.2, settled) + Math.sin(time * 0.3) * 0.01;
  const yaw = Math.sin(time * 0.23) * 0.015;
  const dist = fitDist * lerp(0.95, 0.84, settled);
  camTarget.set(0, 0, lerp(0.35, 0.05, settled) - follow * 1.3);
  camera.position.set(
    camTarget.x + Math.sin(yaw) * Math.cos(pitch) * dist,
    camTarget.y + Math.sin(pitch) * dist,
    camTarget.z + Math.cos(yaw) * Math.cos(pitch) * dist,
  );
  camera.lookAt(camTarget);

  renderer.render(scene, camera);
  if (fadeK > 0) {
    fadeK = Math.max(0, fadeK - dt / 1.2);
    fadeEl.style.opacity = String(fadeK * fadeK);
    if (fadeK === 0) fadeEl.remove();
  }
  requestAnimationFrame(frame);
}

(async () => {
  try {
    await Promise.race([Promise.all([document.fonts.load(`600 50px ${FONT}`, ALL_TEXT), document.fonts.load(`400 42px ${FONT}`, ALL_TEXT)]), new Promise((r) => setTimeout(r, 4000))]);
  } catch (e) {}
  art = new LetterArt();
  artTex = tex(art.canvas);
  for (const p of [pMid, pTop, pBot]) {
    p.front.material.map = artTex;
    p.front.material.needsUpdate = true;
  }
  art.draw(0);
  artTex.needsUpdate = true;
  writeOnPocket();
  requestAnimationFrame(frame);
})();

window.__L = { hold: (m) => { held = m; } };
