import * as THREE from 'three';
import { mat, heartGeometry, glowSprite, clamp, rng } from './util.js';

export const FLOOR_Y = 0.06;
export const DISC_R = 3.02;
export const KEY_A = 1.05; // the winding key sits on the right side of the drum
export const LID_OPEN = 1.74; // radians the lid swings back on its hinge
const TEETH = 22;

// painted sky inside the lid
const skyVert = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} ';
const skyFrag = `
uniform vec3 top; uniform vec3 bottom; uniform vec3 glow; uniform vec3 sunCol;
uniform vec2 sun; uniform float sunOn; uniform vec2 moon; uniform float moonOn;
uniform float stars; uniform float time; uniform float pulse; uniform float overcast; uniform float bright;
uniform float clouds; uniform vec3 cloudCol;
varying vec2 vUv;
uniform sampler2D noiseTex;
// cheap arithmetic hash (no sin), friendly to phone GPUs
float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main(){
  vec2 p = vUv*2.0-1.0;
  float h = clamp(p.y*0.5+0.5, 0.0, 1.0);
  vec3 c = mix(bottom, top, smoothstep(0.08, 0.92, h));
  float sd = length(p - sun);
  c += glow * exp(-sd*sd*2.2) * 0.6;
  c = mix(c, sunCol * 2.6, sunOn * smoothstep(0.17, 0.155, sd));
  c += sunCol * sunOn * exp(-sd*5.0) * 0.3;
  float md = length(p - moon);
  float md2 = length(p - moon - vec2(0.055, 0.035));
  float mo = smoothstep(0.115, 0.105, md) * smoothstep(0.095, 0.11, md2);
  c = mix(c, vec3(0.99,0.95,0.84) * 2.3, mo*moonOn);
  c += vec3(0.65,0.7,1.0) * exp(-md*6.0) * 0.22 * moonOn;
  vec2 g = p*16.0; vec2 id = floor(g); vec2 f = fract(g)-0.5;
  float r = hash(id);
  vec2 off = vec2(hash(id+3.1), hash(id+7.7))-0.5;
  float sz = 0.05 + 0.09*hash(id+1.3);
  float st = smoothstep(sz, 0.0, length(f - off*0.6)) * step(r, stars) * step(0.5, hash(id+9.1));
  float tw = 0.55 + 0.45*sin(time*2.0 + r*40.0);
  c += vec3(1.0,0.96,0.86) * 2.2 * st * tw * (1.0+pulse*0.6) * smoothstep(-0.45, 0.1, p.y);
  // painted clouds drifting across
  if (clouds > 0.01) {
    vec2 cp = vec2(p.x*0.35 + time*0.008, p.y*0.65 - 0.1);
    float cl = texture2D(noiseTex, cp).r * 0.65 + texture2D(noiseTex, cp*2.1 + vec2(time*0.004, 0.3)).r * 0.35;
    float cm = smoothstep(0.56 - clouds*0.2, 0.72, cl) * clouds * smoothstep(-0.75, -0.1, p.y);
    float lit = smoothstep(0.5, 0.75, texture2D(noiseTex, cp + vec2(0.0, 0.02)).r);
    vec3 cc = mix(cloudCol * 1.12, cloudCol * 0.78, lit);
    c = mix(c, cc, cm * 0.92);
  }
  c = mix(c, c*0.82 + vec3(0.025), overcast * (0.5+0.5*sin(p.y*26.0 + p.x*4.0 + time*0.3)) * 0.22);
  c *= mix(1.0, 0.8, smoothstep(0.78, 1.0, length(p)));
  c += (hash(floor(vUv*420.0)) - 0.5) * 0.018;
  gl_FragColor = vec4(c*bright, 1.0);
  #include <colorspace_fragment>
}`;

// soft, tileable cloud noise baked once on the CPU, so the sky shader only samples a texture
function cloudNoise(size = 128) {
  const R = rng(17);
  const data = new Uint8Array(size * size * 4);
  const octaves = [[4, 0.5], [8, 0.25], [16, 0.13], [32, 0.07], [64, 0.05]];
  const lattices = octaves.map(([n]) => Array.from({ length: n * n }, () => R()));
  const sm = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0;
      octaves.forEach(([n, a], o) => {
        const L = lattices[o];
        const fx = (x / size) * n, fy = (y / size) * n;
        const ix = Math.floor(fx), iy = Math.floor(fy);
        const tx = sm(fx - ix), ty = sm(fy - iy);
        const g = (i, j) => L[((j % n) + n) % n * n + (((i % n) + n) % n)];
        const top = g(ix, iy) + (g(ix + 1, iy) - g(ix, iy)) * tx;
        const bot = g(ix, iy + 1) + (g(ix + 1, iy + 1) - g(ix, iy + 1)) * tx;
        v += (top + (bot - top) * ty) * a;
      });
      const k = (y * size + x) * 4;
      data[k] = data[k + 1] = data[k + 2] = Math.round(Math.min(1, v) * 255);
      data[k + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, size, size);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

export class MusicBox {
  constructor() {
    this.group = new THREE.Group();
    const gold = new THREE.MeshStandardMaterial({ color: '#dcb46c', metalness: 0.85, roughness: 0.28 });
    this.gold = gold;
    const porcelain = mat('#efe6da', { roughness: 0.38 });
    this.porcelain = porcelain;
    const d = new THREE.Object3D();

    // the table it stands on
    const tc = document.createElement('canvas');
    tc.width = tc.height = 512;
    const tg2 = tc.getContext('2d');
    const tgr = tg2.createRadialGradient(256, 256, 0, 256, 256, 256);
    tgr.addColorStop(0, '#8a6c6a');
    tgr.addColorStop(0.1, '#6e5455');
    tgr.addColorStop(0.24, '#3e3036');
    tgr.addColorStop(0.5, '#231d25');
    tgr.addColorStop(1, '#1c1820');
    tg2.fillStyle = tgr;
    tg2.fillRect(0, 0, 512, 512);
    const tt = new THREE.CanvasTexture(tc);
    tt.colorSpace = THREE.SRGBColorSpace;
    const table = new THREE.Mesh(new THREE.CircleGeometry(40, 64), mat('#ffffff', { roughness: 0.75, map: tt }));
    table.rotation.x = -Math.PI / 2;
    table.position.y = -1.335;
    table.receiveShadow = true;
    this.table = table;
    this.group.add(table);

    // drum
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(3.25, 3.3, 1.1, 96, 1), porcelain);
    drum.position.y = -0.55;
    drum.receiveShadow = true;
    drum.castShadow = true;
    this.group.add(drum);
    const ring = (r, tube, y) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 10, 128), gold);
      m.rotation.x = Math.PI / 2;
      m.position.y = y;
      this.group.add(m);
    };
    ring(3.26, 0.05, -0.02);
    ring(3.31, 0.075, -1.1);
    ring(3.285, 0.018, -0.9);
    // pearl beads along the top
    const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 10, 8), mat('#fbf6ee', { roughness: 0.25 }), 120);
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * Math.PI * 2;
      d.position.set(Math.cos(a) * 3.285, -0.17, Math.sin(a) * 3.285);
      d.updateMatrix();
      beads.setMatrixAt(i, d.matrix);
    }
    this.group.add(beads);
    // feet
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), gold);
      f.scale.y = 0.7;
      f.position.set(Math.cos(a) * 2.6, -1.18, Math.sin(a) * 2.6);
      f.castShadow = true;
      this.group.add(f);
    }
    // soft contact shadow
    const sc = document.createElement('canvas');
    sc.width = sc.height = 128;
    const g = sc.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 20, 64, 64, 64);
    gr.addColorStop(0, 'rgba(0,0,0,0.6)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 9.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -1.33;
    this.group.add(shadow);

    // rotating stage
    this.disc = new THREE.Group();
    this.group.add(this.disc);
    this.stageMat = mat('#c9d6dc', { roughness: 0.8 });
    const stage = new THREE.Mesh(new THREE.CylinderGeometry(DISC_R, DISC_R, 0.08, 96), this.stageMat);
    stage.position.y = FLOOR_Y - 0.04;
    stage.receiveShadow = true;
    this.disc.add(stage);
    this.pathMat = mat('#dfe7ea', { roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -1 });
    const path = new THREE.Mesh(new THREE.RingGeometry(1.22, 1.88, 128, 1), this.pathMat);
    path.rotation.x = -Math.PI / 2;
    path.position.y = FLOOR_Y + 0.002;
    path.receiveShadow = true;
    this.disc.add(path);
    const dashes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 0.004, 0.16), mat('#ffffff', { roughness: 0.9, transparent: true, opacity: 0.35 }), 48);
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      d.position.set(Math.sin(a) * 1.55, FLOOR_Y + 0.004, Math.cos(a) * 1.55);
      d.rotation.set(0, a + Math.PI / 2, 0);
      d.updateMatrix();
      dashes.setMatrixAt(i, d.matrix);
    }
    dashes.receiveShadow = true;
    this.disc.add(dashes);

    this.buildLid(gold, porcelain);
    this.buildKey(gold);
    this.buildWindow(gold, porcelain);
  }

  // ------------------------------------------------------------ hinged lid with a painted sky inside
  buildLid(gold, porcelain) {
    this.lidHinge = new THREE.Group();
    this.lidHinge.position.set(0, 0.0, -3.3);
    this.group.add(this.lidHinge);
    this.lid = new THREE.Group();
    this.lid.position.z = 3.3;
    this.lidHinge.add(this.lid);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.32, 0.26, 96), porcelain);
    top.position.y = 0.13;
    top.castShadow = true;
    top.receiveShadow = true;
    this.lid.add(top);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(3.3, 96, 12, 0, Math.PI * 2, 0, 0.16), porcelain);
    dome.position.y = 0.26 - 3.3 * Math.cos(0.16);
    dome.castShadow = true;
    this.lid.add(dome);
    for (const y of [0.26, 0.0]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(3.32, 0.055, 10, 128), gold);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = y;
      this.lid.add(rim);
    }
    // gold hinges at the back
    for (const x of [-0.9, 0.9]) {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 16), gold);
      h.rotation.z = Math.PI / 2;
      h.position.set(x, 0.02, -3.3);
      this.lid.add(h);
    }
    // heart emblem
    const heart = new THREE.Mesh(heartGeometry(0.42, 0.06, 0.05), gold);
    heart.rotation.x = -Math.PI / 2;
    heart.position.set(0, 0.33, 0.1);
    this.lid.add(heart);
    this.heartGlow = glowSprite('#ffd7a8', 2.2, 0);
    this.heartGlow.position.set(0, 0.5, 0.1);
    this.lid.add(this.heartGlow);
    // progress ring (winding)
    this.progMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { p: { value: 0 }, a: { value: 1 } },
      vertexShader: 'varying vec2 vU; void main(){ vU = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
      fragmentShader: `uniform float p; uniform float a; varying vec2 vU;
        void main(){ float ang = atan(vU.x, vU.y); ang = ang < 0.0 ? ang + 6.2831853 : ang; float f = ang/6.2831853;
        float on = step(f, p);
        vec3 c = mix(vec3(0.72,0.58,0.38), vec3(0.98,0.8,0.45), on);
        gl_FragColor = vec4(c, mix(0.22, 1.0, on) * a);
        #include <colorspace_fragment>
        }`,
    });
    const pr = new THREE.Mesh(new THREE.RingGeometry(2.35, 2.45, 128), this.progMat);
    pr.rotation.x = -Math.PI / 2;
    pr.rotation.z = Math.PI;
    pr.position.y = 0.33;
    this.lid.add(pr);
    // the painted sky on the inside of the lid
    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: skyVert,
      fragmentShader: skyFrag,
      uniforms: {
        top: { value: new THREE.Color('#1c2443') }, bottom: { value: new THREE.Color('#34436a') },
        glow: { value: new THREE.Color('#000000') }, sunCol: { value: new THREE.Color('#fff4dc') },
        sun: { value: new THREE.Vector2(0, -2) }, sunOn: { value: 0 },
        moon: { value: new THREE.Vector2(0, -2) }, moonOn: { value: 0 },
        stars: { value: 0 }, time: { value: 0 }, pulse: { value: 0 }, overcast: { value: 0 }, bright: { value: 1 },
        clouds: { value: 0 }, cloudCol: { value: new THREE.Color('#ffffff') }, noiseTex: { value: cloudNoise() },
      },
    });
    const sky = new THREE.Mesh(new THREE.CircleGeometry(3.24, 96), this.skyMat);
    sky.rotation.x = Math.PI / 2;
    sky.position.y = -0.006;
    this.lid.add(sky);
    this.sky = sky;
  }

  // ------------------------------------------------------------ winding key on the side
  buildKey(gold) {
    this.key = new THREE.Group();
    this.key.position.set(Math.sin(KEY_A) * 3.27, -0.5, Math.cos(KEY_A) * 3.27);
    this.key.rotation.y = KEY_A;
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.06, 24), gold);
    collar.rotation.x = Math.PI / 2;
    collar.position.z = 0.03;
    this.key.add(collar);
    this.keySpin = new THREE.Group();
    this.key.add(this.keySpin);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.34, 16), gold);
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = 0.17;
    this.keySpin.add(shaft);
    const bow = new THREE.Mesh(heartGeometry(0.4, 0.08, 0.045), gold);
    bow.position.set(0, 0.04, 0.4);
    this.keySpin.add(bow);
    this.bow = bow;
    const hole = new THREE.Mesh(heartGeometry(0.15, 0.09, 0.02), mat('#2a2320'));
    hole.position.set(0, 0.07, 0.41);
    this.keySpin.add(hole);
    this.key.traverse((o) => (o.castShadow = true));
    this.group.add(this.key);

    // turning hint: a soft circular arrow around the key
    this.hint = new THREE.Group();
    this.hint.position.z = 0.48;
    this.hintMat = new THREE.MeshBasicMaterial({ color: '#c99a4a', transparent: true, opacity: 0, depthWrite: false });
    this.hintSpin = new THREE.Group();
    this.hintSpin.add(new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.024, 8, 64, Math.PI * 1.45), this.hintMat));
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.17, 16), this.hintMat);
    head.position.set(0.66, -0.06, 0);
    head.rotation.z = Math.PI;
    this.hintSpin.add(head);
    this.hint.add(this.hintSpin);
    this.key.add(this.hint);
  }

  // ------------------------------------------------------------ the little window onto the comb and cylinder
  buildWindow(gold, porcelain) {
    const w = new THREE.Group();
    w.position.set(0, -0.55, 3.24);
    this.group.add(w);
    const W = 1.5, H = 0.58, D = 0.26;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat('#2a2023', { roughness: 0.9 }));
    back.position.z = 0.03;
    w.add(back);
    // little porcelain casing around the bay
    const sideM = porcelain;
    for (const [x, y, sx, sy] of [[-W / 2 - 0.03, 0, 0.06, H + 0.06], [W / 2 + 0.03, 0, 0.06, H + 0.06], [0, H / 2 + 0.03, W + 0.12, 0.06], [0, -H / 2 - 0.03, W + 0.12, 0.06]]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, D), sideM);
      b.position.set(x, y, D / 2);
      w.add(b);
    }
    // gold frame
    for (const [x, y, sx, sy] of [[-W / 2 - 0.03, 0, 0.07, H + 0.13], [W / 2 + 0.03, 0, 0.07, H + 0.13], [0, H / 2 + 0.03, W + 0.13, 0.07], [0, -H / 2 - 0.03, W + 0.13, 0.07]]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, 0.04), gold);
      b.position.set(x, y, D + 0.01);
      w.add(b);
    }
    // brass cylinder with pins
    const brass = new THREE.MeshStandardMaterial({ color: '#d4a75a', metalness: 0.9, roughness: 0.3 });
    const steel = new THREE.MeshStandardMaterial({ color: '#d9dde3', metalness: 0.9, roughness: 0.22 });
    this.cyl = new THREE.Group();
    this.cyl.position.set(0, 0.07, 0.13);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.22, 32), brass);
    c.rotation.z = Math.PI / 2;
    this.cyl.add(c);
    for (const x of [-0.64, 0.64]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 24), brass);
      cap.rotation.z = Math.PI / 2;
      cap.position.x = x;
      this.cyl.add(cap);
    }
    const R = rng(5);
    const d = new THREE.Object3D();
    const pins = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.006, 0.006, 0.03, 4), steel, 140);
    for (let i = 0; i < 140; i++) {
      const a = R() * Math.PI * 2;
      const x = -0.55 + Math.floor(R() * TEETH) * (1.1 / (TEETH - 1));
      d.position.set(x, Math.cos(a) * 0.11, Math.sin(a) * 0.11);
      d.rotation.set(a, 0, 0);
      d.updateMatrix();
      pins.setMatrixAt(i, d.matrix);
    }
    this.cyl.add(pins);
    w.add(this.cyl);
    // the comb
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.06, 0.12), steel);
    base.position.set(0, -0.21, 0.12);
    w.add(base);
    this.teeth = [];
    this.toothV = new Float32Array(TEETH);
    const tg = new THREE.BoxGeometry(0.034, 0.15, 0.012);
    tg.translate(0, 0.075, 0);
    for (let i = 0; i < TEETH; i++) {
      const t = new THREE.Mesh(tg, steel);
      t.position.set(-0.55 + i * (1.1 / (TEETH - 1)), -0.19, 0.16);
      t.rotation.x = -0.25;
      t.scale.y = 1 - (i / TEETH) * 0.18;
      w.add(t);
      this.teeth.push({ m: t, age: 9, amp: 0 });
    }
    // glass
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.1, roughness: 0.05, metalness: 0.2, depthWrite: false }));
    glass.position.z = D;
    w.add(glass);
    const shine = new THREE.Mesh(new THREE.PlaneGeometry(0.12, H * 1.1), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.12, depthWrite: false }));
    shine.position.set(-0.35, 0, D + 0.003);
    shine.rotation.z = -0.5;
    w.add(shine);
    this.windowGroup = w;
  }

  pluck(pc, strength) {
    // map the note to a tooth (low notes left, high notes right) with a little spread
    const i = Math.min(TEETH - 1, Math.max(0, Math.round((pc / 11) * (TEETH - 4)) + Math.floor(Math.random() * 4)));
    const t = this.teeth[i];
    t.age = 0;
    t.amp = 0.12 + strength * 0.25;
  }

  updateMechanism(dt, cylAngle) {
    this.cyl.rotation.x = cylAngle;
    for (const t of this.teeth) {
      t.age += dt;
      t.m.rotation.x = -0.25 + Math.sin(t.age * 70) * t.amp * Math.exp(-t.age * 9);
    }
  }

  setHint(alpha, time) {
    this.hint.visible = alpha > 0.01;
    this.hintMat.opacity = alpha * 0.9;
    this.hintSpin.rotation.z = -time * 1.6;
    this.hint.scale.setScalar(1 + Math.sin(time * 3.2) * 0.03);
  }

  // lid: 0 closed, 1 open (standing behind the stage like a painted backdrop)
  setLid(open, progress = 0, ringAlpha = 1) {
    this.lidHinge.rotation.x = -open * LID_OPEN;
    this.progMat.uniforms.p.value = progress;
    this.progMat.uniforms.a.value = ringAlpha * (1 - clamp(open * 3));
    this.sky.visible = open > 0.02;
  }
}
