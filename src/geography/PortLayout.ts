import {RIVER,project} from './CityGeography';
const target=project(22.30,91.835);
const candidates=RIVER.slice(1).map((b,i)=>{const a=RIVER[i]!;return {a,b,length:Math.hypot(b[0]-a[0],b[1]-a[1]),distance:Math.hypot((a[0]+b[0])/2-target[0],(a[1]+b[1])/2-target[1])};}).filter(p=>p.length>120).sort((a,b)=>a.distance-b.distance);
const segment=candidates[0]!;
export const PORT={x:(segment.a[0]+segment.b[0])/2,z:(segment.a[1]+segment.b[1])/2,yaw:Math.atan2(segment.b[0]-segment.a[0],segment.b[1]-segment.a[1])};
export function portPoint(x:number,z:number):[number,number]{return [PORT.x+Math.cos(PORT.yaw)*x+Math.sin(PORT.yaw)*z,PORT.z-Math.sin(PORT.yaw)*x+Math.cos(PORT.yaw)*z];}
export function inPortDistrict(x:number,z:number,margin=0):boolean{
 const dx=x-PORT.x,dz=z-PORT.z,px=dx*Math.cos(PORT.yaw)-dz*Math.sin(PORT.yaw),pz=dx*Math.sin(PORT.yaw)+dz*Math.cos(PORT.yaw);
 return px>-128-margin&&px<8+margin&&Math.abs(pz)<77+margin;
}
