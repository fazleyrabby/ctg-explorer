import * as THREE from "three";
import type { PlayerAvatar } from "@/player/PlayerAvatar";

const SKIN = 0xd8a179;
const SHIRT = 0x2f80ed;
const PANTS = 0x2b3550;
const SHOE = 0x1b1b22;
const HAIR = 0x241a12;

const HIP_Y = 0.92;
const TORSO_HEIGHT = 0.62;
const TORSO_TOP = HIP_Y + TORSO_HEIGHT;

/**
 * Procedural low-poly humanoid avatar (spec §24).
 *
 * Built from primitives with a simple limb hierarchy so it can idle, walk, run
 * and jump. A rigged GLB can replace this later behind the same animate() API.
 */
export class PlayerModel implements PlayerAvatar {
  readonly object: THREE.Group;

  private readonly upper: THREE.Group;
  private readonly leftLeg: THREE.Group;
  private readonly rightLeg: THREE.Group;
  private readonly leftArm: THREE.Group;
  private readonly rightArm: THREE.Group;

  constructor() {
    this.object = new THREE.Group();
    this.object.name = "PlayerModel";

    const skin = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.75 });
    const shirt = new THREE.MeshStandardMaterial({ color: SHIRT, roughness: 0.7 });
    const pants = new THREE.MeshStandardMaterial({ color: PANTS, roughness: 0.85 });
    const shoe = new THREE.MeshStandardMaterial({ color: SHOE, roughness: 0.6 });
    const hair = new THREE.MeshStandardMaterial({ color: HAIR, roughness: 0.9 });

    // Upper body group bobs while walking; legs stay planted.
    this.upper = new THREE.Group();
    this.upper.name = "Upper";
    this.object.add(this.upper);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.44, TORSO_HEIGHT, 0.26), shirt);
    torso.position.y = HIP_Y + TORSO_HEIGHT / 2;
    this.addShadow(torso);
    this.upper.add(torso);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.09, 10), skin);
    neck.position.y = TORSO_TOP + 0.04;
    this.upper.add(neck);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.135, 18, 16), skin);
    head.position.y = TORSO_TOP + 0.2;
    head.scale.set(0.95, 1.1, 1.0);
    this.addShadow(head);
    this.upper.add(head);

    const hairMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.142, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
      hair,
    );
    hairMesh.position.y = TORSO_TOP + 0.21;
    hairMesh.scale.set(0.98, 1.05, 1.02);
    this.upper.add(hairMesh);
    this.leftArm = this.buildArm(1, skin, shirt);
    this.rightArm = this.buildArm(-1, skin, shirt);
    this.upper.add(this.leftArm, this.rightArm);

    this.leftLeg = this.buildLeg(1, pants, shoe, skin);
    this.rightLeg = this.buildLeg(-1, pants, shoe, skin);
    this.object.add(this.leftLeg, this.rightLeg);
  }

  private buildArm(side: number, skin: THREE.Material, shirt: THREE.Material): THREE.Group {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.27, TORSO_TOP - 0.06, 0);

    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.18, 6, 12), shirt);
    sleeve.position.y = -0.14;
    this.addShadow(sleeve);
    pivot.add(sleeve);

    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.058, 0.32, 6, 12), skin);
    arm.position.y = -0.44;
    this.addShadow(arm);
    pivot.add(arm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.062, 10, 10), skin);
    hand.position.y = -0.63;
    pivot.add(hand);

    return pivot;
  }

  private buildLeg(side: number, pants: THREE.Material, shoe: THREE.Material, skin: THREE.Material): THREE.Group {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.11, HIP_Y, 0);

    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.28, 6, 12), pants);
    thigh.position.y = -0.21;
    this.addShadow(thigh);
    pivot.add(thigh);

    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.26, 6, 12), pants);
    shin.position.y = -0.55;
    this.addShadow(shin);
    pivot.add(shin);

    const ankle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 8), skin);
    ankle.position.y = -0.72;
    pivot.add(ankle);

    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 0.27), shoe);
    foot.position.set(0, -0.78, 0.06);
    this.addShadow(foot);
    pivot.add(foot);

    return pivot;
  }

  private addShadow(mesh: THREE.Mesh): void {
    mesh.castShadow = true;
  }

  /**
   * @param phase     walk-cycle phase in radians
   * @param intensity 0 = idle, 1 = full run
   * @param airborne  true while jumping/falling
   */
  /** Seated riding pose (legs forward onto the pedals, arms to the bars). */
  animateRiding(phase: number): void {
    const pedal = Math.sin(phase);
    this.leftLeg.rotation.x = -1.0 + pedal * 0.4;
    this.rightLeg.rotation.x = -1.0 - pedal * 0.4;
    this.leftArm.rotation.x = -0.72;
    this.rightArm.rotation.x = -0.72;
    this.upper.rotation.x = 0.14;
    this.upper.position.y = 0.02;
  }

  animate(phase: number, intensity: number, airborne: boolean): void {
    this.upper.rotation.x = 0;
    if (airborne) {
      this.leftLeg.rotation.x = 0.35;
      this.rightLeg.rotation.x = -0.25;
      this.leftArm.rotation.x = -0.8;
      this.rightArm.rotation.x = -0.8;
      this.upper.position.y = 0.02;
      return;
    }

    const swing = Math.sin(phase) * (0.35 + 0.45 * intensity);
    this.leftLeg.rotation.x = swing;
    this.rightLeg.rotation.x = -swing;
    this.leftArm.rotation.x = -swing * 0.85;
    this.rightArm.rotation.x = swing * 0.85;

    // Vertical bob peaks twice per stride.
    this.upper.position.y = Math.abs(Math.sin(phase)) * 0.05 * intensity;

    // Idle breathing when nearly still.
    if (intensity < 0.05) {
      const breath = Math.sin(phase * 0.4) * 0.012;
      this.upper.position.y = breath;
      this.leftArm.rotation.x = Math.sin(phase * 0.4) * 0.05;
      this.rightArm.rotation.x = -Math.sin(phase * 0.4) * 0.05;
    }
  }
}
