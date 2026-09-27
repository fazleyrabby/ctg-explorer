import { readFileSync, writeFileSync } from 'node:fs';
import { DISTRICT_PLACES } from '../src/world/DistrictLandmarks';
import { DISTRICT_SCALE } from '../src/config/WorldConfig';
import { geoToLocal, metersPerDegreeLon } from '../src/geography/Projection';
import type { RoadData } from '../src/world/Roads';
import type { BuildingData } from '../src/world/Buildings';

// Source extracts stay untouched. This is an intentionally edited OSM district.
const root = 'public/world/chattogram';
const sourceRoads: RoadData[] = JSON.parse(readFileSync(`${root}/roads/roads.json`, 'utf8')).roads;
const sourceBuildings: BuildingData[] = JSON.parse(readFileSync(`${root}/buildings/buildings.json`, 'utf8')).buildings;
const streetNames = new Set(['Sirajuddowla Road', 'Jamal Khan Road', 'Cheragi Pahar Circle', 'Momin Road', 'Nandan Kanon Road', 'Jubilee Road', 'Court Road', 'Abdur Rahman Road', 'J.M. Sen Ave', 'Nur Ahmed Road', 'New Market Circle', 'Huseyn Shaheed Suhrawardy Road']);
type Point = [number, number];
const sw=geoToLocal({latitude:22.333,longitude:91.827}), ne=geoToLocal({latitude:22.3465,longitude:91.8395});
const bounds = {minX:sw.x,maxX:ne.x,minZ:sw.z,maxZ:ne.z};
const inside = ([x,z]: Point) => x > bounds.minX + 12 && x < bounds.maxX - 12 && z > bounds.minZ + 12 && z < bounds.maxZ - 12;
const scale = ([x,z]: Point): Point => {const p=geoToLocal({latitude:22.344+z/111320,longitude:91.834+x/metersPerDegreeLon(22.344)});return [p.x,p.z];};
const roads: RoadData[] = [];
for (const road of sourceRoads) {
  if ((!streetNames.has(road.name ?? '') && road.name) || road.bridge || road.tunnel) continue;
  // Split at boundary exits; never join separated interior fragments.
  let points: Point[] = [];
  let part = 0;
  const flush = () => {
    if (points.length > 1) roads.push({...road, id: `${road.id}/${part++}`, width: Math.max(4.5, road.width * DISTRICT_SCALE), points});
    points = [];
  };
  for (const p of road.points.map(scale)) { if (inside(p)) points.push(p); else flush(); }
  flush();
}
// Keep the connected main-road component; isolated clipped pieces are not destinations.
const keys = (road: RoadData) => road.points.map(([x,z]) => `${Math.round(x)},${Math.round(z)}`);
const keep = new Set<number>();
let largest: Set<number> = new Set();
for (let i=0; i<roads.length; i++) {
  if (keep.has(i)) continue;
  const component = new Set([i]); const nodes = new Set(keys(roads[i]!));
  let changed = true;
  while(changed) {changed=false; for(let j=0;j<roads.length;j++) {
    if(component.has(j)) continue;
    if(keys(roads[j]!).some(k=>nodes.has(k))) {component.add(j); keys(roads[j]!).forEach(k=>nodes.add(k)); changed=true;}
  }}
  component.forEach(j=>keep.add(j));
  if(component.size>largest.size) largest=component;
}
const mainRoads=roads.filter((_,i)=>largest.has(i));
const names = new Set(['Anderkilla Shahi Jame Masjid','Andarkilla Book Market','Chittagong City Corporation','Chittagong Buddhist Bihar','Kadam Mobarak Shahi Jame Mosque']);
const centroid=(ring:Point[]):Point=>[ring.reduce((v,p)=>v+p[0],0)/ring.length,ring.reduce((v,p)=>v+p[1],0)/ring.length];
function distance(p:Point,a:Point,b:Point) {const dx=b[0]-a[0],dz=b[1]-a[1];const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz);}
const roadDistance=(p:Point)=>Math.min(...mainRoads.flatMap(r=>r.points.slice(1).map((b,i)=>distance(p,r.points[i]!,b))));
const buildings:BuildingData[]=[];
const occupied:Point[]=[];
for(const b of [...sourceBuildings].sort((a,b)=>Number(names.has(b.name??''))-Number(names.has(a.name??'')))) {
  const ring=b.ring.map(scale).filter((p,i,a)=>i===0||Math.hypot(p[0]-a[i-1]![0],p[1]-a[i-1]![1])>.01);
  if(ring.length>2&&Math.hypot(ring[0]![0]-ring.at(-1)![0],ring[0]![1]-ring.at(-1)![1])<.01)ring.pop();
  if(ring.length<3||!ring.every(inside))continue;
  const c=centroid(ring),hero=names.has(b.name??'');
  if(!hero && DISTRICT_PLACES.some(place=>{const p=geoToLocal(place);return Math.hypot(c[0]-p.x,c[1]-p.z)<(place.type==='park'?40:place.id==='court'?30:10);}))continue;
  if(!hero&&(roadDistance(c)>30||roadDistance(c)<9||occupied.some(p=>Math.hypot(p[0]-c[0],p[1]-c[1])<24)))continue;
  const entry:BuildingData={...b,ring,height:hero?Math.max(8,b.height*.65):Math.min(12,Math.max(4,b.height*.45))};
  if(!hero){delete entry.name;delete entry.wikipedia;delete entry.wikidata;}
  if(entry.name==='Chittagong City Corporation')entry.type='government';
  buildings.push(entry);occupied.push(c);
}
const meta={attribution:'© OpenStreetMap contributors · ODbL 1.0. Edited, compressed district; not for navigation.',scale:DISTRICT_SCALE};
writeFileSync(`${root}/compact/roads.json`,JSON.stringify({...meta,roads:mainRoads}));
writeFileSync(`${root}/compact/buildings.json`,JSON.stringify({...meta,buildings}));
console.log(`${mainRoads.length} road sections, ${new Set(mainRoads.map(r=>r.name)).size} streets, ${buildings.length} buildings, ${buildings.filter(b=>b.name).length} building landmarks`);
console.log(mainRoads.map(r=>r.name));
