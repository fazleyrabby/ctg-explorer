import * as THREE from 'three';
import type {HeightProvider} from '@/geography/WorldHeight';
import type {RoadData} from '@/world/Roads';
import {buildPaths,samplePath,type Path} from '@/world/RoadPath';
import {richVehicle,type TrafficKind} from '@/world/RichVehicles';
import type {ElevatedPath} from '@/world/CityStructures';
interface Mover {object:THREE.Group;wheels:THREE.Object3D[];path:Path;distance:number;speed:number;heightAt?:((d:number)=>number)}
export class Traffic {
 readonly object=new THREE.Group();private readonly movers:Mover[]=[];
 constructor(roads:RoadData[],private readonly ground:HeightProvider,elevated:ElevatedPath[]=[]){
  this.object.name='Traffic';const paths=buildPaths(roads,45);const kinds:TrafficKind[]=['car','cng','rickshaw','bus'];const paint=[0xff6650,0x20bf78,0xffce40,0x36aeee,0xeb4f95];
  for(let i=0;i<32+elevated.length*3;i++){
    const over=i>=32?elevated[Math.floor((i-32)/3)]:undefined;
    const path=over?.path??paths[i%paths.length];if(!path)continue;
    const kind=over?(i%3?'car':'bus'):kinds[i%4]!;
    const object=richVehicle(kind,kind==='cng'?0x19be73:paint[i%paint.length]!);object.scale.setScalar(1.15);this.object.add(object);
    const wheels:THREE.Object3D[]=[];object.traverse(p=>{if(p.userData.wheel)wheels.push(p);});
    const mover:Mover={object,wheels,path,distance:(i*.618%1)*path.total*2,speed:kind==='rickshaw'?3:over?12:7};if(over)mover.heightAt=over.heightAt;this.movers.push(mover);
  }
  this.update(0,false);
 }
 update(delta:number,_night:boolean):void{
  for(const m of this.movers){m.distance+=delta*m.speed;const cycle=m.distance%(m.path.total*2),forward=cycle<m.path.total,d=forward?cycle:m.path.total*2-cycle;
    const p=samplePath(m.path,d),offset=m.path.width*.22*(forward?1:-1),x=p.x-Math.cos(p.yaw)*offset,z=p.z+Math.sin(p.yaw)*offset;
    m.object.position.set(x,(m.heightAt?m.heightAt(d):this.ground(x,z))+.22,z);m.object.rotation.y=p.yaw+(forward?0:Math.PI);
    for(const w of m.wheels)w.rotation.x+=delta*m.speed/.37*(forward?1:-1);
  }
 }
}
