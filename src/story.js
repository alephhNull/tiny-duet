import * as THREE from 'three';
import { clamp, lerp, smooth, seg, win, backOut, easeInOut, colorTrack, monoTrack } from './util.js';
import { FLOOR_Y } from './box.js';
import { buildWard, buildStreet, buildMeadow, buildMountains, buildLights, buildHome } from './scenes.js';
import { Rope } from './world.js';
import music from './music.json';

const PI = Math.PI;
export const SONG_END = 130.4;
export const STORY_END = 134.6;

// ------------------------------------------------------------------ music helpers
const ONSETS = music.onsets; // [t, strength, pitchClass]
function snap(t, w = 0.35, minS = 0.2) {
  let best = t, bd = w;
  for (const [ot, s] of ONSETS) {
    const d = Math.abs(ot - t);
    if (s >= minS && d < bd) { bd = d; best = ot; }
  }
  return best;
}
function onsetsIn(a, b, minS = 0.15) {
  return ONSETS.filter(([t, s]) => t >= a && t <= b && s >= minS).map((o) => o[0]);
}

// ------------------------------------------------------------------ cue sheet (seconds in the song)
const BED = [snap(4.4), snap(9.4), snap(14.2)];
const POP = snap(55.2, 0.4, 0.3);
const C = {
  appear: 1.2,
  stops: [[3.2, 6.2], [7.9, 11.0], [12.7, 16.4]],
  wardOff: 18.0,
  rainWalk: 19.6, bench: 34.5, sit: 35.2, wipe: 38.8,
  himIn: 42.5, himAt: 46.4, himSit: 47.4, tie: 50.2, pass: 53.0,
  pop: POP,
  walk2: 57.8, fence: 71.5, turnBack: 75.8,
  dance: 77.6, climax: 88.0, climaxEnd: 100.0,
  still: 107.0, bind: snap(108.6, 0.4, 0.05), forehead: 109.3, veil: 112.4, front: 113.4,
  girl: 114.4, girlAt: 116.2, house: 119.2, lights: 121.0, walkHome: 123.0, door: 127.2, look: 127.4,
  close: 131.0,
};
const BED_A = [0.3, 1.1, 1.9]; // local angles of the beds on the stage
const BENCH_A = 4.1, FENCE_A = 7.0, HOME_A = 18.6;
const ROOM = new THREE.Color('#1c1820');

// disc angle over the song (it always turns one way, like a real music box drum)
const discTrack = monoTrack([
  [-1, 0.55], [1.6, 0.55], [3.2, 0.0],
  [6.2, 0.0], [7.9, -0.8], [11.0, -0.8], [12.7, -1.6],
  [19.6, -1.6], [34.5, -4.1],
  [57.8, -4.1], [71.5, -7.0],
  [77.6, -7.0], [84, -7.35], [88, -8.0], [100, -16.5], [107.0, -18.6], [400, -18.6],
]);

// the key unwinds while it plays, slowing to a stop as the spring runs out
const keyTurn = monoTrack([[0, 0], [124, 124], [130.6, 128.6], [400, 128.6]]);

// camera: [yaw, pitch, distMul, tx, ty, tz] — the whole toy stays in view
const camTrack = monoTrack([
  [-1, [0.3, 0.42, 1.1, 0.25, -0.35, 0.2]],
  [0.2, [0.3, 0.42, 1.1, 0.25, -0.35, 0.2]],
  [2.6, [0.22, 0.3, 1.0, 0, 2.0, -0.4]],
  [17, [0.16, 0.29, 0.96, 0.1, 1.9, -0.2]],
  [24, [0.1, 0.27, 0.96, 0, 1.9, -0.2]],
  [40, [0.06, 0.26, 0.92, 0, 1.75, 0.1]],
  [50, [0.04, 0.24, 0.87, 0.05, 1.6, 0.3]],
  [54.6, [0.04, 0.22, 0.8, 0.0, 1.55, 0.5]],
  [56.2, [0.1, 0.24, 0.84, 0.0, 1.7, 0.3]],
  [58.5, [0.2, 0.3, 1.0, 0, 2.1, -0.4]],
  [66, [0.08, 0.29, 0.98, 0, 2.0, -0.3]],
  [73.5, [-0.14, 0.26, 0.92, 0, 1.8, 0]],
  [80, [0.18, 0.31, 0.98, 0, 2.0, -0.3]],
  [88, [0.3, 0.36, 1.0, 0, 2.1, -0.4]],
  [99, [-0.28, 0.34, 1.0, 0, 2.1, -0.4]],
  [105, [0.05, 0.29, 0.95, 0, 1.85, 0]],
  [109, [0.03, 0.23, 0.8, 0.0, 1.5, 0.55]],
  [111.5, [0.03, 0.23, 0.8, 0.0, 1.5, 0.55]],
  [114, [0.08, 0.26, 0.9, 0.0, 1.7, 0.2]],
  [117.5, [0.1, 0.25, 0.84, 0.0, 1.55, 0.45]],
  [121, [0.16, 0.29, 0.94, 0, 1.85, -0.05]],
  [128.5, [0.1, 0.29, 0.94, 0, 1.85, -0.1]],
  [131.5, [0.26, 0.38, 0.95, 0, 0.9, 0]],
  [134.2, [0.3, 0.42, 1.1, 0.25, -0.35, 0.2]],
]);

const skyTop = colorTrack([[-1, '#16141d'], [0, '#16141d'], [3, '#1c2443'], [17.5, '#1c2443'], [20, '#3a4256'], [50, '#3a4256'], [54.6, '#4b5569'], [55.6, '#7b93b3'], [58, '#6fb0e2'], [65, '#7ab6e2'], [69.5, '#e9a88b'], [75, '#d98a78'], [77.8, '#3e3466'], [81, '#121233'], [106, '#141436'], [111, '#2a1f48'], [127, '#2a2148'], [131.5, '#16141d']]);
const skyBot = colorTrack([[-1, '#2a2430'], [0, '#2a2430'], [3, '#3a4a74'], [17.5, '#3a4a74'], [20, '#68748a'], [50, '#68748a'], [54.6, '#7c879a'], [55.6, '#f3c9a8'], [58, '#ffe3c8'], [65, '#ffe3c8'], [69.5, '#ffd29e'], [75, '#ffb48a'], [77.8, '#d9858c'], [81, '#33295e'], [106, '#33295e'], [111, '#8a5684'], [127, '#8f5a84'], [131.5, '#2a2430']]);
const skyGlow = colorTrack([[-1, '#000000'], [55.2, '#000000'], [57.5, '#ffc59a'], [65, '#ffe0b8'], [70, '#ff9c6b'], [76, '#ff7a5c'], [79.5, '#000000'], [110, '#000000'], [114, '#5a2a50'], [128, '#5a2a50'], [131, '#000000']]);
const stageCol = colorTrack([[-1, '#c9d6dc'], [17.8, '#c9d6dc'], [20, '#4e586c'], [54.8, '#4e586c'], [56.8, '#a9cf95'], [65.5, '#a9cf95'], [67.5, '#b7c98c'], [76, '#c2b07c'], [79.5, '#363b5c'], [107.5, '#363b5c'], [111, '#e6c7ce'], [130, '#e6c7ce']]);
const pathCol = colorTrack([[-1, '#e3eaee'], [17.8, '#e3eaee'], [20, '#5f6a80'], [54.8, '#5f6a80'], [56.8, '#efe3c6'], [76, '#e6cf9e'], [79.5, '#4a4f73'], [107.5, '#4a4f73'], [111, '#f6e2e6'], [130, '#f6e2e6']]);
const keyCol = colorTrack([[-1, '#ffe2bd'], [0.5, '#ffe2bd'], [3, '#c3cfff'], [17.5, '#c3cfff'], [20, '#b3bfd6'], [54.8, '#b3bfd6'], [56.5, '#fff1dc'], [66, '#fff1dc'], [71, '#ffc08a'], [76, '#ff9f7a'], [79.5, '#a9b3ff'], [107, '#a9b3ff'], [111, '#ffd2dc'], [130, '#ffd2dc'], [133, '#ffe2bd']]);
const hemiSky = colorTrack([[-1, '#b9a8a0'], [3, '#8d9fd6'], [17.5, '#8d9fd6'], [20, '#8794ad'], [54.8, '#8794ad'], [56.5, '#dff0ff'], [66, '#dff0ff'], [72, '#ffd7b3'], [79.5, '#7d84c9'], [107, '#7d84c9'], [111, '#f2c9dc'], [130, '#f2c9dc'], [133, '#b9a8a0']]);
const keyInt = monoTrack([[-1, 1.8], [0.5, 1.8], [3, 1.25], [17.5, 1.25], [20, 0.85], [54.8, 0.9], [56.5, 2.4], [66, 2.4], [72, 2.1], [77, 1.4], [80, 1.0], [107, 1.0], [111, 1.35], [129, 1.35], [131.5, 1.2], [134, 1.8]]);
const hemiInt = monoTrack([[-1, 0.75], [3, 0.8], [17.5, 0.8], [20, 0.7], [54.8, 0.75], [56.5, 1.1], [72, 1.0], [79.5, 0.75], [107, 0.75], [111, 0.9], [129, 0.9], [134, 0.75]]);
const envInt = monoTrack([[-1, 0.55], [3, 0.4], [20, 0.35], [54.8, 0.35], [56.5, 0.7], [72, 0.6], [79.5, 0.38], [111, 0.45], [134, 0.55]]);
const keyPos = monoTrack([[-1, [-3, 10, 8]], [20, [-3, 10, 8]], [56, [-5, 9, 5]], [70, [-7, 6, 1]], [77, [-7, 4, -1]], [80, [3, 10, 6]], [107, [3, 10, 6]], [111, [-4, 10, 7]], [400, [-4, 10, 7]]]);
const rainInt = monoTrack([[19.0, 0], [21.5, 1], [50, 1], [52.5, 0.3], [54.2, 0]]);
const cloudRain = monoTrack([[1.2, 0], [2.5, 0.8], [17, 0.8], [20, 0.95], [50.5, 0.9], [52.5, 0.35], [54.2, 0]]);
const petalInt = monoTrack([[112.8, 0], [115.5, 0.55], [128, 0.55], [130.2, 0]]);
const sunUV = monoTrack([[55.1, [-0.35, -1.25]], [58.5, [-0.25, 0.4]], [66, [0.05, 0.48]], [71.5, [0.3, 0.05]], [76.5, [0.42, -0.42]], [79, [0.5, -1.25]]]);
const moonUV = monoTrack([[84, [-0.45, -1.25]], [92, [-0.42, 0.45]], [129, [-0.36, 0.52]], [400, [-0.36, 0.52]]]);
const cloudAmt = monoTrack([[-1, 0.2], [17.5, 0.2], [20, 0.95], [52, 0.95], [55.5, 0.3], [58, 0.4], [66, 0.4], [72, 0.45], [78, 0.2], [107, 0.15], [112, 0.25], [131, 0.25]]);
const cloudCol = colorTrack([[-1, '#2b3660'], [17.5, '#2b3660'], [20, '#5c667e'], [52, '#5c667e'], [55.5, '#f4d6cc'], [58, '#ffffff'], [66, '#ffffff'], [70, '#ffd0b4'], [76, '#e89a92'], [79, '#2c2a5a'], [107, '#2c2a5a'], [112, '#7a5482'], [131, '#7a5482']]);
const flashTrack = monoTrack([[0, 0], [0.35, 7], [1.6, 2.2], [3.2, 0], [POP - 0.05, 0], [POP + 0.25, 5], [POP + 1.8, 0], [C.bind - 0.1, 0], [C.bind + 0.2, 2.5], [C.bind + 1.6, 0]]);
const overcast = monoTrack([[19, 0], [21.5, 1], [52, 1], [55, 0]]);
const fireOp = monoTrack([[80.5, 0], [83.5, 1], [106, 1], [109, 0.45], [127, 0.45], [130.5, 0]]);
const fireSwirl = monoTrack([[87.5, 0], [89.5, 1], [99, 1], [102, 0]]);
const pairSpin = monoTrack([[77.6, 0], [80, 0.15], [84, 0.9], [88, 2.4], [100, 20.2], [107.0, 8 * PI], [400, 8 * PI]]);
const pairC = monoTrack([[77.6, [0, 1.62]], [80, [0, 1.62]], [88, [0, 0.2]], [100, [0, 0.2]], [106.6, [0, 1.5]], [400, [0, 1.5]]]);
const pairLift = monoTrack([[88.5, 0], [91.5, 0.5], [98, 0.5], [101.5, 0]]);
const girlPath = monoTrack([[C.girl, [1.0, 1.0]], [C.girl + 0.5, [1.0, 1.0]], [C.girlAt, [0, 1.66]], [C.walkHome, [0, 1.66]], [C.door, [0, 0.78]], [400, [0, 0.78]]]);

// ------------------------------------------------------------------ director
export class Story {
  constructor(o) {
    Object.assign(this, o); // box, her, him, girl, cloudHeart, fx, lights, haptic
    this.v = new THREE.Vector3();
    this.v2 = new THREE.Vector3();
    this.cloudPos = new THREE.Vector3(0, 1.9, 1.5);
    this.lastT = -10;
    this.windProgress = 0;
    this.keyBase = 0;
    this.pulse = 0;
    this.onsetIdx = 0;

    const flowerTimes = onsetsIn(56.2, 64.5, 0.05);
    const lightTimes = onsetsIn(78.0, 87.5, 0.05);
    this.starTimes = onsetsIn(77.6, 88, 0.05);
    this.scenes = {
      ward: buildWard(1.2, C.wardOff, BED_A),
      street: buildStreet(19.3, 56.0, BENCH_A),
      meadow: buildMeadow(56.3, 66.4, flowerTimes.length ? flowerTimes : [57]),
      mountains: buildMountains(66.0, 78.0, FENCE_A),
      lights: buildLights(78.2, 130.5, lightTimes.length ? lightTimes : [80], HOME_A),
      home: buildHome(110.4, 130.7, HOME_A, { house: C.house, lights: C.lights }),
    };
    for (const s of Object.values(this.scenes)) this.box.disc.add(s.group);

    // balloons for the children in the ward
    const balloonGeo = new THREE.SphereGeometry(0.085, 20, 14);
    balloonGeo.scale(1, 1.18, 1);
    this.wardBalloons = this.scenes.ward.beds.map((b) => {
      const m = new THREE.Mesh(balloonGeo, new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.25 }));
      m.castShadow = true;
      b.bed.add(m);
      const rope = new Rope(10);
      this.root.add(rope.mesh);
      return { m, rope, b };
    });
    this.heartRope = new Rope(14, '#fdf6ee', 0.007);
    this.root.add(this.heartRope.mesh);
    this.ropeWhite = new THREE.Color('#fdf6ee');
    this.ropeRed = new THREE.Color('#d8344c');
    this.ropeEnd = new THREE.Vector3();
    // the little red knot that binds their hands
    this.knot = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.012, 8, 20), new THREE.MeshStandardMaterial({ color: '#d8344c', roughness: 0.4, emissive: '#5a0c1a', emissiveIntensity: 0.4 }));
    this.root.add(this.knot);

    const sp = this.sparkles, hearts = this.hearts;
    this.events = [
      ...BED.map((t, i) => ({ t, f: () => {
        const b = this.wardBalloons[i];
        b.m.getWorldPosition(this.v);
        sp.burst(this.v, 26, 0.8, 0.5, 1.0);
        this.haptic('light');
      } })),
      { t: 0.25, f: () => {
        sp.burst(new THREE.Vector3(0, 0.3, 0.2), 140, 2.2, 1.4, 1.8, -0.5);
        this.haptic('medium');
      } },
      { t: 42.4, f: () => sp.burst(new THREE.Vector3(2.4, 0.7, 1.85), 30, 0.9, 0.5) },
      { t: 51.4, f: () => this.haptic('light') },
      { t: POP, f: () => {
        const p = this.cloudHeart.anchor.clone().add(new THREE.Vector3(0, 0.2, 0));
        sp.burst(p, 90, 1.8, 0.4, 1.6, -0.2);
        hearts.burst(p, 10);
        this.haptic('heavy');
      } },
      { t: POP + 1.0, f: () => sp.burst(this.v.set(this.her.pose.x, 0.8, this.her.pose.z), 70, 1.0, 0.8, 1.4, -0.3) },
      { t: C.bind, f: () => {
        sp.burst(this.ropeEnd, 50, 0.6, 0.3, 1.4, -0.1);
        hearts.burst(this.ropeEnd, 7);
        this.haptic('heavy');
      } },
      { t: C.veil, f: () => sp.burst(new THREE.Vector3(this.her.pose.x, 1.2, this.her.pose.z), 110, 1.2, 0.5, 1.8, -0.25) },
      { t: C.veil + 0.6, f: () => sp.burst(new THREE.Vector3(this.her.pose.x, 0.5, this.her.pose.z), 60, 1.0, 0.9, 1.6, -0.3) },
      { t: C.girl, f: () => {
        const g = girlPath(C.girl);
        sp.burst(new THREE.Vector3(g[0], 0.35, g[1]), 60, 0.9, 0.6, 1.4, -0.3);
        this.haptic('light');
      } },
      { t: C.close + 2.4, f: () => this.haptic('soft') },
    ];
    for (const t of onsetsIn(100.0, 106.8, 0.25)) {
      this.events.push({ t, f: () => {
        const a = Math.random() * PI - PI / 2;
        sp.burst(new THREE.Vector3(Math.sin(a) * 2.4, 2.6 + Math.random() * 1.4, Math.cos(a) * 1.5 - 0.5), 14, 0.6, -0.2, 1.4, -0.9);
      } });
    }
    for (const t of onsetsIn(88.0, 99.8, 0.45)) {
      this.events.push({ t, f: () => {
        const c = pairC(t);
        sp.burst(new THREE.Vector3(c[0] + (Math.random() - 0.5) * 1.6, 0.7 + Math.random() * 1.2, c[1] + (Math.random() - 0.5) * 1.2), 10, 0.5, 0.3, 1.0, -0.2);
      } });
    }
    this.events.sort((a, b) => a.t - b.t);
  }

  reset() {
    this.lastT = -10;
    this.onsetIdx = 0;
  }

  musicPulse(T, dt) {
    // decaying energy that kicks on every note; each note also plucks a tooth of the comb
    this.pulse *= Math.exp(-dt * 7);
    while (this.onsetIdx < ONSETS.length && ONSETS[this.onsetIdx][0] <= T) {
      const [t, s, pc] = ONSETS[this.onsetIdx];
      if (T - t < 0.3) {
        this.pulse = Math.min(1.4, this.pulse + s);
        this.box.pluck(pc, s);
      }
      this.onsetIdx++;
    }
    if (this.onsetIdx > 0 && ONSETS[this.onsetIdx - 1][0] > T + 0.5) this.onsetIdx = 0;
    return this.pulse;
  }

  discWalk(T) {
    const D = discTrack(T);
    const sp = Math.abs(discTrack(T + 0.05) - discTrack(T - 0.05)) / 0.1 * 1.55;
    return { D, dist: 1.55 * (0.55 - D), speed: sp };
  }

  update(T, dt, time) {
    const { her, him, girl } = this;
    const H = her.pose, G = him.pose;
    const pulse = this.musicPulse(T, dt);
    const ctx = { time, pulse, rain: 0 };

    if (T > this.lastT) {
      for (const e of this.events) if (e.t > this.lastT && e.t <= T && T - e.t < 0.5) e.f();
    }
    this.lastT = T;

    // -------------------------------------------------- the turning stage
    const { D, dist, speed } = this.discWalk(T);
    this.box.disc.rotation.y = D;
    const walkAmp = clamp(speed / 0.22);
    const walkPh = dist * 16;

    // -------------------------------------------------- light, room and the sky painted in the lid
    const sky = this.box.skyMat.uniforms;
    sky.top.value.copy(skyTop(T));
    sky.bottom.value.copy(skyBot(T));
    sky.glow.value.copy(skyGlow(T));
    const su = sunUV(T);
    sky.sun.value.set(su[0], su[1]);
    sky.sunOn.value = T > 54 && T < 80 ? 1 : 0;
    const mu = moonUV(T);
    sky.moon.value.set(mu[0], mu[1]);
    sky.moonOn.value = T > 83 ? 1 : 0;
    const starsShown = this.starTimes.filter((t) => t <= T).length / Math.max(1, this.starTimes.length);
    sky.stars.value = (T < 19.5 ? 0.35 * (1 - smooth(17.5, 19.5, T)) : T < 77 ? 0 : starsShown) * (1 - smooth(130, 132, T));
    sky.overcast.value = overcast(T);
    sky.clouds.value = cloudAmt(T);
    sky.cloudCol.value.copy(cloudCol(T));
    sky.time.value = time;
    sky.pulse.value = pulse;
    this.scene3.background.copy(ROOM).lerp(skyBot(T), 0.1);
    this.scene3.fog.color.copy(this.scene3.background);

    this.box.stageMat.color.copy(stageCol(T));
    this.box.pathMat.color.copy(pathCol(T));
    this.keyLight.color.copy(keyCol(T));
    this.keyLight.intensity = keyInt(T);
    const kp = keyPos(T);
    this.keyLight.position.set(kp[0], kp[1], kp[2]);
    this.hemi.color.copy(hemiSky(T));
    this.hemi.groundColor.copy(stageCol(T)).multiplyScalar(0.6);
    // a warm burst of light when the lid opens, the cloud pops and the string is tied
    const fl = T < 0 ? 0 : flashTrack(T);
    this.hemi.intensity = hemiInt(T) + fl * 0.12;
    this.scene3.environmentIntensity = envInt(T);

    ctx.rain = rainInt(T);
    this.rain.intensity = ctx.rain;
    this.petals.intensity = petalInt(T);
    const pc = pairC(T);
    this.fireflies.update(time, fireOp(T), pulse, fireSwirl(T), this.v2.set(pc[0], 0, pc[1]));

    for (const s of Object.values(this.scenes)) s.update(T, dt, ctx);

    // -------------------------------------------------- HER
    const sink = 1 - easeInOut(seg(T, 130.5, 131.2));
    const herShow = backOut(seg(T, C.appear, C.appear + 0.7)) * sink;
    Object.assign(H, { scale: herShow, lean: 0, headTilt: 0, headTurn: 0, headRoll: 0, walk: 0, sit: 0, kneel: 0, y: FLOOR_Y, flare: 1 });
    H.aL = [0, 0.1];
    H.aR = [0, 0.1];
    H.outfit = smooth(POP + 0.9, POP + 2.0, T) + smooth(C.veil, C.veil + 1.4, T);
    H.cap = 1 - backOut(seg(T, POP + 0.9, POP + 1.3));
    H.veil = easeInOut(seg(T, C.veil, C.veil + 1.4));
    H.crown = backOut(seg(T, C.veil + 0.3, C.veil + 1.0));
    let herExpr = 'sad';

    const himShow = backOut(seg(T, C.himIn - 0.1, C.himIn + 0.6)) * sink;
    Object.assign(G, { scale: himShow, lean: 0, headTilt: 0, headTurn: 0, headRoll: 0, walk: 0, sit: 0, kneel: 0, y: FLOOR_Y, x: 2.4, z: 1.85, rotY: -1.1 });
    G.aL = [0, 0.1];
    G.aR = [0, 0.1];
    G.crown = backOut(seg(T, C.veil + 0.5, C.veil + 1.1));
    let himExpr = 'soft';

    if (T < 18.2) {
      // ============ the ward: she cares for the children, under her own little cloud
      H.x = -0.06; H.z = 1.5;
      let atBed = -1, k = 0;
      C.stops.forEach(([a, b], i) => {
        const w = win(T, a, b, 0.6, 0.7);
        if (w > k) { k = w; atBed = i; }
      });
      H.rotY = lerp(0.95, 1.28, k);
      H.walk = walkAmp;
      H.phase = walkPh;
      H.headTilt = lerp(0.28, 0.12, k);
      if (atBed >= 0) {
        const g = BED[atBed];
        const reach = win(T, g - 1.4, g + 0.5, 0.5, 0.6);
        H.lean = 0.28 * reach;
        H.aR = [lerp(0, -1.15, reach) + Math.sin(T * 9) * 0.12 * win(T, g - 1.2, g - 0.2, 0.2, 0.2), 0.08];
        H.aL = [-0.25 * reach, 0.1];
        if (T > C.stops[atBed][0] + 0.4 && T < C.stops[atBed][1]) herExpr = 'soft';
      }
      const tf = smooth(16.3, 17.4, T);
      H.rotY = lerp(H.rotY, 0.15, tf);
      H.headTilt = lerp(H.headTilt, 0.4, tf);
      if (tf > 0.5) herExpr = 'sad';
      this.scenes.ward.beds.forEach((b, i) => {
        const up = win(T, C.stops[i][0] + 0.2, 17.6, 0.8, 1.0);
        b.kid.pivot.rotation.x = lerp(-PI / 2, -0.15, easeInOut(up));
        b.kid.setExpr(T > BED[i] && T < 17.6 ? 'joy' : T > C.stops[i][0] + 0.4 && T < 17.6 ? 'soft' : 'sleep');
      });
    } else if (T < C.tie) {
      // ============ alone in the rain
      const toWalk = smooth(18.2, 19.6, T);
      H.x = lerp(-0.06, -0.27, toWalk);
      H.z = lerp(1.5, 1.86, toWalk);
      H.rotY = lerp(0.15, 0.95, smooth(19.2, 20.0, T));
      H.walk = Math.max(walkAmp * 0.85, win(T, 18.4, 19.6, 0.3, 0.3) * 0.6);
      H.phase = walkPh + (T < 19.6 ? T * 6 : 0);
      H.headTilt = 0.38;
      const hug = smooth(19.8, 21.0, T) * (1 - smooth(34.6, 35.2, T));
      H.aL = [-0.95 * hug, lerp(0.1, -0.5, hug)];
      H.aR = [-0.95 * hug, lerp(0.1, -0.5, hug)];
      const turn = smooth(34.6, 35.3, T);
      H.rotY = lerp(H.rotY, 0, turn);
      H.z = lerp(H.z, 1.47, smooth(34.9, 35.9, T));
      H.sit = easeInOut(seg(T, 35.3, 36.1));
      if (T > 35.5) {
        H.aL = [-0.55, -0.1];
        H.aR = [-0.55, -0.1];
        H.headTilt = 0.45;
      }
      const wipe = win(T, C.wipe, C.wipe + 2.2, 0.5, 0.6);
      H.aR = [lerp(H.aR[0], -2.45, wipe) + Math.sin(T * 7) * 0.06 * wipe, lerp(H.aR[1], -0.35, wipe)];
      H.headTilt += 0.1 * wipe;
      herExpr = T > 37.5 && T < 44 ? 'cry' : 'sad';
      const notice = smooth(48.0, 49.0, T);
      H.headTurn = 0.45 * notice;
      H.headTilt = lerp(H.headTilt, 0.15, notice);
    } else {
      H.x = -0.27; H.z = 1.47; H.rotY = 0;
    }

    // ============ he arrives
    if (T >= C.himIn - 0.2 && T < POP + 2.6) {
      const inK = easeInOut(seg(T, C.himIn, C.himAt));
      G.x = lerp(2.4, 0.8, inK);
      G.z = 1.86;
      G.rotY = -1.15;
      G.walk = win(T, C.himIn, C.himAt, 0.3, 0.5);
      G.phase = (2.4 - G.x) * 16;
      const look = smooth(C.himAt - 0.3, C.himAt + 0.4, T);
      G.headTilt = lerp(0, -0.35, smooth(C.himAt + 0.3, C.himAt + 0.8, T));
      G.rotY = lerp(G.rotY, -0.7, look);
      const step = easeInOut(seg(T, C.himSit, C.himSit + 0.8));
      G.x = lerp(G.x, 0.27, step);
      G.z = lerp(G.z, 1.47, step);
      G.rotY = lerp(G.rotY, 0, step);
      G.sit = easeInOut(seg(T, C.himSit + 0.6, C.himSit + 1.3));
      if (step > 0) G.headTilt = lerp(G.headTilt, 0.05, step);
      G.headTurn = -0.5 * smooth(C.himSit + 1.2, C.himSit + 2.0, T);
      // stands, ties a string to her cloud, pulls it down
      const stand = easeInOut(seg(T, C.tie, C.tie + 0.6));
      G.sit = lerp(G.sit, 0, stand);
      G.rotY = lerp(G.rotY, -0.35, stand);
      const up = win(T, C.tie + 0.5, C.pass, 0.6, 1.0);
      G.aR = [lerp(0, -2.75, up), lerp(0.1, 0.25, up)];
      G.headTilt = lerp(G.headTilt, -0.55, win(T, C.tie + 0.3, C.pass + 0.4, 0.5, 0.5));
      // hands the string to her
      const give = win(T, C.pass - 0.3, POP + 0.2, 0.6, 0.6);
      G.aR = [lerp(G.aR[0], -1.25, give), lerp(G.aR[1], 0.35, give)];
      G.headTurn = lerp(G.headTurn, -0.4, give);
      G.headTilt = lerp(G.headTilt, 0.1, give);
      G.headTilt = lerp(G.headTilt, -0.3, smooth(POP, POP + 0.6, T));
      himExpr = T > POP ? 'joy' : 'soft';
      G.z = lerp(G.z, 1.66, smooth(POP + 0.5, POP + 1.3, T));
    }

    if (T >= C.tie && T < POP + 2.6) {
      H.sit = 1 - easeInOut(seg(T, POP + 0.8, POP + 1.6));
      H.headTurn = lerp(0.45, 0.15, smooth(C.tie + 0.5, C.tie + 1.5, T));
      H.headTilt = lerp(0.15, -0.5, smooth(C.tie + 1.2, C.tie + 2.2, T));
      const take = smooth(C.pass, C.pass + 0.8, T);
      H.aL = [lerp(-0.55, -2.0, take), lerp(-0.1, 0.05, take)];
      H.aR = [-0.55, -0.1];
      herExpr = T < POP ? 'sad' : T < POP + 0.9 ? 'surprise' : 'joy';
      if (T > POP) H.headTilt = lerp(-0.5, -0.3, smooth(POP, POP + 1, T));
      H.z = lerp(1.47, 1.72, smooth(POP + 0.8, POP + 1.6, T));
      const sw = smooth(POP + 1.4, POP + 2.2, T);
      H.aL = [lerp(H.aL[0], -0.3, sw), lerp(H.aL[1], 0.5, sw)];
      H.aR = [lerp(H.aR[0], -1.1, sw), lerp(H.aR[1], 0.15, sw)];
      H.rotY = lerp(0, 0.5, smooth(POP + 1.6, POP + 2.6, T));
      H.headTurn = lerp(H.headTurn, 0.25, sw);
    }

    // ============ walking together into the sun, then to his hills
    if (T >= POP + 2.6 && T < C.dance) {
      const enter = smooth(POP + 2.6, C.walk2, T);
      H.rotY = lerp(0.5, 0.6, enter);
      H.x = lerp(-0.27, -0.32, enter);
      H.z = lerp(1.72, 1.82, enter);
      G.rotY = lerp(-0.3, 0.6, enter);
      H.walk = walkAmp;
      H.phase = walkPh;
      H.aL = [-0.25, 0.55];
      H.aR = [-1.1, 0.15];
      H.headTilt = -0.12;
      H.headTurn = 0.35 * win(T, 61, 64.5, 0.6, 0.6);
      herExpr = win(T, 61, 64.5, 0.1, 0.1) > 0.5 ? 'happy' : 'joy';
      const look = easeInOut(seg(T, C.fence, C.fence + 1.2)) * (1 - easeInOut(seg(T, C.turnBack, C.turnBack + 1.2)));
      const toFence = smooth(C.fence, C.fence + 1.2, T) * (1 - smooth(C.turnBack, C.turnBack + 1.2, T));
      H.rotY = lerp(H.rotY, PI, look);
      H.x = lerp(H.x, -0.25, toFence);
      H.z = lerp(H.z, 1.45, toFence);
      H.headRoll = 0.28 * smooth(C.fence + 1.6, C.fence + 2.4, T) * (1 - smooth(C.turnBack - 0.4, C.turnBack, T));
      H.headTilt = lerp(H.headTilt, -0.1, look);
      H.aL = [lerp(H.aL[0], 0, look), lerp(H.aL[1], 0.1, look)];
      if (look > 0.5) herExpr = 'love';
      const face = smooth(C.turnBack + 0.8, C.dance, T);
      H.rotY = lerp(H.rotY, PI / 2, face);
      H.aL = [lerp(H.aL[0], -0.6, face), lerp(H.aL[1], 0.05, face)];
      H.aR = [lerp(H.aR[0], -0.6, face), lerp(H.aR[1], 0.05, face)];
      H.headTilt = lerp(H.headTilt, -0.15, face);
      if (T > C.turnBack + 0.4) herExpr = 'joy';
      this.partner(H, G, 0.52);
      G.x = lerp(G.x, H.x + 0.5, toFence);
      G.z = lerp(G.z, H.z, toFence);
      G.walk = H.walk;
      G.phase = H.phase + PI;
      G.rotY = lerp(G.rotY, H.rotY, enter);
      G.aR = [-0.25, 0.55];
      G.aL = [0, 0.1];
      G.headTilt = -0.05;
      G.headTurn = -0.35 * win(T, 61.4, 65, 0.6, 0.6);
      himExpr = win(T, 61.4, 65, 0.1, 0.1) > 0.5 ? 'happy' : 'joy';
      G.aR = [lerp(G.aR[0], 0, look), lerp(G.aR[1], 0.1, look)];
      G.aL = [lerp(G.aL[0], 0.05, toFence), lerp(G.aL[1], 1.45, smooth(C.fence + 1.2, C.fence + 2.0, T) * (1 - smooth(C.turnBack - 0.6, C.turnBack, T)))];
      if (look > 0.5) himExpr = 'love';
      if (face > 0) {
        G.rotY = lerp(G.rotY, -PI / 2, face);
        G.aL = [lerp(G.aL[0], -0.6, face), lerp(G.aL[1], 0.05, face)];
        G.aR = [lerp(G.aR[0], -0.6, face), lerp(G.aR[1], 0.05, face)];
        G.headTilt = lerp(G.headTilt, 0.1, face);
        H.x = lerp(H.x, -0.25, face);
        H.z = lerp(H.z, 1.62, face);
        G.x = lerp(G.x, 0.25, face);
        G.z = lerp(G.z, 1.62, face);
      }
      if (T > C.turnBack + 0.4) himExpr = 'joy';
    }

    // ============ the dance (the music box couple)
    if (T >= C.dance && T < C.still) {
      const phi = pairSpin(T);
      const c = pairC(T);
      const r = 0.25;
      H.x = c[0] - Math.cos(phi) * r;
      H.z = c[1] + Math.sin(phi) * r;
      G.x = c[0] + Math.cos(phi) * r;
      G.z = c[1] - Math.sin(phi) * r;
      H.rotY = Math.atan2(G.x - H.x, G.z - H.z);
      G.rotY = Math.atan2(H.x - G.x, H.z - G.z);
      const lift = pairLift(T);
      const bobble = Math.sin(T * PI * 1.1) * 0.02;
      H.y = G.y = FLOOR_Y + lift + bobble * smooth(78, 80, T);
      const spd = Math.abs(pairSpin(T + 0.05) - pairSpin(T - 0.05)) / 0.1;
      H.flare = 1 + clamp(spd / 1.5) * 0.45;
      const sway = Math.sin(T * 2.3) * 0.12;
      H.aL = [-0.6, 0.05 + sway * 0.3];
      H.aR = [-0.6, 0.05 - sway * 0.3];
      G.aL = [-0.6, 0.05 - sway * 0.3];
      G.aR = [-0.6, 0.05 + sway * 0.3];
      H.lean = -0.08 * clamp(spd);
      H.headTilt = -0.18;
      G.headTilt = 0.08;
      H.headRoll = sway * 0.6;
      const step = (1 - clamp(spd)) * win(T, 78, 88.5, 0.5, 1);
      H.walk = G.walk = step * 0.35;
      H.phase = G.phase = T * 4;
      herExpr = T > 84 && T < 101 ? 'happy' : 'joy';
      himExpr = T > 84.5 && T < 101 ? 'happy' : 'joy';
      if (lift > 0.05) {
        H.walk = G.walk = 0.25;
        H.phase = G.phase = 0.8;
      }
    }

    // ============ the silence: he ties the string around both their hands
    let ropeTarget = null;
    if (T >= C.still) {
      const c = [0, 1.5];
      H.x = c[0] - 0.25; H.z = c[1];
      G.x = c[0] + 0.25; G.z = c[1];
      H.rotY = PI / 2; G.rotY = -PI / 2;
      H.aL = [-0.6, 0.05]; H.aR = [-0.6, 0.05];
      G.aL = [-0.6, 0.05]; G.aR = [-0.6, 0.05];
      herExpr = 'joy'; himExpr = 'joy';
      // he lifts their joined hands, loops the string around them
      const lift = win(T, C.still + 0.4, C.front, 0.6, 0.6);
      H.aR = [lerp(-0.6, -1.15, lift), 0.0];
      G.aL = [lerp(-0.6, -1.15, lift), 0.0];
      H.aL = [lerp(-0.6, 0, lift), 0.1];
      G.headTilt = 0.22 * win(T, C.still + 0.6, C.bind + 0.2, 0.4, 0.4);
      H.headTilt = 0.18 * win(T, C.still + 0.8, C.bind + 0.2, 0.4, 0.4);
      // foreheads together
      const fh = win(T, C.forehead, C.veil - 0.2, 0.9, 0.7);
      H.lean = G.lean = 0.16 * fh;
      H.headTilt += 0.2 * fh;
      G.headTilt += 0.2 * fh;
      if (fh > 0.3) { herExpr = 'love'; himExpr = 'love'; }
      // face the front together (now holding inner hands)
      const front = easeInOut(seg(T, C.front, C.front + 1.0));
      H.rotY = lerp(H.rotY, 0, front);
      G.rotY = lerp(G.rotY, 0, front);
      H.aR = [lerp(H.aR[0], 0, front), lerp(H.aR[1], 0.1, front)];
      G.aL = [lerp(G.aL[0], 0, front), lerp(G.aL[1], 0.1, front)];
      H.aL = [lerp(H.aL[0], -0.2, front), lerp(H.aL[1], 0.55, front)];
      G.aR = [lerp(G.aR[0], -0.2, front), lerp(G.aR[1], 0.55, front)];
      if (T > C.front + 0.5) { herExpr = 'joy'; himExpr = 'joy'; }
      // a little girl runs to them; they make room for her
      const room = easeInOut(seg(T, C.girl + 0.6, C.girlAt));
      H.x = lerp(H.x, -0.38, room);
      G.x = lerp(G.x, 0.38, room);
      const gp = girlPath(T);
      const watch = smooth(C.girl + 0.2, C.girl + 0.8, T);
      H.headTurn = lerp(0, Math.atan2(gp[0] - H.x, gp[1] - H.z) * 0.6, watch);
      G.headTurn = lerp(0, Math.atan2(gp[0] - G.x, gp[1] - G.z) * 0.6, watch);
      H.headTilt = lerp(H.headTilt, 0.25, watch * room);
      G.headTilt = lerp(G.headTilt, 0.25, watch * room);
      // their inner hands reach down to hers
      const hold = smooth(C.girlAt - 0.4, C.girlAt + 0.3, T);
      H.aL = [lerp(H.aL[0], -0.15, hold), lerp(H.aL[1], 0.42, hold)];
      G.aR = [lerp(G.aR[0], -0.15, hold), lerp(G.aR[1], 0.42, hold)];
      if (T > C.girlAt) { herExpr = 'happy'; himExpr = 'happy'; }
      // they look at each other over her head
      const over = win(T, 119.0, 122.4, 0.6, 0.6);
      H.headTurn = lerp(H.headTurn, 0.55, over);
      G.headTurn = lerp(G.headTurn, -0.55, over);
      H.headTilt = lerp(H.headTilt, 0, over);
      G.headTilt = lerp(G.headTilt, 0, over);
      if (over > 0.5) { herExpr = 'love'; himExpr = 'love'; }
      // walk home together, through the arch
      const home = easeInOut(seg(T, C.walkHome, C.door));
      const turnIn = easeInOut(seg(T, C.walkHome - 0.5, C.walkHome + 0.5));
      if (turnIn > 0) {
        H.rotY = lerp(H.rotY, PI, turnIn);
        G.rotY = lerp(G.rotY, -PI, turnIn);
        H.headTurn = lerp(H.headTurn, 0, turnIn);
        G.headTurn = lerp(G.headTurn, 0, turnIn);
        H.aL = [lerp(H.aL[0], 0, turnIn), lerp(H.aL[1], 0.1, turnIn)];
        H.aR = [lerp(H.aR[0], -0.15, turnIn), lerp(H.aR[1], 0.42, turnIn)];
        G.aR = [lerp(G.aR[0], 0, turnIn), lerp(G.aR[1], 0.1, turnIn)];
        G.aL = [lerp(G.aL[0], -0.15, turnIn), lerp(G.aL[1], 0.42, turnIn)];
        H.z = G.z = lerp(c[1], 0.66, home);
        H.walk = G.walk = win(T, C.walkHome + 0.2, C.door, 0.4, 0.6) * 0.6;
        H.phase = (c[1] - H.z) * 16;
        G.phase = H.phase + PI;
      }
      // and look back at us
      const look = easeInOut(seg(T, C.look, C.look + 1.3));
      H.rotY = lerp(H.rotY, PI - 1.2, look);
      G.rotY = lerp(G.rotY, -PI + 1.2, look);
      H.headTurn = lerp(H.headTurn, -0.85, look);
      G.headTurn = lerp(G.headTurn, 0.85, look);
      if (look > 0.3) { herExpr = 'love'; himExpr = 'happy'; }
    }

    if (her.hop > 0.3) herExpr = 'happy';
    if (him.hop > 0.3) himExpr = 'happy';
    her.setExpr(herExpr);
    him.setExpr(himExpr);
    her.update(dt, time);
    him.update(dt, time);

    // -------------------------------------------------- the little girl
    const gk = backOut(seg(T, C.girl, C.girl + 0.6)) * sink;
    girl.root.visible = gk > 0.01;
    if (girl.root.visible) {
      const gp = girlPath(T);
      const nx = girlPath(T + 0.1);
      const moving = Math.hypot(nx[0] - gp[0], nx[1] - gp[1]) > 0.004;
      girl.root.position.set(gp[0], FLOOR_Y, gp[1]);
      girl.root.scale.setScalar(Math.max(0.0001, gk * 2.0));
      let gr = moving ? Math.atan2(nx[0] - gp[0], nx[1] - gp[1]) : 0;
      if (T > C.walkHome - 0.5) gr = PI;
      // she turns round and waves at the very end
      const turnBack = easeInOut(seg(T, C.look + 0.3, C.look + 1.0));
      gr = lerp(gr, 0.15, turnBack);
      girl.root.rotation.y = lerp(girl.root.rotation.y, gr, 1 - Math.exp(-dt * 10));
      girl.pivot.position.y = moving ? Math.abs(Math.sin(time * 13)) * 0.025 : Math.max(0, Math.sin(time * 4)) * 0.008;
      const held = smooth(C.girlAt - 0.4, C.girlAt + 0.2, T);
      girl.arms[0].rotation.z = lerp(-0.3, -1.25, held);
      girl.arms[1].rotation.z = lerp(0.3, 1.25, held);
      const wave = smooth(C.look + 0.6, C.look + 1.0, T);
      if (wave > 0) girl.arms[1].rotation.z = lerp(girl.arms[1].rotation.z, 2.5 + Math.sin(time * 12) * 0.4, wave);
      girl.head.rotation.x = held > 0.5 && T < C.walkHome ? -0.3 : 0;
      girl.head.rotation.y = held > 0.5 && T < C.walkHome ? Math.sin(time * 1.3) * 0.5 : 0;
      girl.setExpr(wave > 0.5 ? 'happy' : 'joy');
    }

    // -------------------------------------------------- the cloud / heart balloon
    const ch = this.cloudHeart;
    const morph = clamp((T - POP) / 0.7);
    ch.group.visible = herShow > 0.01;
    ch.group.scale.setScalar(Math.max(0.0001, herShow * 1.2));
    const target = this.v;
    if (morph <= 0) {
      const headTop = FLOOR_Y + (1.15 - H.sit * 0.14) * 1.25;
      const pull = smooth(C.tie + 1.0, C.pass, T) * 0.3;
      target.set(H.x, headTop + 0.55 - pull, H.z);
      ch.cloudMat.color.set(T > C.tie + 1 ? '#b8c2d2' : '#a7b1c2');
    } else {
      target.copy(this.ropeEnd).add(this.v2.set(0.08 + Math.sin(time * 0.9) * 0.05, lerp(0.8, 1.8, smooth(C.girlAt, C.girlAt + 1.0, T)), -0.05));
    }
    const lag = 1 - Math.exp(-dt * (morph > 0 ? 3.0 : 5.0));
    if (this.cloudPos.distanceTo(target) > 2.5) this.cloudPos.copy(target);
    this.cloudPos.lerp(target, lag);
    ch.group.position.copy(this.cloudPos);
    ch.group.position.y += Math.sin(time * 1.4) * 0.025;
    ch.update(morph, time);
    ch.rain.intensity = cloudRain(T) * (herShow > 0.5 ? 1 : 0);

    // the string, and whoever holds it
    const ropeVis = T > C.tie + 1.2 && sink > 0.05;
    this.heartRope.mesh.visible = ropeVis;
    if (ropeVis) {
      const end = this.ropeEnd;
      end.copy(him.handWorld('R', this.v2));
      end.lerp(her.handWorld('L', this.v2), smooth(C.pass + 0.3, C.pass + 1.0, T));
      end.lerp(her.handWorld('R', this.v2), smooth(POP + 1.4, POP + 2.2, T));
      if (T > C.still) {
        // bound around both their joined hands
        const mid = her.handWorld('R', new THREE.Vector3()).add(him.handWorld('L', this.v2)).multiplyScalar(0.5);
        end.lerp(mid, smooth(C.still + 0.6, C.bind, T));
        end.lerp(her.handWorld('L', this.v2), smooth(C.front, C.front + 0.8, T));
        if (girl.root.visible) {
          const ga = girl.arms[0].localToWorld(this.v2.set(0, -0.06, 0));
          end.lerp(ga, smooth(C.girlAt, C.girlAt + 0.8, T));
        }
      }
      const grow = smooth(C.tie + 1.2, C.tie + 1.7, T);
      const top = ch.anchor;
      const from = top.clone().lerp(end, grow);
      this.heartRope.set(top, from, 0.04, 0.02, time);
      this.heartRope.mesh.material.color.copy(this.ropeWhite).lerp(this.ropeRed, smooth(C.bind - 0.6, C.bind + 0.4, T));
    }
    const kn = backOut(seg(T, C.bind - 0.2, C.bind + 0.4)) * sink;
    this.knot.visible = kn > 0.01;
    if (this.knot.visible) {
      this.knot.position.copy(this.ropeEnd);
      this.knot.rotation.set(time * 0.5, time * 0.8, 0.4);
      this.knot.scale.setScalar(kn);
    }

    // children's balloons in the ward
    this.wardBalloons.forEach((wb, i) => {
      const k = backOut(seg(T, BED[i] - 0.15, BED[i] + 0.55));
      const vis = k > 0.01 && this.scenes.ward.group.visible && wb.b.bed.scale.y > 0.05;
      wb.m.visible = vis;
      wb.rope.mesh.visible = vis;
      if (!vis) return;
      wb.m.scale.setScalar(Math.max(0.0001, k));
      wb.m.position.set(0.12 + Math.sin(time * 1.2 + i) * 0.03, 0.42 + k * 0.42 + Math.sin(time * 1.5 + i) * 0.02, -0.28);
      const a = wb.b.bed.localToWorld(this.v.set(0.12, 0.34, -0.3));
      const b = wb.m.getWorldPosition(this.v2);
      b.y -= 0.1 * k * wb.b.bed.scale.y;
      wb.rope.set(a, b, 0.02, 0.01, time + i);
    });

    // -------------------------------------------------- the box itself
    const lidOpen = backOut(seg(T, 0, 1.5), 1.1) * (1 - easeInOut(seg(T, C.close, C.close + 2.6)));
    this.box.setLid(T < 0 ? 0 : lidOpen, this.windProgress, T < 0.2 ? 1 : 0);
    const hb = smooth(C.close + 2.2, C.close + 2.6, T);
    const beat = Math.max(0, Math.sin((T - C.close - 2.6) * PI * 2.4)) * (1 - smooth(C.close + 2.6, C.close + 4.0, T));
    this.box.heartGlow.material.opacity = hb * beat * 0.9;
    const kt = keyTurn(Math.max(0, T));
    this.box.keySpin.rotation.z = this.keyBase - kt * 0.35;
    this.box.updateMechanism(dt, T > 0 ? kt * 0.5 : 0);

    return { cam: camTrack(T), pulse };
  }

  // place G next to H along a fixed walking direction
  partner(H, G, d, rot = 0.6) {
    G.x = H.x + Math.cos(rot) * d;
    G.z = H.z - Math.sin(rot) * d;
  }

  hit(obj) {
    let o = obj;
    while (o) {
      if (o === this.her.root) return 'her';
      if (o === this.him.root) return 'him';
      if (o === this.girl.root) return 'girl';
      o = o.parent;
    }
    return null;
  }
}
