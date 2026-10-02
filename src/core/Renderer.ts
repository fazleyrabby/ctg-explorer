import * as THREE from "three";

/**
 * Thin wrapper around the WebGL2 renderer (spec §36). Owns sizing and render
 * settings; the game loop lives in Game.
 */
export class Renderer {
  readonly instance: THREE.WebGLRenderer;
  private width = 1;
  private height = 1;
  private maxPixelRatio = 2;

  constructor(canvas: HTMLCanvasElement) {
    this.instance = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.instance.setPixelRatio(Math.min(window.devicePixelRatio, this.maxPixelRatio));
    this.instance.shadowMap.enabled = true;
    this.instance.shadowMap.type = THREE.PCFSoftShadowMap;
    this.instance.toneMapping = THREE.NeutralToneMapping;
    this.instance.toneMappingExposure = 1.0;
  }

  /** Caps the device pixel ratio (quality presets) and resizes the drawing buffer. */
  setMaxPixelRatio(max: number): void {
    this.maxPixelRatio = max;
    this.instance.setPixelRatio(Math.min(window.devicePixelRatio, max));
    this.instance.setSize(this.width, this.height, false);
  }

  get aspect(): number {
    return this.width / this.height;
  }

  setSize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.instance.setSize(this.width, this.height, false);
  }
}
