import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// Tilt-shift: sharp in a band around the figures, softly blurred above and below,
// which is what makes a real photo look like a miniature.
const TiltShift = {
  uniforms: {
    tDiffuse: { value: null },
    delta: { value: new THREE.Vector2() },
    focus: { value: 0.4 },
    band: { value: 0.12 },
    amount: { value: 1 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 delta; uniform float focus; uniform float band; uniform float amount;
    varying vec2 vUv;
    void main(){
      float d = abs(vUv.y - focus);
      float b = smoothstep(band, band + 0.32, d) * amount;
      if (b < 0.01) { gl_FragColor = texture2D(tDiffuse, vUv); return; }
      vec4 sum = vec4(0.0); float ws = 0.0;
      for (int i = -4; i <= 4; i++) {
        float w = exp(-float(i * i) / 9.0);
        sum += texture2D(tDiffuse, vUv + delta * float(i) * b) * w;
        ws += w;
      }
      gl_FragColor = sum / ws;
    }`,
};

export class Post {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    const size = renderer.getSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.75, 0.6, 1.9);
    this.composer.addPass(this.bloom);
    this.tsH = new ShaderPass(TiltShift);
    this.tsV = new ShaderPass(TiltShift);
    this.composer.addPass(this.tsH);
    this.composer.addPass(this.tsV);
    this.composer.addPass(new OutputPass());
    this.enabled = true;
    this.frames = [];
  }

  setSize(w, h, dpr) {
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w / 2, h / 2);
    const px = 2.2 / (h * dpr);
    this.tsH.uniforms.delta.value.set(px * (h / w), 0);
    this.tsV.uniforms.delta.value.set(0, px);
  }

  setFocus(y, amount = 1) {
    for (const p of [this.tsH, this.tsV]) {
      p.uniforms.focus.value = y;
      p.uniforms.amount.value = amount;
    }
  }

  // drop the heavy effects if the phone can't keep up
  watch(dt) {
    if (!this.enabled) return;
    this.frames.push(dt);
    if (this.frames.length < 90) return;
    this.frames.sort((a, b) => a - b);
    const median = this.frames[45];
    this.frames.length = 0;
    if (median > 1 / 38) {
      if (this.tsH.enabled) {
        this.tsH.enabled = this.tsV.enabled = false;
      } else if (this.bloom.enabled) {
        this.bloom.enabled = false;
      } else {
        this.enabled = false;
      }
    }
  }

  render(scene, camera) {
    if (this.enabled) this.composer.render();
    else this.renderer.render(scene, camera);
  }
}
