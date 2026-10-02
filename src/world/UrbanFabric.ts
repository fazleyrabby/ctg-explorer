import {inRailway} from "@/geography/RailwayLayout";
import {inLaldighi} from "@/geography/PondLayout";
import {inShopRows} from "@/geography/ShopRowLayout";
import {solidBox} from '@/world/SolidFootprints';
import type {CollisionBox} from '@/world/Colliders';
import {inPortDistrict} from '@/geography/PortLayout';
import * as THREE from 'three';
import {localWorldBounds,geoToLocal} from '@/geography/Projection';
import {RIVER,shoreDistance,segmentDistance} from '@/geography/CityGeography';
import {DISTRICT_PLACES} from '@/world/DistrictLandmarks';
import {inProminentDistrict} from '@/world/ProminentPlaces';
import {inAirportDistrict} from '@/world/Airport';
import {buildRoadGeometry,type RoadData} from '@/world/Roads';
import type {BuildingData} from '@/world/Buildings';
import type {HeightProvider} from '@/geography/WorldHeight';
import type {Neighborhoods} from '@/world/Neighborhoods';

type Piece={x:number;y:number;z:number;w:number;h:number;d:number;color:number;angle:number};
/** Compact decorative blocks fill the map without adding long exploration roads. */
export class UrbanFabric {
 readonly solids:CollisionBox[]=[];
  readonly object=new THREE.Group();
  readonly plots:Array<{x:number;z:number;radius:number}>=[];
  parkCount=0;
  riverWalkSegments=0;
  constructor(roads:RoadData[],existing:BuildingData[],neighborhood:Neighborhoods,height:HeightProvider){
    this.object.name='CompactCityBlocks';
    const boxes:Piece[]=[],crowns:Piece[]=[],roofs:Piece[]=[];
    const piece=(bucket:Piece[],x:number,y:number,z:number,w:number,h:number,d:number,color:number,angle=0)=>bucket.push({x,y,z,w,h,d,color,angle});
    const box=(x:number,y:number,z:number,w:number,h:number,d:number,c:number,a=0)=>piece(boxes,x,y,z,w,h,d,c,a);
    const bounds=localWorldBounds();
    const occupied=existing.map(b=>({minX:Math.min(...b.ring.map(p=>p[0]))-4,maxX:Math.max(...b.ring.map(p=>p[0]))+4,minZ:Math.min(...b.ring.map(p=>p[1]))-4,maxZ:Math.max(...b.ring.map(p=>p[1]))+4}));
    const landmarks=DISTRICT_PLACES.map(p=>({...geoToLocal(p),radius:p.type==='park'?48:32}));
    const roadClear=(x:number,z:number,r:number)=>!roads.some(road=>road.points.slice(1).some((b,i)=>segmentDistance(x,z,road.points[i]!,b)<r+road.width/2+4));
    const clear=(x:number,z:number,r:number)=>!inRailway(x,z,r)&&!inLaldighi(x,z,r)&&!inShopRows(x,z,r+3)&&!inPortDistrict(x,z,r)&&!inProminentDistrict(x,z,r)&&!inAirportDistrict(x,z,r)&&shoreDistance(x,z)>r+7&&roadClear(x,z,r)&&!occupied.some(b=>x+r>b.minX&&x-r<b.maxX&&z+r>b.minZ&&z-r<b.maxZ)&&!neighborhood.buildings.some(b=>Math.hypot(x-b.x,z-b.z)<r+b.radius+4)&&!neighborhood.trees.some(t=>Math.hypot(x-t.x,z-t.z)<r+6)&&!landmarks.some(p=>Math.hypot(x-p.x,z-p.z)<r+p.radius);
    const tree=(x:number,z:number,size=1)=>{const y=height(x,z);box(x,y+2.4*size,z,.65,4.8*size,.65,0x937253);for(let j=0;j<3;j++)piece(crowns,x+Math.sin(j*2)*size*2,y+(5+j*.9)*size,z+Math.cos(j*2)*size*2,3.2*size,2.7*size,3.2*size,[0x3e9861,0x73b94e,0x9bce65][j]!);};
    const palette=[0xffdf9b,0xeca18b,0x80c7b8,0xa3c9df,0xc3b4d9];
    let index=0;
    // Each 108 m block contains a courtyard and eight tightly grouped parcels.
    for(let z=bounds.minZ+32;z<bounds.maxZ-32;z+=36)for(let x=bounds.minX+32;x<bounds.maxX-32;x+=36){
      const col=Math.round((x-bounds.minX-32)/36),row=Math.round((z-bounds.minZ-32)/36);
      index++;const r=13;if(!clear(x,z,r))continue;
      const y=height(x,z),courtyard=col%3===1&&row%3===1;
      this.plots.push({x,z,radius:r});
      // Paving gives the infill a legible block structure in the overview.
      box(x,y+.12,z,28,.2,28,courtyard?0xb7d688:0xead9b5);
      if(courtyard){
        this.parkCount++;
        box(x,y+.24,z,3,.16,27,0xf7e9c9);box(x,y+.25,z,27,.16,3,0xf7e9c9);
        for(const [dx,dz] of [[-8,-8],[8,8],[-8,8],[8,-8]])tree(x+dx!,z+dz!,.8);
        box(x+5,y+.8,z,3,.3,1,0xbb7f50);box(x-5,y+.8,z,3,.3,1,0xbb7f50);
        continue;
      }
      const w=18+(index%2)*3,d=17,h=7+(index%5)*3.1,c=palette[(Math.floor(col/3)+Math.floor(row/3)+index%2)%5]!;
      this.solids.push(solidBox(x,z,w,d,y,h+.3));
      box(x,y+h/2+.3,z,w,h,d,c);box(x,y+h+.55,z,w+1.2,.55,d+1.2,0xffedca);
      if(index%3===0)piece(roofs,x,y+h+2,z,(w+2)/Math.SQRT2,3.1,(d+2)/Math.SQRT2,index%2?0xd96f50:0x399c98,Math.PI/4);
      else box(x+3,y+h+1.2,z-2,6,1.3,5,index%2?0xd98064:0x539e9b);
      // Window bands on all four sides keep the silhouette readable cheaply.
      for(let floor=0;floor<Math.floor(h/3);floor++)for(const offset of [-.31,0,.31]){
        const yy=y+2+floor*3;
        box(x+w*offset,yy,z+d/2+.08,2.3,1.45,.16,0x396575);box(x+w*offset,yy,z-d/2-.08,2.3,1.45,.16,0x477d88);
        box(x+w/2+.08,yy,z+d*offset,.16,1.45,2.2,0x477d88);box(x-w/2-.08,yy,z+d*offset,.16,1.45,2.2,0x396575);
      }
      if(index%2===0){box(x,y+3,z+d/2+1.2,w,.25,2.7,index%4?0xd97456:0x328f89);box(x,y+1.2,z+d/2+.1,5,2.3,.2,0x315765);}
      for(const dx of [-w/2,w/2])box(x+dx,y+h/2,z+d/2+.12,.4,h,.4,0xffedca);
    }
    // River promenades follow both rounded banks, interrupted at main roads.
    const walks:RoadData[]=[];
    for(let i=1;i<RIVER.length;i++){
      const a=RIVER[i-1]!,b=RIVER[i]!,length=Math.hypot(b[0]-a[0],b[1]-a[1]);
      if(length<.01)continue;
      const nx=-(b[1]-a[1])/length,nz=(b[0]-a[0])/length,steps=Math.ceil(length/7);
      for(const side of [-1,1])for(let j=0;j<steps;j++){
        const point=(t:number):[number,number]=>[a[0]+(b[0]-a[0])*t+nx*side*22,a[1]+(b[1]-a[1])*t+nz*side*22];
        const p=point(j/steps),q=point((j+1)/steps),mx=(p[0]+q[0])/2,mz=(p[1]+q[1])/2;
        if(mx<bounds.minX+8||mx>bounds.maxX-8||mz<bounds.minZ+8||mz>bounds.maxZ-8||shoreDistance(mx,mz)<4||!roadClear(mx,mz,3))continue;
        walks.push({id:`bank/${i}/${side}/${j}`,type:'footway',width:4,bridge:false,tunnel:false,points:[p,q]});
        if(j%6===0){const y=height(mx,mz);box(mx,y+.8,mz,2.8,.35,.9,0xba855a,Math.atan2(nx,nz));tree(mx+nx*side*7,mz+nz*side*7,.85);}
      }
    }
    this.riverWalkSegments=walks.length;
    const promenade=new THREE.Mesh(buildRoadGeometry(walks,height,0,.13),new THREE.MeshStandardMaterial({color:0xf2ddb5,roughness:1}));promenade.name='Riverbank promenades';this.object.add(promenade);
    const material=new THREE.MeshStandardMaterial({roughness:.9});
    const batch=(geometry:THREE.BufferGeometry,items:Piece[])=>{
      const mesh=new THREE.InstancedMesh(geometry,material,items.length),matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion(),axis=new THREE.Vector3(0,1,0),color=new THREE.Color();
      items.forEach((p,i)=>{rotation.setFromAxisAngle(axis,p.angle);matrix.compose(new THREE.Vector3(p.x,p.y,p.z),rotation,new THREE.Vector3(p.w,p.h,p.d));mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,color.setHex(p.color));});
      mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.castShadow=false;mesh.computeBoundingSphere();this.object.add(mesh);
    };
    batch(new THREE.BoxGeometry(1,1,1),boxes);batch(new THREE.IcosahedronGeometry(1,1),crowns);batch(new THREE.ConeGeometry(1,1,4),roofs);
  }
}
