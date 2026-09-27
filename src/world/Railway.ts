import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RAILWAY_PLACE,railwayLayout,railPoint} from '@/geography/RailwayLayout';
import {solidBox} from './SolidFootprints';
import type {HeightProvider} from '@/geography/WorldHeight';
export function trainPosition(time:number):number{const phase=(time%44)/44; if(phase<.1)return -48;if(phase>.5&&phase<.6)return 48;const t=phase<=.5?(phase-.1)/.4:(phase-.6)/.4;return (phase<=.5?-1:1)*(48-96*t*t*(3-2*t));}
export class Railway{
 readonly object=new THREE.Group();readonly named=[{...RAILWAY_PLACE,x:railwayLayout.x,z:railwayLayout.z}];readonly solids=[] as ReturnType<typeof solidBox>[];
 private trains:THREE.Group[]=[];private time=0;
 constructor(height:HeightProvider){
  const root=this.object;root.name='Chattogram railway station';root.position.set(railwayLayout.x,height(railwayLayout.x,railwayLayout.z),railwayLayout.z);root.rotation.y=railwayLayout.yaw;
  const parts:THREE.BufferGeometry[]=[];
  const box=(w:number,h:number,d:number,c:number,x:number,y:number,z:number,bucket=parts)=>{const g=new THREE.BoxGeometry(w,h,d).toNonIndexed();g.translate(x,y,z);const color=new THREE.Color(c),colors=[];for(let i=0;i<g.getAttribute('position').count;i++)colors.push(color.r,color.g,color.b);g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));bucket.push(g);};
  const finish=(bucket:THREE.BufferGeometry[],parent:THREE.Object3D)=>{const g=mergeGeometries(bucket);if(g){const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.75}));mesh.castShadow=true;parent.add(mesh);}bucket.forEach(g=>g.dispose());};
  box(48,.16,154,0xb7b69e,0,.02,0);
  for(const lane of [-4,4]){
   box(4,.22,144,0x657270,lane,.17,0);
   for(let z=-70;z<=70;z+=2)box(3.4,.15,.4,0x725c48,lane,.34,z);
   for(const side of [-1,1])box(.14,.17,144,0xc6d0cd,lane+side*.9,.48,0);
   for(const z of [-72,72]){box(3,.25,.6,0xdc5c43,lane,1.1,z);for(const x of [-1,1])box(.25,1.2,.35,0x475253,lane+x,.7,z);}
  }
  for(const side of [-1,1]){
   box(5,.5,100,0xe9dfc6,side*10,.3,0);box(.3,.04,100,0xf4cb54,side*7.65,.58,0);
   box(6,.35,54,0x328d83,side*10,4.1,0);
   for(let z=-24;z<=24;z+=12)box(.3,3.5,.3,0xe5e3cf,side*10,2.2,z);
   for(let z=-18;z<=18;z+=12){box(2.8,.25,.7,0xb37645,side*10,1,z);box(2.8,.8,.15,0xb37645,side*10,1.45,z+.3);}
  }
  box(9,7,30,0xf5dfac,19,3.5,12);box(11,.5,33,0xcb7655,19,7.25,12);
  for(let z=0;z<=24;z+=6)box(.18,3,2.4,0x265764,14.4,3,z);
  box(10,1,5,0xf1cd8a,19,.5,-7);
  const [sx,sz]=railPoint(19,12);this.solids.push(solidBox(sx,sz,9,30,root.position.y,7,railwayLayout.yaw));
  finish(parts,root);
  if(typeof document!=='undefined'){
   const canvas=document.createElement('canvas');canvas.width=768;canvas.height=128;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#174d4b';ctx.fillRect(0,0,768,128);ctx.fillStyle='#fff1cf';ctx.font='bold 42px sans-serif';ctx.textAlign='center';ctx.fillText('CHATTOGRAM RAILWAY',384,56);ctx.font='26px sans-serif';ctx.fillText('PLATFORMS 1 · 2',384,103);
   const sign=new THREE.Mesh(new THREE.PlaneGeometry(15,2.5),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),side:THREE.DoubleSide}));sign.position.set(0,5,27);root.add(sign);
  }
  for(let train=0;train<2;train++){
   const group=new THREE.Group();root.add(group);this.trains.push(group);group.position.x=train?4:-4;
   const body:THREE.BufferGeometry[]=[];
   for(let car=0;car<3;car++){
    const z=(car-1)*10;box(2.5,2.5,8.5,train?0x287e64:0xad3f47,0,2,z,body);box(2.65,.35,8.8,0xeee3c3,0,3.4,z,body);box(2.55,.35,8.6,0xe8d899,0,1.55,z,body);
    for(const side of [-1,1]){for(let w=-3;w<=3;w+=1.5)box(.06,.8,.95,0x173e4c,side*1.28,2.6,z+w,body);for(const end of [-2.7,2.7])box(.3,.6,1.3,0x293335,side*1.12,.7,z+end,body);}
    box(.3,.3,1.8,0x374342,0,1,z+4.8,body);
   }
   box(1.8,.8,.08,0x173e4c,0,2.6,14.3,body);for(const side of [-1,1])box(.3,.3,.1,0xffecc1,side*.8,1.8,14.35,body);
   finish(body,group);
  }
  this.update(10);
 }
 update(delta:number):void{this.time+=delta;this.trains.forEach((train,i)=>{train.position.z=trainPosition(this.time+i*22);});}
}
