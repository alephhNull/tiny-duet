import * as THREE from 'three';
import { mat, rng, glowTexture, glowSprite, heartGeometry, clamp, lerp } from './util.js';

// ------------------------------------------------------------ sky gradient
export function makeSky() {
  const geo = new THREE.SphereGeometry(60, 32, 16);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color('#151520') },
      bottom: { value: new THREE.Color('#2a2430') },
      glow: { value: new THREE.Color('#000000') },
    },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `uniform vec3 top; uniform vec3 bottom; uniform vec3 glow; varying vec3 vP;
      void main(){ float h = clamp(vP.y*5.5+0.15,0.0,1.0); vec3 c = mix(bottom, top, smoothstep(0.0,1.0,h));
      float g = exp(-pow(max(vP.y+0.05,0.0)*3.0,2.0)) * smoothstep(-0.2,0.6,-vP.z);
      c += glow*g*0.28; gl_FragColor = vec4(c,1.0);
      #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, m);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return mesh;
}

// ------------------------------------------------------------ rain
export class Rain {
  // fade: fraction of the column (from the top) over which drops fade in, so there's no hard ceiling
  constructor(n, radius, height, color = '#a9bdd6', len = 0.18, fade = 0) {
    this.n = n;
    this.r = radius;
    this.h = height;
    this.len = len;
    this.fade = fade;
    const pos = new Float32Array(n * 6);
    this.alpha = new Float32Array(n * 8);
    const c = new THREE.Color(color);
    for (let i = 0; i < n * 2; i++) {
      this.alpha[i * 4] = c.r;
      this.alpha[i * 4 + 1] = c.g;
      this.alpha[i * 4 + 2] = c.b;
      this.alpha[i * 4 + 3] = 1;
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.alpha, 4));
    this.mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false });
    this.mesh = new THREE.LineSegments(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    const R = rng(7 + n);
    this.drops = [];
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, rr = Math.sqrt(R()) * radius;
      this.drops.push({ x: Math.cos(a) * rr, z: Math.sin(a) * rr, y: R() * height, v: 5 + R() * 2 });
    }
    this.intensity = 0;
    this.center = new THREE.Vector3();
    this.floor = 0;
  }
  update(dt) {
    const active = Math.floor(this.n * clamp(this.intensity));
    if (active === 0 && !this.mesh.visible) return;
    const arr = this.geo.attributes.position.array;
    const al = this.alpha;
    for (let i = 0; i < this.n; i++) {
      const d = this.drops[i];
      d.y -= d.v * dt;
      if (d.y < this.floor) d.y += this.h;
      const j = i * 6;
      if (i >= active) {
        arr[j] = arr[j + 2] = arr[j + 3] = arr[j + 5] = 0;
        arr[j + 1] = arr[j + 4] = -50;
        continue;
      }
      const x = this.center.x + d.x, z = this.center.z + d.z, y = this.center.y + d.y;
      arr[j] = x; arr[j + 1] = y; arr[j + 2] = z;
      arr[j + 3] = x - 0.01; arr[j + 4] = y - this.len; arr[j + 5] = z;
      if (this.fade > 0) {
        // fade in from the top of the column
        const k = Math.min(1, (this.h - d.y) / (this.h * this.fade));
        al[i * 8 + 3] = k;
        al[i * 8 + 7] = k;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    if (this.fade > 0) this.geo.attributes.color.needsUpdate = true;
    this.mesh.visible = active > 0;
  }
}

// ------------------------------------------------------------ petals
export class Petals {
  constructor(n = 260) {
    this.n = n;
    const g = new THREE.CircleGeometry(0.022, 7);
    g.scale(1.5, 1, 1);
    const m = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.6, transparent: true, opacity: 0.95 });
    this.mesh = new THREE.InstancedMesh(g, m, n);
    this.mesh.frustumCulled = false;
    const cols = ['#f9c6d3', '#ffffff', '#f7a9bd', '#ffe4ec', '#f3d3e8'].map((c) => new THREE.Color(c));
    const R = rng(33);
    this.p = [];
    for (let i = 0; i < n; i++) {
      this.mesh.setColorAt(i, cols[i % cols.length]);
      this.p.push({
        x: (R() * 2 - 1) * 3, z: (R() * 2 - 1) * 3, y: -1,
        v: 0.35 + R() * 0.35, ph: R() * 10, rs: 1 + R() * 2, ax: R(), az: R(),
      });
    }
    this.intensity = 0;
    this.dummy = new THREE.Object3D();
    this.time = 0;
    this.floorY = 0.07;
  }
  update(dt) {
    this.time += dt;
    const active = Math.floor(this.n * clamp(this.intensity));
    // nothing falling and nothing left on the stage: skip the work
    if (active === 0 && this.idle) return;
    this.idle = active === 0 && this.p.every((p) => p.y <= this.floorY);
    const d = this.dummy;
    for (let i = 0; i < this.n; i++) {
      const p = this.p[i];
      if (i < active || p.y > this.floorY + 0.01) {
        p.y -= p.v * dt;
        if (p.y < this.floorY) {
          // rest on stage briefly, then respawn above if active
          if (i < active) {
            p.y = 4.5 + Math.random() * 1.5;
            p.x = (Math.random() * 2 - 1) * 3;
            p.z = (Math.random() * 2 - 1) * 3;
          } else p.y = this.floorY - 0.5;
        }
      }
      const t = this.time * p.rs + p.ph;
      const vis = p.y > this.floorY - 0.1 && (i < active || p.y > this.floorY);
      d.position.set(p.x + Math.sin(t * 0.7) * 0.25, p.y, p.z + Math.cos(t * 0.5) * 0.2);
      d.rotation.set(t * p.ax * 2, t * 0.8, t * p.az * 2);
      d.scale.setScalar(vis && p.x * p.x + p.z * p.z < 10 ? 1 : 0.0001);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ------------------------------------------------------------ point sprites (stars / fireflies / sparkles)
function pointsMaterial(color, size, additive = true) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: {
      map: { value: glowTexture() },
      color: { value: new THREE.Color(color) },
      opacity: { value: 1 },
      time: { value: 0 },
      pulse: { value: 0 },
      size: { value: size },
      scale: { value: 1 },
    },
    vertexShader: `
      attribute float phase; attribute float alive; attribute float psize;
      uniform float time; uniform float size; uniform float scale; uniform float pulse;
      varying float vA;
      void main(){
        vec4 mv = modelViewMatrix*vec4(position,1.0);
        float tw = 0.65+0.35*sin(time*2.2+phase*6.283);
        vA = alive*tw*(1.0+pulse*0.6);
        gl_PointSize = size*psize*scale*(1.0+pulse*0.35)/max(-mv.z,0.1);
        gl_Position = projectionMatrix*mv;
      }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 color; uniform float opacity; varying float vA;
      void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(color * (1.0 + t.a * 1.6), t.a*vA*opacity); }`,
  });
}

export class Stars {
  constructor(n = 260) {
    const R = rng(91);
    const pos = new Float32Array(n * 3), ph = new Float32Array(n), al = new Float32Array(n), ps = new Float32Array(n);
    this.order = [];
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 1.6 - Math.PI * 0.8; // behind the box
      const e = 0.08 + R() * 0.9;
      const r = 40;
      pos[i * 3] = Math.sin(a) * Math.cos(e) * r;
      pos[i * 3 + 1] = Math.sin(e) * r - 6;
      pos[i * 3 + 2] = -Math.cos(a) * Math.cos(e) * r;
      ph[i] = R();
      ps[i] = 0.6 + R() * R() * 1.8;
      this.order.push(R());
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.geo.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
    this.geo.setAttribute('alive', new THREE.BufferAttribute(al, 1));
    this.geo.setAttribute('psize', new THREE.BufferAttribute(ps, 1));
    this.mat = pointsMaterial('#fff6e6', 260);
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.n = n;
  }
  // reveal: 0..1 fraction of stars visible (each star has its own threshold)
  set(reveal, time, pulse) {
    const al = this.geo.attributes.alive.array;
    for (let i = 0; i < this.n; i++) al[i] = clamp((reveal - this.order[i]) * 12);
    this.geo.attributes.alive.needsUpdate = true;
    this.mat.uniforms.time.value = time;
    this.mat.uniforms.pulse.value = pulse;
    this.points.visible = reveal > 0.001;
  }
}

export class Fireflies {
  constructor(n = 70) {
    const R = rng(55);
    this.n = n;
    this.seed = [];
    const pos = new Float32Array(n * 3), ph = new Float32Array(n), al = new Float32Array(n).fill(1), ps = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.seed.push({ a: R() * 6.28, r: 0.6 + R() * 2.6, y: 0.2 + R() * 2.2, s: 0.1 + R() * 0.3, p: R() * 10 });
      ph[i] = R();
      ps[i] = 0.7 + R() * 0.8;
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.geo.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
    this.geo.setAttribute('alive', new THREE.BufferAttribute(al, 1));
    this.geo.setAttribute('psize', new THREE.BufferAttribute(ps, 1));
    this.mat = pointsMaterial('#ffe08a', 90);
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.swirl = 0;
  }
  update(time, opacity, pulse, swirl, center) {
    const arr = this.geo.attributes.position.array;
    for (let i = 0; i < this.n; i++) {
      const s = this.seed[i];
      const a = s.a + time * s.s * (1 + swirl * 4);
      const r = lerp(s.r, 0.45 + (s.r % 1) * 0.9, swirl);
      arr[i * 3] = center.x + Math.cos(a) * r + Math.sin(time * 0.7 + s.p) * 0.15;
      arr[i * 3 + 1] = s.y + Math.sin(time * 1.3 + s.p) * 0.2 + swirl * 0.3;
      arr[i * 3 + 2] = center.z + Math.sin(a) * r;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.mat.uniforms.opacity.value = opacity;
    this.mat.uniforms.time.value = time;
    this.mat.uniforms.pulse.value = pulse;
    this.points.visible = opacity > 0.01;
  }
}

// one-shot bursts of glowing sparkles
export class Sparkles {
  constructor(n = 240, color = '#fff1c9') {
    this.n = n;
    const pos = new Float32Array(n * 3), ph = new Float32Array(n), al = new Float32Array(n), ps = new Float32Array(n);
    for (let i = 0; i < n; i++) { ph[i] = Math.random(); ps[i] = 0.5 + Math.random(); }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.geo.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
    this.geo.setAttribute('alive', new THREE.BufferAttribute(al, 1));
    this.geo.setAttribute('psize', new THREE.BufferAttribute(ps, 1));
    this.mat = pointsMaterial(color, 70);
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.parts = [];
    for (let i = 0; i < n; i++) this.parts.push({ life: 0, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), g: 0 });
    this.next = 0;
  }
  burst(at, count = 30, speed = 1, up = 0.6, life = 1.2, gravity = -0.6) {
    for (let k = 0; k < count; k++) {
      const q = this.parts[this.next];
      this.next = (this.next + 1) % this.n;
      q.p.copy(at);
      const a = Math.random() * Math.PI * 2, e = Math.random() * 2 - 1;
      const s = speed * (0.4 + Math.random() * 0.6);
      q.v.set(Math.cos(a) * Math.sqrt(1 - e * e) * s, e * s * 0.6 + up, Math.sin(a) * Math.sqrt(1 - e * e) * s);
      q.life = q.max = life * (0.6 + Math.random() * 0.6);
      q.g = gravity;
    }
  }
  update(dt, time) {
    const pos = this.geo.attributes.position.array, al = this.geo.attributes.alive.array;
    let any = false;
    for (let i = 0; i < this.n; i++) {
      const q = this.parts[i];
      if (q.life <= 0) { al[i] = 0; continue; }
      any = true;
      q.life -= dt;
      q.v.y += q.g * dt;
      q.v.multiplyScalar(1 - dt * 1.2);
      q.p.addScaledVector(q.v, dt);
      pos[i * 3] = q.p.x; pos[i * 3 + 1] = q.p.y; pos[i * 3 + 2] = q.p.z;
      al[i] = clamp(q.life / q.max) * 1.2;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.alive.needsUpdate = true;
    this.mat.uniforms.time.value = time;
    this.points.visible = any;
  }
}

// floating little hearts (tap reaction)
export class Hearts {
  constructor(n = 60) {
    this.n = n;
    const g = heartGeometry(0.05, 0.02, 0.012);
    g.rotateZ(Math.PI);
    const m = new THREE.MeshStandardMaterial({ roughness: 0.35, emissive: '#ff6b8a', emissiveIntensity: 0.35 });
    this.mesh = new THREE.InstancedMesh(g, m, n);
    this.mesh.frustumCulled = false;
    const cols = ['#ff7d9a', '#ff9db2', '#ffc2cf', '#ff5f7e'].map((c) => new THREE.Color(c));
    this.parts = [];
    for (let i = 0; i < n; i++) {
      this.mesh.setColorAt(i, cols[i % cols.length]);
      this.parts.push({ life: 0, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), r: 0, s: 1 });
    }
    this.next = 0;
    this.d = new THREE.Object3D();
  }
  burst(at, count = 6) {
    for (let k = 0; k < count; k++) {
      const q = this.parts[this.next];
      this.next = (this.next + 1) % this.n;
      q.p.copy(at);
      q.v.set((Math.random() - 0.5) * 0.9, 0.8 + Math.random() * 0.7, (Math.random() - 0.5) * 0.5);
      q.life = q.max = 1.4 + Math.random() * 0.6;
      q.r = Math.random() * 6;
      q.s = 0.6 + Math.random() * 0.8;
    }
  }
  update(dt, time) {
    const d = this.d;
    for (let i = 0; i < this.n; i++) {
      const q = this.parts[i];
      if (q.life > 0) {
        q.life -= dt;
        q.v.multiplyScalar(1 - dt * 1.3);
        q.p.addScaledVector(q.v, dt);
        q.p.x += Math.sin(time * 3 + q.r) * dt * 0.15;
      }
      const k = q.life > 0 ? clamp(q.life / q.max) : 0;
      const s = k > 0 ? q.s * Math.min(1, (1 - k) * 8) * Math.min(1, k * 3) : 0.0001;
      d.position.copy(q.p);
      d.rotation.set(0, Math.sin(time * 2 + q.r) * 0.8, Math.sin(time * 1.5 + q.r) * 0.2);
      d.scale.setScalar(Math.max(s, 0.0001));
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ------------------------------------------------------------ rope (thin string through points)
export class Rope {
  constructor(segs = 12, color = '#f4efe8', radius = 0.006) {
    this.segs = segs;
    const g = new THREE.CylinderGeometry(radius, radius, 1, 5, 1, true);
    g.translate(0, 0.5, 0);
    g.rotateX(Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(g, mat(color, { roughness: 0.9 }), segs);
    this.mesh.frustumCulled = false;
    this.d = new THREE.Object3D();
    this.pts = Array.from({ length: segs + 1 }, () => new THREE.Vector3());
    this.tmp = new THREE.Vector3();
  }
  // curve from a to b with sag (quadratic)
  set(a, b, sag = 0.05, wobble = 0, time = 0) {
    const mid = this.tmp.copy(a).add(b).multiplyScalar(0.5);
    mid.y -= sag;
    mid.x += Math.sin(time * 1.7) * wobble;
    for (let i = 0; i <= this.segs; i++) {
      const t = i / this.segs;
      const p = this.pts[i];
      p.set(
        (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * mid.x + t * t * b.x,
        (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * mid.y + t * t * b.y,
        (1 - t) * (1 - t) * a.z + 2 * (1 - t) * t * mid.z + t * t * b.z,
      );
    }
    const d = this.d;
    for (let i = 0; i < this.segs; i++) {
      d.position.copy(this.pts[i]);
      d.lookAt(this.pts[i + 1]);
      d.scale.set(1, 1, Math.max(0.0001, this.pts[i].distanceTo(this.pts[i + 1])));
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ------------------------------------------------------------ her little rain cloud, which becomes a heart balloon
export class CloudHeart {
  constructor() {
    this.group = new THREE.Group();
    this.cloud = new THREE.Group();
    this.cloudMat = mat('#a7b1c2', { roughness: 0.95 });
    const puffs = [[0, 0, 0, 0.17], [0.15, -0.02, 0.02, 0.13], [-0.15, -0.03, 0, 0.12], [0.06, 0.08, -0.02, 0.12], [-0.07, 0.06, 0.03, 0.11], [0.26, -0.05, 0, 0.08], [-0.25, -0.05, 0.01, 0.08]];
    for (const [x, y, z, r] of puffs) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), this.cloudMat);
      m.position.set(x, y, z);
      m.scale.y = 0.85;
      m.castShadow = true;
      this.cloud.add(m);
    }
    this.group.add(this.cloud);
    this.heart = new THREE.Group();
    const hm = new THREE.MeshStandardMaterial({ color: '#e84a64', roughness: 0.22, metalness: 0.05, emissive: '#5a0c1a', emissiveIntensity: 0.25 });
    const h = new THREE.Mesh(heartGeometry(0.16, 0.1, 0.06), hm);
    h.castShadow = true;
    this.heart.add(h);
    const knot = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.035, 8), hm);
    knot.position.y = -0.17;
    knot.rotation.x = Math.PI;
    this.heart.add(knot);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7 }));
    shine.position.set(-0.08, 0.06, 0.09);
    shine.scale.set(1, 1.6, 0.4);
    this.heart.add(shine);
    this.group.add(this.heart);
    this.rain = new Rain(80, 0.2, 1.5, '#a9c4ec', 0.13);
    this.anchor = new THREE.Vector3(); // bottom point where the string attaches
  }
  update(morph, time) {
    // morph 0 = cloud, 1 = heart
    const c = Math.max(0.0001, 1 - clamp(morph * 3));
    this.cloud.scale.setScalar(c * (1 + Math.sin(time * 1.3) * 0.03));
    this.cloud.visible = c > 0.001;
    const hk = clamp((morph - 0.15) / 0.85);
    const el = hk <= 0 ? 0 : Math.pow(2, -8 * hk) * Math.sin((hk * 10 - 0.75) * 2.094) + 1;
    this.heart.scale.setScalar(Math.max(0.0001, el));
    this.heart.visible = hk > 0;
    this.heart.rotation.z = Math.sin(time * 1.1) * 0.1;
    this.heart.rotation.y = Math.sin(time * 0.7) * 0.35;
    this.group.getWorldPosition(this.anchor);
    this.anchor.y -= morph > 0.5 ? 0.19 : 0.1;
    this.rain.center.set(this.anchor.x, 0.05, this.anchor.z);
    this.rain.h = Math.max(0.2, this.anchor.y - 0.05);
  }
}

// ------------------------------------------------------------ sun & moon
export function makeSun() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(1.1, 32, 16), new THREE.MeshBasicMaterial({ color: '#fff8e8', toneMapped: false }));
  g.add(core);
  const glow = glowSprite("#ffd9a0", 5.5, 0.5);
  g.add(glow);
  g.userData = { core, glow };
  return g;
}

export function makeMoon() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.9, 32, 16), new THREE.MeshBasicMaterial({ color: '#fdf6e6', toneMapped: false }));
  g.add(core);
  const glow = glowSprite('#cfd8ff', 6, 0.5);
  g.add(glow);
  g.userData = { core, glow };
  return g;
}

export function makeRing() {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 8, 24), new THREE.MeshStandardMaterial({ color: '#f2cf7a', metalness: 0.9, roughness: 0.2, emissive: '#5a4210', emissiveIntensity: 0.5 }));
  g.add(ring);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.014, 0), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#d8ecff', emissiveIntensity: 0.9, roughness: 0.1 }));
  gem.position.y = 0.036;
  g.add(gem);
  const glow = glowSprite('#fff4d0', 0.35, 0.9);
  g.add(glow);
  g.userData.glow = glow;
  return g;
}

// motes of dust drifting in the lamplight around the box
export class Dust {
  constructor(n = 140) {
    const R = rng(301);
    this.n = n;
    this.seed = [];
    const pos = new Float32Array(n * 3), ph = new Float32Array(n), al = new Float32Array(n).fill(1), ps = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.seed.push({ x: (R() * 2 - 1) * 6, y: R() * 9 - 1, z: (R() * 2 - 1) * 5 + 1, s: 0.03 + R() * 0.06, p: R() * 10 });
      ph[i] = R();
      ps[i] = 0.4 + R() * 0.8;
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.geo.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
    this.geo.setAttribute('alive', new THREE.BufferAttribute(al, 1));
    this.geo.setAttribute('psize', new THREE.BufferAttribute(ps, 1));
    this.mat = pointsMaterial('#ffe6c2', 55);
    this.mat.uniforms.opacity.value = 0.32;
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
  }
  update(time) {
    const a = this.geo.attributes.position.array;
    for (let i = 0; i < this.n; i++) {
      const q = this.seed[i];
      const y = ((q.y + time * q.s + 1) % 9) - 1;
      a[i * 3] = q.x + Math.sin(time * 0.3 + q.p) * 0.4;
      a[i * 3 + 1] = y;
      a[i * 3 + 2] = q.z + Math.cos(time * 0.25 + q.p) * 0.3;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.mat.uniforms.time.value = time;
  }
}
