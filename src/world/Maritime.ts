import {solidBox} from '@/world/SolidFootprints';
import type {CollisionBox} from '@/world/Colliders';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {PORT,portPoint} from '@/geography/PortLayout';
import {coastX,project} from '@/geography/CityGeography';
import type {NamedBuilding} from '@/world/Buildings';

const CARGO=[0xe47f48,0x399da0,0xf0c15c,0x466c9b,0xcf655d];
function builder(){
 const parts:THREE.BufferGeometry[]=[];
 const add=(g:THREE.BufferGeometry,c:number,x=0,y=0,z=0,angle=0)=>{g.rotateY(angle).translate(x,y,z);const color=new THREE.Color(c),array=new Float32Array(g.getAttribute('position').count*3);for(let i=0;i<array.length;i+=3){array[i]=color.r;array[i+1]=color.g;array[i+2]=color.b;}g.deleteAttribute('uv');g.setAttribute('color',new THREE.BufferAttribute(array,3));parts.push(g.index?g.toNonIndexed():g);};
 const box=(w:number,h:number,d:number,c:number,x:number,y:number,z:number,a=0)=>add(new THREE.BoxGeometry(w,h,d),c,x,y,z,a);
 const beam=(a:THREE.Vector3,b:THREE.Vector3,width:number,c:number)=>{const g=new THREE.CylinderGeometry(width,width,a.distanceTo(b),6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize()));const mid=a.clone().add(b).multiplyScalar(.5);add(g,c,mid.x,mid.y,mid.z);};
 const finish=()=>{const g=mergeGeometries(parts);if(!g)throw new Error('Marine geometry could not merge');const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.72}));mesh.castShadow=true;return mesh;};
 return {add,box,beam,finish};
}
function container(b:ReturnType<typeof builder>,x:number,y:number,z:number,index:number,w=5,h=3,d=11){
 b.box(w,h,d,CARGO[index%CARGO.length]!,x,y+h/2,z);
 for(let i=-4;i<=4;i++)for(const side of [-1,1])b.box(.09,h*.9,.12,0xd3d1b6,x+side*(w/2+.03),y+h/2,z+i*d/10);
 for(const side of [-1,1]){b.box(w,.13,.12,0xe4d6b8,x,y+h-.1,z+side*d/2);b.box(.1,h*.8,.12,0xe4d6b8,x,y+h/2,z+side*(d/2+.05));}
}
function hull(b:ReturnType<typeof builder>,length:number,width:number,height:number,color:number){
 const shape=new THREE.Shape();shape.moveTo(-width*.4,-length*.5);shape.lineTo(width*.4,-length*.5);shape.lineTo(width*.5,length*.22);shape.quadraticCurveTo(width*.38,length*.4,0,length*.5);shape.quadraticCurveTo(-width*.38,length*.4,-width*.5,length*.22);shape.closePath();
 const g=new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:true,bevelSize:.25,bevelThickness:.25,bevelSegments:1,steps:1,curveSegments:5});g.rotateX(Math.PI/2);b.add(g,color,0,height,0);
}
export function cargoShip(length=56,width=9):THREE.Group {
 const group=new THREE.Group(),b=builder(),h=2.7;
 hull(b,length,width,h,0x254a64);b.box(width*.79,.35,length*.80,0xd8c8a2,0,h+.1,-length*.04);
 // Stacked cargo and a stepped stern bridge distinguish the ship silhouette.
 for(let row=0;row<3;row++)for(let col=0;col<2;col++)for(let level=0;level<2;level++)container(b,(col-.5)*width*.4,h+.3+level*2.2,-length*.13+row*length*.19,row+col+level,width*.36,2.1,length*.17);
 b.box(width*.73,3.2,length*.12,0xf4ebd5,0,h+1.7,-length*.36);b.box(width*.85,2.4,length*.10,0xfff3db,0,h+4.1,-length*.34);
 b.box(width*.72,1,.16,0x40768c,0,h+4.5,-length*.29);b.box(width*.2,2.3,2,0xd9804c,width*.2,h+5,-length*.39);
 b.box(.18,5,.18,0xf7ecd6,0,h+6.5,-length*.34);b.box(width*.65,.12,.12,0xf7ecd6,0,h+8,-length*.34);
 for(const side of [-1,1]){
  b.beam(new THREE.Vector3(side*width*.4,h+1,-length*.45),new THREE.Vector3(side*width*.4,h+1,length*.22),.05,0xf4e8cd);
  for(let z=-length*.44;z<length*.24;z+=4)b.box(.09,1,.09,0xf4e8cd,side*width*.4,h+.5,z);
  b.add(new THREE.TorusGeometry(.6,.16,5,12),0xf09943,side*width*.43,h+2,-length*.35,Math.PI/2);
 }
 group.add(b.finish());group.name='Container ship';return group;
}
export function speedboat(index=0):THREE.Group {
 const group=new THREE.Group(),b=builder();hull(b,12,3.5,1,0xfff1d8);
 b.box(3.1,.35,7,CARGO[index%CARGO.length]!,0,.8,-1);b.box(2.8,.35,5,0xffeed6,0,1.15,1.7);
 b.box(2.6,.9,.15,0x60b2c5,0,1.9,.6);b.box(.12,1.2,.12,0xf5ebd4,-1.35,1.65,.6);b.box(.12,1.2,.12,0xf5ebd4,1.35,1.65,.6);
 for(const side of [-1,1]){b.box(.8,.55,1.2,0x2a6271,side*.7,1.2,-1.6);b.box(.8,1,.35,0x2a6271,side*.7,1.5,-2.1);b.box(.6,1.3,.8,0x354a56,side*.75,.8,-5.7);}
 b.box(.55,.8,.45,0xe6a453,-.65,1.85,-1.6);b.add(new THREE.SphereGeometry(.33,8,6),0xc7916f,-.65,2.5,-1.6);
 group.add(b.finish());group.name='Patenga speedboat';return group;
}
type Vessel={object:THREE.Group;wake?:THREE.Mesh;kind:'speedboat'|'offshore'|'berthed';phase:number;localZ?:number};
export class Maritime {
 readonly solids:CollisionBox[]=[];
 readonly object=new THREE.Group();readonly named:NamedBuilding[]=[];
 readonly vessels:Vessel[]=[];
 readonly containerCount=156;
  private readonly hoists:THREE.Group[]=[];
  private readonly hooks:THREE.Group[]=[];
  private readonly trucks:THREE.Group[]=[];
  private time=0;
 constructor(){
  this.object.name='ChittagongPortAndMarineTraffic';
  const port=new THREE.Group();port.position.set(PORT.x,0,PORT.z);port.rotation.y=PORT.yaw;this.object.add(port);
  const b=builder(),ground=4.3;
  // The quay wall top sits just above the apron top; equal tops z-fought along
  // the whole quay and flickered as the camera moved.
  b.box(111,.8,138,0x8c9fa2,-70,ground-.4,0);b.box(6,4.3,136,0xd8d2b7,-16,ground-1.85,0);
  // Dock bumpers, bollards, safety stripes and container handling lanes.
  for(let z=-62;z<=62;z+=8){b.box(1.4,1.5,2,0x344953,-12.6,2,z);b.add(new THREE.CylinderGeometry(.4,.6,.8,8),0x455560,-17,4.7,z);b.box(.8,.04,3.8,z%16?0xf0ca56:0x384953,-19,4.5,z);}
  for(const x of [-26,-50,-78,-111])b.box(.25,.05,126,0xf1da91,x,ground+.45,0);
  // Tiered stacks share one raised origin — never build the same box twice.
  for(let row=0;row<6;row++)for(let col=0;col<4;col++)for(let level=0;level<2+(row%3===0?1:0);level++)container(b,-39-col*8,ground+level*3,-49+row*18,row+col+level,5,3,12);
  for(const z of [-38,33]){
   const [wx,wz]=portPoint(-96,z);this.solids.push(solidBox(wx,wz,26,36,ground,12,PORT.yaw));
   b.box(26,12,36,0xe5d5aa,-96,ground+6,z);b.box(29,.8,39,0x4b8d95,-96,ground+12.3,z);
   for(let k=-1;k<=1;k++)b.box(.2,6,7,0x51727a,-82.8,ground+3,z+k*10);
   b.box(25,1.5,.2,0xf7e6c2,-96,ground+9,z+18.1);
  }
  const [ox,oz]=portPoint(-98,62);this.solids.push(solidBox(ox,oz,18,12,ground,10,PORT.yaw));
  b.box(18,10,12,0xf3e7c9,-98,ground+5,62);b.box(18,2,.2,0x548794,-98,ground+7,68.1);
  b.box(22,.7,15,0x42798c,-98,ground+10,62);
  for(const x of [-125,-78])b.box(.5,3,134,0x9eb4ad,x,ground+1.5,0);
  // Three ship-to-shore cranes; each trolley travels the boom and its spreader
  // raises and lowers a container onto the quay and the ship (daily loading).
  let crane=0;
  for(const z of [-44,0,44]){
   for(const x of [-30,-20])for(const dz of [-5,5]){b.box(1.2,29,1.2,0xe5b34e,x,ground+14.5,z+dz);b.box(3,1,3,0x344c5b,x,ground+.5,z+dz);}
   b.box(48,1.4,2,0xf2c75a,-10,ground+29,z);b.box(13,1.5,14,0xf0bf51,-25,ground+25,z);
   b.box(4,3,4,0x4e8c99,-21,ground+23,z+6);
   b.beam(new THREE.Vector3(-28,ground+39,z),new THREE.Vector3(12,ground+29,z),.14,0xf5df9b);
   b.beam(new THREE.Vector3(-28,ground+39,z),new THREE.Vector3(-33,ground+29,z),.14,0xf5df9b);
   b.box(.9,12,.9,0xd7a849,-28,ground+33,z);
   const trolley=new THREE.Group();trolley.position.set(0,ground+27.8,z);
   const tb=builder();tb.box(8,.6,3.4,0xf3c34e,0,0,0);trolley.add(tb.finish());
   const hook=new THREE.Group();
   const hb=builder();for(const dx of [-3,3])hb.box(.1,10,.1,0x445b61,dx,-5,0);hb.box(6,.7,3.4,0x445b61,0,-10.6,0);container(hb,0,-12.4,0,crane,5,2.8,11);hook.add(hb.finish());
   trolley.add(hook);this.hoists.push(trolley);this.hooks.push(hook);port.add(trolley);
   crane++;
  }
  // Yard trucks haul containers along the service lane.
  for(let i=0;i<4;i++){const t=builder();t.box(4,1,14,0x3a4d59,0,1,0);t.box(4,3,4,CARGO[i]!,0,2.7,8);t.box(3.4,1.1,.12,0x7bbed0,0,3.2,10.1);container(t,0,1.5,0,i,3.7,2.6,11);for(const side of [-1,1])for(const dz of [-4,4,8])t.add(new THREE.CylinderGeometry(.8,.8,.5,8).rotateZ(Math.PI/2),0x293b45,side*2,.8,dz);const truck=new THREE.Group();truck.add(t.finish());truck.position.set(-72,ground,-48+i*29);port.add(truck);this.trucks.push(truck);}
  // Entrance gate, lighting and visible port lettering.
  for(const x of [-120,-104])b.box(.8,7,.8,0xf0d9a9,x,ground+3.5,-69);
  b.box(19,2,.8,0x286c7e,-112,ground+7,-69);
  for(const z of [-58,0,58]){b.box(.25,19,.25,0xc5d2cf,-80,ground+9.5,z);b.box(5,.4,1,0xffedb2,-80,ground+19,z);}
  port.add(b.finish());
  if(typeof document!=='undefined'){
   const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#286c7e';ctx.fillRect(0,0,1024,128);ctx.fillStyle='#fff2cc';ctx.font='bold 72px sans-serif';ctx.textAlign='center';ctx.fillText('CHITTAGONG PORT',512,88);const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;const sign=new THREE.Mesh(new THREE.PlaneGeometry(18,2.25),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));sign.position.set(-112,ground+7,-69.5);port.add(sign);
  }
  for(const z of [-33,33]){const ship=cargoShip(56,8);const [x,wz]=portPoint(0,z);ship.position.set(x,.3,wz);ship.rotation.y=PORT.yaw;this.object.add(ship);this.vessels.push({object:ship,kind:'berthed',phase:z,localZ:z});}
  const [visitX,visitZ]=portPoint(-112,-83);
  this.named.push({id:'chittagong-port',name:'Chittagong Port · Container Terminal',type:'port',x:visitX,z:visitZ,height:35,description:'A compact interpretation of Chittagong’s Karnaphuli container terminals, with quays, cranes, stacked cargo and warehouses. Terminal layout and berth positions are adapted to the miniature; this is not a surveyed replica.',wikipedia:'en:Port_of_Chittagong'});
  for(let i=0;i<3;i++){const boat=speedboat(i);this.object.add(boat);const wake=this.wake(19,7);this.object.add(wake);this.vessels.push({object:boat,wake,kind:'speedboat',phase:i*2.1});}
  for(let i=0;i<2;i++){const ship=cargoShip(95,18);this.object.add(ship);this.vessels.push({object:ship,kind:'offshore',phase:i*Math.PI});}
  this.update(0);
 }
 private wake(length:number,width:number):THREE.Mesh{
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,-5,-width,0,-length,-width*.7,0,-length,0,0,-5,width*.7,0,-length,width,0,-length],3));g.computeVertexNormals();
  return new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0xd8f7ec,transparent:true,opacity:.3,side:THREE.DoubleSide,depthWrite:false}));
 }
 update(delta:number):void{
  this.time+=delta;const [,pz]=project(22.23444,91.79226);
  this.vessels.forEach(v=>{
   if(v.kind==='berthed'){v.object.position.y=.3+Math.sin(this.time*.45+v.phase)*.05;v.object.rotation.z=Math.sin(this.time*.3+v.phase)*.003;return;}
   const speed=v.kind==='speedboat'?.09:.009,a=this.time*speed+v.phase;
   const position=(angle:number)=>{const z=pz+Math.sin(angle)*(v.kind==='speedboat'?145:310);return new THREE.Vector3(coastX(z)-(v.kind==='speedboat'?95:245)+Math.cos(angle)*(v.kind==='speedboat'?28:35),.5,z);};
   const p=position(a),next=position(a+.01);v.object.position.copy(p);v.object.position.y+=Math.sin(this.time*1.6+v.phase)*(v.kind==='speedboat'?.15:.22);v.object.rotation.set(0,Math.atan2(next.x-p.x,next.z-p.z),Math.sin(this.time+v.phase)*.018);
   if(v.wake){v.wake.position.set(p.x,.7,p.z);v.wake.rotation.y=v.object.rotation.y;(v.wake.material as THREE.MeshBasicMaterial).opacity=.22+.06*Math.sin(this.time*2+v.phase);}
  });
   this.hoists.forEach((t,i)=>{
    const phase=((this.time*.13+i*.31)%1)*Math.PI*2;
    const travel=Math.sin(phase)*.5+.5;              // 0 over apron .. 1 over ship
    t.position.x=-28+travel*32;
    const settle=Math.abs(Math.cos(phase));           // lower the spreader at each end
    this.hooks[i]!.position.y=-2-settle*13;
   });
   this.trucks.forEach((t,i)=>{t.position.z=-62+((this.time*.05+i*.27)%1)*124;});
  }
}
