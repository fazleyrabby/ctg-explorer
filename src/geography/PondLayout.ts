import {geoToLocal} from './Projection';
import {segmentDistance,shoreDistance} from './CityGeography';
import type {RoadData} from '@/world/Roads';
import type {BuildingData} from '@/world/Buildings';
const anchor=geoToLocal({latitude:22.33768,longitude:91.83766});
export const laldighiLayout={x:anchor.x,z:anchor.z,radius:30};
/** Reserve a complete park parcel before any decorative scenery is generated. */
export function planLaldighi(roads:RoadData[],buildings:BuildingData[]):void {
 let best=Infinity;
 for(let dx=-120;dx<=120;dx+=4)for(let dz=-120;dz<=120;dz+=4){
  const x=anchor.x+dx,z=anchor.z+dz,r=laldighiLayout.radius;
  if(Math.hypot(dx,dz)>=best||shoreDistance(x,z)<r+4)continue;
  if(roads.some(road=>road.points.slice(1).some((b,i)=>segmentDistance(x,z,road.points[i]!,b)<r+road.width/2+4)))continue;
  if(buildings.some(b=>{const xs=b.ring.map(p=>p[0]),zs=b.ring.map(p=>p[1]);return x+r>Math.min(...xs)&&x-r<Math.max(...xs)&&z+r>Math.min(...zs)&&z-r<Math.max(...zs);}))continue;
  best=Math.hypot(dx,dz);laldighiLayout.x=x;laldighiLayout.z=z;
 }
 if(!Number.isFinite(best))throw new Error('No clear parcel for Laldighi');
}
export function inLaldighi(x:number,z:number,padding=0):boolean {
 return Math.hypot(x-laldighiLayout.x,z-laldighiLayout.z)<laldighiLayout.radius+padding;
}
