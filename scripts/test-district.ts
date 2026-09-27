import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildRoadGeometry,type RoadData} from '../src/world/Roads';
import {createHeightProvider} from '../src/geography/WorldHeight';
import {geoToLocal,localToGeo,localWorldBounds} from '../src/geography/Projection';
import {RoadGraph} from '../src/navigation/RoadGraph';
import {CITY_STOPS,shoreDistance,segmentDistance} from '../src/geography/CityGeography';
import {CityStructures,type ElevatedRoad} from '../src/world/CityStructures';
import {richVehicle} from '../src/world/RichVehicles';
import {DISTRICT_PLACES} from '../src/world/DistrictLandmarks';
import {CHEARGI_WALK} from '../src/quests/quest';
import type {BuildingData} from '../src/world/Buildings';
const roads:RoadData[]=JSON.parse(readFileSync('public/world/chattogram/compact/roads.json','utf8')).roads;
const buildings:BuildingData[]=JSON.parse(readFileSync('public/world/chattogram/compact/buildings.json','utf8')).buildings;
const height=createHeightProvider();
const graph=new RoadGraph(roads), start=roads[0]!.points[0]!;
for(const road of roads)for(const point of road.points)assert(graph.route(...start,...point),'Every road must be reachable');
const bounds=localWorldBounds();
const destinations=[...[...DISTRICT_PLACES,...CITY_STOPS].map(p=>({...p,...geoToLocal(p)})),...buildings.filter(b=>b.name).map(b=>({name:b.name,x:b.ring.reduce((s,p)=>s+p[0],0)/b.ring.length,z:b.ring.reduce((s,p)=>s+p[1],0)/b.ring.length}))];
for(const stop of CHEARGI_WALK.stops)assert(destinations.some(p=>p.name===stop.landmark));
for(const p of destinations) {
  assert(p.x>bounds.minX+12&&p.x<bounds.maxX-12&&p.z>bounds.minZ+12&&p.z<bounds.maxZ-12);
  assert(graph.route(...start,p.x,p.z));
}
for(const b of buildings) {
  assert(b.ring.length>=3); assert.notDeepEqual(b.ring[0],b.ring.at(-1),'Roof ring has no duplicated closure');
  assert(b.ring.flat().every(Number.isFinite));
}
for(const p of [...DISTRICT_PLACES,...CITY_STOPS]) {
  const restored=localToGeo(geoToLocal(p));
  assert(Math.abs(restored.latitude-p.latitude)<1e-9);assert(Math.abs(restored.longitude-p.longitude)<1e-9);
}
// Regression cases: duplicate vertices, a reversal, tight corner, closed circle,
// and long DEM-spanning segment must remain finite with upward-facing triangles.
const fixtures:RoadData[]=[{id:'regression',type:'primary',bridge:false,tunnel:false,width:6,points:[[0,0],[0,0],[100,0],[0,0],[0,100],[1,99],[0,0]]}];
for(const set of [roads,fixtures]) {
  const geometry=buildRoadGeometry(set,height),p=geometry.getAttribute('position'),ix=geometry.getIndex()!;
  assert(Array.from(p.array).every(Number.isFinite));
  for(let i=0;i<ix.count;i+=3) {
    const a=ix.getX(i),b=ix.getX(i+1),c=ix.getX(i+2);
    const up=(p.getZ(b)-p.getZ(a))*(p.getX(c)-p.getX(a))-(p.getX(b)-p.getX(a))*(p.getZ(c)-p.getZ(a));
    assert(up>0,'No inverted or degenerate road triangles');
  }
  // Roads never fall beneath the shared terrain at their vertices.
  for(let i=0;i<p.count;i++)assert(p.getY(i)>height(p.getX(i),p.getZ(i))+.1);
  geometry.dispose();
}
const total=roads.reduce((s,r)=>s+r.points.slice(1).reduce((l,p,i)=>l+Math.hypot(p[0]-r.points[i]![0],p[1]-r.points[i]![1]),0),0);
console.log(`PASS: ${destinations.length} destinations; ${roads.length} connected road sections; ${Math.round(total)} m miniature road network; ${Math.round(bounds.maxX-bounds.minX)} × ${Math.round(bounds.maxZ-bounds.minZ)} m playable area. Geometry, quest coverage, boundaries and geographic round-trips passed.`);

const elevated:ElevatedRoad[]=JSON.parse(readFileSync('public/world/chattogram/compact/elevated.json','utf8')).elevated;
const structures=CityStructures.build(elevated,height);
assert.equal(structures.paths.length,4);
for(const p of structures.paths){assert(p.heightAt(p.path.total/2)>8);assert(p.road.sourceWayIds.length>0);}
const car=richVehicle('car',0xff6633);assert.equal(car.children.filter(c=>c.userData.wheel).length,4);
for(const road of roads) {
  const wet=road.points.filter(p=>shoreDistance(...p)<0);
  assert.equal(wet.length,0,`Ground road ${road.name} must not be underwater`);
}
console.log('PASS: four sourced elevated structures, visible decks, detailed vehicle wheels and dry ground road vertices.');

// Panning must translate the overview target at every heading without escaping the world.
const {OverviewCamera}=await import('../src/camera/OverviewCamera');
const {CityLife}=await import('../src/world/CityLife');
const view=new OverviewCamera(1.5,height);view.update(0);
const before=view.camera.position.clone();view.pan(90,40,800);view.snap();view.update(0);
assert(view.camera.position.distanceTo(before)>10,'Dragging translates overview');
view.pan(1e9,-1e9,800);view.snap();view.update(0);
assert(Number.isFinite(view.camera.position.x)&&Math.abs(view.camera.position.x)<10000,'Pan stays bounded');
const life=new CityLife(roads,height);
assert(life.object.children.some(o=>'geometry' in o&&(o.geometry as import('three').BufferGeometry).getAttribute('position').count>10000),'Beach props survive mixed indexed geometry merging');
console.log('PASS: overview panning and beach scenery merge regression checks.');

const {Neighborhoods}=await import('../src/world/Neighborhoods');
const neighborhood=new Neighborhoods(roads,buildings,height);
assert(neighborhood.buildings.length>100,'City infill must visibly increase density');
assert(neighborhood.trees.length>=350,'City has substantial additional greenery');
for(const b of neighborhood.buildings){
  assert(shoreDistance(b.x,b.z)>b.radius);
  for(const road of roads)for(let i=1;i<road.points.length;i++){
    assert(segmentDistance(b.x,b.z,road.points[i-1]!,road.points[i]!)>road.width/2+b.radius,'Infill clears main roads');
  }
}
const aircraft=neighborhood.object.getObjectByName('Decorative aircraft')!;
const oldPosition=aircraft.position.clone();neighborhood.update(1);assert(aircraft.position.distanceTo(oldPosition)>1);
for(const road of roads)for(let i=1;i<road.points.length;i++){
  const a=road.points[i-1]!,b=road.points[i]!,steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2);
  for(let j=0;j<=steps;j++)assert(shoreDistance(a[0]+(b[0]-a[0])*j/steps,a[1]+(b[1]-a[1])*j/steps)>=0,`Dry main road: ${road.name}`);
}
console.log(`PASS: ${neighborhood.buildings.length} extra buildings, ${neighborhood.trees.length} trees, road clearance, animated aircraft and continuous dry roads.`);

const {UrbanFabric}=await import('../src/world/UrbanFabric');
const fabric=new UrbanFabric(roads,buildings,neighborhood,height);
assert(fabric.plots.length>200,'Empty land receives neighborhood blocks');
assert(fabric.parkCount>15,'Courtyards break up dense blocks');
assert(fabric.riverWalkSegments>30,'Riverbank paths are present');
for(const p of fabric.plots){
  assert(shoreDistance(p.x,p.z)>p.radius+5);
  for(const road of roads)for(let i=1;i<road.points.length;i++)assert(segmentDistance(p.x,p.z,road.points[i-1]!,road.points[i]!)>p.radius+road.width/2+3,'Infill leaves main roads clear');
}
console.log(`PASS: ${fabric.plots.length-fabric.parkCount} infill buildings, ${fabric.parkCount} courtyards, ${fabric.riverWalkSegments} bank path segments; main-road and water clearances passed.`);
