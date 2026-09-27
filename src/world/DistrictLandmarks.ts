import {laldighiLayout} from "@/geography/PondLayout";
import {solidBox} from '@/world/SolidFootprints';
import type {CollisionBox} from '@/world/Colliders';
import * as THREE from 'three';
import { geoToLocal } from '@/geography/Projection';
import type { NamedBuilding } from '@/world/Buildings';
import type { HeightProvider } from '@/geography/WorldHeight';

// Verified geographic anchors; geometry is an authored miniature, not a survey.
export const DISTRICT_PLACES = [
  {id:'cheragi',name:'Cheragi Pahar',latitude:22.34367,longitude:91.83368,type:'monument',height:9,wikipedia:'en:Cheragi_Pahar',description:'A cultural meeting place at the meeting of Momin Road and Jamal Khan Road.'},
  {id:'dc-hill',name:'DC Hill',latitude:22.341944,longitude:91.831944,type:'park',height:3,wikipedia:'en:DC_Hill',description:'A green hillside associated with the city’s cultural gatherings and Bengali New Year celebrations.'},
  {id:'laldighi',name:'Laldighi',latitude:22.33768,longitude:91.83766,type:'park',height:1,wikipedia:'en:Laldighi,_Chittagong',description:'The historic pond and park in the heart of the old city. This miniature uses a simplified pond outline.'},
  {id:'court',name:'Chittagong Court Building',latitude:22.33483,longitude:91.83461,type:'government',height:14,wikipedia:'en:Chittagong_Court_Building',description:'The historic courthouse on Parir Pahar, or Fairy’s Hill. The model is a stylized interpretation.'},
];
export class DistrictLandmarks {
 readonly solids:CollisionBox[]=[];
  readonly object=new THREE.Group();
  readonly named:NamedBuilding[]=[];
  constructor(height:HeightProvider) {
    this.object.name='DistrictLandmarks';
    for(const place of DISTRICT_PLACES) {
      const {x,z}=place.id==='laldighi'?laldighiLayout:geoToLocal(place),y=height(x,z);
      this.named.push({...place,x,z});
      const group=new THREE.Group();group.position.set(x,y,z);this.object.add(group);
      const mesh=(geo:THREE.BufferGeometry,color:number,px=0,py=0,pz=0)=>{
        if(geo instanceof THREE.BoxGeometry&&geo.parameters.height>=3&&geo.parameters.width>=3&&geo.parameters.depth>=3)this.solids.push(solidBox(x+px,z+pz,geo.parameters.width,geo.parameters.depth,y+py-geo.parameters.height/2,geo.parameters.height));
        const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color,roughness:.9}));m.position.set(px,py,pz);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;
      };
      const box=(w:number,h:number,d:number,color:number,px=0,py=h/2,pz=0)=>mesh(new THREE.BoxGeometry(w,h,d),color,px,py,pz);
      if(place.id==='cheragi') {
        mesh(new THREE.CylinderGeometry(3.5,4.5,.5,24),0xdccdab,0,.25);
        mesh(new THREE.CylinderGeometry(1.1,1.4,6,8),0xdad1b8,0,3.5);
        mesh(new THREE.CylinderGeometry(2.4,1.1,1.4,8),0xb16f43,0,6.8);
        mesh(new THREE.SphereGeometry(.7,12,8),0xe8b957,0,8);
      } else if(place.id==='court') {
        box(42,1,24,0xc3b399);
        box(38,9,18,0xc88870,0,5.5);
        box(42,1,21,0xf0dfbd,0,10.5);
        box(12,13,20,0xc88870,0,7);
        for(let i=-4;i<=4;i++)if(Math.abs(i)>1) {
          box(1.5,4,1,0x364a49,i*4,6,9.1);
          mesh(new THREE.CylinderGeometry(.45,.45,5,8),0xf0dfbd,i*4,3.5,11);
        }
        box(7,5,.5,0x364a49,0,3.5,10.2);
        const roof=mesh(new THREE.ConeGeometry(9,4,4),0x87574b,0,15);roof.rotation.y=Math.PI/4;
      } else {
        const pond=place.id==='laldighi';
        const radius=pond?24:32;
        // Drape park paths to the shared relief; a level water basin sits above it.
        const disk=new THREE.CircleGeometry(radius,48);disk.rotateX(-Math.PI/2);
        const p=disk.getAttribute('position');
        for(let i=0;i<p.count;i++)p.setY(i,height(x+p.getX(i),z+p.getZ(i))-y+.04);
        disk.computeVertexNormals();mesh(disk,0x819e6b);
        if(pond) {
          // Low coping frames the pond; no raised opaque slab over streets.
          box(30,.22,38,0xd5c9ac,0,.12);
          const water=mesh(new THREE.PlaneGeometry(27,35).rotateX(-Math.PI/2),0x398f9e,0,.25);
          (water.material as THREE.MeshStandardMaterial).roughness=.28;
          box(30,.25,1.2,0xe4d5b4,0,.28,18.4);box(30,.25,1.2,0xe4d5b4,0,.28,-18.4);
          box(1.2,.25,35.6,0xe4d5b4,14.4,.28);box(1.2,.25,35.6,0xe4d5b4,-14.4,.28);
          // Block walking into the water while leaving the perimeter promenade open.
          this.solids.push(solidBox(x,z,27,35,y-2,5));
        } else {
          for(let i=0;i<4;i++) box(16+i*3,.7,2,0xd0c2a2,0,height(x,z+8+i*2)-y+.35,8+i*2);
        }
        for(let i=0;i<12;i++) {
          const angle=i/12*Math.PI*2,tx=Math.cos(angle)*radius,tz=Math.sin(angle)*radius;
          const ground=height(x+tx,z+tz)-y;
          mesh(new THREE.CylinderGeometry(.35,.5,4,6),0x74634b,tx,ground+2,tz);
          mesh(new THREE.IcosahedronGeometry(3.5,1),i%2?0x466e4b:0x668552,tx,ground+5.5,tz);
        }
      }
    }
  }
}
