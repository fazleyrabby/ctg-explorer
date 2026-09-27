import * as THREE from "three";
import type { HeightProvider } from "@/geography/WorldHeight";
import { shoreDistance } from "@/geography/CityGeography";
import { richVehicle } from "@/world/RichVehicles";
import { clampToWorld } from "@/geography/Projection";

export type VehicleKind = "car" | "bicycle";

const TYRE = 0x1b1b1f;
const RIM = 0xc9ccd2;
const FRAME = 0xb0382f;

interface VehicleSpec {
  maxSpeed: number;
  reverseSpeed: number;
  acceleration: number;
  braking: number;
  drag: number;
  turnRate: number;
  camDistance: number;
}

const SPECS: Record<VehicleKind, VehicleSpec> = {
  car: { maxSpeed: 22, reverseSpeed: 7, acceleration: 12, braking: 22, drag: 1.2, turnRate: 1.7, camDistance: 12 },
  bicycle: { maxSpeed: 9, reverseSpeed: 2.5, acceleration: 6, braking: 10, drag: 1.0, turnRate: 2.6, camDistance: 7 },
};

/**
 * A simple summonable, rideable vehicle (spec §42 stretch feature).
 *
 * Arcade model: W/S accelerate/brake, A/D steer (steering scales with speed).
 * The mesh sits on the terrain and wheels spin with speed.
 */
export class Vehicle {
  readonly kind: VehicleKind;
  readonly object: THREE.Group;
  readonly spec: VehicleSpec;

  heading = 0;
  speed = 0;

  private readonly wheels: THREE.Group[] = [];
  private position = new THREE.Vector3();

  constructor(kind: VehicleKind) {
    this.kind = kind;
    this.spec = SPECS[kind];
    this.object = kind === "car" ? richVehicle("car", 0xffbd36) : buildBicycle();
    this.object.name = `Vehicle:${kind}`;
    this.object.visible = false;

    this.object.traverse((child) => {
      if (child.userData.wheel === true) this.wheels.push(child as THREE.Group);
    });
  }

  get isVisible(): boolean {
    return this.object.visible;
  }

  /** Places the vehicle on the ground just in front of a point. */
  place(x: number, z: number, heading: number, getHeight: HeightProvider): void {
    this.heading = heading;
    this.speed = 0;
    this.position.set(x, getHeight(x, z), z);
    this.object.visible = true;
    this.sync();
  }

  update(
    delta: number,
    throttle: number,
    steer: number,
    handbrake: boolean,
    getHeight: HeightProvider,
  ): void {
    const spec = this.spec;

    if (handbrake) {
      // Hard brake toward zero — never reverses.
      const decel = spec.braking * 1.8 * delta;
      if (Math.abs(this.speed) <= decel) this.speed = 0;
      else this.speed -= Math.sign(this.speed) * decel;
    } else if (throttle > 0) {
      this.speed += spec.acceleration * throttle * delta;
    } else if (throttle < 0) {
      // Brake to a stop first, then accelerate in reverse.
      if (this.speed > 0.1) {
        this.speed -= spec.braking * delta;
      } else {
        this.speed -= spec.acceleration * 0.8 * delta;
      }
    } else {
      this.speed -= Math.sign(this.speed) * spec.drag * delta * 4;
      if (Math.abs(this.speed) < 0.05) this.speed = 0;
    }
    this.speed = THREE.MathUtils.clamp(this.speed, -spec.reverseSpeed, spec.maxSpeed);

    // Steering only bites while moving.
    const speedFactor = THREE.MathUtils.clamp(Math.abs(this.speed) / 4, 0, 1);
    this.heading -= steer * spec.turnRate * speedFactor * delta * Math.sign(this.speed || 1);

    const dx = Math.sin(this.heading) * this.speed * delta;
    const dz = Math.cos(this.heading) * this.speed * delta;
    const [nextX, nextZ] = clampToWorld(this.position.x + dx, this.position.z + dz, 12);
    if(shoreDistance(nextX,nextZ)<2){this.speed=0;return;}
    this.position.set(nextX, getHeight(nextX, nextZ), nextZ);

    const wheelSpin = (this.speed / 0.33) * delta;
    for (const wheel of this.wheels) wheel.rotation.x -= wheelSpin;

    this.sync();
  }

  getPosition(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.position);
  }

  private sync(): void {
    this.object.position.copy(this.position);
    this.object.rotation.y = this.heading;
  }
}

function buildBicycle(): THREE.Group {
  const group = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: FRAME, roughness: 0.5, metalness: 0.3 });
  const tyreMat = new THREE.MeshStandardMaterial({ color: TYRE, roughness: 0.85 });
  const rimMat = new THREE.MeshStandardMaterial({ color: RIM, roughness: 0.4, metalness: 0.4 });
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x22242a, roughness: 0.7 });

  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.06, 20);
  const rimGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.04, 20);
  for (const sz of [1, -1]) {
    const wheel = new THREE.Group();
    wheel.position.set(0, 0.34, sz * 0.55);
    const tyre = new THREE.Mesh(wheelGeo, tyreMat);
    tyre.rotation.z = Math.PI / 2;
    tyre.castShadow = true;
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.z = Math.PI / 2;
    wheel.add(tyre, rim);
    wheel.userData.wheel = true;
    group.add(wheel);
  }

  const bar = (x: number, y: number, z: number, len: number, axis: "x" | "y" | "z") => {
    const geo = new THREE.BoxGeometry(axis === "x" ? len : 0.05, axis === "y" ? len : 0.05, axis === "z" ? len : 0.05);
    const mesh = new THREE.Mesh(geo, frameMat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    group.add(mesh);
  };

  // Frame: front (handlebar/fork) at +Z, rear (saddle) at -Z.
  bar(0, 0.63, 0.5, 0.62, "y"); // head tube / fork
  bar(0, 0.66, -0.45, 0.5, "y"); // seat tube
  bar(0, 0.87, 0.02, 0.98, "z"); // top tube
  bar(0, 0.54, 0.02, 0.98, "z"); // down tube
  bar(0, 0.98, 0.5, 0.46, "x"); // handlebar
  bar(0, 0.45, 0.0, 0.18, "x"); // pedal crank

  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.34), seatMat);
  seat.position.set(0, 0.93, -0.46);
  seat.castShadow = true;
  group.add(seat);

  return group;
}
