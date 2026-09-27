import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { PlayerAvatar } from "@/player/PlayerAvatar";

export const AVATAR_URL = "/models/character.glb";

/**
 * Blender-authored avatar (scripts/blender/build_character.py).
 *
 * The GLB exposes named joint nodes; animation mirrors the procedural avatar so
 * the two are interchangeable (spec §24). The model faces +Z, matching the
 * game's forward axis.
 */
export class GltfAvatar implements PlayerAvatar {
  readonly object: THREE.Group;

  private readonly upper: THREE.Object3D;
  private readonly leftLeg: THREE.Object3D;
  private readonly rightLeg: THREE.Object3D;
  private readonly leftArm: THREE.Object3D;
  private readonly rightArm: THREE.Object3D;
  // JointTorso sits at hip height in the GLB; bob must be added to that base,
  // never overwrite it.
  private readonly upperBaseY: number;

  private constructor(
    root: THREE.Group,
    joints: {
      upper: THREE.Object3D;
      leftLeg: THREE.Object3D;
      rightLeg: THREE.Object3D;
      leftArm: THREE.Object3D;
      rightArm: THREE.Object3D;
    },
  ) {
    this.object = root;
    this.upper = joints.upper;
    this.leftLeg = joints.leftLeg;
    this.rightLeg = joints.rightLeg;
    this.leftArm = joints.leftArm;
    this.rightArm = joints.rightArm;
    this.upperBaseY = joints.upper.position.y;
  }

  static async load(url = AVATAR_URL): Promise<GltfAvatar> {
    const gltf = await new GLTFLoader().loadAsync(url);
    const root = gltf.scene;
    root.name = "PlayerModel";

    root.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = false;
        if (mesh.material instanceof THREE.MeshStandardMaterial) {
          mesh.material.side = THREE.FrontSide;
        }
      }
    });

    const joint = (name: string): THREE.Object3D => {
      const found = root.getObjectByName(name);
      if (!found) throw new Error(`Avatar GLB missing joint "${name}"`);
      return found;
    };

    return new GltfAvatar(root, {
      upper: joint("JointTorso"),
      leftLeg: joint("JointLegL"),
      rightLeg: joint("JointLegR"),
      leftArm: joint("JointArmL"),
      rightArm: joint("JointArmR"),
    });
  }

  /** Seated riding pose (legs forward onto the pedals, arms to the bars). */
  animateRiding(phase: number): void {
    const pedal = Math.sin(phase);
    this.leftLeg.rotation.x = -1.0 + pedal * 0.4;
    this.rightLeg.rotation.x = -1.0 - pedal * 0.4;
    this.leftArm.rotation.x = -0.72;
    this.rightArm.rotation.x = -0.72;
    this.upper.rotation.x = 0.14;
    this.upper.position.y = this.upperBaseY + 0.02;
  }

  animate(phase: number, intensity: number, airborne: boolean): void {
    this.upper.rotation.x = 0;
    if (airborne) {
      this.leftLeg.rotation.x = 0.35;
      this.rightLeg.rotation.x = -0.25;
      this.leftArm.rotation.x = -0.8;
      this.rightArm.rotation.x = -0.8;
      this.upper.position.y = this.upperBaseY + 0.02;
      return;
    }

    const swing = Math.sin(phase) * (0.35 + 0.45 * intensity);
    this.leftLeg.rotation.x = swing;
    this.rightLeg.rotation.x = -swing;
    this.leftArm.rotation.x = -swing * 0.85;
    this.rightArm.rotation.x = swing * 0.85;

    let bob = Math.abs(Math.sin(phase)) * 0.05 * intensity;
    if (intensity < 0.05) {
      // Standing still: plant the feet, keep only a faint arm/shoulder breath.
      this.leftLeg.rotation.x = 0;
      this.rightLeg.rotation.x = 0;
      bob = Math.sin(phase * 0.4) * 0.012;
      this.leftArm.rotation.x = Math.sin(phase * 0.4) * 0.05;
      this.rightArm.rotation.x = -Math.sin(phase * 0.4) * 0.05;
    }
    this.upper.position.y = this.upperBaseY + bob;
  }
}
