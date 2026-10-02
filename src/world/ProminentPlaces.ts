import {inRailway} from "@/geography/RailwayLayout";
import {inLaldighi} from "@/geography/PondLayout";
import {inShopRows} from "@/geography/ShopRowLayout";
import {solidBox} from '@/world/SolidFootprints';
import type {CollisionBox} from '@/world/Colliders';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {geoToLocal, localWorldBounds} from '@/geography/Projection';
import {shoreDistance, segmentDistance} from '@/geography/CityGeography';
import type {HeightProvider} from '@/geography/WorldHeight';
import type {RoadData} from '@/world/Roads';
import type {BuildingData, NamedBuilding} from '@/world/Buildings';

export interface ProminentPlace {
  id: string; name: string; latitude: number; longitude: number;
  type: string; height: number; description: string; wikipedia?: string;
}

// Real anchors; the geometry is an authored miniature, not a survey.
export const PROMINENT_PLACES: ProminentPlace[] = [
  {id:'agrabad',name:'Agrabad Commercial Area',latitude:22.32699,longitude:91.80914,type:'commercial',height:36,wikipedia:'en:Agrabad',description:'The city’s main business district of banks and offices, beside the port quarter. An authored miniature.'},
  {id:'gec',name:'GEC Circle',latitude:22.35657,longitude:91.82118,type:'square',height:14,description:'The GEC roundabout linking Nasirabad, Khulshi and the city centre. A stylised interchange.'},
  {id:'newmarket',name:'Chittagong New Market',latitude:22.34325,longitude:91.83703,type:'market',height:13,description:'A large municipal market beside the old city; halls, stalls and awnings are interpreted.'},
  {id:'chawkbazar',name:'Chawkbazar',latitude:22.34657,longitude:91.83835,type:'market',height:12,description:'One of the oldest bazaars in the city, dense with shops and a landmark mosque.'},
  {id:'crb',name:'CRB',latitude:22.34405,longitude:91.83376,type:'civic',height:12,description:'The Circuit House and parade-ground quarter by the old railway line.'},
  {id:'foyslake',name:"Foy's Lake",latitude:22.37234,longitude:91.80089,type:'park',height:18,wikipedia:"en:Foy's_Lake",description:'A hill lake and amusement park on the northern edge of the city.'},
  {id:'nasirabad',name:'Nasirabad',latitude:22.36398,longitude:91.81775,type:'residential',height:11,description:'A residential quarter of the northern city.'},
  {id:'khulshi',name:'Khulshi',latitude:22.35124,longitude:91.79541,type:'residential',height:11,description:'A hilly residential area west of the centre.'},
  {id:'pahartali',name:'Pahartali',latitude:22.37647,longitude:91.82367,type:'transit',height:10,wikipedia:'en:Pahartali',description:'A northern suburb known for its railway workshop and station.'},
  {id:'khatunganj',name:'Khatunganj',latitude:22.3357,longitude:91.83184,type:'wholesale',height:9,wikipedia:'en:Khatunganj',description:'The old riverfront wholesale market of godowns and jetties.'},
  {id:'cmch',name:'Chittagong Medical College',latitude:22.3602,longitude:91.8297,type:'hospital',height:17,wikipedia:'en:Chittagong_Medical_College',description:'The city’s main teaching hospital campus.'},
];

/** Resolved anchors with a keep-clear radius, shared with the infill generators. */
export const PROMINENT_AREAS = PROMINENT_PLACES.map(p => ({
  ...geoToLocal(p),
  radius: p.type === 'park' ? 78 : 54,
}));

export function inProminentDistrict(x: number, z: number, margin = 0): boolean {
  return PROMINENT_AREAS.some(a => Math.hypot(x - a.x, z - a.z) < a.radius + margin);
}

/**
 * Nudges a cluster to the nearby spot with the most road clearance, so a
 * warehouse row never spans a road. Shared with parcel planners that must
 * keep clear of the built cluster rather than of its geographic anchor.
 */
export function prominentSite(place: ProminentPlace, roads: RoadData[]): {x: number; z: number} {
  const bounds = localWorldBounds(), anchor = geoToLocal(place);
  let x = anchor.x, z = anchor.z, best = -Infinity;
  for (let dx = -70; dx <= 70; dx += 10) for (let dz = -70; dz <= 70; dz += 10) {
    const tx = anchor.x + dx, tz = anchor.z + dz;
    if (tx < bounds.minX + 45 || tx > bounds.maxX - 45 || tz < bounds.minZ + 45 || tz > bounds.maxZ - 45) continue;
    if (inRailway(tx,tz,60)||inLaldighi(tx,tz,60)) continue;
    if (shoreDistance(tx, tz) < 45) continue;
    let clear = Infinity;
    for (const road of roads) for (let i = 1; i < road.points.length; i++) {
      const d = segmentDistance(tx, tz, road.points[i - 1]!, road.points[i]!) - road.width / 2;
      if (d < clear) clear = d;
    }
    const score = Math.min(clear, 70) - Math.hypot(dx, dz) * .12;
    if (score > best) { best = score; x = tx; z = tz; }
  }
  return {x, z};
}

export class ProminentPlaces {
 readonly solids:CollisionBox[]=[];
  readonly object = new THREE.Group();
  readonly named: NamedBuilding[] = [];

  constructor(roads: RoadData[], existing: BuildingData[], height: HeightProvider) {
    this.object.name = 'ProminentPlaces';
    const bounds = localWorldBounds();
    const occupied = existing.map(b => ({
      minX: Math.min(...b.ring.map(p => p[0])) - 3, maxX: Math.max(...b.ring.map(p => p[0])) + 3,
      minZ: Math.min(...b.ring.map(p => p[1])) - 3, maxZ: Math.max(...b.ring.map(p => p[1])) + 3,
    }));
    const parts: THREE.BufferGeometry[] = [];
    const add = (geo: THREE.BufferGeometry, color: number, ax: number, ay: number, az: number, rx = 0, ry = 0, rz = 0) => {
      geo.rotateX(rx); geo.rotateY(ry); geo.rotateZ(rz); geo.translate(ax, ay, az);
      const c = new THREE.Color(color);
      const count = geo.getAttribute('position').count;
      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) { colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b; }
      geo.deleteAttribute('uv');
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      parts.push(geo.index ? geo.toNonIndexed() : geo);
    };

    for (const place of PROMINENT_PLACES) {
      const {x, z} = prominentSite(place, roads);
      const y = height(x, z);
      this.named.push({...place, x, z});
      const ground = (lx: number, lz: number) => height(x + lx, z + lz) - y;
      const safe = (lx: number, lz: number, r: number): boolean => {
        const px = x + lx, pz = z + lz;
        if (px < bounds.minX + 8 || px > bounds.maxX - 8 || pz < bounds.minZ + 8 || pz > bounds.maxZ - 8) return false;
        if (inRailway(px,pz,r)||inLaldighi(px,pz,r)||inShopRows(px,pz,r)) return false;
        if (shoreDistance(px, pz) < 8) return false;
        for (const road of roads) for (let i = 1; i < road.points.length; i++) {
          if (segmentDistance(px, pz, road.points[i - 1]!, road.points[i]!) < road.width / 2 + r + 2) return false;
        }
        if (occupied.some(o => px + r > o.minX && px - r < o.maxX && pz + r > o.minZ && pz - r < o.maxZ)) return false;
        return true;
      };
      const box = (w: number, h: number, d: number, c: number, lx: number, lz: number, ry = 0, base = 0) => {
        if (!safe(lx, lz, Math.max(w, d) / 2)) return;
        if(h>=3&&w>=3&&d>=3&&base<2)this.solids.push(solidBox(x+lx,z+lz,w,d,y+ground(lx,lz)+base,h,ry));
        add(new THREE.BoxGeometry(w, h, d), c, x + lx, y + ground(lx, lz) + base + h / 2, z + lz, 0, ry);
        if(base===0&&h>=8&&w>=8&&d>=8){
          add(new THREE.BoxGeometry(w+.8,.45,d+.8),0xf2e1ba,x+lx,y+ground(lx,lz)+h+.2,z+lz,0,ry);
          add(new THREE.BoxGeometry(3,3,.25),0x355f6f,x+lx+Math.sin(ry)*(d/2+.2),y+ground(lx,lz)+1.5,z+lz+Math.cos(ry)*(d/2+.2),0,ry);
        }
      };
      const cyl = (rt: number, rb: number, h: number, c: number, lx: number, lz: number, seg = 10, base = 0) => {
        if (!safe(lx, lz, Math.max(rt, rb) + 1)) return;
        add(new THREE.CylinderGeometry(rt, rb, h, seg), c, x + lx, y + ground(lx, lz) + base + h / 2, z + lz);
      };
      const ball = (r: number, c: number, lx: number, ly: number, lz: number) => {
        if (!safe(lx, lz, r)) return;
        add(new THREE.SphereGeometry(r, 10, 8), c, x + lx, y + ground(lx, lz) + ly, z + lz);
      };
      const disk = (radius: number, c: number, lx: number, lz: number, lift: number) => {
        if (!safe(lx, lz, radius)) return;
        const g = new THREE.CircleGeometry(radius, 40); g.rotateX(-Math.PI / 2);
        const p = g.getAttribute('position');
        for (let i = 0; i < p.count; i++) p.setY(i, ground(lx + p.getX(i), lz + p.getZ(i)) + lift);
        g.computeVertexNormals(); add(g, c, x + lx, y, z + lz);
      };
      const tree = (lx: number, lz: number, s = 1) => {
        if (!safe(lx, lz, 3 * s)) return;
        cyl(.22 * s, .32 * s, 3.4 * s, 0x7a5a3a, lx, lz, 6);
        ball(2.4 * s, 0x4d7f45, lx, 3.4 * s + 1.4 * s, lz);
      };

      if (place.id === 'agrabad') {
        disk(30, 0xb9b2a2, 0, 0, .05);
        const towers: Array<[number, number, number, number, number]> = [[-18, -12, 11, 34, 0x8fa6b6], [16, -14, 11, 40, 0x9fb4c2], [-16, 14, 11, 28, 0x7f97a8], [16, 16, 11, 31, 0xa9bcc8]];
        for (const [lx, lz, w, h, c] of towers) box(w, h, w, c, lx, lz);
        box(20, 7, 14, 0xc9c0ad, 0, 0, .1);
        for (let i = 0; i < 4; i++) tree(-26 + i * 17, 24, .8);
      } else if (place.id === 'gec') {
        if (safe(0, 0, 18)) add(new THREE.TorusGeometry(16, 2.1, 8, 32), 0x4a5563, x, y + .4, z, Math.PI / 2);
        disk(12, 0xb7c3a4, 0, 0, .12);
        cyl(5, 6, 1.2, 0xd8d2c0, 0, 0, 16);
        cyl(1.6, 2.2, 3.2, 0xd8d2c0, 0, 0, 12, 1.2);
        ball(1.4, 0x74b6c9, 0, 5, 0);
        box(11, 15, 11, 0x9aa7b2, -28, -22);
        box(11, 11, 11, 0xb0a894, 28, -20);
        box(10, 13, 10, 0x9a9f8a, -26, 24);
        box(12, 9, 12, 0xc0ab90, 27, 25);
      } else if (place.id === 'newmarket' || place.id === 'chawkbazar') {
        box(40, 8, 26, 0xd7cbb0, 0, 0);
        box(42, 1, 28, 0xb46b52, 0, 0, .1, 8);
        for (let i = -2; i <= 2; i++) box(6, 3, 4, i % 2 ? 0xd98a5b : 0x6fb3a6, i * 8, -18, 0, 0);
        if (place.id === 'chawkbazar') {
          box(16, 6, 16, 0xe6dcc6, 26, 6);
          ball(7, 0x3f8f7d, 26, 9, 6);
          cyl(1.2, 1.6, 12, 0xe6dcc6, 36, -1, 8);
          ball(2, 0xe0b45a, 36, 12, -1);
        } else {
          for (let i = 0; i < 6; i++) box(7, 4, 5, i % 3 ? 0xdca86a : 0x74a9bd, -18 + i * 9, 18, 0, 0);
        }
      } else if (place.id === 'crb') {
        box(52, 7, 16, 0xe2d6bb, 0, -10);
        box(54, 1, 18, 0x9d5f4a, 0, -10, 0, 7);
        disk(26, 0xa9b58f, 0, 16, .05);
        cyl(.35, .35, 14, 0xe8e2d0, -22, 16, 8);
        ball(1, 0xd94f4f, -22, 13.5, 16);
      } else if (place.id === 'foyslake') {
        disk(30, 0x3f8ea0, 0, 0, .3);
        disk(36, 0x6f9a63, 0, 0, .05);
        for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; tree(Math.cos(a) * 42, Math.sin(a) * 42, 1); }
        if (safe(-34, 34, 10)) {
          add(new THREE.TorusGeometry(9, .7, 8, 28), 0xe8556b, x - 34, y + 12, z + 34);
          for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(new THREE.CylinderGeometry(.18, .18, 18, 6), 0xf2e6c8, x - 34, y + 12, z + 34, 0, 0, a); }
          add(new THREE.CylinderGeometry(.5, .5, 12, 8), 0x9aa3ab, x - 34, y + 6, z + 34);
        }
      } else if (place.id === 'nasirabad' || place.id === 'khulshi') {
        const palette = [0xe3d6bd, 0xc9b79a, 0xd8c8b0, 0xb9c2b0];
        for (let i = 0; i < 8; i++) {
          const lx = -21 + (i % 4) * 14, lz = -12 + Math.floor(i / 4) * 20;
          box(9, 6 + (i % 3), 8, palette[i % 4]!, lx, lz);
          box(10, .8, 9, 0x9a6a54, lx, lz, 0, 6 + (i % 3));
          if (i % 2 === 0) tree(lx + 9, lz + 6, .9);
        }
      } else if (place.id === 'pahartali') {
        box(34, 7, 12, 0xd6c4a4, 0, 0);
        box(36, 1.2, 14, 0x8c5a46, 0, 0, 0, 7);
        box(60, .25, 1.4, 0x5b5f63, 0, -12);
        box(60, .25, 1.4, 0x5b5f63, 0, -16);
        for (let i = -2; i <= 2; i++) box(6, 1.2, 2.4, 0x6f7a82, i * 11, -12, 0, .3);
        cyl(1.2, 1.6, 9, 0xc7bcae, 22, 12, 10);
        ball(2.2, 0xb7c3bd, 22, 10.5, 12);
      } else if (place.id === 'khatunganj') {
        for (let i = 0; i < 4; i++) box(20, 7, 13, i % 2 ? 0xd9cdb2 : 0xc9bda2, -36 + i * 24, 0);
        for (let i = 0; i < 4; i++) box(6, 1, 10, 0x8a7d63, -36 + i * 24, -16);
        for (let i = 0; i < 4; i++) box(3, 1.4, 8, 0x7a6f57, -36 + i * 24, -26);
      } else if (place.id === 'cmch') {
        box(32, 11, 18, 0xeae2d0, 0, 0);
        box(12, 8, 12, 0xd9d0ba, -25, 0);
        box(12, 8, 12, 0xd9d0ba, 25, 0);
        if (safe(0, 0, 5)) {
          add(new THREE.BoxGeometry(8, 2.4, 2.4), 0xd94f4f, x, y + 12, z);
          add(new THREE.BoxGeometry(2.4, 2.4, 8), 0xd94f4f, x, y + 12, z);
        }
        disk(14, 0x9aa7ad, 0, 28, .06);
      }
    }

    const merged = mergeGeometries(parts);
    if (merged) {
      const mesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({vertexColors: true, roughness: .82}));
      mesh.castShadow = true; mesh.receiveShadow = true;
      this.object.add(mesh);
    }
  }
}
