import {geoToLocal,localWorldBounds} from './Projection';
import {shoreDistance} from './CityGeography';
import {inLaldighi} from './PondLayout';
import type {RoadData} from '@/world/Roads';
import type {BuildingData} from '@/world/Buildings';
export const RAILWAY_PLACE={id:'chattogram-station',name:'Chattogram Railway Station',latitude:22.33389,longitude:91.83006,type:'transit',height:9,description:'Chattogram’s central railway station. A compact interpretation with platforms and animated passenger trains; track distances and layout are simplified.',wikipedia:'en:Chattogram_railway_station'};
const anchor=geoToLocal(RAILWAY_PLACE);
export const railwayLayout={x:anchor.x,z:anchor.z,yaw:0,ready:false};
export function railPoint(x:number,z:number):[number,number]{const a=railwayLayout;return [a.x+Math.cos(a.yaw)*x+Math.sin(a.yaw)*z,a.z-Math.sin(a.yaw)*x+Math.cos(a.yaw)*z];}
export function inRailway(x:number,z:number,padding=0):boolean{if(!railwayLayout.ready)return false;const a=railwayLayout,dx=x-a.x,dz=z-a.z;return Math.abs(Math.cos(a.yaw)*dx-Math.sin(a.yaw)*dz)<26+padding&&Math.abs(Math.sin(a.yaw)*dx+Math.cos(a.yaw)*dz)<80+padding;}
export function planRailway(roads:RoadData[],buildings:BuildingData[]):void{
 const bounds=localWorldBounds();let best=Infinity,chosen:{x:number;z:number;yaw:number}|undefined;
 const obstacles=roads.flatMap(r=>r.points.slice(1).flatMap((b,i)=>{const a=r.points[i]!,n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/3);return Array.from({length:n+1},(_,j)=>({x:a[0]+(b[0]-a[0])*j/n,z:a[1]+(b[1]-a[1])*j/n,r:r.width/2+6}));}));
 for(const yaw of [0,Math.PI/2])for(let dx=-240;dx<=240;dx+=8)for(let dz=-240;dz<=240;dz+=8){
  const x=anchor.x+dx,z=anchor.z+dz,score=Math.hypot(dx,dz);if(score>=best)continue;
  const hw=yaw?80:26,hd=yaw?26:80;
  if(x-hw<bounds.minX+8||x+hw>bounds.maxX-8||z-hd<bounds.minZ+8||z+hd>bounds.maxZ-8)continue;
  if(inLaldighi(x,z,Math.hypot(hw,hd)))continue;
  if(obstacles.some(p=>Math.abs(x-p.x)<hw+p.r&&Math.abs(z-p.z)<hd+p.r))continue;
  if(buildings.some(b=>x+hw>Math.min(...b.ring.map(p=>p[0]))&&x-hw<Math.max(...b.ring.map(p=>p[0]))&&z+hd>Math.min(...b.ring.map(p=>p[1]))&&z-hd<Math.max(...b.ring.map(p=>p[1]))))continue;
  if([[-hw,-hd],[hw,-hd],[-hw,hd],[hw,hd],[0,0]].some(([a,b])=>shoreDistance(x+a!,z+b!)<10))continue;
  best=score;chosen={x,z,yaw};
 }
 if(!chosen)throw new Error('No clear railway parcel');Object.assign(railwayLayout,chosen,{ready:true});
}
