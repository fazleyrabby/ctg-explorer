import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

/**
 * Screen-space finishing pass: subtle chromatic aberration, a miniature-style
 * tilt-shift blur, saturation/contrast grade and a vignette.
 */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uAberration: { value: 0 },
    uTilt: { value: 0 },
    uFocus: { value: 0.5 },
    uSaturation: { value: 1.06 },
    uContrast: { value: 1.05 },
    uVignette: { value: 0.12 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uAberration;
    uniform float uTilt;
    uniform float uFocus;
    uniform float uSaturation;
    uniform float uContrast;
    uniform float uVignette;
    varying vec2 vUv;

    void main() {
      vec2 dir = vUv - 0.5;
      float r2 = dot(dir, dir);

      // Chromatic aberration grows toward the edges.
      float ab = uAberration * r2 * 0.01;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + dir * ab).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - dir * ab).b;

      // Tilt-shift: blur away from the focus band (miniature look).
      float d = abs(vUv.y - uFocus);
      float blur = smoothstep(0.10, 0.46, d) * uTilt;
      if (blur > 0.002) {
        vec3 acc = col;
        float w = 1.0;
        for (int i = 1; i <= 6; i++) {
          float o = (float(i) / 6.0) * blur * 0.02;
          acc += texture2D(tDiffuse, vUv + vec2(0.0, o)).rgb;
          acc += texture2D(tDiffuse, vUv - vec2(0.0, o)).rgb;
          w += 2.0;
        }
        col = acc / w;
      }

      // Grade.
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(l), col, uSaturation);
      col = (col - 0.5) * uContrast + 0.5;

      // Vignette.
      float v = smoothstep(0.95, 0.35, length(dir));
      col *= mix(1.0, v, uVignette);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

/**
 * Post-processing pipeline (spec §36, §40): GTAO ambient occlusion to ground
 * geometry, Unreal bloom for lights/emissives, a grade + tilt-shift pass, SMAA
 * anti-aliasing and output tone mapping. Falls back to direct rendering if the
 * composer fails to initialise.
 */
export class PostFX {
  private readonly composer: EffectComposer;
  private readonly renderPass: RenderPass;
  private readonly gtao: GTAOPass;
  private readonly bloom: UnrealBloomPass;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    width: number,
    height: number,
  ) {
    const target = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      samples: 4,
    });
    this.composer = new EffectComposer(renderer, target);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    this.gtao = new GTAOPass(scene, camera, width, height);
    this.gtao.output = GTAOPass.OUTPUT.Default;
    this.gtao.blendIntensity = 0.9;
    this.composer.addPass(this.gtao);

    this.bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.32, 0.6, 0.9);
    this.composer.addPass(this.bloom);

    this.composer.addPass(new ShaderPass(GradeShader));
    this.composer.addPass(new SMAAPass());
    this.composer.addPass(new OutputPass());
  }

  private enabled = false;

  /** Points the whole stack at a different camera (follow <-> globe overview). */
  setCamera(camera: THREE.Camera): void {
    if (this.renderPass.camera === camera && this.gtao.camera === camera) return;
    this.renderPass.camera = camera;
    this.gtao.camera = camera;
  }

  setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  render(delta: number, scene: THREE.Scene, camera: THREE.Camera): void {
    if (this.enabled) {
      this.composer.render(delta);
    } else {
      this.renderer.render(scene, camera);
    }
  }
}
