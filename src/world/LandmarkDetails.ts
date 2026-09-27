import * as THREE from "three";
import type { HeightProvider } from "@/geography/WorldHeight";
import type { BuildingData, NamedBuilding } from "@/world/Buildings";

const STONE = 0xcabfa8;
const RELIGIOUS_STONE = 0xe8dfc8;
const DOME = 0xd7c489;
const MINARET = 0xefe8d4;
const CIVIC = 0xc9c0aa;
const SCHOOL = 0xd7c39c;
const ACCENT = 0x9c8f78;

type Vec3 = [number, number, number];
type Point = [number, number];

interface Buffer {
  pos: number[];
  col: number[];
}

/**
 * Extra architectural detail for named buildings (spec §16).
 *
 * Named buildings keep the procedural shell but gain a plinth, a cornice, and a
 * type-inspired treatment: mosques get a drummed dome, four minarets and an
 * arched portal; civic/commercial buildings get a colonnaded portico with a
 * parapet sign band; schools get a flag pole. Stylised, not literal replicas
 * (spec §76–77).
 */
export class LandmarkDetails {
  readonly object: THREE.Mesh;

  private constructor(object: THREE.Mesh) {
    this.object = object;
  }

  static build(
    list: BuildingData[],
    named: NamedBuilding[],
    getHeight: HeightProvider,
  ): LandmarkDetails {
    const byId = new Map(list.map((b) => [b.id, b]));
    const buf: Buffer = { pos: [], col: [] };
    const color = new THREE.Color();

    for (const landmark of named) {
      const data = byId.get(landmark.id);
      if (!data) continue;
      const ring = data.ring;
      if (ring.length < 3) continue;

      const ground = ring.map(([x, z]) => getHeight(x, z));
      const baseLevel = Math.max(...ground);
      const topLevel = baseLevel + data.height;
      const centroid = ringCentroid(ring);
      const size = footprintSize(ring);

      const type = data.type;
      if (type === "religious") color.setHex(RELIGIOUS_STONE);
      else if (type === "school" || type === "university") color.setHex(SCHOOL);
      else color.setHex(CIVIC);

      // Plinth and cornice.
      band(buf, color, outset(ring, 0.8, centroid), baseLevel - 0.3, baseLevel + 1.0, centroid);
      band(buf, color, outset(ring, 0.5, centroid), topLevel - 0.8, topLevel + 0.3, centroid);

      if (landmark.name.includes("Buddhist")) {
        // A stepped temple roof, rather than the mosque treatment.
        const red = new THREE.Color(0xa95643);
        for (let tier = 0; tier < 3; tier++) {
          const width = Math.max(4, size * (1.1 - tier * .22));
          box(buf, red, [centroid[0], topLevel + tier * 2 + .5, centroid[1]], [width, .8, width]);
          box(buf, color, [centroid[0], topLevel + tier * 2 + 1.2, centroid[1]], [width * .65, 1, width * .65]);
        }
        cylinder(buf, new THREE.Color(DOME), centroid[0], centroid[1], topLevel + 6, 3, .35, 8);
      } else if (type === "religious") {
        religiousDetails(buf, landmark, ring, ground, topLevel, centroid, size);
      } else {
        civicDetails(buf, ring, ground, topLevel, centroid, size, color);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(buf.pos), 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(buf.col), 3));
    geometry.computeVertexNormals();

    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }),
    );
    mesh.name = "LandmarkDetails";
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    void STONE;
    void ACCENT;
    return new LandmarkDetails(mesh);
  }
}

function religiousDetails(
  buf: Buffer,
  landmark: NamedBuilding,
  ring: Point[],
  ground: number[],
  topLevel: number,
  centroid: Point,
  size: number,
): void {
  const domeColor = new THREE.Color(DOME);
  const minaretColor = new THREE.Color(MINARET);

  const radius = THREE.MathUtils.clamp(size * 0.22, 2, 6.5);

  // Drum beneath the dome.
  cylinder(buf, domeColor, centroid[0], centroid[1], topLevel + 0.3, 2.2, radius * 1.05, 20);
  // Dome.
  domeMesh(buf, domeColor, centroid[0], centroid[1], topLevel + 2.5, radius, 22, 8);
  // Finial.
  cylinder(buf, minaretColor, centroid[0], centroid[1], topLevel + 2.5 + radius, 1.6, 0.16, 6);

  // Four corner minarets with small domed caps.
  const corners = ringExtremes(ring);
  for (const [cx, cz] of corners) {
    const minaretHeight = THREE.MathUtils.clamp(landmark.height * 0.85, 8, 20);
    cylinder(buf, minaretColor, cx, cz, topLevel - 1, minaretHeight, 0.55, 10);
    domeMesh(buf, domeColor, cx, cz, topLevel - 1 + minaretHeight, 0.75, 10, 4);
  }

  // Arched portal on the longest edge.
  const front = longestEdge(ring, ground);
  const portalHeight = THREE.MathUtils.clamp(landmark.height * 0.55, 4, 9);
  addPortal(buf, minaretColor, front.a, front.b, front.aY, front.bY, portalHeight);
}

function civicDetails(
  buf: Buffer,
  ring: Point[],
  ground: number[],
  topLevel: number,
  centroid: Point,
  size: number,
  color: THREE.Color,
): void {
  const front = longestEdge(ring, ground);
  const columns = size > 30 ? 6 : 4;
  const radius = 0.45;
  const height = THREE.MathUtils.clamp(size * 0.25, 3, 7);

  for (let i = 0; i < columns; i++) {
    const t = (i + 0.5) / columns;
    const x = front.a[0] + (front.b[0] - front.a[0]) * t;
    const z = front.a[1] + (front.b[1] - front.a[1]) * t;
    const g = ground[0]!;
    cylinder(buf, color, x, z, g, height, radius, 10);
  }

  // Portico roof slab above the columns.
  const nx = front.normal[0];
  const nz = front.normal[1];
  const midX = (front.a[0] + front.b[0]) / 2;
  const midZ = (front.a[1] + front.b[1]) / 2;
  const half = Math.hypot(front.b[0] - front.a[0], front.b[1] - front.a[1]) / 2;
  const depth = 3;
  const slabCenter: Vec3 = [midX + nx * depth * 0.5, ground[0]! + height + 0.3, midZ + nz * depth * 0.5];
  box(buf, color, slabCenter, [half * 2 + 1.2, 0.5, depth + 1.2]);
  void topLevel;
  void centroid;
}

function addPortal(buf: Buffer, color: THREE.Color, a: Point, b: Point, aY: number, bY: number, height: number): void {
  const midX = (a[0] + b[0]) / 2;
  const midZ = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz) || 1;
  const nx = -dz / len;
  const nz = dx / len;
  const width = 6;

  // Two jambs and a lintel forming a simple arch frame.
  const jamb = (offset: number): void => {
    const cx = midX + (dx / len) * offset;
    const cz = midZ + (dz / len) * offset;
    box(buf, color, [cx, (aY + bY) / 2 + height * 0.5, cz], [1.0, height, 1.0]);
  };
  jamb(-width / 2);
  jamb(width / 2);
  // Lintel/arch cap.
  box(buf, color, [midX + nx * 0.2, (aY + bY) / 2 + height + 0.5, midZ + nz * 0.2], [width + 2, 1.0, 1.4]);
}

// ---------------------------------------------------------------- primitives

function band(buf: Buffer, color: THREE.Color, ring: Point[], y0: number, y1: number, centroid: Point): void {
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    const a = ring[i]!;
    const b = ring[j]!;
    const p0: Vec3 = [a[0], y0, a[1]];
    const p1: Vec3 = [b[0], y0, b[1]];
    const p2: Vec3 = [b[0], y1, b[1]];
    const p3: Vec3 = [a[0], y1, a[1]];
    quad(buf, color, p0, p1, p2, p3, "out", centroid);
    quad(buf, color, p1, p0, p3, p2, "out", centroid);
  }
}

function cylinder(
  buf: Buffer,
  color: THREE.Color,
  x: number,
  z: number,
  baseY: number,
  height: number,
  radius: number,
  segments: number,
): void {
  for (let s = 0; s < segments; s++) {
    const t0 = (s / segments) * Math.PI * 2;
    const t1 = ((s + 1) / segments) * Math.PI * 2;
    quad(
      buf,
      color,
      [x + radius * Math.cos(t0), baseY, z + radius * Math.sin(t0)],
      [x + radius * Math.cos(t1), baseY, z + radius * Math.sin(t1)],
      [x + radius * Math.cos(t1), baseY + height, z + radius * Math.sin(t1)],
      [x + radius * Math.cos(t0), baseY + height, z + radius * Math.sin(t0)],
      "out",
      [x, z],
    );
  }
}

function domeMesh(
  buf: Buffer,
  color: THREE.Color,
  x: number,
  z: number,
  baseY: number,
  radius: number,
  segments: number,
  rings: number,
): void {
  for (let r = 0; r < rings; r++) {
    const phi0 = (r / rings) * (Math.PI / 2);
    const phi1 = ((r + 1) / rings) * (Math.PI / 2);
    for (let s = 0; s < segments; s++) {
      const t0 = (s / segments) * Math.PI * 2;
      const t1 = ((s + 1) / segments) * Math.PI * 2;
      quad(
        buf,
        color,
        [x + radius * Math.cos(phi0) * Math.cos(t0), baseY + radius * Math.sin(phi0), z + radius * Math.cos(phi0) * Math.sin(t0)],
        [x + radius * Math.cos(phi0) * Math.cos(t1), baseY + radius * Math.sin(phi0), z + radius * Math.cos(phi0) * Math.sin(t1)],
        [x + radius * Math.cos(phi1) * Math.cos(t1), baseY + radius * Math.sin(phi1), z + radius * Math.cos(phi1) * Math.sin(t1)],
        [x + radius * Math.cos(phi1) * Math.cos(t0), baseY + radius * Math.sin(phi1), z + radius * Math.cos(phi1) * Math.sin(t0)],
        "up",
      );
    }
  }
}

function box(buf: Buffer, color: THREE.Color, center: Vec3, size: [number, number, number]): void {
  const [cx, cy, cz] = center;
  const [sx, sy, sz] = size;
  const hx = sx / 2;
  const hy = sy / 2;
  const hz = sz / 2;
  const c = (dx: number, dy: number, dz: number): Vec3 => [cx + dx, cy + dy, cz + dz];

  const faces: Array<[Vec3, Vec3, Vec3, Vec3]> = [
    [c(-hx, -hy, -hz), c(hx, -hy, -hz), c(hx, hy, -hz), c(-hx, hy, -hz)], // -z
    [c(-hx, -hy, hz), c(hx, -hy, hz), c(hx, hy, hz), c(-hx, hy, hz)], // +z
    [c(-hx, -hy, -hz), c(-hx, -hy, hz), c(-hx, hy, hz), c(-hx, hy, -hz)], // -x
    [c(hx, -hy, -hz), c(hx, -hy, hz), c(hx, hy, hz), c(hx, hy, -hz)], // +x
    [c(-hx, hy, -hz), c(hx, hy, -hz), c(hx, hy, hz), c(-hx, hy, hz)], // top
  ];
  for (const [p0, p1, p2, p3] of faces) quad(buf, color, p0, p1, p2, p3, "up");
}

function quad(
  buf: Buffer,
  color: THREE.Color,
  p0: Vec3,
  p1: Vec3,
  p2: Vec3,
  p3: Vec3,
  mode: "up" | "out",
  ref?: Point,
): void {
  const n = faceNormal(p0, p1, p2);
  let flip = false;
  if (mode === "up") {
    flip = n[1] < 0;
  } else if (ref) {
    const mx = (p0[0] + p1[0]) / 2;
    const mz = (p0[2] + p1[2]) / 2;
    flip = n[0] * (mx - ref[0]) + n[2] * (mz - ref[1]) < 0;
  }
  const tri = (a: Vec3, b: Vec3, c: Vec3): void => {
    const pts = flip ? [a, c, b] : [a, b, c];
    for (const p of pts) {
      buf.pos.push(p[0], p[1], p[2]);
      buf.col.push(color.r, color.g, color.b);
    }
  };
  tri(p0, p1, p2);
  tri(p0, p2, p3);
}

// ---------------------------------------------------------------- geometry utils

function outset(ring: Point[], amount: number, centroid: Point): Point[] {
  return ring.map(([x, z]) => {
    const dx = x - centroid[0];
    const dz = z - centroid[1];
    const len = Math.hypot(dx, dz) || 1;
    return [x + (dx / len) * amount, z + (dz / len) * amount] as Point;
  });
}

function ringCentroid(ring: Point[]): Point {
  let x = 0;
  let z = 0;
  for (const [px, pz] of ring) {
    x += px;
    z += pz;
  }
  return [x / ring.length, z / ring.length];
}

function footprintSize(ring: Point[]): number {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, z] of ring) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  return Math.min(maxX - minX, maxZ - minZ);
}

function ringExtremes(ring: Point[]): Point[] {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, z] of ring) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  const inset = 1.2;
  return [
    [minX + inset, minZ + inset],
    [maxX - inset, minZ + inset],
    [maxX - inset, maxZ - inset],
    [minX + inset, maxZ - inset],
  ];
}

interface Edge {
  a: Point;
  b: Point;
  aY: number;
  bY: number;
  normal: Point;
}

function longestEdge(ring: Point[], ground: number[]): Edge {
  let best = 0;
  let bestLen = -1;
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    const len = Math.hypot(ring[j]![0] - ring[i]![0], ring[j]![1] - ring[i]![1]);
    if (len > bestLen) {
      bestLen = len;
      best = i;
    }
  }
  const j = (best + 1) % ring.length;
  const a = ring[best]!;
  const b = ring[j]!;
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz) || 1;
  const centroid = ringCentroid(ring);
  let nx = -dz / len;
  let nz = dx / len;
  const midX = (a[0] + b[0]) / 2;
  const midZ = (a[1] + b[1]) / 2;
  if (nx * (midX - centroid[0]) + nz * (midZ - centroid[1]) < 0) {
    nx = -nx;
    nz = -nz;
  }
  return { a, b, aY: ground[best] ?? 0, bY: ground[j] ?? 0, normal: [nx, nz] };
}

function faceNormal(a: Vec3, b: Vec3, c: Vec3): Vec3 {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
}
