import type {Colliders} from "@/world/Colliders";
import type {HeightProvider} from "@/geography/WorldHeight";
import * as THREE from "three";
import type { Input } from "@/player/Input";

const MIN_PITCH = 0.12;
const MAX_PITCH = 1.25;
const MIN_DISTANCE = 4;
const MAX_DISTANCE = 40;
const AUTO_FOLLOW_RATE = 2.4;
const MANUAL_ORBIT_PAUSE = 2.5;

/**
 * Third-person orbit camera (spec §26). Follows a target with smoothing,
 * supports drag rotation, wheel zoom, and immediate building occlusion.
 */
export class ThirdPersonCamera {
  colliders?:Colliders;
  getHeight?:HeightProvider;
  private readonly collisionDirection=new THREE.Vector3();
  readonly camera: THREE.PerspectiveCamera;

  yaw = Math.PI;
  pitch = 0.55;
  distance = 12;

  private readonly currentTarget = new THREE.Vector3();
  private readonly desiredTarget = new THREE.Vector3();
  private readonly desiredPosition = new THREE.Vector3();
  private initialized = false;
  private manualOrbitPause = 0;
  private orbitRevision = 0;

  get manualOrbitRevision(): number { return this.orbitRevision; }

  constructor(aspect: number, private readonly rotateSpeed = 0.005) {
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 12000);
  }

  handleInput(input: Input): void {
    const pointer = input.consumePointerDelta();
    this.yaw -= pointer.x * this.rotateSpeed;
    if(pointer.x !== 0 || pointer.y !== 0){
      this.manualOrbitPause = MANUAL_ORBIT_PAUSE;
      this.orbitRevision++;
    }
    this.pitch = THREE.MathUtils.clamp(
      this.pitch - pointer.y * this.rotateSpeed,
      MIN_PITCH,
      MAX_PITCH,
    );

    const wheel = input.consumeWheelDelta();
    if (wheel !== 0) {
      this.distance = THREE.MathUtils.clamp(
        this.distance + wheel * 0.02,
        MIN_DISTANCE,
        MAX_DISTANCE,
      );
    }
  }

  /** Gradually settles behind a moving character or vehicle after manual orbit. */
  followHeading(delta:number,heading:number,moving:boolean):void {
    this.manualOrbitPause=Math.max(0,this.manualOrbitPause-delta);
    if(!moving||this.manualOrbitPause>0)return;
    const desired=heading+Math.PI;
    const difference=Math.atan2(Math.sin(desired-this.yaw),Math.cos(desired-this.yaw));
    this.yaw+=difference*(1-Math.exp(-AUTO_FOLLOW_RATE*delta));
  }

  update(delta: number, target: THREE.Vector3): void {
    this.desiredTarget.copy(target);

    const cosPitch = Math.cos(this.pitch);
    this.desiredPosition.set(
      target.x + Math.sin(this.yaw) * cosPitch * this.distance,
      target.y + Math.sin(this.pitch) * this.distance,
      target.z + Math.cos(this.yaw) * cosPitch * this.distance,
    );

    if (!this.initialized) {
      this.currentTarget.copy(this.desiredTarget);
      this.camera.position.copy(this.desiredPosition);
      this.initialized = true;
    } else {
      const targetLerp = 1 - Math.exp(-12 * delta);
      const positionLerp = 1 - Math.exp(-9 * delta);
      this.currentTarget.lerp(this.desiredTarget, targetLerp);
      this.camera.position.lerp(this.desiredPosition, positionLerp);
    }

    // Resolve the final smoothed position, so an orbit cannot lerp through a wall.
    this.constrainPosition();
    this.camera.lookAt(this.currentTarget);
  }

  private constrainPosition():void {
    const origin=this.currentTarget,position=this.camera.position,dir=this.collisionDirection;
    if(this.getHeight)position.y=Math.max(position.y,this.getHeight(position.x,position.z)+1);
    dir.copy(position).sub(origin);const desired=dir.length();if(desired<.001)return;dir.divideScalar(desired);
    let hit=this.colliders?.rayDistance(origin,dir,desired)??desired;
    if(hit<desired){
      // Near walls, raise the boom until there is room for the minimum orbit.
      if(hit-.55<MIN_DISTANCE){
        for(let step=1;step<=12;step++){
          dir.copy(position).sub(origin);dir.y+=step*2;dir.normalize();
          const candidate=this.colliders!.rayDistance(origin,dir,desired);
          if(candidate-.55>=MIN_DISTANCE||candidate===desired){hit=candidate;break;}
        }
      }
      if(hit-.55<MIN_DISTANCE){
        // A vertical boom outside the player's wall preserves the minimum
        // distance even beside tall facades; discard a target lagging inside.
        origin.copy(this.desiredTarget);
        dir.set(0,1,0);
        hit=this.colliders!.rayDistance(origin,dir,Math.max(desired,MIN_DISTANCE));
      }
      position.copy(origin).addScaledVector(dir,Math.max(MIN_DISTANCE,Math.min(desired,hit-.55)));
    }
  }

  /** Jumps the follow smoothing (used after a teleport). */
  snap(): void {
    this.initialized = false;
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
