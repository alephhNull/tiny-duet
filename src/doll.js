import * as THREE from 'three';
import { mat, lerp, clamp } from './util.js';

// ---------------------------------------------------------------- faces
const FW = 256, FH = 224;
const faceCache = new Map();

function strokeArc(g, x, y, r, a0, a1, w, col) {
  g.beginPath();
  g.arc(x, y, r, a0, a1);
  g.lineWidth = w;
  g.strokeStyle = col;
  g.lineCap = 'round';
  g.stroke();
}

function drawFace(who, expr, blink) {
  const c = document.createElement('canvas');
  c.width = FW;
  c.height = FH;
  const g = c.getContext('2d');
  const cx = 128, ey = 108, ex = 33;
  const her = who === 'her';
  const kid = who === 'kid';
  const ink = '#1b1416';

  // blush
  const blushA = { sad: 0.35, cry: 0.45, soft: 0.5, joy: 0.65, happy: 0.7, surprise: 0.6, love: 0.9, sleep: 0.4 }[expr] ?? 0.5;
  const ba = (her ? 1 : kid ? 0.9 : 0.45) * blushA;
  for (const s of [-1, 1]) {
    const x = cx + s * 54, y = 138;
    const gr = g.createRadialGradient(x, y, 0, x, y, 30);
    gr.addColorStop(0, `rgba(238,104,118,${ba})`);
    gr.addColorStop(1, 'rgba(238,104,118,0)');
    g.fillStyle = gr;
    g.fillRect(x - 32, y - 32, 64, 64);
  }

  // brows
  const browCol = her ? '#17110f' : kid ? '#5a3d2e' : '#1d1612';
  const bw = her ? 7.5 : kid ? 3 : 8;
  for (const s of [-1, 1]) {
    const inner = cx + s * 14, outer = cx + s * 54;
    let iy = 76, oy = 78, peak = 68;
    if (expr === 'sad' || expr === 'cry') { iy = 66; oy = 80; peak = 70; }
    if (expr === 'surprise') { iy = 64; oy = 68; peak = 58; }
    if (expr === 'happy' || expr === 'love' || expr === 'joy') { iy = 74; oy = 76; peak = 66; }
    if (kid) { iy += 6; oy += 6; peak += 6; }
    g.beginPath();
    g.moveTo(inner, iy);
    g.quadraticCurveTo(cx + s * 38, peak, outer, oy);
    g.lineWidth = bw;
    g.strokeStyle = browCol;
    g.lineCap = 'round';
    g.stroke();
  }

  // eyes
  const closedHappy = expr === 'happy' || expr === 'love';
  const closedDown = expr === 'sleep' || blink;
  for (const s of [-1, 1]) {
    const x = cx + s * ex;
    if (closedHappy) {
      strokeArc(g, x, ey + 6, 11, Math.PI * 1.12, Math.PI * 1.88, 4.5, ink);
    } else if (closedDown) {
      strokeArc(g, x, ey - 8, 11, Math.PI * 0.18, Math.PI * 0.82, 4, ink);
      if (her) {
        g.beginPath();
        g.moveTo(x + s * 10, ey);
        g.lineTo(x + s * 20, ey - 6);
        g.lineWidth = 3;
        g.stroke();
      }
    } else {
      const big = expr === 'surprise' ? 1.15 : 1;
      const droop = expr === 'sad' || expr === 'cry' ? 3 : 0;
      g.fillStyle = ink;
      g.beginPath();
      g.ellipse(x, ey + droop * 0.5, 9.5 * big, (12.5 - droop) * big, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.95)';
      g.beginPath();
      g.arc(x - 3, ey - 4, 3.2, 0, Math.PI * 2);
      g.fill();
      if (her) {
        // winged liner + lashes
        g.strokeStyle = ink;
        g.lineCap = 'round';
        g.lineWidth = 3.5;
        g.beginPath();
        g.moveTo(x + s * 8, ey - 6 + droop);
        g.lineTo(x + s * 21, ey - 12 + droop);
        g.stroke();
        g.lineWidth = 2.2;
        g.beginPath();
        g.ellipse(x, ey + droop * 0.5, 11, 14 - droop, 0, Math.PI * 1.05, Math.PI * 1.95);
        g.stroke();
      }
      if (droop) {
        // heavy lid
        g.fillStyle = 'rgba(0,0,0,0)';
      }
    }
  }

  // tears
  if (expr === 'cry') {
    g.fillStyle = 'rgba(140,205,255,0.95)';
    for (const s of [-1, 1]) {
      const x = cx + s * (ex + 4), y = ey + 24;
      g.beginPath();
      g.moveTo(x, y - 8);
      g.quadraticCurveTo(x + 6, y + 2, x, y + 6);
      g.quadraticCurveTo(x - 6, y + 2, x, y - 8);
      g.fill();
    }
  }

  // mouth
  const lip = her ? '#b52f40' : kid ? '#d26a6a' : '#a8645a';
  const my = 160;
  g.fillStyle = lip;
  if (expr === 'sad' || expr === 'cry') {
    strokeArc(g, cx, my + 14, 11, Math.PI * 1.2, Math.PI * 1.8, her ? 5 : 4, lip);
  } else if (expr === 'soft' || expr === 'sleep') {
    strokeArc(g, cx, my - 8, 11, Math.PI * 0.22, Math.PI * 0.78, her ? 5 : 4, lip);
  } else if (expr === 'surprise') {
    g.beginPath();
    g.ellipse(cx, my, 6, 7.5, 0, 0, Math.PI * 2);
    g.fill();
  } else {
    g.beginPath();
    g.arc(cx, my - 4, expr === 'love' ? 11 : 13, 0, Math.PI);
    g.closePath();
    g.fill();
    if (expr !== 'love') {
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.fillRect(cx - 9, my - 4, 18, 3);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function faceTex(who, expr, blink = false) {
  const k = `${who}|${expr}|${blink}`;
  if (!faceCache.has(k)) faceCache.set(k, drawFace(who, expr, blink));
  return faceCache.get(k);
}

const OPEN_EYES = new Set(['sad', 'cry', 'soft', 'joy', 'surprise']);

function faceMesh(r, who) {
  const g = new THREE.SphereGeometry(r * 1.006, 32, 20, Math.PI / 2 - 1.0, 2.0, Math.PI * 0.25, Math.PI * 0.55);
  const m = new THREE.MeshStandardMaterial({
    map: faceTex(who, 'soft'),
    transparent: true,
    roughness: 0.7,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.renderOrder = 2;
  return mesh;
}

// ---------------------------------------------------------------- pose
export function defaultPose() {
  return {
    x: 0, y: 0, z: 0, rotY: 0, scale: 1,
    lean: 0, headTilt: 0, headTurn: 0, headRoll: 0,
    aL: [0, 0.08], aR: [0, 0.08],
    walk: 0, phase: 0, sit: 0, kneel: 0,
    outfit: 0, veil: 0, cap: 1, flare: 1, crown: 0,
  };
}

const SKIN = '#f2d2c0';

export class Doll {
  constructor(kind) {
    this.kind = kind;
    const her = kind === 'her';
    this.pose = defaultPose();
    this.expr = 'soft';
    this.blinkT = 2 + Math.random() * 2;
    this.blinking = 0;
    this.hop = 0;

    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.baseScale = her ? 1.25 : 1.36;
    this.hipH = 0.42;

    const skin = mat(SKIN, { roughness: 0.5 });
    this.skinMat = skin;

    // hips & legs
    this.hips = new THREE.Group();
    this.hips.position.y = this.hipH;
    this.body.add(this.hips);

    const legMat = mat(her ? '#8cc6c9' : '#cdbb9c', { roughness: 0.6 });
    this.legMat = legMat;
    const shoeMat = mat(her ? '#f4f1ec' : '#7a5136', { roughness: 0.4 });
    // thigh + shin with a knee, so sitting and kneeling read naturally
    const lr = her ? 0.036 : 0.044;
    const thighGeo = new THREE.CapsuleGeometry(lr, 0.17, 4, 10);
    thighGeo.translate(0, -0.105, 0);
    const shinGeo = new THREE.CapsuleGeometry(lr * 0.92, 0.17, 4, 10);
    shinGeo.translate(0, -0.1, 0);
    const footGeo = new THREE.SphereGeometry(0.045, 12, 8);
    footGeo.scale(1, 0.6, 1.6);
    footGeo.translate(0, -0.2, 0.025);
    this.legL = new THREE.Group();
    this.legR = new THREE.Group();
    this.shinL = new THREE.Group();
    this.shinR = new THREE.Group();
    for (const [lg, sh, s] of [[this.legL, this.shinL, 1], [this.legR, this.shinR, -1]]) {
      lg.position.x = s * (her ? 0.055 : 0.065);
      lg.add(new THREE.Mesh(thighGeo, legMat));
      sh.position.y = -0.21;
      sh.add(new THREE.Mesh(shinGeo, legMat));
      sh.add(new THREE.Mesh(footGeo, shoeMat));
      lg.add(sh);
      this.hips.add(lg);
    }
    const pelvis = new THREE.Mesh(new THREE.SphereGeometry(her ? 0.12 : 0.135, 16, 10), her ? legMat : legMat);
    pelvis.scale.y = 0.6;
    this.hips.add(pelvis);
    this.pelvis = pelvis;

    // upper body
    this.upper = new THREE.Group();
    this.hips.add(this.upper);
    const topMat = mat(her ? '#8cc6c9' : '#a9c7e3', { roughness: 0.55 });
    this.topMat = topMat;
    const torso = new THREE.Mesh(
      new THREE.CylinderGeometry(her ? 0.1 : 0.135, her ? 0.122 : 0.128, 0.3, 20),
      topMat,
    );
    torso.position.y = 0.15;
    this.upper.add(torso);
    const chestCap = new THREE.Mesh(new THREE.SphereGeometry(her ? 0.1 : 0.135, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), topMat);
    chestCap.scale.y = 0.45;
    chestCap.position.y = 0.3;
    this.upper.add(chestCap);

    if (!her) {
      // shirt collar and a row of buttons
      const collarM = mat('#f6f2ea', { roughness: 0.55 });
      for (const sx of [-1, 1]) {
        const c = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.012, 0.06), collarM);
        c.position.set(sx * 0.04, 0.315, 0.085);
        c.rotation.set(0.5, sx * 0.5, sx * -0.35);
        this.upper.add(c);
      }
      this.flower = new THREE.Group();
      const petal = mat('#f7b3c4', { roughness: 0.5 });
      this.flower.add(new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), petal));
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), mat('#7fb276'));
      leaf.scale.set(1.6, 0.6, 0.6);
      leaf.position.set(-0.02, -0.018, -0.004);
      this.flower.add(leaf);
      this.flower.position.set(0.075, 0.24, 0.125);
      this.upper.add(this.flower);
      const btnM = mat('#f6f2ea', { roughness: 0.3 });
      for (let i = 0; i < 3; i++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 4), btnM);
        b.position.set(0, 0.26 - i * 0.075, 0.132);
        this.upper.add(b);
      }
    }

    // arms
    const armGeo = new THREE.CapsuleGeometry(her ? 0.031 : 0.038, 0.28, 4, 10);
    armGeo.translate(0, -0.17, 0);
    const handGeo = new THREE.SphereGeometry(her ? 0.038 : 0.045, 12, 10);
    handGeo.translate(0, -0.35, 0);
    const sleeveGeo = new THREE.CylinderGeometry(her ? 0.045 : 0.052, her ? 0.042 : 0.047, her ? 0.11 : 0.19, 14);
    sleeveGeo.translate(0, her ? -0.04 : -0.08, 0);
    this.armL = new THREE.Group();
    this.armR = new THREE.Group();
    this.hands = {};
    for (const [ag, s, name] of [[this.armL, 1, 'L'], [this.armR, -1, 'R']]) {
      ag.position.set(s * (her ? 0.125 : 0.162), 0.28, 0);
      ag.add(new THREE.Mesh(armGeo, skin));
      const hand = new THREE.Mesh(handGeo, skin);
      ag.add(hand);
      ag.add(new THREE.Mesh(sleeveGeo, topMat));
      this.hands[name] = hand;
      this.upper.add(ag);
    }

    // neck & head
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.08, 12), skin);
    neck.position.y = 0.33;
    this.upper.add(neck);
    this.head = new THREE.Group();
    this.head.position.y = 0.35;
    this.head.rotation.order = 'YXZ';
    this.upper.add(this.head);
    const R = 0.155;
    this.headR = R;
    const skull = new THREE.Group();
    skull.position.y = 0.15;
    this.head.add(skull);
    this.skull = skull;
    skull.add(new THREE.Mesh(new THREE.SphereGeometry(R, 32, 24), skin));
    this.face = faceMesh(R, kind);
    skull.add(this.face);
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), skin);
      ear.scale.set(0.6, 1, 0.8);
      ear.position.set(s * R * 0.98, -0.01, 0);
      skull.add(ear);
    }

    const hairMat = mat(her ? '#15141b' : '#1d1713', { roughness: 0.55 });
    this.hairMat = hairMat;
    if (her) this.buildHerHair(skull, R, hairMat);
    else this.buildHisHair(skull, R, hairMat);

    if (her) {
      // pearl earrings + necklace
      const pearl = mat('#fbf8f3', { roughness: 0.25 });
      for (const s of [-1, 1]) {
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), pearl);
        e.position.set(s * R * 0.99, -0.045, 0.01);
        skull.add(e);
      }
      const neckl = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.007, 6, 24), pearl);
      neckl.rotation.x = Math.PI / 2 - 0.25;
      neckl.position.set(0, 0.315, 0.012);
      this.upper.add(neckl);
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.014, 0), pearl);
      star.position.set(0, 0.29, 0.06);
      this.upper.add(star);

      // nurse cap
      this.capG = new THREE.Group();
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.055, 0.09), mat('#ffffff', { roughness: 0.6 }));
      this.capG.add(cap);
      const red = mat('#e0505a');
      const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.01, 0.011), red);
      const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.032, 0.011), red);
      c1.position.z = c2.position.z = 0.046;
      this.capG.add(c1, c2);
      this.capG.position.set(0, R * 0.93, 0.045);
      this.capG.rotation.x = -0.35;
      skull.add(this.capG);

      // skirt (rebuilt each frame for length / flare / sway)
      this.skirtGeo = new THREE.CylinderGeometry(1, 1, 1, 32, 4, true);
      this.skirtBase = this.skirtGeo.attributes.position.array.slice();
      this.skirt = new THREE.Mesh(this.skirtGeo, topMat);
      this.skirt.material = topMat.clone();
      this.skirt.material.side = THREE.DoubleSide;
      this.skirtMat = this.skirt.material;
      this.skirt.position.y = 0.06;
      this.hips.add(this.skirt);

      // veil + flower crown
      this.veilG = new THREE.Group();
      const veilGeo = new THREE.CylinderGeometry(0.09, 0.36, 0.95, 32, 6, true, Math.PI * 0.42, Math.PI * 1.16);
      veilGeo.translate(0, -0.475, 0);
      const veilMat = new THREE.MeshStandardMaterial({
        color: '#ffffff', transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false, roughness: 0.9,
      });
      const veil = new THREE.Mesh(veilGeo, veilMat);
      veil.rotation.x = 0.12;
      this.veilG.add(veil);
      this.veilG.position.set(0, R * 0.75, -0.05);
      skull.add(this.veilG);
      this.crown = new THREE.Group();
      const fl = [mat('#ffffff', { roughness: 0.5 }), mat('#f7b9c8', { roughness: 0.5 }), mat('#ffe6a8')];
      for (let i = 0; i < 11; i++) {
        const a = (i / 11) * Math.PI * 2;
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), fl[i % 3]);
        b.position.set(Math.cos(a) * R * 0.86, 0, Math.sin(a) * R * 0.86);
        this.crown.add(b);
      }
      this.crown.position.y = R * 0.55;
      this.crown.rotation.x = -0.25;
      skull.add(this.crown);
    }

    this.root.traverse((o) => {
      if (o.isMesh && o !== this.face) o.castShadow = true;
    });
    if (this.veilG) this.veilG.traverse((o) => (o.castShadow = false));

    this.outfitCols = [new THREE.Color('#8cc6c9'), new THREE.Color('#f3b7ae'), new THREE.Color('#fbf7f1')];
    this.tmpC = new THREE.Color();
  }

  buildHerHair(skull, R, m) {
    const top = new THREE.Mesh(new THREE.SphereGeometry(R * 1.065, 32, 12, 0, Math.PI * 2, 0, Math.PI * 0.3), m);
    skull.add(top);
    const sides = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.055, 32, 16, Math.PI / 2 + 0.62, Math.PI * 2 - 1.24, 0, Math.PI * 0.72),
      m,
    );
    skull.add(sides);
    // long straight hair down the back
    const back = new THREE.Mesh(new THREE.CapsuleGeometry(0.155, 0.36, 6, 16), m);
    back.scale.set(1, 1, 0.42);
    back.position.set(0, -0.22, -0.06);
    skull.add(back);
    // the two front strands framing her face
    for (const s of [-1, 1]) {
      const st = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.3, 4, 8), m);
      st.scale.set(1, 1, 0.6);
      st.position.set(s * R * 0.83, -0.15, 0.065);
      st.rotation.z = s * 0.05;
      skull.add(st);
    }
    // middle part
    const part = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.003, 0.09), mat('#e9c9b8'));
    part.position.set(0, R * 1.064, 0.05);
    part.rotation.x = 0.35;
    skull.add(part);
  }

  buildHisHair(skull, R, m) {
    // short dark hair: close at the sides, fuller on top and pushed up at the front
    const top = new THREE.Mesh(new THREE.SphereGeometry(R * 1.06, 32, 12, 0, Math.PI * 2, 0, Math.PI * 0.33), m);
    skull.add(top);
    const back = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.04, 32, 16, Math.PI / 2 + 0.85, Math.PI * 2 - 1.7, 0, Math.PI * 0.52),
      m,
    );
    skull.add(back);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(R * 0.86, 24, 12), m);
    crown.scale.set(1.08, 0.42, 1.0);
    crown.position.set(0, R * 0.82, -0.005);
    skull.add(crown);
    const quiff = new THREE.Mesh(new THREE.SphereGeometry(R * 0.5, 20, 10), m);
    quiff.scale.set(1.5, 0.55, 0.75);
    quiff.position.set(-0.012, R * 0.86, R * 0.55);
    quiff.rotation.z = 0.08;
    skull.add(quiff);
    for (const [x, z, r] of [[-0.07, 0.07, 0.05], [0.06, 0.08, 0.045], [0.0, 0.11, 0.045]]) {
      const t = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), m);
      t.scale.y = 0.6;
      t.position.set(x, R * 0.9, z);
      skull.add(t);
    }
  }

  setExpr(e) {
    this.expr = e;
  }

  handWorld(side, out) {
    return this.hands[side].getWorldPosition(out);
  }

  update(dt, time) {
    const p = this.pose;
    const her = this.kind === 'her';

    // blink
    this.blinkT -= dt;
    if (this.blinkT < 0) {
      this.blinking = 0.13;
      this.blinkT = 2.4 + Math.random() * 3;
    }
    this.blinking -= dt;
    const blink = this.blinking > 0 && OPEN_EYES.has(this.expr);
    const tex = faceTex(this.kind, this.expr, blink);
    if (this.face.material.map !== tex) {
      this.face.material.map = tex;
      this.face.material.needsUpdate = true;
    }

    // hop (tap reaction)
    this.hop = Math.max(0, this.hop - dt * 2.2);
    const hopY = Math.sin(this.hop * Math.PI) * 0.18;

    const ph = p.phase;
    const sw = Math.sin(ph);
    const bob = p.walk * Math.abs(Math.cos(ph)) * 0.035;
    this.root.position.set(p.x, p.y + bob + hopY, p.z);
    this.root.rotation.y = p.rotY;
    this.root.scale.setScalar(Math.max(0.0001, p.scale * this.baseScale));

    const sitDrop = p.sit * (this.hipH - 0.29);
    const kneelDrop = p.kneel * 0.15;
    this.hips.position.y = this.hipH - sitDrop - kneelDrop;
    this.legL.rotation.x = sw * 0.55 * p.walk - 1.5 * p.sit - 1.45 * p.kneel;
    this.legR.rotation.x = -sw * 0.55 * p.walk - 1.5 * p.sit + 0.25 * p.kneel;
    // knees bend on the back-swing, when seated and when kneeling
    this.shinL.rotation.x = Math.max(0, -Math.cos(ph)) * 0.7 * p.walk + 1.45 * p.sit + 1.45 * p.kneel;
    this.shinR.rotation.x = Math.max(0, Math.cos(ph)) * 0.7 * p.walk + 1.45 * p.sit + 1.3 * p.kneel;

    this.upper.rotation.x = p.lean + p.walk * 0.05;
    this.upper.rotation.z = Math.sin(ph) * 0.03 * p.walk;
    const swing = -sw * 0.45 * p.walk;
    this.armL.rotation.set(p.aL[0] + swing, 0, p.aL[1]);
    this.armR.rotation.set(p.aR[0] - swing, 0, -p.aR[1]);
    this.head.rotation.set(p.headTilt, p.headTurn, p.headRoll);

    if (this.flower) {
      this.flower.scale.setScalar(Math.max(0.0001, p.crown));
      this.flower.visible = p.crown > 0.01;
    }
    if (her) {
      // outfit colour: 0 scrubs, 1 blush dress, 2 white
      const o = clamp(p.outfit, 0, 2);
      const c = this.tmpC;
      if (o <= 1) c.copy(this.outfitCols[0]).lerp(this.outfitCols[1], o);
      else c.copy(this.outfitCols[1]).lerp(this.outfitCols[2], o - 1);
      this.topMat.color.copy(c);
      this.skirtMat.color.copy(c);
      this.pelvis.material.color.copy(c);
      const legSkin = clamp(o);
      this.legMat.color.copy(this.outfitCols[0]).lerp(new THREE.Color(SKIN), legSkin);

      const len = lerp(0.2, 0.43, clamp(o)) + (o > 1 ? (o - 1) * 0.03 : 0);
      const botR = lerp(0.17, 0.27, clamp(o)) * p.flare;
      const topR = 0.122;
      const arr = this.skirtGeo.attributes.position.array;
      const base = this.skirtBase;
      const swayX = Math.sin(ph) * 0.03 * p.walk;
      const twirl = (p.flare - 1) * 0.6;
      for (let i = 0; i < arr.length; i += 3) {
        const bx = base[i], by = base[i + 1], bz = base[i + 2];
        const h = 0.5 - by; // 0 top .. 1 bottom
        const ang = Math.atan2(bz, bx);
        const wave = 1 + Math.sin(ang * 6 + time * 3) * 0.04 * h * (p.walk + twirl);
        const r = lerp(topR, botR, Math.pow(h, 0.85)) * wave;
        arr[i] = Math.cos(ang) * r + swayX * h;
        arr[i + 2] = Math.sin(ang) * r;
        arr[i + 1] = -h * len + (p.sit > 0 ? 0 : 0);
      }
      this.skirtGeo.attributes.position.needsUpdate = true;
      this.skirtGeo.computeVertexNormals();
      // sitting: drape skirt forward over the legs
      this.skirt.rotation.x = -p.sit * 0.9;

      this.capG.scale.setScalar(Math.max(0.0001, p.cap));
      this.capG.visible = p.cap > 0.01;
      this.veilG.scale.set(1, Math.max(0.0001, p.veil), 1);
      this.veilG.visible = p.veil > 0.01;
      this.crown.scale.setScalar(Math.max(0.0001, p.crown));
      this.crown.visible = p.crown > 0.01;
    }
  }
}

// ---------------------------------------------------------------- small children figures
const KID_COLS = [
  { shirt: '#f6c4c4', hair: '#4a3328', balloon: '#ff8fa3' },
  { shirt: '#bfe3d5', hair: '#24201e', balloon: '#ffd36e' },
  { shirt: '#f7e0a3', hair: '#7a4b2c', balloon: '#8fc8ff' },
  { shirt: '#f9cfd8', hair: '#15141b', balloon: '#e84a64', girl: true },
];
export { KID_COLS };

export class Kid {
  constructor(i) {
    const c = KID_COLS[i % KID_COLS.length];
    this.root = new THREE.Group();
    this.pivot = new THREE.Group();
    this.root.add(this.pivot);
    const skin = mat(SKIN, { roughness: 0.6 });
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.2, 16), mat(c.shirt));
    body.position.y = 0.1;
    this.pivot.add(body);
    this.head = new THREE.Group();
    this.head.position.y = 0.26;
    this.pivot.add(this.head);
    const r = 0.075;
    this.head.add(new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), skin));
    const hair = new THREE.Mesh(new THREE.SphereGeometry(r * 1.07, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), mat(c.hair));
    hair.rotation.x = -0.25;
    this.head.add(hair);
    this.face = faceMesh(r, 'kid');
    this.head.add(this.face);
    if (c.girl) {
      // her mother's black hair, in two little pigtails, and a fuller dress
      const hm = mat(c.hair, { roughness: 0.55 });
      const back = new THREE.Mesh(new THREE.SphereGeometry(r * 1.06, 20, 12, Math.PI / 2 + 0.7, Math.PI * 2 - 1.4, 0, Math.PI * 0.62), hm);
      this.head.add(back);
      for (const sx of [-1, 1]) {
        const pt = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), hm);
        pt.scale.set(0.8, 1.3, 0.8);
        pt.position.set(sx * r * 1.05, -0.01, -0.02);
        this.head.add(pt);
        const bow = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), mat('#e84a64'));
        bow.position.set(sx * r * 0.98, 0.025, -0.01);
        this.head.add(bow);
      }
      const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.16, 20, 1, true), mat(c.shirt));
      skirt.position.y = 0.08;
      this.pivot.add(skirt);
    }
    this.arms = [];
    for (const s of [-1, 1]) {
      const a = new THREE.Group();
      a.position.set(s * 0.05, 0.17, 0);
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.08, 3, 6), skin);
      m.position.y = -0.055;
      a.add(m);
      a.rotation.z = s * 0.3;
      this.pivot.add(a);
      this.arms.push(a);
    }
    this.root.traverse((o) => {
      if (o.isMesh && o !== this.face) o.castShadow = true;
    });
    this.expr = 'sleep';
    this.balloonColor = c.balloon;
  }
  setExpr(e) {
    if (e === this.expr) return;
    this.expr = e;
    this.face.material.map = faceTex('kid', e);
    this.face.material.needsUpdate = true;
  }
}
