import {planRailway,railwayLayout,inRailway,RAILWAY_PLACE} from "../src/geography/RailwayLayout";
import {Railway,trainPosition} from "../src/world/Railway";
import {planLaldighi,laldighiLayout,inLaldighi} from "../src/geography/PondLayout";
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildRoadGeometry,type RoadData} from '../src/world/Roads';
import {createHeightProvider,createSurfaceProvider} from '../src/geography/WorldHeight';
import {geoToLocal,localToGeo,localWorldBounds} from '../src/geography/Projection';
import {RoadGraph} from '../src/navigation/RoadGraph';
import {CITY_STOPS,shoreDistance,segmentDistance} from '../src/geography/CityGeography';
import {CityStructures,type ElevatedRoad} from '../src/world/CityStructures';
import {samplePath} from '../src/world/RoadPath';
import {richVehicle} from '../src/world/RichVehicles';
import {DISTRICT_PLACES} from '../src/world/DistrictLandmarks';
import {PROMINENT_PLACES} from '../src/world/ProminentPlaces';
import {CHEARGI_WALK} from '../src/quests/quest';
import type {BuildingData} from '../src/world/Buildings';
const roads:RoadData[]=JSON.parse(readFileSync('public/world/chattogram/compact/roads.json','utf8')).roads;
const buildings:BuildingData[]=JSON.parse(readFileSync('public/world/chattogram/compact/buildings.json','utf8')).buildings;
const height=createHeightProvider();
const graph=new RoadGraph(roads), start=roads[0]!.points[0]!;
for(const road of roads)for(const point of road.points)assert(graph.route(...start,...point),'Every road must be reachable');
const bounds=localWorldBounds();
const destinations=[...[...DISTRICT_PLACES,...CITY_STOPS,...PROMINENT_PLACES,RAILWAY_PLACE].map(p=>({...p,...geoToLocal(p)})),...buildings.filter(b=>b.name).map(b=>({name:b.name,x:b.ring.reduce((s,p)=>s+p[0],0)/b.ring.length,z:b.ring.reduce((s,p)=>s+p[1],0)/b.ring.length}))];
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
planLaldighi([...roads,...elevated],buildings);
planRailway([...roads,...elevated],buildings);
const structures=CityStructures.build(elevated,height);
assert.equal(structures.paths.length,4);
for(const p of structures.paths){assert(p.heightAt(p.path.total/2)>5);assert(p.road.sourceWayIds.length>0);}
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
const keyboardView=new OverviewCamera(1.5,height);keyboardView.update(0);
const keyboardStart=keyboardView.camera.position.clone();
keyboardView.move(.5,1,0,false);keyboardView.snap();keyboardView.update(0);
const flyDistance=keyboardView.camera.position.distanceTo(keyboardStart);
assert(flyDistance>40&&flyDistance<200,'Holding W moves overview steadily without racing to its boundary');
keyboardView.move(.5,-1,0,false);keyboardView.snap();keyboardView.update(0);
assert(keyboardView.camera.position.distanceTo(keyboardStart)<.001,'S can return the bird-eye view to its starting point');
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

const THREE=await import('three');
const {Colliders}=await import('../src/world/Colliders');
const {ThirdPersonCamera}=await import('../src/camera/ThirdPersonCamera');
const {Traffic}=await import('../src/world/Traffic');
const collision=new Colliders([{id:'test-solid',type:'office',height:8,ring:[[0,0],[8,0],[8,8],[0,8]]}],()=>0);
const walker=new THREE.Vector3(-.1,0,4);collision.resolve(walker,.35);assert(walker.x<=-.349);
const stable=walker.clone();collision.resolve(walker,.35);assert(walker.distanceTo(stable)<1e-6,'No stationary collision jitter');
const roofWalker=new THREE.Vector3(4,9,4);collision.resolve(roofWalker,.35);assert.equal(roofWalker.x,4,'Above-roof movement remains free');
assert.equal(collision.rayDistance(new THREE.Vector3(-5,3,4),new THREE.Vector3(1,0,0),20),5);
const camera=new ThirdPersonCamera(1.5);camera.colliders=collision;camera.getHeight=()=>0;camera.yaw=Math.PI/2;camera.pitch=.15;camera.distance=12;
const target=new THREE.Vector3(-2,1.3,4);camera.update(.016,target);
const ray=camera.camera.position.clone().sub(target),length=ray.length();ray.normalize();
assert(collision.rayDistance(target,ray,length)>=length-.001,'Camera cannot see through a solid');
assert(length>=4&&camera.camera.position.y>=1,'Camera retains a safe orbit and ground clearance');
const followCamera=new ThirdPersonCamera(1.5);
followCamera.yaw=0;
for(let i=0;i<90;i++)followCamera.followHeading(.016,Math.PI/2,true);
assert(Math.abs(Math.atan2(Math.sin(followCamera.yaw-3*Math.PI/2),Math.cos(followCamera.yaw-3*Math.PI/2)))<.06,'Follow camera turns behind moving character');
const orbitInput={consumePointerDelta:()=>({x:40,y:0}),consumeWheelDelta:()=>0} as unknown as import('../src/player/Input').Input;
followCamera.handleInput(orbitInput);
const manualYaw=followCamera.yaw;
for(let i=0;i<120;i++)followCamera.followHeading(.016,0,true);
assert.equal(followCamera.yaw,manualYaw,'Manual orbit temporarily holds its chosen view');
for(let i=0;i<90;i++)followCamera.followHeading(.016,0,true);
assert(Math.abs(followCamera.yaw-manualYaw)>.1,'Camera resumes following after manual look pause');
// A solid deck must have downward-facing geometry, visible from street level.
let downward=0;structures.object.traverse(o=>{if(o instanceof THREE.Mesh){const n=o.geometry.getAttribute('normal');for(let i=0;i<n.count;i++)if(n.getY(i)<-.9)downward++;}});assert(downward>100);
const traffic=new Traffic(roads,height,structures.paths);let trafficDraws=0;traffic.object.traverse(o=>{if(o instanceof THREE.Mesh)trafficDraws++;});assert(trafficDraws<=45,'Traffic wheels share one instanced draw');traffic.update(.1,true);
console.log(`PASS: wall sliding, roof clearance, camera obstruction, solid flyover underside; traffic geometry uses ${trafficDraws} draws (previously 204).`);

const bah=structures.paths.find(p=>p.road.id==='bahaddarhat-flyover')!;
for(let d=1;d<bah.path.total;d++)assert(Math.abs(bah.heightAt(d)-bah.heightAt(d-1))<.4,'Bahaddarhat ramp must not form a steep hump');
for(const elevatedPath of structures.paths){
  const d=elevatedPath.path.total/2,p=samplePath(elevatedPath.path,d);
  const nx=Math.cos(p.yaw),nz=-Math.sin(p.yaw),y=elevatedPath.heightAt(d)+.15;
  const [heldX,heldZ]=structures.constrainDrive(p.x,p.z,y,p.x+nx*20,p.z+nz*20,.95);
  const lateralDistance=Math.min(...elevatedPath.path.points.slice(1).map((point,i)=>segmentDistance(heldX,heldZ,elevatedPath.path.points[i]!,point)));
  assert(lateralDistance<=elevatedPath.road.width/2-.5,`${elevatedPath.road.id}: car stays inside elevated side wall (${lateralDistance})`);
  assert.equal(createSurfaceProvider(height,structures)(heldX,heldZ,y),structures.deckTop(heldX,heldZ),'Guarded car remains on deck');
}
const rampStart=samplePath(bah.path,0);
const openRamp=structures.constrainDrive(rampStart.x,rampStart.z,bah.heightAt(0),rampStart.x+15,rampStart.z+15,.95);
assert.deepEqual(openRamp,[rampStart.x+15,rampStart.z+15],'Ground-level ramp entrance stays open');
const market=new CityLife(roads,height,structures.paths.map(p=>p.road));
for(const box of market.solids){const x=(box.minX+box.maxX)/2,z=(box.minZ+box.maxZ)/2;for(const r of [...roads,...elevated])for(let i=1;i<r.points.length;i++)assert(segmentDistance(x,z,r.points[i-1]!,r.points[i]!)>=r.width/2+7.99,'Market shops clear roads and flyover ramps');}
console.log('PASS: flyover and bridge side walls contain vehicles while ramp entrances remain open; gentle Bahaddarhat approaches and market road clearance.');

for(const road of roads)for(let i=1;i<road.points.length;i++)assert(segmentDistance(laldighiLayout.x,laldighiLayout.z,road.points[i-1]!,road.points[i]!)>=laldighiLayout.radius+road.width/2+4,'Laldighi parcel clears roads and walking paths');
for(const b of neighborhood.buildings)assert(!inLaldighi(b.x,b.z,b.radius),'Buildings clear pond park');
for(const t of neighborhood.trees)assert(!inLaldighi(t.x,t.z,5),'Generated trees clear pond park');
for(const p of fabric.plots)assert(!inLaldighi(p.x,p.z,p.radius),'Infill clears pond park');
console.log('PASS: reserved Laldighi parcel clears roads, buildings and generated trees.');

const railway=new Railway(height);assert.equal(railway.named[0]!.name,'Chattogram Railway Station');
assert.equal(trainPosition(0),trainPosition(3),'Train dwells at platform');
for(let t=0;t<100;t+=.25)assert(Math.abs(trainPosition(t))<=48,'Train stays inside reserved tracks');
for(const b of neighborhood.buildings)assert(!inRailway(b.x,b.z,b.radius),'Buildings clear railway');
for(const p of fabric.plots)assert(!inRailway(p.x,p.z,p.radius),'Infill clears railway');
railway.update(12);console.log('PASS: railway reservation, station geometry and bounded train movement.',railwayLayout);

// The rounded presentation must not turn the map into curved terrain or wet roads.
for(const x of [bounds.minX,bounds.maxX])for(const z of [bounds.minZ,bounds.maxZ])assert(shoreDistance(x,z)<0,'Rectangular map corners are submerged');
for(const road of roads)for(let i=1;i<road.points.length;i++){const a=road.points[i-1]!,b=road.points[i]!;const steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2);for(let j=0;j<=steps;j++){const t=j/steps;assert(shoreDistance(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t)>=0,'Entire road centerline stays dry after island shaping');}}
console.log('PASS: rounded island corners underwater; continuous road centerlines remain dry.');

const {VehicleManager}=await import('../src/vehicles/VehicleManager');
const {Player}=await import('../src/player/Player');
const {PlayerController}=await import('../src/player/PlayerController');
const {Vehicle}=await import('../src/vehicles/Vehicle');
const walkingPlayer=new Player(),walkingCamera=new ThirdPersonCamera(1.5);
walkingCamera.yaw=0;
const interior=roads.flatMap(r=>r.points).find(p=>shoreDistance(...p)>30)!;
walkingPlayer.position.set(interior[0],height(...interior),interior[1]);
const walkingInput={moveForward:1,moveRight:1,sprinting:false,jumpPressed:false} as unknown as import('../src/player/Input').Input;
const walkingController=new PlayerController(walkingPlayer,walkingInput,walkingCamera,height);
const walkingStart=walkingPlayer.position.clone();
for(let i=0;i<90;i++){
  walkingController.update(.016);
  walkingCamera.followHeading(.016,walkingPlayer.facing,true);
}
const walkDx=walkingPlayer.position.x-walkingStart.x,walkDz=walkingPlayer.position.z-walkingStart.z;
assert(walkDx>2&&walkDz< -2&&Math.abs(walkDx+walkDz)<.3,`Automatic camera turn does not curve held diagonal walking input (${walkDx}, ${walkDz})`);
const rider=new Player(),vehicleManager=new VehicleManager(new THREE.Scene(),()=>2);
vehicleManager.summon('car',rider);assert(vehicleManager.toggleMount(rider));vehicleManager.syncRider(rider);assert.equal(rider.object.visible,false,'Enclosed car hides avatar feet');vehicleManager.toggleMount(rider);assert.equal(rider.object.visible,true,'Dismount restores avatar');
vehicleManager.summon('bicycle',rider);assert(vehicleManager.toggleMount(rider));vehicleManager.syncRider(rider);assert.equal(rider.object.visible,true,'Bicycle keeps visible rider');vehicleManager.toggleMount(rider);
for(const kind of ['car','bicycle'] as const){const v=new Vehicle(kind);v.place(0,0,0,()=>2);assert(v.object.visible&&Number.isFinite(v.object.position.y));}
const deckSurface=createSurfaceProvider(height,structures);
for(const elevatedPath of structures.paths){
  const d=elevatedPath.path.total/2,p=samplePath(elevatedPath.path,d);
  for(const kind of ['car','bicycle'] as const){
    const v=new Vehicle(kind),nx=Math.cos(p.yaw),nz=-Math.sin(p.yaw);
    v.place(p.x,p.z,Math.atan2(nx,nz),deckSurface,elevatedPath.heightAt(d)+.15);
    for(let i=0;i<30;i++)v.update(.1,1,0,false,deckSurface,structures.constrainDrive.bind(structures));
    const lateral=Math.min(...elevatedPath.path.points.slice(1).map((point,i)=>segmentDistance(v.object.position.x,v.object.position.z,elevatedPath.path.points[i]!,point)));
    assert(lateral<=elevatedPath.road.width/2+.1,`${kind} remains on ${elevatedPath.road.id}`);
    assert(v.object.position.y>height(v.object.position.x,v.object.position.z)+1.4,`${kind} does not fall from ${elevatedPath.road.id}`);
  }
}
for(const kind of ['car','cng','rickshaw','bus'] as const){const v=richVehicle(kind,0xffaa44);assert(v.children.some(p=>p instanceof THREE.Mesh),'Vehicle body is merged');assert(v.children.filter(p=>p.userData.wheel).length>=3,'Vehicle wheels remain animated');}
console.log('PASS: car rider hidden, bicycle rider visible, dismount restore, all vehicle families render and stay on elevated roads.');

// Old-town shop rows: reserved parcels, road/flyover clearance and infill exclusion.
const {planShopRows,shopRows,inShopRows,rowToWorld,SHOP_FRONTAGE}=await import('../src/geography/ShopRowLayout');
const {ShopRows}=await import('../src/world/ShopRows');
planShopRows(roads,elevated,buildings);
assert(shopRows.length>=12,`Old town receives shop rows (${shopRows.length})`);
for(const district of ['chawkbazar','anderkilla','khatunganj'])assert(shopRows.filter(r=>r.district===district).length>=3,`${district} has shop rows`);
for(const row of shopRows){
  assert(row.units.length>=3&&row.units.length<=5);
  for(const unit of row.units){
    assert(unit.floors>=2&&unit.floors<=4,'Shops are two to four storeys');
    for(const lz of [-row.depth/2,0,row.depth/2])for(const lx of [unit.offset-unit.width/2,unit.offset,unit.offset+unit.width/2]){
      const [x,z]=rowToWorld(row,lx,lz);
      assert(shoreDistance(x,z)>8&&!inRailway(x,z)&&!inLaldighi(x,z),'Shop rows stay on dry, unreserved land');
      for(const r of roads)for(let i=1;i<r.points.length;i++)assert(segmentDistance(x,z,r.points[i-1]!,r.points[i]!)>=r.width/2+1.5,'Shop facades clear every carriageway');
      for(const r of elevated)for(let i=1;i<r.points.length;i++)assert(segmentDistance(x,z,r.points[i-1]!,r.points[i]!)>=r.width/2+7,'Shop rows clear flyover decks and ramps');
      assert(!buildings.some(b=>{const xs=b.ring.map(p=>p[0]),zs=b.ring.map(p=>p[1]);return x>Math.min(...xs)&&x<Math.max(...xs)&&z>Math.min(...zs)&&z<Math.max(...zs);}),'Shop rows clear mapped buildings');
    }
  }
  // Each row fronts a street across its paved frontage.
  const [fx,fz]=rowToWorld(row,0,row.depth/2+SHOP_FRONTAGE);
  assert(Math.min(...roads.flatMap(r=>r.points.slice(1).map((b,i)=>segmentDistance(fx,fz,r.points[i]!,b)-r.width/2)))<1.5,'Shop row faces a street');
  for(const other of shopRows)if(other!==row)assert(Math.hypot(other.x-row.x,other.z-row.z)>6,'Rows do not stack');
}
const shopNeighborhood=new Neighborhoods(roads,buildings,height),shopFabric=new UrbanFabric(roads,buildings,shopNeighborhood,height);
assert(shopNeighborhood.buildings.length>100&&shopNeighborhood.trees.length>=350&&shopFabric.plots.length>200,'Infill density survives the shop-row reservation');
for(const b of shopNeighborhood.buildings)assert(!inShopRows(b.x,b.z,b.radius),'Infill buildings clear shop rows');
for(const p of shopFabric.plots)assert(!inShopRows(p.x,p.z,p.radius),'Infill blocks clear shop rows');
const shops=new ShopRows(height);let shopDraws=0;shops.object.traverse(o=>{if(o instanceof THREE.Mesh)shopDraws++;});
assert.equal(shopDraws,1,'All shop rows share one merged draw');
assert.equal(shops.unitCount,shopRows.reduce((n,r)=>n+r.units.length,0));assert(shops.solids.length>=shops.unitCount);
const shopPosition=(shops.object.children[0] as import('three').Mesh).geometry.getAttribute('position');
assert(Array.from(shopPosition.array).every(Number.isFinite));
console.log(`PASS: ${shopRows.length} old-town shop rows, ${shops.unitCount} shops and ${shops.stallCount} tea stalls in one draw; road, flyover, building and infill clearances passed.`);

// Vehicles slide along building walls instead of driving through them.
const wallCar=new Vehicle('car');wallCar.place(-12,4,Math.PI/2,()=>0);
for(let i=0;i<120;i++)wallCar.update(.05,1,0,false,()=>0,undefined,collision);
assert(wallCar.object.position.x<=-1.24,`Car stops at a wall (${wallCar.object.position.x})`);
assert(Math.abs(wallCar.speed)<1.5,'A head-on wall hit sheds the car speed');
const freeCar=new Vehicle('car');freeCar.place(-12,30,Math.PI/2,()=>0);
for(let i=0;i<40;i++)freeCar.update(.05,1,0,false,()=>0,undefined,collision);
assert(freeCar.object.position.x>10,'Open ground stays drivable');
const insideCar=new Vehicle('car');insideCar.place(4,4,0,()=>0,0,collision);
assert(insideCar.object.position.x<-1.2||insideCar.object.position.x>9.2||insideCar.object.position.z<-1.2||insideCar.object.position.z>9.2,'A car is never summoned inside a building');
// Mapped footprints use conservative boxes; main streets must still be passable by car.
const cityColliders=new Colliders(buildings,height);
for(const source of [shopNeighborhood,shopFabric,shops])for(const box of source.solids)cityColliders.addBox(box);
let roadSamples=0,roadBlocked=0;const roadProbe=new THREE.Vector3();
for(const road of roads)for(let i=1;i<road.points.length;i++){
  const a=road.points[i-1]!,b=road.points[i]!,steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/3);
  for(let j=0;j<=steps;j++){const x=a[0]+(b[0]-a[0])*j/steps,z=a[1]+(b[1]-a[1])*j/steps;roadProbe.set(x,height(x,z),z);cityColliders.resolve(roadProbe,1.25);roadSamples++;if(Math.hypot(roadProbe.x-x,roadProbe.z-z)>road.width/2)roadBlocked++;}
}
assert.equal(roadBlocked,0,`Cars can follow every road centreline (${roadBlocked} of ${roadSamples} samples pushed off the carriageway)`);
console.log(`PASS: vehicle wall sliding, summon clearance and ${roadSamples} unobstructed road-centreline samples.`);

// Quests and saved progress.
const {QUESTS}=await import('../src/quests/quest');
const {QuestManager}=await import('../src/quests/QuestManager');
const {Maritime}=await import('../src/world/Maritime');
const questPlaces=[...destinations.map(p=>p.name),...new Maritime().named.map(p=>p.name)];
assert(QUESTS.length>=4&&new Set(QUESTS.map(q=>q.id)).size===QUESTS.length);
for(const quest of QUESTS){assert(quest.stops.length>=5);for(const stop of quest.stops)assert(questPlaces.includes(stop.landmark),`${quest.id}: unknown stop ${stop.landmark}`);}
const hudLog:string[]=[];
const fakeHud={setQuestChoices:()=>{},setQuest:(id:string,_s:string,objective:string|null,done:number,total:number)=>hudLog.push(`${id}:${objective}:${done}/${total}`)} as unknown as import('../src/ui/HUD').HUD;
const fakeBeacon={setTarget:()=>{}} as unknown as import('../src/world/QuestBeacon').QuestBeacon;
const questManager=new QuestManager(QUESTS,[],fakeHud,fakeBeacon);
questManager.notifyDiscovered('Laldighi');assert.equal(questManager.completed,1);
questManager.select('old-town-bazaars');assert.equal(questManager.activeId,'old-town-bazaars');
assert.equal(questManager.completed,1,'A visit counts for every route that includes the place');
assert.equal(questManager.currentStop()!.landmark,'Chittagong New Market');
questManager.reset();assert.equal(questManager.completed,0);assert.equal(questManager.activeId,QUESTS[0]!.id);
const store=new Map<string,string>();
(globalThis as unknown as {localStorage:unknown}).localStorage={getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>{store.set(k,v);}};
const {SaveGame}=await import('../src/core/SaveGame');
const firstSave=new SaveGame();firstSave.addDiscovery('laldighi');firstSave.addDiscovery('laldighi');firstSave.setQuest('rails-and-port');firstSave.setQuality('low');
const reloaded=new SaveGame();assert.deepEqual(reloaded.data,{discovered:['laldighi'],quest:'rails-and-port',quality:'low'},'Progress survives a reload');
reloaded.resetProgress();assert.deepEqual(new SaveGame().data,{discovered:[],quality:'low'},'Reset keeps display preferences');
store.set('chattogram:save','{not json');assert.deepEqual(new SaveGame().data,{discovered:[]},'Corrupt storage falls back to a fresh save');
console.log(`PASS: ${QUESTS.length} quests with known stops, shared discoveries, and save/reload/reset of progress.`);

// Touch joystick axes and virtual keys reach the same input state as the keyboard.
const {Input}=await import('../src/player/Input');
const listeners={addEventListener:()=>{},removeEventListener:()=>{}};
(globalThis as unknown as {window:unknown}).window=listeners;
const touchInput=new Input(listeners as unknown as HTMLCanvasElement);
touchInput.setVirtualMove(.4,-1,true);assert.equal(touchInput.moveForward,1);assert.equal(touchInput.moveRight,-1);assert(touchInput.sprinting);
touchInput.setVirtualKey('KeyF',true);assert(touchInput.wasPressed('KeyF')&&touchInput.isDown('KeyF'));
touchInput.endFrame();assert(!touchInput.wasPressed('KeyF'));touchInput.setVirtualKey('KeyF',false);assert(!touchInput.isDown('KeyF'));
touchInput.setVirtualMove(0,0,false);assert.equal(touchInput.moveForward,0);assert(!touchInput.sprinting);
console.log('PASS: touch joystick and on-screen buttons drive the shared input state.');
