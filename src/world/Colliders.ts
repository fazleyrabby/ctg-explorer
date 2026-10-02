import * as THREE from "three";
import type { BuildingData } from "@/world/Buildings";
import type { HeightProvider } from "@/geography/WorldHeight";

/** Axis-aligned footprint used for cheap collision and camera occlusion. */
export interface CollisionBox {
  minX: number; maxX: number;
  minZ: number; maxZ: number;
  bottom: number; top: number;
  /**
   * Mapped footprint outline. When present, push-out follows the real walls,
   * so a rotated building's bounding box no longer blocks the street beside it.
   */
  ring?: Array<[number, number]>;
}

const CELL = 20;

/**
 * Solid building footprints on a uniform grid (spec §30). Buildings were drawn
 * as merged geometry with no collision, so the player and camera passed through
 * them; this gives an O(1)-ish broadphase to push out of walls and to pull the
 * camera in front of them.
 */
export class Colliders {
  private readonly grid = new Map<number, CollisionBox[]>();
  count = 0;

  constructor(buildings: BuildingData[], getHeight: HeightProvider) {
    this.addBuildings(buildings,getHeight);
  }

  addBuildings(buildings: BuildingData[], getHeight: HeightProvider):void {
    for (const building of buildings) {
      if (building.ring.length < 3) continue;
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, bottom = Infinity;
      for (const [x, z] of building.ring) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
        const g = getHeight(x, z);
        if (g < bottom) bottom = g;
      }
      const box: CollisionBox = { minX, maxX, minZ, maxZ, bottom, top: Math.max(...building.ring.map(([x,z])=>getHeight(x,z))) + building.height, ring: building.ring };
      this.insert(box);
      this.count++;
    }
  }

  addBox(box:CollisionBox):void {this.insert(box);this.count++;}

  private key(cx: number, cz: number): number {
    return (cx + 4096) * 8192 + (cz + 4096);
  }

  private insert(box: CollisionBox): void {
    const x0 = Math.floor(box.minX / CELL), x1 = Math.floor(box.maxX / CELL);
    const z0 = Math.floor(box.minZ / CELL), z1 = Math.floor(box.maxZ / CELL);
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
      const k = this.key(cx, cz);
      const bucket = this.grid.get(k);
      if (bucket) bucket.push(box);
      else this.grid.set(k, [box]);
    }
  }

  private eachNear(x: number, z: number, radius: number, visit: (box: CollisionBox) => void): void {
    const seen = new Set<CollisionBox>();
    const x0 = Math.floor((x - radius) / CELL), x1 = Math.floor((x + radius) / CELL);
    const z0 = Math.floor((z - radius) / CELL), z1 = Math.floor((z + radius) / CELL);
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
      const bucket = this.grid.get(this.key(cx, cz));
      if (!bucket) continue;
      for (const box of bucket) {
        if (seen.has(box)) continue;
        seen.add(box);
        visit(box);
      }
    }
  }

  /** Pushes a circle out of any building it overlaps (below the roofline). */
  resolve(position: THREE.Vector3, radius: number): void {
    for(let pass=0;pass<3;pass++)this.eachNear(position.x, position.z, radius + CELL, (b) => {
      if (position.y >= b.top-.02 || position.y+1.7 < b.bottom) return;
      if (b.ring) {
        if (position.x < b.minX - radius || position.x > b.maxX + radius || position.z < b.minZ - radius || position.z > b.maxZ + radius) return;
        pushOutOfRing(position, radius, b.ring);
        return;
      }
      const nx = Math.max(b.minX, Math.min(position.x, b.maxX));
      const nz = Math.max(b.minZ, Math.min(position.z, b.maxZ));
      const dx = position.x - nx, dz = position.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) return;
      if (d2 > 1e-6) {
        const push = (radius - Math.sqrt(d2)) / Math.sqrt(d2);
        position.x += dx * push;
        position.z += dz * push;
        return;
      }
      // Centre is inside the box: exit through the nearest face.
      const left = position.x - b.minX, right = b.maxX - position.x;
      const front = position.z - b.minZ, back = b.maxZ - position.z;
      const min = Math.min(left, right, front, back);
      if (min === left) position.x = b.minX - radius;
      else if (min === right) position.x = b.maxX + radius;
      else if (min === front) position.z = b.minZ - radius;
      else position.z = b.maxZ + radius;
    });
  }

  /** Distance from `origin` to the first building along `dir`, or maxDist. */
  rayDistance(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): number {
    let nearest = maxDist;
    const seen = new Set<CollisionBox>();
    const step = CELL * 0.5;
    for (let t = 0; t <= maxDist + step; t += step) {
      const px = origin.x + dir.x * t, pz = origin.z + dir.z * t;
      this.eachNear(px, pz, CELL, (b) => {
        if (seen.has(b)) return;
        seen.add(b);
        const hit = rayBox(origin, dir, b);
        if (hit >= 0 && hit < nearest) nearest = hit;
      });
    }
    return nearest;
  }
}

/** Moves a circle out of a footprint polygon along its nearest wall. */
function pushOutOfRing(position: THREE.Vector3, radius: number, ring: Array<[number, number]>): void {
  const x = position.x, z = position.z;
  let best = Infinity, nearX = x, nearZ = z, inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!, b = ring[j]!;
    const ex = b[0] - a[0], ez = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[1]) * ez) / (ex * ex + ez * ez || 1)));
    const px = a[0] + ex * t, pz = a[1] + ez * t;
    const d = Math.hypot(x - px, z - pz);
    if (d < best) { best = d; nearX = px; nearZ = pz; }
    if ((a[1] > z) !== (b[1] > z) && x < (ex * (z - a[1])) / ez + a[0]) inside = !inside;
  }
  if (!inside && best >= radius) return;
  if (best < 1e-6) return;
  // From outside, back away from the wall; from inside, leave through it.
  const sign = inside ? -1 : 1;
  position.x = nearX + ((x - nearX) / best) * radius * sign;
  position.z = nearZ + ((z - nearZ) / best) * radius * sign;
}

/** Slab test; returns entry distance in [0,maxDist] or -1. */
function rayBox(origin: THREE.Vector3, dir: THREE.Vector3, b: CollisionBox): number {
  let tmin = 0, tmax = Infinity;
  for (const axis of ["x", "y", "z"] as const) {
    const o = origin[axis], d = dir[axis];
    const lo = axis === "x" ? b.minX : axis === "z" ? b.minZ : b.bottom;
    const hi = axis === "x" ? b.maxX : axis === "z" ? b.maxZ : b.top;
    if (Math.abs(d) < 1e-8) {
      if (o < lo || o > hi) return -1;
    } else {
      let t1 = (lo - o) / d, t2 = (hi - o) / d;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return -1;
    }
  }
  return tmin;
}
