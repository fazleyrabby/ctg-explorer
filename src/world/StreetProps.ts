import {inRailway} from "@/geography/RailwayLayout";
import {inLaldighi} from "@/geography/PondLayout";
import {inShopRows} from "@/geography/ShopRowLayout";
import {segmentDistance} from "@/geography/CityGeography";
import * as THREE from "three";
import type { HeightProvider } from "@/geography/WorldHeight";
import type { RoadData } from "@/world/Roads";

const POLE_SPACING = 34;
const POLE_HEIGHT = 7.5;
const POLE_SIDE_OFFSET = 1.1;
const TREE_EVERY = 3;
const TREE_OFFSET = 3.0;
const WIRE_SEGMENTS = 8;
const WIRE_SAG = 0.9;

interface Placed {
  x: number;
  z: number;
  y: number;
  angle: number;
}

/**
 * Roadside environment (spec §41): electric utility poles with sagging cables
 * and street trees, placed along the major roads on the sidewalk line. Poles,
 * crossarms, tree trunks and foliage are all InstancedMesh (spec §23, §38).
 */
export class StreetProps {
  readonly object: THREE.Group;
  private readonly lampMaterial=new THREE.MeshStandardMaterial({color:0xffebbd,emissive:0xffc96a,emissiveIntensity:0});
  private readonly poolMaterial=new THREE.MeshBasicMaterial({color:0xffd78b,transparent:true,opacity:0,depthWrite:false});
  setNight(night:boolean):void{this.lampMaterial.emissiveIntensity=night?2.5:0;this.poolMaterial.opacity=night?.13:0;}

  constructor(roads: RoadData[], getHeight: HeightProvider, elevated: RoadData[] = []) {
    this.object = new THREE.Group();
    this.object.name = "StreetProps";

    const poles: Placed[] = [];
    const trees: Placed[] = [];

    for (const road of roads) {
      if (road.points.length < 2) continue;
      const offset = road.width / 2 + POLE_SIDE_OFFSET;
      let travelled = 0;
      let sincePole = POLE_SPACING * 0.5;

      for (let i = 0; i < road.points.length - 1; i++) {
        const a = road.points[i]!;
        const b = road.points[i + 1]!;
        const dx = b[0] - a[0];
        const dz = b[1] - a[1];
        const len = Math.hypot(dx, dz);
        if (len < 0.01) continue;
        const dirX = dx / len;
        const dirZ = dz / len;
        const nX = -dirZ;
        const nZ = dirX;
        const angle = Math.atan2(dirX, dirZ);

        let t = 0;
        while (t < len) {
          const step = Math.min(POLE_SPACING - sincePole, len - t);
          sincePole += step;
          t += step;
          if (sincePole >= POLE_SPACING - 0.01) {
            sincePole = 0;
            const px = a[0] + dirX * t + nX * offset;
            const pz = a[1] + dirZ * t + nZ * offset;
            if(inRailway(px,pz,7)||inLaldighi(px,pz,7))continue;
            if(elevated.some(r=>r.points.slice(1).some((b,i)=>segmentDistance(px,pz,r.points[i]!,b)<r.width/2+7)))continue;
            poles.push({ x: px, z: pz, y: getHeight(px, pz), angle });

            if (poles.length % TREE_EVERY === 0) {
              const tx = a[0] + dirX * t + nX * (offset + TREE_OFFSET);
              const tz = a[1] + dirZ * t + nZ * (offset + TREE_OFFSET);
              // Old-town shop fronts keep their awnings and doors clear of trunks.
              if (!inShopRows(tx, tz, 1.5)) trees.push({ x: tx, z: tz, y: getHeight(tx, tz), angle: poles.length * 0.7 });
            }
          }
        }
        travelled += len;
      }
      void travelled;
    }

    this.object.add(buildPoles(poles));
    const heads=new THREE.InstancedMesh(new THREE.BoxGeometry(1.5,.25,.7),this.lampMaterial,poles.length);
    const pools=new THREE.InstancedMesh(new THREE.CircleGeometry(3.7,16).rotateX(-Math.PI/2),this.poolMaterial,poles.length);
    const matrix=new THREE.Matrix4();poles.forEach((p,i)=>{matrix.makeTranslation(p.x,p.y+POLE_HEIGHT-.6,p.z);heads.setMatrixAt(i,matrix);matrix.makeTranslation(p.x,p.y+.07,p.z);pools.setMatrixAt(i,matrix);});
    heads.name='Street lamp heads';pools.name='Street lamp pools';this.object.add(heads,pools);
    this.object.add(buildTrees(trees));
    // Wires are intentionally omitted in the miniature district.
    void buildWires;
  }
}

function buildPoles(poles: Placed[]): THREE.Group {
  const group = new THREE.Group();
  const count = poles.length;
  if (count === 0) return group;

  const poleGeo = new THREE.CylinderGeometry(0.13, 0.16, POLE_HEIGHT, 6);
  poleGeo.translate(0, POLE_HEIGHT / 2, 0);
  const armGeo = new THREE.BoxGeometry(2.2, 0.12, 0.12);
  armGeo.translate(0, POLE_HEIGHT - 0.7, 0);

  const material = new THREE.MeshStandardMaterial({ color: 0x6b6b6b, roughness: 0.9 });
  const poleMesh = new THREE.InstancedMesh(poleGeo, material, count);
  const armMesh = new THREE.InstancedMesh(armGeo, material, count);
  poleMesh.castShadow = true;
  armMesh.castShadow = true;

  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  const pos = new THREE.Vector3();
  poles.forEach((pole, index) => {
    quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pole.angle);
    pos.set(pole.x, pole.y, pole.z);
    matrix.compose(pos, quat, scale);
    poleMesh.setMatrixAt(index, matrix);
    armMesh.setMatrixAt(index, matrix);
  });
  poleMesh.instanceMatrix.needsUpdate = true;
  armMesh.instanceMatrix.needsUpdate = true;

  group.add(poleMesh, armMesh);
  return group;
}

function buildTrees(trees: Placed[]): THREE.Group {
  const group = new THREE.Group();
  const count = trees.length;
  if (count === 0) return group;

  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.22, 2.2, 6);
  trunkGeo.translate(0, 1.1, 0);
  const foliageGeo = new THREE.IcosahedronGeometry(1.7, 0);
  foliageGeo.translate(0, 3.1, 0);

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5b4632, roughness: 1 });
  const foliageMat = new THREE.MeshStandardMaterial({ color: 0x3f6b34, roughness: 1, flatShading: true });

  const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
  const foliageMesh = new THREE.InstancedMesh(foliageGeo, foliageMat, count);
  trunkMesh.castShadow = true;
  foliageMesh.castShadow = true;

  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const pos = new THREE.Vector3();
  trees.forEach((tree, index) => {
    const s = 0.7 + ((index * 37) % 60) / 100;
    quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), tree.angle);
    scale.set(s, s, s);
    pos.set(tree.x, tree.y, tree.z);
    matrix.compose(pos, quat, scale);
    trunkMesh.setMatrixAt(index, matrix);
    foliageMesh.setMatrixAt(index, matrix);
  });
  trunkMesh.instanceMatrix.needsUpdate = true;
  foliageMesh.instanceMatrix.needsUpdate = true;

  group.add(trunkMesh, foliageMesh);
  return group;
}

function buildWires(poles: Placed[]): THREE.LineSegments {
  const positions: number[] = [];
  const top = POLE_HEIGHT - 0.7;

  // Connect consecutive poles by index (approximate: they were pushed in road order).
  for (let i = 0; i < poles.length - 1; i++) {
    const a = poles[i]!;
    const b = poles[i + 1]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const dist = Math.hypot(dx, dz);
    // Skip gaps that are clearly different roads.
    if (dist > POLE_SPACING * 2.5) continue;

    const y0 = a.y + top;
    const y1 = b.y + top;
    const sag = Math.min(WIRE_SAG, dist * 0.03);
    let prevX = a.x;
    let prevY = y0;
    let prevZ = a.z;
    for (let s = 1; s <= WIRE_SEGMENTS; s++) {
      const u = s / WIRE_SEGMENTS;
      const x = a.x + dx * u;
      const z = a.z + dz * u;
      const y = y0 + (y1 - y0) * u - Math.sin(u * Math.PI) * sag;
      positions.push(prevX, prevY, prevZ, x, y, z);
      prevX = x;
      prevY = y;
      prevZ = z;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({ color: 0x1b1b1b, transparent: true, opacity: 0.7 });
  const lines = new THREE.LineSegments(geometry, material);
  lines.name = "PowerLines";
  return lines;
}
