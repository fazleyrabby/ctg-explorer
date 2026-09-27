import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {geoToLocal} from '@/geography/Projection';
import type {HeightProvider} from '@/geography/WorldHeight';

const RUNWAY_LENGTH = 200;
const RUNWAY_WIDTH = 20;
const PERIOD = 46;

const AIRPORT = geoToLocal({latitude: 22.2496, longitude: 91.8133});

/** Rectangular keep-clear zone around the runway and apron; shared with infill. */
export function inAirportDistrict(x: number, z: number, margin = 0): boolean {
  return Math.abs(x - AIRPORT.x) < 72 + margin
    && z > AIRPORT.z - 70 - margin && z < AIRPORT.z + 210 + margin;
}

function buildPlane(accent: number): THREE.Group {
  const group = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({color: 0xf4f6f8, roughness: .5});
  const paint = new THREE.MeshStandardMaterial({color: accent, roughness: .5});
  const dark = new THREE.MeshStandardMaterial({color: 0x2b3138, roughness: .5});
  const add = (geo: THREE.BufferGeometry, x: number, y: number, z: number, mat: THREE.Material) => {
    const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, y, z); mesh.castShadow = true; group.add(mesh); return mesh;
  };
  add(new THREE.CapsuleGeometry(1.6, 13, 6, 12).rotateX(Math.PI / 2), 0, 0, 0, white);
  add(new THREE.ConeGeometry(1.6, 3.4, 12).rotateX(Math.PI / 2), 0, 0, 8.5, white);
  add(new THREE.BoxGeometry(24, .45, 4.6), 0, -.5, -.4, white);
  add(new THREE.BoxGeometry(9.5, .4, 2.6), 0, .35, -6.6, white);
  add(new THREE.BoxGeometry(.5, 3.6, 3.2), 0, 2.1, -6.6, paint);
  for (const side of [-1, 1]) {
    add(new THREE.CylinderGeometry(1, 1, 3.4, 12).rotateX(Math.PI / 2), side * 7, -1.3, .6, dark);
    add(new THREE.CylinderGeometry(1.15, 1.15, .5, 12).rotateX(Math.PI / 2), side * 7, -1.3, 2.2, paint);
  }
  add(new THREE.BoxGeometry(2.6, .8, 1.6), 0, .9, 6.8, dark);
  add(new THREE.BoxGeometry(3, .35, 9), 0, .7, 2.6, paint);
  group.name = 'Airliner';
  return group;
}

/** Shah Amanat Airport: a runway with airliners that take off and land on a loop. */
export class Airport {
  readonly object = new THREE.Group();
  private readonly planes: THREE.Group[] = [];
  private readonly curves: THREE.CatmullRomCurve3[] = [];
  private readonly baseY: number;
  private readonly height: HeightProvider;
  private time = 0;

  constructor(height: HeightProvider) {
    this.object.name = 'ShahAmanatAirport';
    this.height = height;
    const a = AIRPORT;
    const x0 = a.x - 25, z0 = a.z - 30;
    const gy = height(a.x, z0 + RUNWAY_LENGTH / 2);
    this.baseY = gy + 2.6;

    // Ground surfaces are lifted above the road/terrain layer so the runway
    // never z-fights the airport access road that crosses it.
    const parts: THREE.BufferGeometry[] = [];
    const add = (geo: THREE.BufferGeometry, color: number, ax: number, ay: number, az: number, ry = 0) => {
      geo.rotateY(ry).translate(ax, ay, az);
      const c = new THREE.Color(color), n = geo.getAttribute('position').count, arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
      geo.deleteAttribute('uv'); geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      parts.push(geo.index ? geo.toNonIndexed() : geo);
    };
    const flat = (w: number, d: number, color: number, x: number, z: number, lift: number, ry = 0) => {
      const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2);
      const p = g.getAttribute('position');
      for (let i = 0; i < p.count; i++) p.setY(i, height(x + p.getX(i), z + p.getZ(i)) - height(x, z) + lift);
      g.computeVertexNormals(); add(g, color, x, height(x, z), z, ry);
    };

    flat(RUNWAY_WIDTH, RUNWAY_LENGTH, 0x41474d, x0, z0 + RUNWAY_LENGTH / 2, .16);
    flat(10, 46, 0x5a6169, x0 + 16, z0 + 33, .16);
    flat(26, 32, 0x6d747c, x0 + 34, z0 + 8, .16);
    for (let i = 0; i < 10; i++) flat(1.4, 8, 0xf3f2ea, x0, z0 + 18 + i * 18, .24);
    for (const s of [-1, 1]) for (let i = 0; i < 6; i++) flat(1.2, 5, 0xf3f2ea, x0 + s * (RUNWAY_WIDTH / 2 - 2.5), z0 + 8 + i * 3, .24);

    const geometry = mergeGeometries(parts);
    if (geometry) {
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({vertexColors: true, roughness: .9}));
      mesh.receiveShadow = true; this.object.add(mesh);
    }

    // Flight loop: apron -> takeoff -> wide circuit -> approach -> touchdown -> apron.
    const b = this.baseY, g = gy;
    const path = [
      new THREE.Vector3(x0 + 34, b, z0 + 8),
      new THREE.Vector3(x0, b, z0 + 6),
      new THREE.Vector3(x0, b, z0 + RUNWAY_LENGTH),
      new THREE.Vector3(x0 + 130, g + 46, z0 + RUNWAY_LENGTH + 150),
      new THREE.Vector3(x0 + 340, g + 100, z0 + 560),
      new THREE.Vector3(x0 + 150, g + 78, z0 - 250),
      new THREE.Vector3(x0, g + 44, z0 - 420),
      new THREE.Vector3(x0, b, z0),
      new THREE.Vector3(x0, b, z0 + RUNWAY_LENGTH * .55),
    ];
    for (let i = 0; i < 2; i++) {
      const plane = buildPlane(i === 0 ? 0xd6452f : 0x2f6fb0);
      this.object.add(plane); this.planes.push(plane);
      this.curves.push(new THREE.CatmullRomCurve3(path, true, 'catmullrom', .5));
    }
  }

  update(delta: number): void {
    this.time += delta;
    const point = new THREE.Vector3(), tangent = new THREE.Vector3();
    this.planes.forEach((plane, i) => {
      const p = (this.time / PERIOD + i * .5) % 1;
      this.curves[i]!.getPointAt(p, point);
      this.curves[i]!.getTangentAt(p, tangent);
      // Never let the airliner sink below the runway or the terrain.
      point.y = Math.max(this.baseY, this.height(point.x, point.z) + 2);
      plane.position.copy(point);
      const pitch = Math.asin(THREE.MathUtils.clamp(tangent.y, -1, 1));
      plane.rotation.set(-pitch, Math.atan2(tangent.x, tangent.z), 0);
    });
  }
}
