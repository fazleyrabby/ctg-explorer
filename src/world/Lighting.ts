import * as THREE from "three";

/**
 * Daylight lighting rig (spec §35). Day/night cycle (§34) is added later;
 * for Milestone 1 this is a fixed, clean sun setup.
 */
export class Lighting {
  readonly object: THREE.Group;
  readonly sun: THREE.DirectionalLight;
  readonly hemisphere: THREE.HemisphereLight;
  /** World size of one shadow-map texel; used to snap the sun and avoid shimmer. */
  readonly shadowTexel: number;

  constructor(sceneSize = 2400) {
    this.object = new THREE.Group();
    this.object.name = "Lighting";

    const hemisphere = new THREE.HemisphereLight(0xf2faff, 0xc5cfb2, 1.3);
    this.hemisphere = hemisphere;
    this.object.add(hemisphere);

    const sun = new THREE.DirectionalLight(0xfff3e0, 2.2);
    sun.position.set(1200, 1800, 900);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 6000;
    // normalBias removes shadow acne on large, low-resolution shadow maps.
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.6;

    const extent = Math.min(sceneSize / 4, 1200);
    const cam = sun.shadow.camera as THREE.OrthographicCamera;
    cam.left = -extent;
    cam.right = extent;
    cam.top = extent;
    cam.bottom = -extent;
    cam.updateProjectionMatrix();

    this.shadowTexel = (2 * extent) / sun.shadow.mapSize.x;

    this.sun = sun;
    this.object.add(sun);
    this.object.add(sun.target);
  }

  /** Applies time-of-day lighting values (spec §34). */
  applyTimeOfDay(
    color: THREE.Color,
    intensity: number,
    ambientIntensity: number,
    castShadow: boolean,
  ): void {
    this.sun.color.copy(color);
    this.sun.intensity = intensity;
    // A near-horizontal sun produces extreme shadow acne; only cast shadows
    // while the key light is reasonably high.
    this.sun.castShadow = castShadow;
    this.hemisphere.intensity = ambientIntensity;
  }
}
