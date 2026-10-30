import * as THREE from 'three';

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const easeInOut = (t) => {
  t = clamp(t);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const easeIn = (t) => Math.pow(clamp(t), 3);
export const backOut = (t, s = 1.9) => {
  t = clamp(t);
  const c3 = s + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
};
export const elasticOut = (t) => {
  t = clamp(t);
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -9 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
};
// progress of x through [a,b], clamped
export const seg = (x, a, b) => clamp((x - a) / (b - a));
// rises over [a,a+fi], falls over [b-fo,b]
export const win = (x, a, b, fi = 0.5, fo = 0.5) => Math.min(smooth(a, a + fi, x), 1 - smooth(b - fo, b, x));

// Keyframe track: keys = [[t, v], ...] (v: number or array). Eased between keys.
export function track(keys, t, ease = easeInOut) {
  if (t <= keys[0][0]) return keys[0][1];
  const last = keys[keys.length - 1];
  if (t >= last[0]) return last[1];
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
  const [t0, a] = keys[i];
  const [t1, b] = keys[i + 1];
  const k = ease((t - t0) / (t1 - t0));
  if (Array.isArray(a)) return a.map((v, j) => lerp(v, b[j], k));
  return lerp(a, b, k);
}

// Color track: keys = [[t, '#hex'], ...]
export function colorTrack(keys) {
  const k = keys.map(([t, c]) => [t, new THREE.Color(c)]);
  const out = new THREE.Color();
  return (t) => {
    if (t <= k[0][0]) return out.copy(k[0][1]);
    if (t >= k[k.length - 1][0]) return out.copy(k[k.length - 1][1]);
    let i = 0;
    while (i < k.length - 2 && t > k[i + 1][0]) i++;
    const f = easeInOut((t - k[i][0]) / (k[i + 1][0] - k[i][0]));
    return out.copy(k[i][1]).lerp(k[i + 1][1], f);
  };
}

// deterministic pseudo random
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...opts });
}

export function heartShape(s = 1) {
  const sh = new THREE.Shape();
  sh.moveTo(0, -0.9 * s);
  sh.bezierCurveTo(-0.15 * s, -0.7 * s, -1.0 * s, -0.25 * s, -1.0 * s, 0.25 * s);
  sh.bezierCurveTo(-1.0 * s, 0.75 * s, -0.4 * s, 0.95 * s, 0, 0.5 * s);
  sh.bezierCurveTo(0.4 * s, 0.95 * s, 1.0 * s, 0.75 * s, 1.0 * s, 0.25 * s);
  sh.bezierCurveTo(1.0 * s, -0.25 * s, 0.15 * s, -0.7 * s, 0, -0.9 * s);
  return sh;
}

export function heartGeometry(size = 1, depth = 0.3, bevel = 0.12) {
  const g = new THREE.ExtrudeGeometry(heartShape(size), {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 4,
    curveSegments: 20,
  });
  g.center();
  return g;
}

let glowTex;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  gr.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

export function glowSprite(color, size = 1, opacity = 1) {
  const m = new THREE.SpriteMaterial({
    map: glowTexture(),
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(size);
  return s;
}

export function shadowAll(obj, cast = true, receive = false) {
  obj.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = cast;
      o.receiveShadow = receive;
    }
  });
  return obj;
}

// Monotone cubic (Fritsch–Carlson) track: smooth velocity through keys, no overshoot.
export function monoTrack(keys) {
  const n = keys.length;
  const ts = keys.map((k) => k[0]);
  const isArr = Array.isArray(keys[0][1]);
  const vs = keys.map((k) => (isArr ? k[1] : [k[1]]));
  const dim = vs[0].length;
  const ms = [];
  for (let d = 0; d < dim; d++) {
    const del = [];
    for (let i = 0; i < n - 1; i++) del[i] = (vs[i + 1][d] - vs[i][d]) / (ts[i + 1] - ts[i]);
    const m = new Array(n).fill(0);
    for (let i = 1; i < n - 1; i++) m[i] = del[i - 1] * del[i] <= 0 ? 0 : (del[i - 1] + del[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (del[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / del[i], b = m[i + 1] / del[i];
      const s = a * a + b * b;
      if (s > 9) { const tau = 3 / Math.sqrt(s); m[i] = tau * a * del[i]; m[i + 1] = tau * b * del[i]; }
    }
    ms.push(m);
  }
  const out = new Array(dim);
  return (t) => {
    let i = 0;
    if (t <= ts[0]) { for (let d = 0; d < dim; d++) out[d] = vs[0][d]; }
    else if (t >= ts[n - 1]) { for (let d = 0; d < dim; d++) out[d] = vs[n - 1][d]; }
    else {
      while (i < n - 2 && t > ts[i + 1]) i++;
      const h = ts[i + 1] - ts[i], s = (t - ts[i]) / h;
      const s2 = s * s, s3 = s2 * s;
      const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
      for (let d = 0; d < dim; d++) out[d] = h00 * vs[i][d] + h10 * h * ms[d][i] + h01 * vs[i + 1][d] + h11 * h * ms[d][i + 1];
    }
    return isArr ? out.slice() : out[0];
  };
}
