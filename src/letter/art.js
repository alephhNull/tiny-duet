// A page torn from a notebook, already written on in crayon: the words on top, and below them a
// child's drawing of the two of them holding hands, with Koko. The lines "boil" gently like
// hand-drawn animation, and a few things move.
import { rng } from '../util.js';

export const PW = 900, PH = 1260; // design space of the page
const SCALE = 0.84; // canvas resolution relative to the design space

export const COLORS = {
  ink: '#3d3b8e',
  crimson: '#c8324a',
  sepia: '#8a5a3c',
  hair: '#2a2630',
  skin: '#f2b896',
  pink: '#f27aa6',
  pinkDark: '#d94f86',
  blue: '#7fb3e6',
  blueDark: '#4a86c8',
  tan: '#d9b58a',
  brown: '#8a5a3c',
  red: '#e8333f',
  green: '#5fb85a',
  yellow: '#ffc93c',
  orange: '#f08a1c',
  sky: '#8ec5ff',
  violet: '#9a6ad8',
  wine: '#b8264a',
  koko: '#9c9ca4',
  kokoDark: '#4f5058',
  kokoLight: '#d8d6d8',
  rainbow: ['#f6a5b8', '#f9d48a', '#fff19a', '#a8e6b4', '#a9c8f5', '#c9b3ef'],
};

// the words, in a plain letter font; a line can be split into coloured words.
// The last two lines are the sign-off, set apart and to the left like the end of a letter.
export const FONT = 'Vazirmatn';
const LINES = [
  { y: 168, size: 56, weight: 600, parts: [['دلبر شیرینم،', COLORS.crimson]] },
  { y: 238, size: 46, parts: [['این نامه رو با کوکو نوشتیم', COLORS.ink]] },
  { y: 300, size: 46, parts: [['که یادآوری کنیم که', COLORS.ink]] },
  { y: 364, size: 50, weight: 600, parts: [['شاد باش،', COLORS.orange], ['بنوش،', COLORS.wine], ['بخند،', COLORS.pinkDark], ['برقص،', COLORS.violet]] },
  { y: 426, size: 46, parts: [['حتی اگه عمر پروانه کوتاهه', COLORS.ink]] },
  { y: 532, size: 44, align: 'left', parts: [['به سلامتی عشق و شادی،', COLORS.ink]] },
  { y: 594, size: 50, weight: 600, align: 'left', parts: [['دوست داریم.', COLORS.crimson]] },
];
// Saadi's couplet: a quiet postscript in soft pencil, set apart from the playful crayon
const COUPLET = ['دگرش چو بازبینی غم دل مگوی سعدی', 'که شب وصال کوتاه و سخن دراز باشد'];
export const ALL_TEXT = LINES.map((l) => l.parts.map((p) => p[0]).join(' ')).join(' ') + COUPLET.join(' ');
const RIGHT = 790, LEFT = 120;

// the picture was designed at full size; it's shrunk into the space under the words
const PIC = { s: 0.6, ox: 450, oy: 1176 };
const toPage = ([x, y]) => [PIC.ox + (x - PIC.ox) * PIC.s, PIC.oy + (y - PIC.oy) * PIC.s];

// ------------------------------------------------------------------ geometry helpers
const circle = (cx, cy, r, n = 28, wob = 0, seed = 1) => {
  const R = rng(seed);
  const pts = [];
  const a0 = R() * 6.28;
  for (let i = 0; i <= n; i++) {
    const a = a0 + (i / n) * Math.PI * 2.08;
    const rr = r * (1 + (R() - 0.5) * wob);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return pts;
};
const ellipse = (cx, cy, rx, ry, n = 32) => {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2.05 - Math.PI / 2;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return pts;
};
const poly = (...p) => p;
const closed = (p) => [...p, p[0], p[1] || p[0]];
const heartPts = (cx, cy, s) => {
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const t = (i / 40) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    pts.push([cx + (x / 17) * s, cy + (y / 17) * s]);
  }
  return pts;
};
const curve = (pts, steps = 8) => {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < steps; k++) {
      const t = k / steps, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
};
function scribble(polygon, spacing = 13, angle = 0.5, seed = 1) {
  const R = rng(seed);
  const c = Math.cos(angle), s = Math.sin(angle);
  const P = polygon.map(([x, y]) => [x * c + y * s, -x * s + y * c]);
  const inv = ([x, y]) => [x * c - y * s, x * s + y * c];
  const ys = P.map((p) => p[1]);
  const out = [];
  let dir = 1;
  for (let y = Math.min(...ys) + spacing * 0.4; y <= Math.max(...ys) - spacing * 0.3; y += spacing * (0.85 + R() * 0.3)) {
    const xs = [];
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
    }
    if (xs.length < 2) continue;
    xs.sort((m, n) => m - n);
    const xa = xs[0] + 3, xb = xs[xs.length - 1] - 3;
    if (xb <= xa) continue;
    out.push(...(dir > 0 ? [inv([xa, y]), inv([xb, y + spacing * 0.5])] : [inv([xb, y]), inv([xa, y + spacing * 0.5])]));
    dir = -dir;
  }
  return out;
}

// ------------------------------------------------------------------ the picture (full-size design coordinates)
function buildPicture() {
  const S = [];
  const add = (g, c, w, p, extra = {}) => S.push({ g, c, w, p, ...extra });
  const fill = (g, c, polyPts, spacing, angle, seed, w = 9) => add(g, c, w, scribble(polyPts, spacing, angle, seed), { fill: true });

  // ground
  const ground = [];
  for (let x = 40; x <= 860; x += 30) ground.push([x, 1172 + Math.sin(x * 0.025) * 7]);
  add('ground', COLORS.green, 9, ground);
  for (let i = 0; i < 16; i++) {
    const x = 60 + i * 52 + ((i * 37) % 17);
    const y = 1172 + Math.sin(x * 0.025) * 7;
    add('ground', COLORS.green, 6, poly([x - 8, y], [x - 3, y - 22], [x + 2, y], [x + 8, y - 18], [x + 12, y]));
  }

  // ---- her: long black hair, a pink dress with pastel rainbow stripes
  const hx = 360, hy = 760;
  fill('her', COLORS.hair, poly([hx - 60, hy - 4], [hx - 52, hy - 42], [hx - 26, hy - 64], [hx + 26, hy - 64], [hx + 52, hy - 42], [hx + 60, hy - 4], [hx + 42, hy - 18], [hx + 6, hy - 34], [hx - 6, hy - 34], [hx - 42, hy - 18]), 10, 0.3, 11, 10);
  fill('her', COLORS.hair, poly([hx - 62, hy - 8], [hx - 44, hy - 18], [hx - 46, hy + 124], [hx - 68, hy + 120]), 10, 1.3, 14, 10);
  fill('her', COLORS.hair, poly([hx + 62, hy - 8], [hx + 44, hy - 18], [hx + 46, hy + 124], [hx + 68, hy + 120]), 10, 1.3, 15, 10);
  add('her', COLORS.skin, 7, circle(hx, hy, 50, 30, 0.04, 3));
  fill('her', COLORS.skin, ellipse(hx, hy + 6, 40, 40, 20), 12, 0.3, 12, 7);
  add('her', COLORS.hair, 7, curve([[hx - 64, hy + 118], [hx - 62, hy], [hx - 40, hy - 58], [hx, hy - 66], [hx + 40, hy - 58], [hx + 62, hy], [hx + 64, hy + 118]], 6));
  add('herEyes', COLORS.hair, 9, circle(hx - 18, hy + 2, 3, 8, 0, 4));
  add('herEyes', COLORS.hair, 9, circle(hx + 18, hy + 2, 3, 8, 0, 5));
  add('her', COLORS.hair, 4, poly([hx - 32, hy - 18], [hx - 10, hy - 22]));
  add('her', COLORS.hair, 4, poly([hx + 10, hy - 22], [hx + 32, hy - 18]));
  add('her', COLORS.red, 6, curve([[hx - 14, hy + 22], [hx, hy + 32], [hx + 14, hy + 22]], 5));
  add('her', COLORS.pink, 10, circle(hx - 30, hy + 18, 7, 10, 0.1, 6));
  add('her', COLORS.pink, 10, circle(hx + 30, hy + 18, 7, 10, 0.1, 7));
  add('her', COLORS.skin, 7, poly([hx, hy + 52], [hx, hy + 66]));
  const dress = poly([hx - 22, hy + 64], [hx + 22, hy + 64], [hx + 80, hy + 232], [hx - 80, hy + 232]);
  fill('her', COLORS.pink, dress, 14, -0.6, 13);
  COLORS.rainbow.forEach((c, i) => {
    const y = hy + 100 + i * 22, half = 22 + ((y - hy - 64) / 168) * 58;
    add('her', c, 9, poly([hx - half + 6, y + 6], [hx + half - 6, y - 6]));
  });
  add('her', COLORS.pinkDark, 7, closed(dress));
  add('her', COLORS.skin, 7, curve([[hx - 22, hy + 90], [hx - 56, hy + 140], [hx - 66, hy + 172]], 5));
  add('her', COLORS.skin, 9, circle(hx - 67, hy + 178, 8, 10, 0.1, 8));
  add('hands', COLORS.skin, 7, curve([[hx + 22, hy + 90], [hx + 62, hy + 128], [hx + 92, hy + 146]], 5));
  add('her', COLORS.skin, 7, poly([hx - 26, hy + 232], [hx - 28, hy + 360]));
  add('her', COLORS.skin, 7, poly([hx + 26, hy + 232], [hx + 28, hy + 360]));
  add('her', COLORS.hair, 10, ellipse(hx - 36, hy + 364, 14, 7, 12));
  add('her', COLORS.hair, 10, ellipse(hx + 36, hy + 364, 14, 7, 12));

  // ---- him: short dark hair, light blue shirt, stone trousers
  const mx = 560, my = 745;
  add('him', COLORS.skin, 7, circle(mx, my, 52, 30, 0.04, 21));
  fill('him', COLORS.skin, ellipse(mx, my + 4, 42, 42, 20), 12, 0.3, 22, 7);
  const cap = poly([mx - 54, my - 2], [mx - 50, my - 34], [mx - 26, my - 58], [mx + 22, my - 60], [mx + 50, my - 36], [mx + 54, my - 2], [mx + 40, my - 22], [mx - 40, my - 22]);
  fill('him', COLORS.hair, cap, 10, 0.2, 23, 10);
  add('him', COLORS.hair, 7, poly([mx - 50, my - 20], [mx - 40, my - 62], [mx - 24, my - 46], [mx - 10, my - 72], [mx + 6, my - 50], [mx + 22, my - 70], [mx + 34, my - 46], [mx + 52, my - 24]));
  add('himEyes', COLORS.hair, 9, circle(mx - 18, my + 2, 3, 8, 0, 24));
  add('himEyes', COLORS.hair, 9, circle(mx + 18, my + 2, 3, 8, 0, 25));
  add('him', COLORS.hair, 6, poly([mx - 32, my - 12], [mx - 8, my - 14]));
  add('him', COLORS.hair, 6, poly([mx + 8, my - 14], [mx + 32, my - 12]));
  add('him', COLORS.red, 6, curve([[mx - 16, my + 22], [mx, my + 33], [mx + 16, my + 22]], 5));
  add('him', COLORS.pink, 8, circle(mx - 30, my + 18, 5, 10, 0.1, 26));
  add('him', COLORS.pink, 8, circle(mx + 30, my + 18, 5, 10, 0.1, 27));
  add('him', COLORS.skin, 7, poly([mx, my + 54], [mx, my + 66]));
  const shirt = poly([mx - 48, my + 66], [mx + 48, my + 66], [mx + 52, my + 216], [mx - 52, my + 216]);
  fill('him', COLORS.blue, shirt, 13, 0.7, 28);
  add('him', COLORS.blueDark, 7, closed(shirt));
  add('him', COLORS.blueDark, 5, poly([mx, my + 70], [mx, my + 210]));
  const legL = poly([mx - 46, my + 216], [mx - 6, my + 216], [mx - 8, my + 370], [mx - 42, my + 370]);
  const legR = poly([mx + 6, my + 216], [mx + 46, my + 216], [mx + 42, my + 370], [mx + 8, my + 370]);
  fill('him', COLORS.tan, legL, 12, 1.3, 29);
  fill('him', COLORS.tan, legR, 12, 1.3, 30);
  add('him', COLORS.brown, 6, closed(legL));
  add('him', COLORS.brown, 6, closed(legR));
  add('him', COLORS.brown, 10, ellipse(mx - 30, my + 376, 18, 8, 12));
  add('him', COLORS.brown, 10, ellipse(mx + 30, my + 376, 18, 8, 12));
  add('hands', COLORS.skin, 7, curve([[mx - 48, my + 84], [mx - 82, my + 130], [mx - 100, my + 160]], 5));
  add('him', COLORS.skin, 7, curve([[mx + 48, my + 84], [mx + 84, my + 140], [mx + 92, my + 176]], 5));
  add('him', COLORS.skin, 9, circle(mx + 93, my + 184, 8, 10, 0.1, 31));

  // ---- holding hands, and a heart above them
  add('hands', COLORS.skin, 10, circle(458, 906, 13, 14, 0.12, 32));
  fill('heart', COLORS.red, heartPts(460, 640, 40), 9, 0.9, 33, 8);
  add('heart', COLORS.red, 8, heartPts(460, 640, 42));

  // ---- Koko: a grey tabby Scottish Fold kitten, sitting by her feet
  const kx = 170, ky = 975;
  const body = ellipse(kx + 4, ky + 110, 62, 76, 26);
  fill('koko', COLORS.koko, body, 12, -0.4, 41);
  add('koko', COLORS.kokoDark, 7, body);
  const tail = curve([[kx + 58, ky + 158], [kx + 108, ky + 140], [kx + 124, ky + 84], [kx + 104, ky + 52]], 6);
  add('kokoTail', COLORS.koko, 16, tail);
  add('kokoTail', COLORS.kokoDark, 7, tail);
  for (const [x, y] of [[kx + 96, ky + 146], [kx + 120, ky + 110], [kx + 118, ky + 72]]) add('kokoTail', COLORS.kokoDark, 6, poly([x - 9, y - 6], [x + 9, y + 6]));
  fill('koko', COLORS.koko, ellipse(kx, ky, 46, 44, 20), 11, 0.4, 43);
  add('koko', COLORS.kokoDark, 7, circle(kx, ky, 54, 30, 0.03, 42));
  add('koko', COLORS.kokoDark, 8, curve([[kx - 50, ky - 22], [kx - 48, ky - 50], [kx - 26, ky - 52], [kx - 18, ky - 38]], 4));
  add('koko', COLORS.kokoDark, 8, curve([[kx + 50, ky - 22], [kx + 48, ky - 50], [kx + 26, ky - 52], [kx + 18, ky - 38]], 4));
  for (const dx of [-12, 0, 12]) add('koko', COLORS.kokoDark, 6, curve([[kx + dx * 1.3, ky - 50], [kx + dx, ky - 40], [kx + dx * 0.8, ky - 28]], 3));
  for (const s of [-1, 1]) for (const dy of [0, 12]) add('koko', COLORS.kokoDark, 5, poly([kx + s * 52, ky + dy], [kx + s * 36, ky + dy + 4]));
  for (const dy of [70, 98, 126]) add('koko', COLORS.kokoDark, 6, curve([[kx - 50, ky + dy], [kx - 30, ky + dy + 8], [kx - 10, ky + dy + 4]], 3));
  add('koko', COLORS.kokoLight, 10, scribble(ellipse(kx + 2, ky + 112, 26, 40, 14), 9, 0.2, 44), { fill: true });
  add('koko', COLORS.kokoLight, 9, scribble(ellipse(kx, ky + 22, 20, 12, 12), 7, 0.2, 45), { fill: true });
  add('kokoEyes', COLORS.hair, 14, circle(kx - 20, ky - 2, 9, 14, 0, 46));
  add('kokoEyes', COLORS.hair, 14, circle(kx + 20, ky - 2, 9, 14, 0, 47));
  add('kokoEyes', '#ffffff', 5, circle(kx - 23, ky - 6, 2, 6, 0, 48));
  add('kokoEyes', '#ffffff', 5, circle(kx + 17, ky - 6, 2, 6, 0, 49));
  add('koko', COLORS.pink, 8, closed(poly([kx - 6, ky + 12], [kx + 6, ky + 12], [kx, ky + 19])));
  add('koko', COLORS.kokoDark, 5, curve([[kx - 12, ky + 24], [kx - 6, ky + 30], [kx, ky + 22], [kx + 6, ky + 30], [kx + 12, ky + 24]], 3));
  for (const s of [-1, 1]) for (const dy of [-4, 6, 16]) add('koko', COLORS.kokoDark, 3, poly([kx + s * 26, ky + 16], [kx + s * 70, ky + 16 + dy * 1.4]));
  for (const s of [-1, 1]) add('koko', COLORS.kokoDark, 7, ellipse(kx + s * 22, ky + 182, 17, 9, 12));

  // ---- a sun, a cloud, flowers and little hearts
  add('sun', COLORS.orange, 8, circle(790, 610, 44, 26, 0.05, 51));
  add('sun', COLORS.yellow, 10, scribble(ellipse(790, 610, 38, 38, 18), 10, 0.5, 52), { fill: true });
  add('sun', COLORS.orange, 8, circle(776, 602, 2, 6, 0, 53));
  add('sun', COLORS.orange, 8, circle(804, 602, 2, 6, 0, 54));
  add('sun', COLORS.orange, 6, curve([[776, 622], [790, 632], [804, 622]], 4));
  add('cloud', COLORS.sky, 8, curve([[60, 620], [70, 592], [100, 586], [118, 566], [150, 566], [170, 586], [196, 584], [214, 604], [204, 626], [60, 626]], 5));
  for (const [x, c] of [[690, COLORS.violet], [760, COLORS.pink], [835, COLORS.yellow], [70, COLORS.red]]) {
    const y = 1172 + Math.sin(x * 0.025) * 7;
    add('flower', COLORS.green, 6, curve([[x, y], [x - 4, y - 30], [x, y - 58]], 4));
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      add('flower', c, 7, circle(x + Math.cos(a) * 12, y - 66 + Math.sin(a) * 12, 7, 10, 0.1, 60 + k + x));
    }
    add('flower', COLORS.yellow, 9, circle(x, y - 66, 5, 8, 0, 70 + x));
  }
  for (const [x, y, s, c] of [[300, 640, 16, COLORS.pink], [640, 610, 14, COLORS.red], [250, 560, 11, COLORS.red], [700, 690, 11, COLORS.pink]]) add('hearts', c, 6, heartPts(x, y, s));
  return S;
}

export class LetterArt {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.round(PW * SCALE);
    this.canvas.height = Math.round(PH * SCALE);
    this.ctx = this.canvas.getContext('2d');
    this.layer = document.createElement('canvas');
    this.layer.width = this.canvas.width;
    this.layer.height = this.canvas.height;
    this.lctx = this.layer.getContext('2d');
    this.paper = this.makePaper();
    this.grain = this.lctx.createPattern(this.makeGrain(), 'repeat');
    this.strokes = buildPicture();
    this.text = this.makeText();
    this.anim = { hop: { her: 0, him: 0, koko: 0 }, blink: 0, kokoBlink: 0, tail: 0, hands: 0, sun: 0, heart: 1 };
  }

  makePaper() {
    const c = document.createElement('canvas');
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const g = c.getContext('2d');
    g.scale(SCALE, SCALE);
    const R = rng(9);
    // torn notebook edge along the top
    g.beginPath();
    g.moveTo(0, 26);
    for (let x = 0; x <= PW; x += 9) g.lineTo(x, 14 + R() * 18);
    g.lineTo(PW, PH);
    g.lineTo(0, PH);
    g.closePath();
    g.fillStyle = '#fffdf7';
    g.fill();
    g.save();
    g.clip();
    g.strokeStyle = 'rgba(120,160,215,0.26)';
    g.lineWidth = 2;
    for (let y = 120; y < PH; y += 60) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(PW, y);
      g.stroke();
    }
    g.strokeStyle = 'rgba(230,110,120,0.35)';
    g.beginPath();
    g.moveTo(822, 40);
    g.lineTo(822, PH);
    g.stroke();
    // holes left behind by the spiral
    g.globalCompositeOperation = 'destination-out';
    for (let x = 60; x < PW; x += 78) {
      g.beginPath();
      g.arc(x, 52, 9, 0, Math.PI * 2);
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 2200; i++) {
      g.fillStyle = `rgba(${150 + R() * 60},${130 + R() * 50},${110 + R() * 40},${0.04 + R() * 0.05})`;
      g.fillRect(R() * PW, R() * PH, 1 + R() * 2.5, 1 + R() * 2.5);
    }
    g.restore();
    return c;
  }

  makeGrain() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const R = rng(4);
    for (let i = 0; i < 1500; i++) {
      g.fillStyle = `rgba(0,0,0,${0.25 + R() * 0.6})`;
      g.save();
      g.translate(R() * 128, R() * 128);
      g.rotate(-0.4 + R() * 0.2);
      g.fillRect(0, 0, 0.6 + R() * 2.2, 0.6 + R() * 1.2);
      g.restore();
    }
    return c;
  }

  // all the words, in crayon colours, with a little waxy grain
  makeText() {
    const c = document.createElement('canvas');
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const g = c.getContext('2d');
    g.scale(SCALE, SCALE);
    g.direction = 'rtl';
    g.textAlign = 'right';
    for (const ln of LINES) {
      let size = ln.size, widths, total, gap;
      for (;;) {
        g.font = `${ln.weight || 400} ${size}px ${FONT}`;
        gap = size * 0.28;
        widths = ln.parts.map(([t]) => g.measureText(t).width);
        total = widths.reduce((a, b) => a + b, 0) + gap * (ln.parts.length - 1);
        if (total <= 680 || size < 26) break;
        size -= 2;
      }
      let x = ln.align === 'left' ? LEFT + total : RIGHT;
      ln.parts.forEach(([t, col], i) => {
        g.fillStyle = col;
        g.fillText(t, x, ln.y);
        x -= widths[i] + gap;
      });
      if (ln.align === 'left' && ln.weight) this.signEnd = LEFT;
    }
    // the postscript: a hand-drawn wavy line, then the couplet in grey pencil, slightly tilted
    g.save();
    g.translate(PW / 2, 706);
    g.rotate(-0.018);
    g.strokeStyle = 'rgba(110,108,122,0.55)';
    g.lineWidth = 2.5;
    g.lineCap = 'round';
    g.beginPath();
    for (let x = -120; x <= 120; x += 6) g[x === -120 ? 'moveTo' : 'lineTo'](x, -50 + Math.sin(x * 0.08) * 3);
    g.stroke();
    g.textAlign = 'center';
    g.fillStyle = '#5e5d6c';
    g.globalAlpha = 0.82;
    let ps = 35;
    for (;;) {
      g.font = `400 ${ps}px ${FONT}`;
      if (Math.max(...COUPLET.map((t) => g.measureText(t).width)) <= 640 || ps < 26) break;
      ps -= 1;
    }
    g.fillText(COUPLET[0], 0, 0);
    g.fillText(COUPLET[1], 0, ps * 1.45);
    // a small pencil crescent moon beside it
    g.globalAlpha = 0.7;
    g.strokeStyle = '#5e5d6c';
    g.lineWidth = 2.5;
    g.beginPath();
    g.arc(-370, 14, 16, Math.PI * 0.35, Math.PI * 1.65);
    g.arc(-362, 14, 13, Math.PI * 1.55, Math.PI * 0.45, true);
    g.stroke();
    g.restore();
    // Koko's paw print next to the signature
    g.fillStyle = COLORS.pink;
    const px = LEFT - 34, py = 574;
    g.beginPath();
    g.ellipse(px, py, 15, 12, 0, 0, Math.PI * 2);
    for (const [dx, dy] of [[-17, -17], [-6, -26], [6, -26], [17, -17]]) {
      g.moveTo(px + dx + 5, py + dy);
      g.arc(px + dx, py + dy, 5, 0, Math.PI * 2);
    }
    g.fill();
    return c;
  }

  draw(time) {
    const g = this.lctx;
    const a = this.anim;
    const boil = Math.floor(time * 8);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.layer.width, this.layer.height);
    g.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const s of this.strokes) this.crayon(g, this.transform(s, a).map(toPage), s.c, s.w * PIC.s * 1.25, boil, s.fill);
    // the sun's rays turn slowly
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2 + a.sun;
      this.crayon(g, [[790 + Math.cos(ang) * 58, 610 + Math.sin(ang) * 58], [790 + Math.cos(ang) * 84, 610 + Math.sin(ang) * 84]].map(toPage), COLORS.orange, 8, boil);
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = this.grain;
    g.fillRect(0, 0, this.layer.width, this.layer.height);
    g.globalCompositeOperation = 'source-over';

    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(this.paper, 0, 0);
    c.drawImage(this.text, 0, 0);
    c.globalCompositeOperation = 'multiply';
    c.drawImage(this.layer, 0, 0);
    c.globalCompositeOperation = 'source-over';
  }

  // the moving bits: a wagging tail, swinging hands, blinking, a beating heart
  transform(s, a) {
    let p = s.p;
    if (s.g === 'kokoTail') {
      const px = 228, py = 1133, ang = a.tail;
      const cs = Math.cos(ang), sn = Math.sin(ang);
      p = p.map(([x, y]) => [px + (x - px) * cs - (y - py) * sn, py + (x - px) * sn + (y - py) * cs]);
    }
    if (s.g === 'hands') p = p.map(([x, y]) => [x, y + a.hands * Math.max(0, 1 - Math.abs(x - 458) / 60)]);
    if (s.g === 'heart') p = p.map(([x, y]) => [460 + (x - 460) * a.heart, 640 + (y - 640) * a.heart + a.hands]);
    if (s.g.endsWith('Eyes')) {
      const b = s.g === 'kokoEyes' ? a.kokoBlink : a.blink;
      if (b > 0) {
        const cy = p.reduce((m, q) => m + q[1], 0) / p.length;
        p = p.map(([x, y]) => [x, cy + (y - cy) * 0.12]);
      }
    }
    return p;
  }

  crayon(g, pts, color, w, boil, isFill) {
    if (pts.length < 2) return;
    const R = rng(boil * 131 + Math.round(pts[0][0] * 7 + pts[0][1]));
    const passes = isFill ? 1 : 2;
    g.strokeStyle = color;
    for (let k = 0; k < passes; k++) {
      g.globalAlpha = isFill ? 0.62 : k === 0 ? 0.8 : 0.55;
      g.lineWidth = w * (k === 0 ? 1 : 0.55);
      const ox = (R() - 0.5) * 1.6, oy = (R() - 0.5) * 1.6;
      g.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const j = (R() - 0.5) * 1.2;
        const x = pts[i][0] + ox + j, y = pts[i][1] + oy - j;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
    g.globalAlpha = 1;
  }
}
