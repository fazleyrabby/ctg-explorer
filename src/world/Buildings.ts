import * as THREE from "three";
import type { HeightProvider } from "@/geography/WorldHeight";

const BUILDINGS_PATH = "/world/chattogram/compact/buildings.json";

const TYPE_COLORS: Record<string, number> = {
  residential: 0xcabfae,
  commercial: 0xd6cfc0,
  industrial: 0x9aa0a6,
  office: 0xb9c2ce,
  school: 0xd7c39c,
  university: 0xcbb896,
  hospital: 0xd8d3cb,
  religious: 0xe6ddc8,
  government: 0xc7bda6,
  warehouse: 0xa8a49c,
  hotel: 0xd9d3c6,
  stadium: 0xc3c6c9,
  unknown: 0xc2bbaf,
};

const FLOOR_HEIGHT = 3;
const PARAPET = 0.55;
const ROOF_COLOR = 0xd96948;
const DOME_COLOR = 0xd8c48a;
const MINARET_COLOR = 0xe0d6bd;

export interface NamedBuilding {
  id: string;
  name: string;
  type: string;
  x: number;
  z: number;
  height: number;
  wikidata?: string;
  wikipedia?: string;
  description?: string;
}

export interface BuildingData {
  id: string;
  type: string;
  name?: string;
  height: number;
  ring: Array<[number, number]>;
  wikidata?: string;
  wikipedia?: string;
  description?: string;
  amenity?: string;
  tourism?: string;
  roofShape?: string;
  colour?: string;
  levels?: number;
}

interface BuildingsFile {
  buildings: BuildingData[];
}

type Vec3 = [number, number, number];

interface WallBuffer {
  pos: number[];
  col: number[];
  uv: number[];
}
interface RoofBuffer {
  pos: number[];
  col: number[];
}

/**
 * Procedural buildings from real OSM footprints (spec §12–15).
 *
 * A realism pass over the flat extrusions: window facades (procedural texture),
 * per-building color variation, parapets on flat roofs, hip roofs on some small
 * buildings, and domes + minarets on religious buildings. Walls and roofs are
 * separate merged meshes; named buildings are collected for labels and panels.
 */
export class Buildings {
  readonly object: THREE.Group;
  readonly named: NamedBuilding[];
  readonly list: BuildingData[];
  setNight(night:boolean):void {const wall=this.object.getObjectByName("BuildingWalls") as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>;wall.material.emissiveIntensity=night?1.6:0;}

  private constructor(object: THREE.Group, named: NamedBuilding[], list: BuildingData[]) {
    this.object = object;
    this.named = named;
    this.list = list;
  }

  static async load(getHeight: HeightProvider): Promise<Buildings> {
    const response = await fetch(BUILDINGS_PATH);
    if (!response.ok) throw new Error(`Failed to load buildings: ${response.status}`);
    const data = (await response.json()) as BuildingsFile;

    const walls: WallBuffer = { pos: [], col: [], uv: [] };
    const roofs: RoofBuffer = { pos: [], col: [] };
    const color = new THREE.Color();
    const roofColor = new THREE.Color(ROOF_COLOR);
    const named: NamedBuilding[] = [];

    for (const building of data.buildings) {
      const ring = building.ring;
      if (ring.length < 3) continue;

      // Wall bottoms follow the terrain (nothing floats) and the roofline is
      // level. Level it at the HIGHEST ground under the footprint — using the
      // lowest buried the uphill side, making sloped buildings look squashed.
      const base = ring.map(([x, z]) => getHeight(x, z));
      const topLevel = Math.max(...base) + building.height;
      const top = base.map(() => topLevel);
      const centroid = ringCentroid(ring);
      const hash = hashString(building.id);

      color.setHex(TYPE_COLORS[building.type] ?? TYPE_COLORS.unknown!);
      const palette = [0xffe3a6, 0xf4a185, 0x71c7ba, 0xc3b6dc, 0x8dcde3];
      color.setHex(palette[hash % palette.length]!);
      applyVariation(color, hash);
      if (building.name && building.type === "religious") color.setHex(0xe9dfc3);

      // Walls with window UVs (u along the wall, v by height).
      let u = 0;
      for (let i = 0; i < ring.length; i++) {
        const j = (i + 1) % ring.length;
        const a = ring[i]!;
        const b = ring[j]!;
        const segment = Math.hypot(b[0] - a[0], b[1] - a[1]);
        addWall(
          walls,
          color,
          a,
          b,
          base[i]!,
          base[j]!,
          top[i]!,
          top[j]!,
          centroid,
          u / FLOOR_HEIGHT,
          (u + segment) / FLOOR_HEIGHT,
        );
        u += segment;
      }

      // Roof treatment. Named buildings get their hero detail from
      // LandmarkDetails, so only give them the plain shell here.
      const isNamed = Boolean(building.name);
      if (building.type === "religious" && !isNamed) {
        addFlatCap(roofs, ring, top, roofColor);
        addDome(roofs, centroid, top, ring, DOME_COLOR);
        addMinarets(roofs, ring, centroid, top, building.height, MINARET_COLOR);
      } else if (!isNamed && useHipRoof(building, hash)) {
        addHipRoof(roofs, ring, top, roofColor, centroid);
      } else {
        addFlatCap(roofs, ring, top, roofColor);
        addParapet(walls, ring, top, centroid, color);
      }

      if (building.name) {
        const landmark: NamedBuilding = {
          id: building.id,
          name: building.name,
          type: building.type,
          x: centroid[0],
          z: centroid[1],
          height: building.height,
        };
        if (building.wikidata) landmark.wikidata = building.wikidata;
        if (building.wikipedia) landmark.wikipedia = building.wikipedia;
        if (building.description) landmark.description = building.description;
        named.push(landmark);
      }
    }

    const group = new THREE.Group();
    group.name = "Buildings";

    const wallMesh = new THREE.Mesh(
      buildGeometry(walls.pos, walls.col, walls.uv),
      new THREE.MeshStandardMaterial({
        map: createFacadeTexture(),
        emissiveMap:createWindowLightTexture(),emissive:0xffca72,emissiveIntensity:0,
        vertexColors: true,
        roughness: 0.9,
        metalness: 0,
      }),
    );
    wallMesh.name = "BuildingWalls";
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    group.add(wallMesh);

    const roofMesh = new THREE.Mesh(
      buildGeometry(roofs.pos, roofs.col),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }),
    );
    roofMesh.name = "BuildingRoofs";
    roofMesh.castShadow = true;
    roofMesh.receiveShadow = true;
    group.add(roofMesh);

    return new Buildings(group, named, data.buildings);
  }
}

function buildGeometry(pos: number[], col: number[], uv?: number[]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(col), 3));
  if (uv) geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uv), 2));
  geometry.computeVertexNormals();
  return geometry;
}

function pushWall(
  buf: WallBuffer,
  color: THREE.Color,
  p: Vec3,
  u: number,
  v: number,
): void {
  buf.pos.push(p[0], p[1], p[2]);
  buf.col.push(color.r, color.g, color.b);
  buf.uv.push(u, v);
}

function pushRoof(buf: RoofBuffer, color: THREE.Color, p: Vec3): void {
  buf.pos.push(p[0], p[1], p[2]);
  buf.col.push(color.r, color.g, color.b);
}

function addWall(
  buf: WallBuffer,
  color: THREE.Color,
  a: [number, number],
  b: [number, number],
  ay: number,
  by: number,
  aty: number,
  bty: number,
  centroid: [number, number],
  u0: number,
  u1: number,
): void {
  const p0: Vec3 = [a[0], ay, a[1]];
  const p1: Vec3 = [b[0], by, b[1]];
  const p2: Vec3 = [b[0], bty, b[1]];
  const p3: Vec3 = [a[0], aty, a[1]];

  const n = faceNormal(p0, p1, p2);
  const midX = (a[0] + b[0]) / 2;
  const midZ = (a[1] + b[1]) / 2;
  const outward = n[0] * (midX - centroid[0]) + n[2] * (midZ - centroid[1]) >= 0;

  const vtx: Array<[Vec3, number, number]> = [
    [p0, u0, ay / FLOOR_HEIGHT],
    [p1, u1, by / FLOOR_HEIGHT],
    [p2, u1, bty / FLOOR_HEIGHT],
    [p3, u0, aty / FLOOR_HEIGHT],
  ];

  // Non-indexed geometry: each quad must emit two triangles (6 vertices).
  const tri = (i0: number, i1: number, i2: number): void => {
    for (const i of [i0, i1, i2]) {
      const [point, u, v] = vtx[i]!;
      pushWall(buf, color, point, u, v);
    }
  };
  if (outward) {
    tri(0, 1, 2);
    tri(0, 2, 3);
  } else {
    tri(0, 2, 1);
    tri(0, 3, 2);
  }
}

function addParapet(
  buf: WallBuffer,
  ring: Array<[number, number]>,
  top: number[],
  centroid: [number, number],
  color: THREE.Color,
): void {
  let u = 0;
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    const a = ring[i]!;
    const b = ring[j]!;
    const segment = Math.hypot(b[0] - a[0], b[1] - a[1]);
    addWall(
      buf,
      color,
      a,
      b,
      top[i]!,
      top[j]!,
      top[i]! + PARAPET,
      top[j]! + PARAPET,
      centroid,
      u / 1.5,
      (u + segment) / 1.5,
    );
    u += segment;
  }
}

function addFlatCap(buf: RoofBuffer, ring: Array<[number, number]>, top: number[], color: THREE.Color): void {
  const contour = ring.map(([x, z]) => new THREE.Vector2(x, z));
  let faces: number[][] = [];
  try {
    faces = ring.length === 3 ? [[0, 1, 2]] : THREE.ShapeUtils.triangulateShape(contour, []);
  } catch {
    faces = [];
  }
  for (const face of faces) {
    const i0 = face[0]!;
    const i1 = face[1]!;
    const i2 = face[2]!;
    addRoofTriangle(
      buf,
      color,
      [ring[i0]![0], top[i0]! + PARAPET, ring[i0]![1]],
      [ring[i1]![0], top[i1]! + PARAPET, ring[i1]![1]],
      [ring[i2]![0], top[i2]! + PARAPET, ring[i2]![1]],
    );
  }
}

function addHipRoof(
  buf: RoofBuffer,
  ring: Array<[number, number]>,
  top: number[],
  color: THREE.Color,
  centroid: [number, number],
): void {
  const minDim = footprintSize(ring);
  const rise = THREE.MathUtils.clamp(minDim * 0.3, 1.2, 4.5);
  const inset = 0.4;

  const inner = ring.map(([x, z]) => [
    centroid[0] + (x - centroid[0]) * (1 - inset),
    centroid[1] + (z - centroid[1]) * (1 - inset),
  ] as [number, number]);
  const ridgeY = Math.max(...top) + rise;

  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    addQuadUp(
      buf,
      color,
      [ring[i]![0], top[i]!, ring[i]![1]],
      [ring[j]![0], top[j]!, ring[j]![1]],
      [inner[j]![0], ridgeY, inner[j]![1]],
      [inner[i]![0], ridgeY, inner[i]![1]],
    );
  }

  const contour = inner.map(([x, z]) => new THREE.Vector2(x, z));
  let faces: number[][] = [];
  try {
    faces = inner.length === 3 ? [[0, 1, 2]] : THREE.ShapeUtils.triangulateShape(contour, []);
  } catch {
    faces = [];
  }
  for (const face of faces) {
    addRoofTriangle(
      buf,
      color,
      [inner[face[0]!]![0], ridgeY, inner[face[0]!]![1]],
      [inner[face[1]!]![0], ridgeY, inner[face[1]!]![1]],
      [inner[face[2]!]![0], ridgeY, inner[face[2]!]![1]],
    );
  }
}

function addDome(
  buf: RoofBuffer,
  centroid: [number, number],
  top: number[],
  ring: Array<[number, number]>,
  colorHex: number,
): void {
  const color = new THREE.Color(colorHex);
  const size = footprintSize(ring);
  const radius = THREE.MathUtils.clamp(size * 0.28, 1.5, 7);
  const baseY = average(top) + PARAPET;
  const centerX = centroid[0];
  const centerZ = centroid[1];

  const segments = 16;
  const rings = 6;
  for (let r = 0; r < rings; r++) {
    const phi0 = (r / rings) * (Math.PI / 2);
    const phi1 = ((r + 1) / rings) * (Math.PI / 2);
    for (let s = 0; s < segments; s++) {
      const t0 = (s / segments) * Math.PI * 2;
      const t1 = ((s + 1) / segments) * Math.PI * 2;
      const p00: Vec3 = [centerX + radius * Math.cos(phi0) * Math.cos(t0), baseY + radius * Math.sin(phi0), centerZ + radius * Math.cos(phi0) * Math.sin(t0)];
      const p10: Vec3 = [centerX + radius * Math.cos(phi0) * Math.cos(t1), baseY + radius * Math.sin(phi0), centerZ + radius * Math.cos(phi0) * Math.sin(t1)];
      const p11: Vec3 = [centerX + radius * Math.cos(phi1) * Math.cos(t1), baseY + radius * Math.sin(phi1), centerZ + radius * Math.cos(phi1) * Math.sin(t1)];
      const p01: Vec3 = [centerX + radius * Math.cos(phi1) * Math.cos(t0), baseY + radius * Math.sin(phi1), centerZ + radius * Math.cos(phi1) * Math.sin(t0)];
      addQuadUp(buf, color, p00, p10, p11, p01);
    }
  }
}

function addMinarets(
  buf: RoofBuffer,
  ring: Array<[number, number]>,
  centroid: [number, number],
  top: number[],
  height: number,
  colorHex: number,
): void {
  const color = new THREE.Color(colorHex);
  const baseY = Math.max(...top);
  const minaretHeight = THREE.MathUtils.clamp(height * 0.9, 6, 18);
  const radius = 0.45;

  // Place up to four minarets at the extreme ring points.
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, z] of ring) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  const corners: Array<[number, number]> = [
    [minX, minZ], [maxX, minZ], [maxX, maxZ], [minX, maxZ],
  ];
  const useAll = footprintSize(ring) > 250;
  const chosen = useAll ? corners : [corners[0]!, corners[2]!];

  for (const [cx, cz] of chosen) {
    addCylinder(buf, color, cx, cz, baseY, minaretHeight, radius, 8);
    // Small dome cap.
    addSphereCap(buf, color, cx, baseY + minaretHeight, cz, radius * 1.5, 8, 3);
  }
  void centroid;
}

function addCylinder(
  buf: RoofBuffer,
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
    const p00: Vec3 = [x + radius * Math.cos(t0), baseY, z + radius * Math.sin(t0)];
    const p10: Vec3 = [x + radius * Math.cos(t1), baseY, z + radius * Math.sin(t1)];
    const p11: Vec3 = [x + radius * Math.cos(t1), baseY + height, z + radius * Math.sin(t1)];
    const p01: Vec3 = [x + radius * Math.cos(t0), baseY + height, z + radius * Math.sin(t0)];
    addQuadUp(buf, color, p00, p10, p11, p01);
  }
}

function addSphereCap(
  buf: RoofBuffer,
  color: THREE.Color,
  x: number,
  baseY: number,
  z: number,
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
      addQuadUp(
        buf,
        color,
        [x + radius * Math.cos(phi0) * Math.cos(t0), baseY + radius * Math.sin(phi0), z + radius * Math.cos(phi0) * Math.sin(t0)],
        [x + radius * Math.cos(phi0) * Math.cos(t1), baseY + radius * Math.sin(phi0), z + radius * Math.cos(phi0) * Math.sin(t1)],
        [x + radius * Math.cos(phi1) * Math.cos(t1), baseY + radius * Math.sin(phi1), z + radius * Math.cos(phi1) * Math.sin(t1)],
        [x + radius * Math.cos(phi1) * Math.cos(t0), baseY + radius * Math.sin(phi1), z + radius * Math.cos(phi1) * Math.sin(t0)],
      );
    }
  }
}

function addQuadUp(buf: RoofBuffer, color: THREE.Color, p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3): void {
  addRoofTriangle(buf, color, p0, p1, p2);
  addRoofTriangle(buf, color, p0, p2, p3);
}

function addRoofTriangle(buf: RoofBuffer, color: THREE.Color, p0: Vec3, p1: Vec3, p2: Vec3): void {
  const n = faceNormal(p0, p1, p2);
  // Roofs should face upward-ish; flip if pointing down.
  if (n[1] >= 0) {
    pushRoof(buf, color, p0);
    pushRoof(buf, color, p1);
    pushRoof(buf, color, p2);
  } else {
    pushRoof(buf, color, p0);
    pushRoof(buf, color, p2);
    pushRoof(buf, color, p1);
  }
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

function ringCentroid(ring: Array<[number, number]>): [number, number] {
  let x = 0;
  let z = 0;
  for (const [px, pz] of ring) {
    x += px;
    z += pz;
  }
  return [x / ring.length, z / ring.length];
}

function footprintSize(ring: Array<[number, number]>): number {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, z] of ring) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  return Math.min(maxX - minX, maxZ - minZ);
}

function average(values: number[]): number {
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

function useHipRoof(building: BuildingData, hash: number): boolean {
  if (building.type !== "residential" && building.type !== "unknown") return false;
  const size = footprintSize(building.ring);
  return size > 6 && size < 16 && building.height <= 12 && hash % 3 === 0;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Subtle per-building tint/brightness variation so rows don't look cloned. */
function applyVariation(color: THREE.Color, hash: number): void {
  const brightness = 0.86 + ((hash % 100) / 100) * 0.28;
  const warm = ((hash >> 8) % 20) / 100 - 0.1;
  color.multiplyScalar(brightness);
  color.offsetHSL(0, -0.04 * warm, 0);
}

/** Procedural facade texture: one window per UV tile, multiplied by vertex color. */
function createFacadeTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);

  // Window (darker glass).
  ctx.fillStyle = "rgba(28, 38, 50, 0.55)";
  ctx.fillRect(size * 0.22, size * 0.2, size * 0.56, size * 0.48);
  ctx.fillStyle = "rgba(255, 255, 255, 0.10)";
  ctx.fillRect(size * 0.22, size * 0.2, size * 0.56, size * 0.14);

  // Floor separation line at the tile edge.
  ctx.fillStyle = "rgba(0, 0, 0, 0.14)";
  ctx.fillRect(0, size - 4, size, 4);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createWindowLightTexture():THREE.DataTexture {
 const size=64,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=(y*size+x)*4,lit=x>size*.22&&x<size*.78&&y>size*.32&&y<size*.80;
  data[i]=data[i+1]=data[i+2]=lit?255:0;data[i+3]=255;
 }
 const texture=new THREE.DataTexture(data,size,size);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearFilter;texture.needsUpdate=true;return texture;
}
