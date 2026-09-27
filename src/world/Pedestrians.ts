import * as THREE from 'three';
import type {HeightProvider} from '@/geography/WorldHeight';
import type {RoadData} from '@/world/Roads';
import {buildPaths,samplePath,type Path} from '@/world/RoadPath';
const COUNT=72;
interface Walker {path:Path;distance:number;phase:number;side:number;speed:number}
export class Pedestrians {
 readonly object=new THREE.Group();private readonly walkers:Walker[]=[];private time=0;
 private readonly parts:Array<{mesh:THREE.InstancedMesh;part:string}>=[];
 constructor(roads:RoadData[],private readonly ground:HeightProvider){
  this.object.name='Pedestrians';const paths=buildPaths(roads,35);
  const part=(name:string,geo:THREE.BufferGeometry,color:number)=>{const mesh=new THREE.InstancedMesh(geo,new THREE.MeshStandardMaterial({color,roughness:.8}),paths.length?COUNT:0);mesh.frustumCulled=false;mesh.castShadow=true;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.object.add(mesh);this.parts.push({mesh,part:name});return mesh;};
  const torso=part('torso',new THREE.CapsuleGeometry(.25,.5,4,8),0xffffff);
  part('head',new THREE.SphereGeometry(.19,10,8),0xffffff);
  part('hair',new THREE.SphereGeometry(.2,8,6,0,Math.PI*2,0,Math.PI*.5),0x30233c);
  part('legL',new THREE.CapsuleGeometry(.1,.58,4,8).translate(0,-.38,0),0x244e73);
  part('legR',new THREE.CapsuleGeometry(.1,.58,4,8).translate(0,-.38,0),0x244e73);
  part('armL',new THREE.CapsuleGeometry(.075,.5,4,8).translate(0,-.3,0),0xdba47c);
  part('armR',new THREE.CapsuleGeometry(.075,.5,4,8).translate(0,-.3,0),0xdba47c);
  const shirts=[0xff6b59,0xffcc45,0x28cba4,0x3d9af1,0xd16dec,0xff8bb3],skin=[0xe5b38a,0xb97751,0xc78b60];
  for(let i=0;i<COUNT&&paths.length;i++){
   this.walkers.push({path:paths[i%paths.length]!,distance:i*51.37,phase:i*2.3,side:i%2?1:-1,speed:1.2+i%4*.18});torso.setColorAt(i,new THREE.Color(shirts[i%shirts.length]!));this.parts.find(p=>p.part==='head')!.mesh.setColorAt(i,new THREE.Color(skin[i%skin.length]!));
  }
  this.update(0);
 }
 update(delta:number):void{
  this.time+=delta;const base=new THREE.Matrix4(),local=new THREE.Matrix4(),out=new THREE.Matrix4(),q=new THREE.Quaternion(),pos=new THREE.Vector3(),scale=new THREE.Vector3(1.15,1.15,1.15),rot=new THREE.Quaternion();
  for(let i=0;i<this.walkers.length;i++){
   const w=this.walkers[i]!;w.distance+=delta*w.speed;const cycle=w.distance%(w.path.total*2),forward=cycle<w.path.total,d=forward?cycle:w.path.total*2-cycle,p=samplePath(w.path,d);
   const offset=(w.path.width/2+2)*w.side,x=p.x-Math.cos(p.yaw)*offset,z=p.z+Math.sin(p.yaw)*offset,phase=this.time*w.speed*5+w.phase,swing=Math.sin(phase)*.55;
   q.setFromAxisAngle(new THREE.Vector3(0,1,0),p.yaw+(forward?0:Math.PI));base.compose(pos.set(x,this.ground(x,z)+Math.abs(Math.sin(phase))*.04,z),q,scale);
   for(const part of this.parts){let y=1.22,px=0,angle=0;if(part.part==='head')y=1.88;if(part.part==='hair')y=1.94;if(part.part.startsWith('leg')){y=.88;px=part.part==='legL'?.13:-.13;angle=swing*Math.sign(px);}if(part.part.startsWith('arm')){y=1.53;px=part.part==='armL'?.34:-.34;angle=-swing*Math.sign(px);}
     rot.setFromAxisAngle(new THREE.Vector3(1,0,0),angle);local.compose(pos.set(px,y,0),rot,new THREE.Vector3(1,1,1));out.multiplyMatrices(base,local);part.mesh.setMatrixAt(i,out);
   }
  }
  this.parts.forEach(p=>{p.mesh.instanceMatrix.needsUpdate=true;});
 }
}
