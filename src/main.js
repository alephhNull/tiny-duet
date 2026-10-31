import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { MusicBox, FLOOR_Y } from './box.js';
import { Doll, Kid } from './doll.js';
import { Rain, Petals, Fireflies, Sparkles, Hearts, CloudHeart, Dust } from './world.js';
import { Post } from './post.js';
import { Story, SONG_END, STORY_END } from './story.js';
import { Sound } from './audio.js';
import { clamp, lerp } from './util.js';
import music from './music.json';

// ------------------------------------------------------------------ telegram
const tg = window.Telegram && window.Telegram.WebApp;
if (tg) {
  try {
    tg.ready();
    tg.expand();
    if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
    tg.setHeaderColor && tg.setHeaderColor('#16141d');
    tg.setBackgroundColor && tg.setBackgroundColor('#16141d');
    tg.setBottomBarColor && tg.setBottomBarColor('#16141d');
    if ((tg.platform === 'ios' || tg.platform === 'android') && tg.requestFullscreen) tg.requestFullscreen();
    if (tg.lockOrientation) tg.lockOrientation();
  } catch (e) {}
}
function haptic(kind = 'light') {
  try {
    const h = tg && tg.HapticFeedback;
    if (h && tg.platform !== 'unknown') {
      if (kind === 'select') h.selectionChanged();
      else if (kind === 'success') h.notificationOccurred('success');
      else h.impactOccurred(kind);
      return;
    }
  } catch (e) {}
  const ua = navigator.userActivation;
  if (navigator.vibrate && (!ua || ua.hasBeenActive)) navigator.vibrate(kind === 'heavy' ? 25 : 8);
}

// ------------------------------------------------------------------ renderer & scene
// phones get lighter settings from the start (and step down further on their own if needed)
const phone = new URLSearchParams(location.search).has('phone') || (tg && (tg.platform === 'ios' || tg.platform === 'android')) ||
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (window.matchMedia && matchMedia('(pointer: coarse)').matches);
const renderer = new THREE.WebGLRenderer({ antialias: !phone, powerPreference: 'high-performance' });
let dprCap = phone ? 1.5 : 2;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = phone ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.5;

const camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.1, 200);

// a dim, warm room: the box sits on a table
scene.background = new THREE.Color('#1c1820');
scene.fog = new THREE.Fog('#1c1820', 26, 60);

const hemi = new THREE.HemisphereLight('#b9a8a0', '#40384a', 0.7);
scene.add(hemi);
const keyLight = new THREE.DirectionalLight('#ffe2bd', 1.6);
keyLight.position.set(-3, 9, 7);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(phone ? 1024 : 2048, phone ? 1024 : 2048);
const sc = keyLight.shadow.camera;
sc.left = -6; sc.right = 6; sc.top = 6; sc.bottom = -6; sc.near = 1; sc.far = 40;
keyLight.shadow.bias = -0.0005;
keyLight.shadow.normalBias = 0.02;
keyLight.shadow.radius = 4;
scene.add(keyLight);
scene.add(keyLight.target);


const box = new MusicBox();
scene.add(box.group);

const her = new Doll('her');
const him = new Doll('him');
const girl = new Kid(3);
scene.add(her.root, him.root, girl.root);

const cloudHeart = new CloudHeart();
scene.add(cloudHeart.group, cloudHeart.rain.mesh);
const rain = new Rain(900, 2.6, 5.2, '#a9bdd6', 0.18, 0.55);
rain.floor = FLOOR_Y;
scene.add(rain.mesh);
const petals = new Petals(260);
scene.add(petals.mesh);
const fireflies = new Fireflies(70);
scene.add(fireflies.points);
const dust = new Dust(140);
scene.add(dust.points);
const sparkles = new Sparkles(400);
scene.add(sparkles.points);
const hearts = new Hearts(60);
scene.add(hearts.mesh);

const sound = new Sound(`${import.meta.env.BASE_URL}duet.mp3`);

const story = new Story({
  box, her, him, girl, cloudHeart, keyLight, hemi, rain, petals, fireflies,
  sparkles, hearts, haptic, scene3: scene, root: scene,
});

// notes for tap-chimes, from the song's own most common pitch classes
const pcCount = new Array(12).fill(0);
for (const [, s, pc] of music.onsets) pcCount[pc] += s;
const scalePcs = pcCount.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, 5).map((x) => x[1]).sort((a, b) => a - b);
const noteFreq = (pc, oct) => 440 * Math.pow(2, (pc - 9) / 12 + (oct - 4));

// ------------------------------------------------------------------ layout
let fitDist = 12;
const post = new Post(renderer, scene, camera, phone);
post.onLowRes = () => {
  dprCap = 1;
  renderer.setPixelRatio(1);
  resize();
};
post.onNoShadow = () => {
  renderer.shadowMap.enabled = false;
  scene.traverse((o) => {
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => (m.needsUpdate = true));
  });
};
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  post.setSize(w, h, renderer.getPixelRatio());
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  // keep the whole toy (box, key and the open lid) in frame
  const byWidth = 3.5 / (tanV * camera.aspect);
  const byHeight = 4.9 / tanV;
  fitDist = Math.max(byWidth, byHeight);
}
window.addEventListener('resize', resize);
if (tg && tg.onEvent) tg.onEvent('viewportChanged', resize);
resize();

// ------------------------------------------------------------------ state
const params = new URLSearchParams(location.search);
const debugT = params.has('t') ? parseFloat(params.get('t')) : null;
let state = 'pre'; // pre -> play -> pre
let T = -1;
let wind = 0; // radians wound
const WIND_NEEDED = Math.PI * 2 * 2.5;
let lastClick = 0;
let wound = false;
let keyAngle = 0;
let yawOffset = 0, yawVel = 0;
// zoom: pinch, double-tap or mouse wheel. It follows the figures and eases back to the whole box
// a few seconds after you let go.
const ZMAX = 2.8;
let zoom = 1, zoomGoal = 1, zoomHold = 0;
const touches = new Map();
let pinch = null;
let lastTap = 0;
const subject = new THREE.Vector3(), subjectSm = new THREE.Vector3(0, 1, 1.4);
let lastInteract = performance.now();
let held = null;
const chimeNotes = [0, 1, 2].map((i) => noteFreq(scalePcs[(i * 2) % scalePcs.length], 5));

function startPlay(from = 0) {
  state = 'play';
  sound.play(from);
  story.reset();
  T = from;
  haptic('success');
}

if (debugT !== null) {
  wound = true;
  wind = WIND_NEEDED;
}

// ------------------------------------------------------------------ input
const keyScreen = new THREE.Vector2();
let pointer = null;
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();

function keyCenter() {
  const v = box.bow.getWorldPosition(new THREE.Vector3());
  v.project(camera);
  keyScreen.set((v.x * 0.5 + 0.5) * window.innerWidth, (-v.y * 0.5 + 0.5) * window.innerHeight);
  return keyScreen;
}

function onDown(e) {
  sound.unlock();
  lastInteract = performance.now();
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touches.size >= 2) {
    // second finger: start pinching, and the first finger stops rotating/winding
    const [a, b] = [...touches.values()];
    pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: zoomGoal };
    if (pointer) pointer.moved = 999;
    return;
  }
  const kc = keyCenter();
  pointer = {
    id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(),
    a: Math.atan2(e.clientY - kc.y, e.clientX - kc.x), moved: 0,
  };
  try {
    renderer.domElement.setPointerCapture(e.pointerId);
  } catch (err) {}
}
function onMove(e) {
  if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch) {
    if (touches.size >= 2 && state === 'play') {
      const [a, b] = [...touches.values()];
      zoomGoal = clamp(pinch.z0 * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d0, 1, ZMAX);
      zoomHold = 2.5;
    }
    return;
  }
  if (!pointer || e.pointerId !== pointer.id) return;
  const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y;
  pointer.moved += Math.hypot(dx, dy);
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  lastInteract = performance.now();
  if (state === 'pre' && !wound) {
    const kc = keyCenter();
    const r = Math.hypot(e.clientX - kc.x, e.clientY - kc.y);
    const a = Math.atan2(e.clientY - kc.y, e.clientX - kc.x);
    let d = a - pointer.a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    pointer.a = a;
    let step = r > 18 ? Math.abs(d) : 0;
    // straight swipes also wind a little
    step = Math.max(step, Math.hypot(dx, dy) * 0.006);
    step = Math.min(step, 0.5);
    wind += step;
    const clicks = Math.floor(wind / (Math.PI / 3));
    if (clicks > lastClick) {
      lastClick = clicks;
      sound.tick(0.8);
      haptic('select');
      sparkles.burst(box.bow.getWorldPosition(new THREE.Vector3()), 3, 0.5, 0.4, 0.7, -0.4);
      if (clicks % 6 === 0) {
        const n = clicks / 6;
        sound.chime(chimeNotes[(n - 1) % chimeNotes.length], 0, 0.22);
        sparkles.burst(box.bow.getWorldPosition(new THREE.Vector3()), 18, 0.9, 0.5, 1.0, -0.4);
      }
    }
    if (wind >= WIND_NEEDED) {
      wound = true;
      wind = WIND_NEEDED;
      sound.chime(chimeNotes[0] * 2, 0.0, 0.18);
      sound.chime(chimeNotes[1] * 2, 0.12, 0.18);
      sound.chime(chimeNotes[2] * 2, 0.24, 0.2);
      haptic('medium');
      sparkles.burst(new THREE.Vector3(0, 0.7, 0.1), 60, 1.4, 0.8, 1.4, -0.4);
    }
  } else if (state === 'play') {
    yawOffset = clamp(yawOffset - dx * 0.006, -0.75, 0.75);
    yawVel = 0;
  }
}
function onUp(e) {
  touches.delete(e.pointerId);
  if (pinch) {
    if (touches.size < 2) {
      pinch = null;
      pointer = null;
      zoomHold = 2.5;
    }
    return;
  }
  if (!pointer || e.pointerId !== pointer.id) return;
  const tap = pointer.moved < 10 && performance.now() - pointer.t < 400;
  pointer = null;
  sound.unlock();
  sound.ensurePlaying();
  if (state === 'pre' && wound) {
    startPlay(debugT !== null ? debugT : 0);
    return;
  }
  if (state === 'play' && tap) {
    // double-tap: zoom in on them (or back out)
    const now = performance.now();
    if (now - lastTap < 320) {
      zoomGoal = zoomGoal > 1.3 ? 1 : 2.3;
      zoomHold = zoomGoal > 1 ? 4 : 0;
      lastTap = 0;
    } else lastTap = now;
    ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects([her.root, him.root, girl.root, box.disc], true);
    const hit = hits.find((h) => h.object.visible);
    if (hit) {
      const who = story.hit(hit.object);
      if (who === 'girl') {
        hearts.burst(girl.root.position.clone().add(new THREE.Vector3(0, 0.7, 0)), 6);
        haptic('light');
      } else if (who) {
        const d = who === 'her' ? her : him;
        d.hop = 1;
        const p = d.root.position.clone();
        p.y += 1.6;
        hearts.burst(p, 7);
        haptic('light');
      } else {
        hearts.burst(hit.point.clone().add(new THREE.Vector3(0, 0.05, 0)), 4);
        sparkles.burst(hit.point, 10, 0.5, 0.6, 0.8);
      }
      const pc = scalePcs[Math.floor(Math.random() * scalePcs.length)];
      sound.chime(noteFreq(pc, 6), 0, 0.07);
    }
  }
}
const cv = renderer.domElement;
cv.addEventListener('pointerdown', onDown);
cv.addEventListener('pointermove', onMove);
cv.addEventListener('pointerup', onUp);
cv.addEventListener('pointercancel', (e) => {
  touches.delete(e.pointerId);
  if (touches.size < 2) pinch = null;
  if (pointer && e.pointerId === pointer.id) pointer = null;
});
cv.addEventListener('wheel', (e) => {
  if (state !== 'play') return;
  e.preventDefault();
  zoomGoal = clamp(zoomGoal * Math.exp(-e.deltaY * 0.0015), 1, ZMAX);
  zoomHold = 2.5;
}, { passive: false });
// iOS: make sure audio unlocks on the touch itself
cv.addEventListener('touchend', () => {
  sound.unlock();
  if (state === 'pre' && wound) startPlay(debugT !== null ? debugT : 0);
  sound.ensurePlaying();
}, { passive: true });
window.addEventListener('click', () => sound.ensurePlaying());
document.addEventListener('visibilitychange', () => sound.setHidden(document.hidden));
document.addEventListener('gesturestart', (e) => e.preventDefault());

// ------------------------------------------------------------------ loop
const clock = new THREE.Clock();
let time = 0;
const camTarget = new THREE.Vector3();
const focusPt = new THREE.Vector3();
const focusUp = new THREE.Vector3(0, 0.95, 0);
const fadeEl = document.getElementById('fade');
// ?shot renders a clean, closer still of the closed box (used for the bot's cover image)
const shot = new URLSearchParams(location.search).has('shot');
let fadeK = shot ? 0 : 1;
if (shot) fadeEl.remove();

function frame() {
  const dt = Math.min(clock.getDelta(), 1 / 20);
  time += dt;

  if (held !== null) {
    state = 'play';
    T = held;
  } else if (state === 'play') {
    T = sound.time();
    if (T > STORY_END) {
      state = 'pre';
      sound.stop();
      story.keyBase = box.keySpin.rotation.z;
      keyAngle = 0;
      wind = 0;
      lastClick = 0;
      wound = false;
      T = -1;
      story.reset();
    }
  } else T = -1;

  // winding visuals
  if (state === 'pre') {
    keyAngle = lerp(keyAngle, wind, 1 - Math.exp(-dt * 18));
    story.windProgress = wind / WIND_NEEDED;
  }
  const keyBaseNow = story.keyBase - (state === 'pre' ? keyAngle : WIND_NEEDED);
  const savedBase = story.keyBase;
  story.keyBase = keyBaseNow;
  const { cam } = story.update(T, dt, time);
  story.keyBase = savedBase;

  // pre-state invitation: breathing heart on the lid, circling lights round the key
  if (state === 'pre') {
    const idle = (performance.now() - lastInteract) / 1000;
    const breathe = 0.5 + 0.5 * Math.sin(time * 2.2);
    box.heartGlow.material.opacity = wound ? 0.55 + breathe * 0.4 : 0.12 + breathe * 0.12;
    box.setHint(wound ? 0 : clamp((idle - 0.6) / 1.2) * (0.6 + breathe * 0.4) * (1 - clamp(wind / 2)), time);
    // little wiggle of the key when nobody touches it
    if (!wound && idle > 3) box.keySpin.rotation.z += Math.sin(time * 9) * 0.06 * Math.max(0, Math.sin(time * 1.3));
  } else box.setHint(0, time);

  // camera
  if (!pointer) {
    yawVel += -yawOffset * dt * 6;
    yawVel *= Math.exp(-dt * 4);
    yawOffset += yawVel;
  }
  // zoom: hold while pinching, then drift back to the whole box
  if (state !== 'play') zoomGoal = 1;
  else if (!pinch) {
    zoomHold -= dt;
    if (zoomHold <= 0) zoomGoal = lerp(zoomGoal, 1, 1 - Math.exp(-dt * 1.4));
  }
  zoom = lerp(zoom, zoomGoal, 1 - Math.exp(-dt * 8));
  // the figures on stage: zooming follows them as they move
  let n = 0;
  subject.set(0, 0, 0);
  for (const r of [her.root, him.root, girl.root]) {
    if (r.visible && r.scale.y > 0.3) {
      subject.add(r.position);
      n++;
    }
  }
  if (n) subject.divideScalar(n).add(focusUp);
  else subject.set(0, 0.95, 1.3);
  subjectSm.lerp(subject, 1 - Math.exp(-dt * 4));
  const zk = clamp((zoom - 1) / 1.2);
  const zs = zk * zk * (3 - 2 * zk);
  const [yaw0, pitch0, dm, tx, ty, tz] = cam;
  const yaw = yaw0 + yawOffset + Math.sin(time * 0.21) * 0.035;
  const pitch = pitch0 * (1 - 0.35 * zs);
  const dist = (fitDist * dm * (shot && state === 'pre' ? 0.72 : 1)) / zoom;
  camTarget.set(tx, ty, tz).lerp(subjectSm, zs);
  camera.position.set(
    camTarget.x + Math.sin(yaw) * Math.cos(pitch) * dist,
    camTarget.y + Math.sin(pitch) * dist + Math.sin(time * 0.33) * 0.03,
    camTarget.z + Math.cos(yaw) * Math.cos(pitch) * dist,
  );
  camera.lookAt(camTarget);

  rain.update(dt);
  cloudHeart.rain.update(dt);
  petals.update(dt);
  sparkles.update(dt, time);
  hearts.update(dt, time);

  dust.update(time, dt);
  // keep the figures in the sharp band of the tilt-shift
  focusPt.set(0, 0.75, 1.3).lerp(subjectSm, zs).project(camera);
  post.setFocus(clamp(focusPt.y * 0.5 + 0.5, 0.2, 0.8), 1);
  post.watch(dt);
  post.render();
  if (fadeK > 0) {
    fadeK = Math.max(0, fadeK - dt / 1.8);
    fadeEl.style.opacity = String(fadeK * fadeK);
    if (fadeK === 0) fadeEl.remove();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// debug hooks
window.__mb = { post, phone, story, setT: (t) => startPlay(t), hold: (t) => { held = t; }, sound, camera, renderer, scene };
