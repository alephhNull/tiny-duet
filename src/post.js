import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// Tilt-shift in a single pass: sharp in a band around the figures, softly blurred above and
// below, which is what makes a real photo look like a miniature.
const TiltShift = {
  uniforms: {
    tDiffuse: { value: null },
    px: { value: new THREE.Vector2() },
    focus: { value: 0.4 },
    band: { value: 0.12 },
    amount: { value: 1 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 px; uniform float focus; uniform float band; uniform float amount;
    varying vec2 vUv;
    void main(){
      float b = smoothstep(band, band + 0.32, abs(vUv.y - focus)) * amount;
      vec4 c = texture2D(tDiffuse, vUv);
      if (b < 0.02) { gl_FragColor = c; return; }
      vec4 sum = c; float ws = 1.0;
      // 12 taps on a golden-angle spiral
      for (int i = 1; i <= 12; i++) {
        float r = sqrt(float(i) / 12.0);
        float a = float(i) * 2.39996;
        sum += texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * r * px * 7.0 * b);
        ws += 1.0;
      }
      gl_FragColor = sum / ws;
    }`,
};

// Quality steps, from richest to lightest. Phones start lower and every step down is quick.
const STEPS = ['full', 'noTilt', 'noBloom', 'direct', 'lowRes', 'noShadow'];

export class Post {
  constructor(renderer, scene, camera, phone) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.phone = phone;
    const size = renderer.getSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: phone ? 0 : 4 });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloomDiv = phone ? 4 : 2;
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / this.bloomDiv, size.y / this.bloomDiv), 0.75, 0.6, 1.9);
    this.composer.addPass(this.bloom);
    this.tilt = new ShaderPass(TiltShift);
    this.composer.addPass(this.tilt);
    this.composer.addPass(new OutputPass());
    this.step = 0;
    this.frames = [];
    this.skip = 60; // ignore the first frames while shaders compile
    this.onLowRes = null;
    this.onNoShadow = null;
  }

  setSize(w, h, dpr) {
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w / this.bloomDiv, h / this.bloomDiv);
    this.tilt.uniforms.px.value.set(1 / w, 1 / h);
  }

  setFocus(y, amount = 1) {
    this.tilt.uniforms.focus.value = y;
    this.tilt.uniforms.amount.value = amount;
  }

  // step down whenever frames are consistently slow
  watch(dt) {
    if (this.step >= STEPS.length - 1) return;
    if (this.skip > 0) { this.skip--; return; }
    this.frames.push(dt);
    if (this.frames.length < 40) return;
    this.frames.sort((a, b) => a - b);
    const median = this.frames[20];
    this.frames.length = 0;
    if (median <= 1 / 45) return;
    this.step++;
    const s = STEPS[this.step];
    if (s === 'noTilt') this.tilt.enabled = false;
    if (s === 'noBloom') this.bloom.enabled = false;
    if (s === 'lowRes' && this.onLowRes) this.onLowRes();
    if (s === 'noShadow' && this.onNoShadow) this.onNoShadow();
    this.skip = 20;
  }

  render() {
    if (this.step < 3) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}
