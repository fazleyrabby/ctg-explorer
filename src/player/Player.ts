import * as THREE from "three";
import { PlayerModel } from "@/player/PlayerModel";
import type { PlayerAvatar } from "@/player/PlayerAvatar";

export const PLAYER_HALF_HEIGHT = 0.9;
export const PLAYER_RADIUS = 0.35;

const CAMERA_TARGET_HEIGHT = 1.15;
const WALK_PHASE_RATE = 2.2;
const RUN_SPEED_REFERENCE = 9;

/**
 * Player avatar and kinematic state (spec §24, §29).
 *
 * `position` is the feet position; `object` is the renderable root. Animation is
 * driven from horizontal speed so it stays in sync with the controller.
 */
export class Player {
  readonly object: THREE.Group;
  readonly position: THREE.Vector3;
  readonly velocity = new THREE.Vector3();

  onGround = true;
  facing = 0;

  /** Called once per footfall while grounded and moving (intensity 0..1). */
  onFootstep?: (intensity: number) => void;

  private avatar: PlayerAvatar;
  private walkPhase = 0;
  private ridePhase = 0;
  private idlePhase = 0;

  constructor() {
    this.position = new THREE.Vector3();
    this.object = new THREE.Group();
    this.object.name = "Player";
    this.avatar = new PlayerModel();
    this.object.add(this.avatar.object);
  }

  /** Swaps the avatar (e.g. procedural -> Blender GLB) without a controller change. */
  setAvatar(avatar: PlayerAvatar): void {
    this.object.remove(this.avatar.object);
    this.avatar = avatar;
    this.object.add(avatar.object);
  }

  /** Copies simulation state onto the renderable group. */
  sync(): void {
    this.object.position.copy(this.position);
    this.object.rotation.y = this.facing;
  }

  /**
   * Advances the avatar animation. The avatar stays completely static at rest
   * and only animates in response to player input (movement or falling).
   */
  update(delta: number): void {
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    const intensity = Math.min(speed / RUN_SPEED_REFERENCE, 1);
    const moving = speed > 0.2;
    const airborne = !this.onGround;

    if (moving) {
      const previousPhase = this.walkPhase;
      this.walkPhase += delta * WALK_PHASE_RATE * speed;
      this.avatar.animate(this.walkPhase, intensity, airborne);

      // Each PI of phase is one footfall.
      if (
        this.onGround &&
        Math.floor(previousPhase / Math.PI) !== Math.floor(this.walkPhase / Math.PI)
      ) {
        this.onFootstep?.(intensity);
      }
    } else {
      this.walkPhase = 0;
      this.idlePhase += delta * 3;
      this.avatar.animate(this.idlePhase, 0, airborne);
    }
  }

  /** Advances the seated riding pose while mounted. */
  updateRiding(delta: number): void {
    this.ridePhase += delta * 5;
    this.avatar.animateRiding(this.ridePhase);
  }

  /** Camera follow target (chest height). */
  getCameraTarget(out: THREE.Vector3): THREE.Vector3 {
    return out.set(
      this.position.x,
      this.position.y + CAMERA_TARGET_HEIGHT,
      this.position.z,
    );
  }
}
