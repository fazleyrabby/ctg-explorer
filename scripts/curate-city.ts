import './curate-district';
import {readFileSync,writeFileSync} from 'node:fs';
import {project,shoreDistance} from '../src/geography/CityGeography';
import type {RoadData} from '../src/world/Roads';
import type {OverpassElement} from './lib/osm';
const root='public/world/chattogram/compact';
const ground=JSON.parse(readFileSync(`${root}/roads.json`,'utf8'));
const raw=JSON.parse(readFileSync('data/city/elevated-osm.json','utf8')) as {osm3s:{timestamp_osm_base:string};elements:OverpassElement[]};
const byId=new Map(raw.elements.map(e=>[e.id,e]));
const pieces=(ids:number[])=>ids.map(id=>{
  const e=byId.get(id);if(!e?.geometry)throw new Error(`Missing OSM way ${id}`);
  return e.geometry.map(p=>project(p.lat,p.lon));
});
function join(ids:number[]):Array<[number,number]> {
  const remaining=pieces(ids),out=remaining.shift()!;
  while(remaining.length){let best=Infinity,chosen=0,reverse=false,front=false;
    remaining.forEach((p,i)=>{for(const f of [false,true])for(const r of [false,true]){
      const a=f?out[0]!:out.at(-1)!,b=r?p.at(-1)!:p[0]!;
      const d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(d<best){best=d;chosen=i;reverse=r;front=f;}
    }});
    const p=remaining.splice(chosen,1)[0]!;if(reverse)p.reverse();if(front)out.unshift(...p.reverse());else out.push(...p);
  }
  return out.filter((p,i)=>!i||Math.hypot(p[0]-out[i-1]![0],p[1]-out[i-1]![1])>.02);
}
const elevated=[
  {id:'expressway',name:'Patenga–Lalkhan Elevated Expressway',ids:[1075414974,1353155839,1320233255,1353155840],width:8,height:15},
  {id:'akhtaruzzaman',name:'Akhtaruzzaman Flyover',ids:[532877130],width:7,height:13},
  {id:'bahaddarhat-flyover',name:'Bahaddarhat Flyover',ids:[377616152],width:7,height:12},
  {id:'shah-amanat-bridge',name:'Shah Amanat Bridge',ids:[133794971],width:8,height:9},
].map(e=>({...e,points:join(e.ids),type:'primary',bridge:true,tunnel:false,sourceWayIds:e.ids}));
const roads:RoadData[]=ground.roads;
const add=(id:string,name:string,points:Array<[number,number]>,width=7)=>roads.push({id,name,points,type:'primary',bridge:false,tunnel:false,width});
// The ground promenade/corridor is a simplified gameplay link under the mapped
// elevated alignment, not a claim about the precise surface-road carriageway.
for(const e of elevated.filter(e=>e.id!=='shah-amanat-bridge'))add(`corridor/${e.id}`,e.name.replace('Elevated Expressway','corridor').replace('Flyover','road corridor'),e.points,16);
const patenga=project(22.23444,91.79226),beachEntry:[number,number]=[patenga[0]+18,patenga[1]];
const near=(p:[number,number],items:RoadData[])=>items.flatMap(r=>r.points).reduce((a,b)=>Math.hypot(a[0]-p[0],a[1]-p[1])<Math.hypot(b[0]-p[0],b[1]-p[1])?a:b);
add('promenade','Patenga Beach Road',[beachEntry,project(22.236,91.795),near(beachEntry,[roads.find(r=>r.id==='corridor/expressway')!])],8);
const bridge=elevated.at(-1)!;
const north=[...bridge.points].sort((a,b)=>b[1]-a[1])[0]!;
const bah=project(22.36848,91.84375);
add('bridge-approach','Shah Amanat Bridge approach',[north,project(22.332,91.851),project(22.35,91.8445),project(22.361,91.844),bah,near(bah,[roads.find(r=>r.id==='corridor/bahaddarhat-flyover')!])],14);
// Connect the curated districts through short explicit miniature links. Keep
// their identities distinct from sourced OSM geometry in the generated data.
const original:RoadData[]=ground.roads.filter((r:RoadData)=>r.id.startsWith('way/'));
for(const id of ['corridor/expressway','corridor/akhtaruzzaman','corridor/bahaddarhat-flyover','bridge-approach']) {
  const road=roads.find(r=>r.id===id)!;
  let best=Infinity,pair:[[number,number],[number,number]]|undefined;
  for(const p of road.points)for(const q of original.flatMap(r=>r.points)) {const d=Math.hypot(p[0]-q[0],p[1]-q[1]);if(d<best&&shoreDistance((p[0]+q[0])/2,(p[1]+q[1])/2)>0){best=d;pair=[p,q];}}
  if(pair)add(`link/${id}`,'District connection · simplified',pair,6);
}
// Make the main city spine continuous between the independently mapped flyovers.
const connectEnds=(left:string,right:string)=>{
  const a=roads.find(r=>r.id===left)!,b=roads.find(r=>r.id===right)!;
  let best=Infinity,pair:Array<[number,number]>=[];
  for(const p of [a.points[0]!,a.points.at(-1)!])for(const q of [b.points[0]!,b.points.at(-1)!]){
    const distance=Math.hypot(p[0]-q[0],p[1]-q[1]);if(distance<best){best=distance;pair=[p,q];}
  }
  add(`main-link/${left}/${right}`,'Main city road · simplified junction',pair,16);
};
connectEnds('corridor/expressway','corridor/akhtaruzzaman');
connectEnds('corridor/akhtaruzzaman','corridor/bahaddarhat-flyover');
const airport=project(22.2496,91.8133);
add('airport-access','Airport Road · simplified access',[airport,near(airport,[roads.find(r=>r.id==='corridor/expressway')!])],12);
writeFileSync(`${root}/roads.json`,JSON.stringify({...ground,projection:'piecewise city miniature',roads}));
writeFileSync(`${root}/elevated.json`,JSON.stringify({attribution:'© OpenStreetMap contributors · ODbL',sourceTimestamp:raw.osm3s.timestamp_osm_base,elevated}));
console.log(`City: ${roads.length} ground road sections and ${elevated.length} elevated structures. OSM snapshot ${raw.osm3s.timestamp_osm_base}`);
