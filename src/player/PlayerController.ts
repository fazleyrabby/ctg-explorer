import * as THREE from "three";
import type { Input } from "@/player/Input";
import type { Player } from "@/player/Player";
import type { ThirdPersonCamera } from "@/camera/ThirdPersonCamera";
import type { HeightProvider } from "@/geography/WorldHeight";
import { shoreDistance } from "@/geography/CityGeography";
import { clampToWorld } from "@/geography/Projection";

const WALK_SPEED = 4.5;
const RUN_SPEED = 9;
const ACCELERATION = 12;
const GRAVITY = 25;
const JUMP_VELOCITY = 8.5;
const GROUND_EPSILON = 0.05;
const TURN_RATE = 14;

const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const wish = new THREE.Vector3();

/**
 * Kinematic player controller (spec §25, §29).
 *
 * Moves relative to camera yaw, applies gravity, and resolves ground contact
 * against the curved procedural surface. Collision with buildings/landmarks is
 * added in a later milestone; no physics engine is used yet (ADR-0001).
 */
export class PlayerController {
  constructor(
    private readonly player: Player,
    private readonly input: Input,
    private readonly camera: ThirdPersonCamera,
    private readonly getHeight: HeightProvider,
  ) {}

  update(delta: number): void {
    this.applyMovement(delta);
    this.applyGravityAndJump(delta);
    this.integrate(delta);
    this.resolveGround();
    this.applyFacing(delta);
    this.player.sync();
    this.player.update(delta);
  }

  private applyMovement(delta: number): void {
    const yaw = this.camera.yaw;

    forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    right.set(Math.cos(yaw), 0, -Math.sin(yaw));

    wish
      .set(0, 0, 0)
      .addScaledVector(forward, this.input.moveForward)
      .addScaledVector(right, this.input.moveRight);

    const speed = this.input.sprinting ? RUN_SPEED : WALK_SPEED;

    if (wish.lengthSq() > 1e-6) {
      wish.normalize().multiplyScalar(speed);
    }

    const lerp = 1 - Math.exp(-ACCELERATION * delta);
    this.player.velocity.x += (wish.x - this.player.velocity.x) * lerp;
    this.player.velocity.z += (wish.z - this.player.velocity.z) * lerp;
  }

  private applyGravityAndJump(delta: number): void {
    if (this.player.onGround && this.input.jumpPressed) {
      this.player.velocity.y = JUMP_VELOCITY;
      this.player.onGround = false;
    }
    this.player.velocity.y -= GRAVITY * delta;
  }

  private integrate(delta: number): void {
    const oldX=this.player.position.x,oldZ=this.player.position.z;
    this.player.position.addScaledVector(this.player.velocity, delta);
    const x=this.player.position.x,z=this.player.position.z;
    // Bridges let the player cross water the ground surface would otherwise block.
    const onDeck=this.getHeight(x,z,this.player.position.y)-this.getHeight(x,z)>1.5;
    if(shoreDistance(x,z)<1&&!onDeck){this.player.position.x=oldX;this.player.position.z=oldZ;this.player.velocity.x=0;this.player.velocity.z=0;}
  }

  private resolveGround(): void {
    // Invisible walls: keep the player inside the small district.
    const [cx, cz] = clampToWorld(this.player.position.x, this.player.position.z, 12);
    this.player.position.x = cx;
    this.player.position.z = cz;

    const groundY = this.getHeight(this.player.position.x, this.player.position.z, this.player.position.y);

    if (this.player.position.y <= groundY + GROUND_EPSILON) {
      this.player.position.y = groundY;
      if (this.player.velocity.y < 0) this.player.velocity.y = 0;
      this.player.onGround = true;
    } else {
      this.player.onGround = false;
    }
  }

  private applyFacing(delta: number): void {
    const speedSq =
      this.player.velocity.x * this.player.velocity.x +
      this.player.velocity.z * this.player.velocity.z;
    if (speedSq < 0.05) return;

    const targetYaw = Math.atan2(this.player.velocity.x, this.player.velocity.z);
    const deltaAngle = shortestAngle(this.player.facing, targetYaw);
    this.player.facing += deltaAngle * Math.min(1, TURN_RATE * delta);
  }
}

function shortestAngle(from: number, to: number): number {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}
