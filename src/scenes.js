import * as THREE from 'three';
import { mat, rng, backOut, easeIn, clamp, glowSprite, shadowAll } from './util.js';
import { FLOOR_Y } from './box.js';
import { Kid, KID_COLS } from './doll.js';


// A set of props on the turning stage that pop up like a pop-up book and fold away again.
export class Scene {
  constructor(on, off) {
    this.group = new THREE.Group();
    this.items = [];
    this.on = on;
    this.off = off;
    this.updaters = [];
  }
  add(obj, delay = 0, grow = false) {
    obj.userData.base = obj.scale.clone();
    obj.userData.rx = obj.rotation.x;
    obj.rotation.order = 'YXZ';
    this.items.push({ obj, delay, grow });
    this.group.add(obj);
    return obj;
  }
  update(T, dt, ctx) {
    const vis = T >= this.on && T <= this.off + 1.2;
    this.group.visible = vis;
    if (!vis) return;
    for (const it of this.items) {
      // pop-up book: each piece hinges up from the stage floor with a little spring, and folds back down
      const kIn = backOut((T - this.on - it.delay) / 0.75, 1.7);
      const kOut = 1 - easeIn((T - this.off - it.delay * 0.3) / 0.5);
      const k = Math.max(0, Math.min(kIn, kOut));
      const b = it.obj.userData.base;
      const s = Math.max(0.0001, Math.min(1, k * 2.2) * (T > this.off ? kOut : 1));
      if (it.grow) it.obj.scale.set(b.x * s, b.y * Math.max(0.0001, Math.min(k, 1.15)), b.z * s);
      else it.obj.scale.copy(b).multiplyScalar(s);
      it.obj.rotation.x = it.obj.userData.rx - (1 - k) * 1.45;
      it.obj.visible = k > 0.001;
    }
    for (const f of this.updaters) f(T, dt, ctx);
  }
}

// place on the disc by polar coords; local +z faces outward
export function place(obj, a, r, y = FLOOR_Y, turn = 0) {
  obj.position.set(Math.sin(a) * r, y, Math.cos(a) * r);
  obj.rotation.y = a + turn;
  return obj;
}

const box = (w, h, d, m, x = 0, y = 0, z = 0) => {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z);
  return o;
};
const cyl = (rt, rb, h, m, x = 0, y = 0, z = 0, seg = 14) => {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  o.position.set(x, y, z);
  return o;
};
const sph = (r, m, x = 0, y = 0, z = 0, seg = 16) => {
  const o = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.7)), m);
  o.position.set(x, y, z);
  return o;
};
function roof(w, h, d, m) {
  const g = new THREE.CylinderGeometry(0.5, 0.5, 1, 3, 1);
  g.rotateZ(Math.PI / 2);
  g.rotateX(-Math.PI / 2);
  const o = new THREE.Mesh(g, m);
  o.scale.set(w, h * 1.33, d);
  return o;
}
function house(w, h, d, wall, roofM, winM, litWins = []) {
  const g = new THREE.Group();
  g.add(box(w, h, d, wall, 0, h / 2, 0));
  const r = roof(w * 1.12, h * 0.55, d * 1.15, roofM);
  r.position.y = h + h * 0.2;
  g.add(r);
  const wins = [];
  const cols = Math.max(1, Math.round(w / 0.28));
  for (let i = 0; i < cols; i++) {
    const x = (i - (cols - 1) / 2) * (w / cols);
    const lit = litWins.includes(i);
    const wm = lit ? winM.lit : winM.dark;
    const wn = box(w / cols * 0.42, h * 0.22, 0.01, wm, x, h * 0.6, d / 2 + 0.005);
    g.add(wn);
    wins.push(wn);
  }
  shadowAll(g, true, true);
  g.userData.wins = wins;
  return g;
}

// ============================================================ WARD (her work: the children's ward)
export function buildWard(on, off, bedAngles) {
  const s = new Scene(on, off);
  const white = mat('#fbfaf7', { roughness: 0.6 });
  const frame = mat('#cfe1ea');
  const blankets = ['#f6c9c4', '#bfe0d6', '#f7e2a6'].map((c) => mat(c));
  s.beds = [];
  bedAngles.forEach((a, i) => {
    const bed = new THREE.Group();
    bed.add(box(0.34, 0.07, 0.6, white, 0, 0.17, 0));
    for (const [x, z] of [[-0.15, -0.27], [0.15, -0.27], [-0.15, 0.27], [0.15, 0.27]]) bed.add(cyl(0.013, 0.013, 0.14, frame, x, 0.07, z, 6));
    bed.add(box(0.36, 0.26, 0.03, frame, 0, 0.22, -0.3));
    bed.add(box(0.36, 0.12, 0.03, frame, 0, 0.15, 0.3));
    const pillow = box(0.22, 0.05, 0.11, white, 0, 0.23, -0.21);
    bed.add(pillow);
    const blanket = sph(0.17, blankets[i % 3], 0, 0.2, 0.08, 20);
    blanket.scale.set(1.0, 0.34, 1.25);
    bed.add(blanket);
    const kid = new Kid(i);
    kid.root.position.set(0, 0.2, 0.0);
    kid.pivot.rotation.x = -Math.PI / 2;
    bed.add(kid.root);
    shadowAll(bed, true, true);
    place(bed, a, 1.55);
    s.add(bed, 0.15 * i);
    s.beds.push({ bed, kid, angle: a, color: KID_COLS[i].balloon });
  });
  // teddy at the foot of the middle bed
  const bear = new THREE.Group();
  const fur = mat('#c8946c');
  bear.add(sph(0.05, fur, 0, 0.05, 0), sph(0.038, fur, 0, 0.12, 0.005));
  for (const sx of [-1, 1]) bear.add(sph(0.016, fur, sx * 0.03, 0.155, 0));
  bear.add(sph(0.012, mat('#3a2a22'), 0, 0.118, 0.04, 8));
  bear.position.set(0.1, 0.205, 0.24);
  s.beds[1].bed.add(bear);

  // tall arched window with the moon
  const win = new THREE.Group();
  const sh = new THREE.Shape();
  sh.moveTo(-0.38, 0);
  sh.lineTo(0.38, 0);
  sh.lineTo(0.38, 0.85);
  sh.absarc(0, 0.85, 0.38, 0, Math.PI, false);
  sh.lineTo(-0.38, 0);
  const hole = new THREE.Path();
  hole.moveTo(-0.31, 0.07);
  hole.lineTo(0.31, 0.07);
  hole.lineTo(0.31, 0.85);
  hole.absarc(0, 0.85, 0.31, 0, Math.PI, false);
  hole.lineTo(-0.31, 0.07);
  sh.holes.push(hole);
  const fg = new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: false, curveSegments: 24 });
  win.add(new THREE.Mesh(fg, white));
  const glassShape = new THREE.Shape(hole.getPoints(24));
  const glass = new THREE.Mesh(new THREE.ShapeGeometry(glassShape), new THREE.MeshBasicMaterial({ color: '#2b3a66' }));
  glass.position.z = 0.02;
  win.add(glass);
  win.add(box(0.025, 1.1, 0.03, white, 0, 0.62, 0.04), box(0.62, 0.025, 0.03, white, 0, 0.62, 0.04));
  const moon = new THREE.Mesh(new THREE.CircleGeometry(0.09, 24), new THREE.MeshBasicMaterial({ color: '#fff6dc' }));
  moon.position.set(0.14, 0.95, 0.025);
  win.add(moon);
  const bite = new THREE.Mesh(new THREE.CircleGeometry(0.085, 24), new THREE.MeshBasicMaterial({ color: '#2b3a66' }));
  bite.position.set(0.18, 0.98, 0.027);
  win.add(bite);
  for (const sx of [-1, 1]) {
    const cur = box(0.16, 1.2, 0.03, mat('#f3d7d5'), sx * 0.44, 0.62, 0.06);
    win.add(cur);
  }
  const wg = glowSprite('#9fb6ff', 1.8, 0.35);
  wg.position.set(0, 0.7, 0.1);
  win.add(wg);
  shadowAll(win, true, false);
  place(win, bedAngles[1] - 0.15, 0.55);
  s.add(win, 0.3, true);

  // IV stand
  const iv = new THREE.Group();
  const steel = mat('#b8c2cc', { metalness: 0.4, roughness: 0.35 });
  iv.add(cyl(0.012, 0.012, 1.0, steel, 0, 0.5, 0, 6));
  iv.add(cyl(0.1, 0.1, 0.015, steel, 0, 0.01, 0, 12));
  iv.add(box(0.14, 0.012, 0.012, steel, 0, 0.98, 0));
  const bag = box(0.07, 0.11, 0.025, new THREE.MeshStandardMaterial({ color: '#e7f4ff', transparent: true, opacity: 0.75, roughness: 0.2 }), 0.06, 0.9, 0);
  iv.add(bag);
  shadowAll(iv);
  place(iv, bedAngles[2] + 0.28, 1.12);
  s.add(iv, 0.45, true);

  // little paper stars hanging over the beds
  const starM = new THREE.MeshStandardMaterial({ color: '#ffe9a8', emissive: '#ffcf6a', emissiveIntensity: 2.4 });
  s.mobile = [];
  for (let i = 0; i < 7; i++) {
    const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0), starM);
    const a = bedAngles[0] - 0.2 + i * ((bedAngles[2] - bedAngles[0] + 0.4) / 6);
    place(st, a, 0.95, 1.25 + Math.sin(i * 2.1) * 0.12);
    s.add(st, 0.5 + i * 0.05);
    s.mobile.push(st);
  }
  s.updaters.push((T, dt, ctx) => {
    s.mobile.forEach((m, i) => {
      m.rotation.y = ctx.time * 0.8 + i;
      m.position.y = 1.25 + Math.sin(i * 2.1) * 0.12 + Math.sin(ctx.time * 1.2 + i) * 0.02;
    });
  });
  return s;
}

// ============================================================ RAIN STREET
export function buildStreet(on, off, benchA) {
  const s = new Scene(on, off);
  const R = rng(4);
  const winM = {
    lit: new THREE.MeshStandardMaterial({ color: '#ffd59a', emissive: '#ffb75e', emissiveIntensity: 2.6 }),
    dark: mat('#3c4258'),
  };
  const walls = ['#6c7390', '#7b7f9a', '#5f6784', '#8a8ea6'].map((c) => mat(c));
  const roofs = ['#434862', '#4d4560', '#3d4a5e'].map((c) => mat(c));
  const hs = [
    [0.0, 0.0, 0.7, 0.9, 0.6, [1]],
    [1.3, 0.75, 0.55, 0.65, 0.5, [0]],
    [2.6, 0.7, 0.6, 0.75, 0.5, []],
    [3.7, 0.65, 0.5, 0.6, 0.45, [1]],
    [5.0, 0.72, 0.55, 0.85, 0.5, [0]],
  ];
  hs.forEach(([a, r, w, h, d, lit], i) => {
    const hh = house(w, h, d, walls[i % 4], roofs[i % 3], winM, lit);
    place(hh, a, r);
    s.add(hh, 0.1 * i, true);
  });
  // lamps
  const iron = mat('#2c3042', { roughness: 0.5 });
  const bulbM = new THREE.MeshStandardMaterial({ color: '#fff0cc', emissive: '#ffcf80', emissiveIntensity: 4 });
  s.lampGlows = [];
  const lamp = (a, r, tall = 1.15) => {
    const g = new THREE.Group();
    g.add(cyl(0.022, 0.03, tall, iron, 0, tall / 2, 0, 8));
    g.add(cyl(0.06, 0.07, 0.03, iron, 0, 0.015, 0, 10));
    const head = cyl(0.03, 0.075, 0.07, iron, 0, tall + 0.08, 0, 8);
    g.add(head);
    g.add(sph(0.045, bulbM, 0, tall + 0.02, 0, 10));
    const gl = glowSprite('#ffc979', 1.0, 0.75);
    gl.position.y = tall + 0.02;
    g.add(gl);
    s.lampGlows.push(gl);
    shadowAll(g);
    place(g, a, r);
    return g;
  };
  [0.4, 1.4, 2.4, 3.3, 5.2, 6.0].forEach((a, i) => s.add(lamp(a, 2.45, 1.0), 0.05 * i, true));
  s.benchLamp = lamp(benchA + 0.32, 1.0, 1.35);
  s.add(s.benchLamp, 0.2, true);

  // bench
  const wood = mat('#8a5b45', { roughness: 0.7 });
  const bench = new THREE.Group();
  bench.add(box(0.95, 0.035, 0.2, wood, 0, 0.21, 0));
  bench.add(box(0.95, 0.12, 0.025, wood, 0, 0.33, -0.1));
  for (const x of [-0.4, 0.4]) {
    bench.add(box(0.03, 0.21, 0.18, iron, x, 0.105, 0));
    bench.add(box(0.03, 0.2, 0.025, iron, x, 0.3, -0.11));
  }
  shadowAll(bench, true, true);
  place(bench, benchA, 1.47);
  bench.scale.setScalar(1.25);
  s.add(bench, 0.25);

  // puddles with ripples
  const pud = new THREE.MeshStandardMaterial({ color: '#2d3850', roughness: 0.08, metalness: 0.4 });
  const rip = new THREE.MeshBasicMaterial({ color: '#b6c8e6', transparent: true, opacity: 0.5, depthWrite: false });
  s.ripples = [];
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group();
    const p = new THREE.Mesh(new THREE.CircleGeometry(0.16 + R() * 0.12, 24), pud);
    p.rotation.x = -Math.PI / 2;
    p.scale.y = 0.6;
    p.position.y = 0.004;
    p.receiveShadow = true;
    g.add(p);
    for (let k = 0; k < 2; k++) {
      const rr = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 24), rip.clone());
      rr.rotation.x = -Math.PI / 2;
      rr.position.y = 0.008;
      g.add(rr);
      s.ripples.push({ m: rr, ph: R() * 2, sx: (R() - 0.5) * 0.12, sz: (R() - 0.5) * 0.06 });
    }
    place(g, R() * Math.PI * 2, 1.35 + R() * 1.2);
    s.add(g, 0.1);
  }
  s.updaters.push((T, dt, ctx) => {
    for (const r of s.ripples) {
      const k = ((ctx.time * 0.9 + r.ph) % 1);
      r.m.scale.setScalar(0.02 + k * 0.14);
      r.m.position.x = r.sx;
      r.m.position.z = r.sz;
      r.m.material.opacity = (1 - k) * 0.6 * ctx.rain;
    }
    for (const g of s.lampGlows) g.material.opacity = 0.6 + ctx.pulse * 0.35;
  });
  return s;
}

// ============================================================ MEADOW (the sun comes out)
export function buildMeadow(on, off, popTimes) {
  const s = new Scene(on, off);
  const R = rng(12);
  // blossom tree
  const tree = new THREE.Group();
  const bark = mat('#8a6650');
  const trunk = cyl(0.07, 0.12, 1.1, bark, 0, 0.55, 0, 10);
  tree.add(trunk);
  const br1 = cyl(0.035, 0.05, 0.55, bark, 0.16, 1.05, 0, 8);
  br1.rotation.z = -0.7;
  const br2 = cyl(0.03, 0.045, 0.5, bark, -0.15, 1.0, 0.05, 8);
  br2.rotation.z = 0.75;
  tree.add(br1, br2);
  const pinks = ['#f7bfcd', '#f4a9bd', '#fbd3dd', '#f2b3c6'].map((c) => mat(c, { roughness: 0.85 }));
  const blobs = [[0, 1.55, 0, 0.5], [0.42, 1.35, 0.05, 0.36], [-0.42, 1.32, 0.0, 0.35], [0.2, 1.75, -0.15, 0.34], [-0.2, 1.72, 0.12, 0.33], [0.0, 1.3, 0.3, 0.3], [0.05, 1.35, -0.32, 0.32]];
  blobs.forEach(([x, y, z, r], i) => tree.add(sph(r * 0.8, pinks[i % 4], x * 0.85, y * 0.92, z * 0.85, 20)));
  shadowAll(tree);
  place(tree, 0, 0);
  s.add(tree, 0.0, true);

  // flowers — each blooms on a note of the music
  const N = 180;
  const stemG = new THREE.CylinderGeometry(0.006, 0.008, 1, 4);
  stemG.translate(0, 0.5, 0);
  const headG = new THREE.IcosahedronGeometry(1, 1);
  const stems = new THREE.InstancedMesh(stemG, mat('#6fa56d'), N);
  const heads = new THREE.InstancedMesh(headG, new THREE.MeshStandardMaterial({ roughness: 0.6 }), N);
  const hc = ['#f7a8b8', '#ffffff', '#ffd27a', '#c9b6f2', '#ff9a8f', '#fde2e4'].map((c) => new THREE.Color(c));
  const fl = [];
  for (let i = 0; i < N; i++) {
    let r = 0.55 + Math.sqrt(R()) * 2.35;
    if (r > 1.3 && r < 1.82 && R() < 0.75) r = r < 1.56 ? 1.2 - R() * 0.3 : 1.95 + R() * 0.5;
    const a = R() * Math.PI * 2;
    fl.push({ x: Math.sin(a) * r, z: Math.cos(a) * r, h: 0.08 + R() * 0.12, s: 0.022 + R() * 0.018, t: popTimes[i % popTimes.length] + R() * 0.15 });
    heads.setColorAt(i, hc[Math.floor(R() * hc.length)]);
  }
  const fgroup = new THREE.Group();
  fgroup.add(stems, heads);
  s.group.add(fgroup);
  const d = new THREE.Object3D();
  // grass tufts
  const tuftG = new THREE.ConeGeometry(0.025, 0.12, 4);
  tuftG.translate(0, 0.06, 0);
  const tufts = new THREE.InstancedMesh(tuftG, mat('#7fb276'), 120);
  const tf = [];
  for (let i = 0; i < 120; i++) {
    const a = R() * Math.PI * 2, r = 0.5 + R() * 2.45;
    tf.push({ x: Math.sin(a) * r, z: Math.cos(a) * r, ry: R() * 3, s: 0.6 + R() * 0.8, t: on + 0.2 + (r / 3) * 0.8 });
  }
  s.group.add(tufts);

  // butterflies (like the one on her necklace)
  s.butterflies = [];
  const wingM = [mat('#fff6e9', { side: THREE.DoubleSide }), mat('#ffd9a0', { side: THREE.DoubleSide }), mat('#f9c8dc', { side: THREE.DoubleSide })];
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Group();
    const wg = new THREE.CircleGeometry(0.05, 10);
    wg.translate(0.045, 0.01, 0);
    const wl = new THREE.Mesh(wg, wingM[i % 3]);
    const wr = new THREE.Mesh(wg, wingM[i % 3]);
    b.add(wl, wr);
    b.userData = { wl, wr, ph: R() * 6, r: 0.9 + R() * 1.5, h: 0.5 + R() * 0.6, sp: 0.4 + R() * 0.3 };
    s.group.add(b);
    s.butterflies.push(b);
  }

  s.updaters.push((T, dt, ctx) => {
    const out = 1 - easeIn((T - s.off) / 0.6);
    for (let i = 0; i < N; i++) {
      const f = fl[i];
      const k = Math.max(0, Math.min(backOut((T - f.t) / 0.5, 2.2), out));
      d.position.set(f.x, FLOOR_Y, f.z);
      d.rotation.set(Math.sin(ctx.time * 1.5 + i) * 0.08, 0, Math.cos(ctx.time * 1.3 + i) * 0.08);
      d.scale.set(1, Math.max(0.0001, f.h * k), 1);
      d.updateMatrix();
      stems.setMatrixAt(i, d.matrix);
      d.position.y = FLOOR_Y + f.h * k;
      const ss = Math.max(0.0001, f.s * k * (1 + ctx.pulse * 0.12));
      d.scale.set(ss, ss * 0.7, ss);
      d.updateMatrix();
      heads.setMatrixAt(i, d.matrix);
    }
    stems.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < tf.length; i++) {
      const t = tf[i];
      const k = Math.max(0, Math.min(backOut((T - t.t) / 0.5), out));
      d.position.set(t.x, FLOOR_Y, t.z);
      d.rotation.set(0, t.ry, 0);
      d.scale.setScalar(Math.max(0.0001, k * t.s));
      d.updateMatrix();
      tufts.setMatrixAt(i, d.matrix);
    }
    tufts.instanceMatrix.needsUpdate = true;
    const bk = Math.max(0, Math.min(1, (T - s.on - 1.5) / 1.0, out));
    for (const b of s.butterflies) {
      const u = b.userData;
      const a = ctx.time * u.sp + u.ph;
      b.position.set(Math.sin(a) * u.r, u.h + Math.sin(ctx.time * 2 + u.ph) * 0.15, Math.cos(a * 1.3) * u.r);
      b.rotation.y = a + Math.PI / 2;
      const f = Math.sin(ctx.time * 18 + u.ph) * 1.1;
      u.wl.rotation.y = f;
      u.wr.rotation.y = Math.PI - f;
      b.scale.setScalar(Math.max(0.0001, bk));
    }
  });
  return s;
}

// ============================================================ MOUNTAINS (his place: the fence, the hills)
function mountain(r, h, color, seed) {
  const g = new THREE.ConeGeometry(r, h, 9, 4);
  const R = rng(seed);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y < h / 2 - 0.01) {
      const k = 1 + (R() - 0.5) * 0.25;
      p.setX(i, p.getX(i) * k);
      p.setZ(i, p.getZ(i) * k);
      p.setY(i, y + (R() - 0.5) * 0.06);
    }
  }
  g.translate(0, h / 2, 0);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat(color, { flatShading: true, roughness: 0.9 }));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function buildMountains(on, off, fenceA) {
  const s = new Scene(on, off);
  const R = rng(21);
  const back = fenceA + Math.PI;
  // far blue ridge, green hills, and the big red-brown mound in front
  const far = [[back, 0.9, 0.85, 1.7], [back + 0.7, 1.1, 0.7, 1.3], [back - 0.7, 1.05, 0.75, 1.45]];
  far.forEach(([a, r, rad, h], i) => {
    const m = mountain(rad, h, i ? '#a9b5cc' : '#9aaac4', 40 + i);
    place(m, a, r);
    s.add(m, 0.05 * i, true);
  });
  const mid = [[fenceA + 1.3, 0.7, 0.75, 0.75], [fenceA - 1.2, 0.75, 0.8, 0.85], [back + 1.6, 1.4, 0.6, 0.6]];
  mid.forEach(([a, r, rad, h], i) => {
    const m = mountain(rad, h, '#8fb779', 50 + i);
    place(m, a, r);
    s.add(m, 0.15 + 0.05 * i, true);
  });
  const mound = mountain(0.75, 1.05, '#a5715d', 61);
  place(mound, fenceA - 0.45, 0.42);
  s.add(mound, 0.2, true);
  // a small village in the valley
  const wall = mat('#f4efe7'), roofM = mat('#c7665a');
  const winM = { lit: mat('#ffe2a6'), dark: mat('#7d8aa0') };
  for (let i = 0; i < 4; i++) {
    const h = house(0.16, 0.12, 0.14, wall, roofM, winM, []);
    place(h, fenceA + 0.35 + i * 0.14, 0.62 + (i % 2) * 0.16);
    s.add(h, 0.3 + i * 0.05, true);
  }
  // pine trees on the rim
  const pine = mat('#4f7b5a', { flatShading: true });
  for (let i = 0; i < 9; i++) {
    const t = new THREE.Group();
    const h = 0.35 + R() * 0.3;
    t.add(cyl(0.02, 0.025, 0.08, mat('#6b4c3a'), 0, 0.04, 0, 6));
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.12, h, 7), pine);
    c.position.y = 0.08 + h / 2;
    t.add(c);
    shadowAll(t);
    place(t, R() * Math.PI * 2, 2.1 + R() * 0.7);
    s.add(t, 0.2 + R() * 0.3, true);
  }
  // the fence
  const fence = new THREE.Group();
  const steel = mat('#c5cad3', { metalness: 0.5, roughness: 0.4 });
  const span = 1.3, n = 8;
  for (let i = 0; i < n; i++) {
    const x = -span / 2 + (i * span) / (n - 1);
    fence.add(cyl(0.012, 0.012, 0.42, steel, x, 0.21, 0, 6));
  }
  for (const y of [0.4, 0.22]) {
    const rail = cyl(0.014, 0.014, span + 0.05, steel, 0, y, 0, 6);
    rail.rotation.z = Math.PI / 2;
    fence.add(rail);
  }
  // wire mesh
  const meshM = new THREE.MeshBasicMaterial({ color: '#c5cad3', wireframe: true, transparent: true, opacity: 0.35 });
  const net = new THREE.Mesh(new THREE.PlaneGeometry(span, 0.36, 18, 5), meshM);
  net.position.y = 0.22;
  fence.add(net);
  shadowAll(fence);
  place(fence, fenceA, 1.08);
  s.add(fence, 0.35, true);
  return s;
}

// ============================================================ NIGHT: fairy lights around the rim
export function buildLights(on, off, revealTimes, gapA = 0) {
  const s = new Scene(on, off);
  const poles = 8;
  const pr = 2.6;
  const ph = 1.75;
  const wood = mat('#5b4a44');
  const bulbsPos = [];
  for (let i = 0; i < poles; i++) {
    const a = ((i + 0.5) / poles) * Math.PI * 2 + gapA;
    const p = cyl(0.018, 0.024, ph, wood, 0, ph / 2, 0, 6);
    const g = new THREE.Group();
    g.add(p);
    shadowAll(g);
    place(g, a, pr);
    s.add(g, 0.05 * i, true);
    const a2 = ((i + 1.5) / poles) * Math.PI * 2 + gapA;
    const A = new THREE.Vector3(Math.sin(a) * pr, FLOOR_Y + ph, Math.cos(a) * pr);
    const B = new THREE.Vector3(Math.sin(a2) * pr, FLOOR_Y + ph, Math.cos(a2) * pr);
    const pts = [];
    for (let k = 0; k <= 16; k++) {
      const t = k / 16;
      const v = A.clone().lerp(B, t);
      v.y -= Math.sin(t * Math.PI) * 0.26;
      pts.push(v);
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const wire = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.005, 4, false), mat('#3a3030'));
    const wg = new THREE.Group();
    wg.add(wire);
    s.add(wg, 0.4 + 0.03 * i);
    for (let k = 1; k < 8; k++) bulbsPos.push(curve.getPoint(k / 8));
  }
  const N = bulbsPos.length;
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.028, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }), N);
  const glows = [];
  const d = new THREE.Object3D();
  const warm = new THREE.Color('#ffd27f'), off_ = new THREE.Color('#4a4038'), tmp = new THREE.Color();
  const pal = ['#ffd27f', '#ffb3c1', '#fff2cf', '#ffc98f'].map((c) => new THREE.Color(c));
  for (let i = 0; i < N; i++) {
    d.position.copy(bulbsPos[i]);
    d.updateMatrix();
    bulbs.setMatrixAt(i, d.matrix);
    const g = glowSprite(pal[i % 4], 0.42, 0);
    g.position.copy(bulbsPos[i]);
    s.group.add(g);
    glows.push(g);
  }
  s.group.add(bulbs);
  s.updaters.push((T, dt, ctx) => {
    const out = 1 - easeIn((T - s.off) / 0.6);
    for (let i = 0; i < N; i++) {
      const rt = revealTimes[i % revealTimes.length] + Math.floor(i / revealTimes.length) * 0.3;
      const k = clamp((T - rt) / 0.25) * out;
      const tw = 0.75 + 0.25 * Math.sin(ctx.time * 3 + i * 1.7);
      tmp.copy(off_).lerp(pal[i % 4], k).multiplyScalar(1 + k * 2.2 * (0.8 + ctx.pulse * 0.4));
      bulbs.setColorAt(i, tmp);
      glows[i].material.opacity = k * tw * (0.7 + ctx.pulse * 0.5);
    }
    bulbs.instanceColor.needsUpdate = true;
    bulbs.visible = out > 0.01 && T >= s.on;
  });
  s.bulbs = bulbs;
  return s;
}

// ============================================================ HOME: the flower arch and a little house
export function buildHome(on, off, frontA, times) {
  const s = new Scene(on, off);
  const R = rng(77);
  // arch
  const arch = new THREE.Group();
  const white = mat('#fbf7f2', { roughness: 0.5 });
  for (const x of [-0.44, 0.44]) arch.add(cyl(0.025, 0.03, 0.85, white, x, 0.425, 0, 8));
  const top = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.025, 8, 32, Math.PI), white);
  top.position.y = 0.85;
  arch.add(top);
  const flowerCols = ['#f7b9c8', '#ffffff', '#fbd3dd', '#f29fb4', '#fff1d6'].map((c) => mat(c, { roughness: 0.7 }));
  const leaf = mat('#8dbb85');
  for (let i = 0; i < 46; i++) {
    let x, y;
    const t = R();
    if (t < 0.6) {
      const a = R() * Math.PI;
      x = Math.cos(a) * 0.44;
      y = 0.85 + Math.sin(a) * 0.44;
    } else {
      x = R() < 0.5 ? -0.44 : 0.44;
      y = 0.2 + R() * 0.65;
    }
    const isLeaf = R() < 0.3;
    arch.add(sph(isLeaf ? 0.035 : 0.04 + R() * 0.025, isLeaf ? leaf : flowerCols[i % 5], x + (R() - 0.5) * 0.06, y, (R() - 0.5) * 0.06, 8));
  }
  shadowAll(arch);
  place(arch, frontA, 0.98);
  arch.scale.setScalar(1.35);
  s.add(arch, 0, true);
  s.arch = arch;

  // house
  const wall = mat('#f5e8d8');
  const roofM = mat('#d27c70');
  const homeWin = new THREE.MeshStandardMaterial({ color: '#4b4258', emissive: '#ffb45e', emissiveIntensity: 0 });
  const hg = new THREE.Group();
  hg.add(box(1.25, 0.95, 0.85, wall, 0, 0.475, 0));
  const r = roof(1.4, 0.6, 1.0, roofM);
  r.position.y = 0.95 + 0.12;
  hg.add(r);
  hg.add(box(0.12, 0.35, 0.12, roofM, 0.35, 1.3, -0.1));
  hg.add(box(0.3, 0.55, 0.02, mat('#8a5b45'), 0, 0.275, 0.43));
  hg.add(sph(0.015, mat('#e4c27a', { metalness: 0.7, roughness: 0.3 }), 0.1, 0.28, 0.445, 8));
  const w1 = box(0.22, 0.22, 0.02, homeWin, -0.38, 0.55, 0.43);
  const w2 = box(0.22, 0.22, 0.02, homeWin, 0.38, 0.55, 0.43);
  const w3 = new THREE.Mesh(new THREE.CircleGeometry(0.08, 20), homeWin);
  w3.position.set(0, 1.25, 0.47);
  hg.add(w1, w2, w3);
  for (const x of [-0.38, 0.38]) {
    hg.add(box(0.26, 0.02, 0.05, white, x, 0.43, 0.45));
    hg.add(box(0.012, 0.22, 0.022, white, x, 0.55, 0.442), box(0.22, 0.012, 0.022, white, x, 0.55, 0.442));
  }
  // flower boxes
  for (const x of [-0.38, 0.38]) for (let k = 0; k < 4; k++) hg.add(sph(0.028, flowerCols[k], x - 0.09 + k * 0.06, 0.465, 0.47, 8));
  const lamp = glowSprite('#ffc27a', 0.9, 0);
  lamp.position.set(0, 0.6, 0.55);
  hg.add(lamp);
  const winGlows = [w1, w2].map((w) => {
    const g = glowSprite('#ffbe70', 0.7, 0);
    g.position.copy(w.position).add(new THREE.Vector3(0, 0, 0.05));
    hg.add(g);
    return g;
  });
  shadowAll(hg, true, true);
  place(hg, frontA, -0.05);
  s.add(hg, times.house - on, true);

  // chimney smoke
  const smokeM = mat('#f1eef5', { transparent: true, opacity: 0.7 });
  s.smoke = [];
  for (let i = 0; i < 6; i++) {
    const p = sph(0.05, smokeM.clone(), 0, 0, 0, 10);
    s.group.add(p);
    s.smoke.push(p);
  }
  const chimLocal = new THREE.Vector3(0.35, 1.5, -0.1);

  s.updaters.push((T, dt, ctx) => {
    const lit = clamp((T - times.lights) / 1.5) * (1 - clamp((T - s.off) / 0.5));
    homeWin.emissiveIntensity = lit * 3.2;
    lamp.material.opacity = lit * 0.8;
    winGlows.forEach((g) => (g.material.opacity = lit * 0.7));
    const sm = clamp((T - times.house - 1.5) / 1) * (1 - clamp((T - s.off) / 0.4));
    s.smoke.forEach((p, i) => {
      const k = (ctx.time * 0.25 + i / s.smoke.length) % 1;
      const w = chimLocal.clone();
      w.y += k * 0.9;
      w.x += Math.sin(k * 5 + i) * 0.08;
      w.applyAxisAngle(new THREE.Vector3(0, 1, 0), frontA);
      w.add(hg.position);
      p.position.copy(w);
      p.scale.setScalar(Math.max(0.0001, (0.6 + k * 1.6) * sm));
      p.material.opacity = (1 - k) * 0.7;
      p.visible = sm > 0.01;
    });
  });
  return s;
}
