import * as THREE from "three";
import { localWorldBounds } from "@/geography/Projection";
import type { Input } from "@/player/Input";
import type { HeightProvider } from "@/geography/WorldHeight";

const MIN_DISTANCE = 35;
const MAX_DISTANCE = 4000;
const MIN_PITCH = 0.15;
const MAX_PITCH = 1.45;

/**
 * Detached "globe overview" camera (spec §5, Jalan KL-style overview): orbits the
 * whole district so it reads as a small world you can spin, then click a spot to
 * travel there. Independent of the player — the main camera is swapped in Game.
 */
export class OverviewCamera {
  readonly camera: THREE.PerspectiveCamera;

  yaw = Math.PI * 0.75;
  pitch = 0.85;
  distance = 1050;

  private readonly focus = new THREE.Vector3();
  private readonly desired = new THREE.Vector3();
  private initialized = false;

  constructor(
    aspect: number,
    private readonly getHeight: HeightProvider,
    private readonly rotateSpeed = 0.005,
  ) {
    this.camera = new THREE.PerspectiveCamera(50, aspect, 10, 10000);
    const b = localWorldBounds();
    this.focus.set((b.minX+b.maxX)/2, 0, (b.minZ+b.maxZ)/2);
    this.distance = Math.max(b.maxX-b.minX,b.maxZ-b.minZ)*1.4;
    this.focus.y = this.getHeight(this.focus.x, this.focus.z);
  }

  handleInput(input: Input): void {
    const pointer = input.consumeOverviewDelta();
    this.yaw -= pointer.orbitX * this.rotateSpeed;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch + pointer.orbitY * this.rotateSpeed,
      MIN_PITCH,
      MAX_PITCH,
    );
    this.pan(pointer.panX, pointer.panY, pointer.height);
    const wheel = input.consumeWheelDelta();
    if (wheel !== 0) {
      this.distance = THREE.MathUtils.clamp(
        this.distance * Math.exp(wheel * 0.0015),
        MIN_DISTANCE,
        MAX_DISTANCE,
      );
    }
  }

  /** Grab-and-drag the ground plane, scaled to the current zoom. */
  pan(dx: number, dy: number, viewportHeight: number): void {
    const scale = 2 * this.distance * Math.max(1, .95 / this.camera.aspect) * Math.tan(THREE.MathUtils.degToRad(25)) / Math.max(1, viewportHeight);
    const forward = dy * scale / Math.max(.3, Math.sin(this.pitch));
    this.focus.x += -dx * scale * Math.cos(this.yaw) + forward * Math.sin(this.yaw);
    this.focus.z += dx * scale * Math.sin(this.yaw) + forward * Math.cos(this.yaw);
    const b = localWorldBounds();
    this.focus.x = THREE.MathUtils.clamp(this.focus.x, b.minX, b.maxX);
    this.focus.z = THREE.MathUtils.clamp(this.focus.z, b.minZ, b.maxZ);
  }

  update(delta: number): void {
    this.focus.y = this.getHeight(this.focus.x, this.focus.z);
    const cosPitch = Math.cos(this.pitch);
    const framingDistance = this.distance * Math.max(1, .95 / this.camera.aspect);
    this.desired.set(
      this.focus.x + Math.sin(this.yaw) * cosPitch * framingDistance,
      this.focus.y + Math.sin(this.pitch) * framingDistance,
      this.focus.z + Math.cos(this.yaw) * cosPitch * framingDistance,
    );
    if (!this.initialized) {
      this.camera.position.copy(this.desired);
      this.initialized = true;
    } else {
      const lerp = 1 - Math.exp(-8 * delta);
      this.camera.position.lerp(this.desired, lerp);
    }
    this.camera.lookAt(this.focus);
  }

  /** Jumps to the orbit position on next update. */
  snap(): void {
    this.initialized = false;
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** Raycasts a screen point against the terrain; returns a world [x,z] or null. */
  pickGround(clientX: number, clientY: number, canvas: HTMLCanvasElement, terrain: THREE.Object3D): [number, number] | null {
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, this.camera);
    const hits = raycaster.intersectObject(terrain, true);
    if (hits.length === 0) return null;
    const point = hits[0]!.point;
    return [point.x, point.z];
  }
}
