import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {buildRoadGeometry,type RoadData} from '@/world/Roads';
import {buildPaths,samplePath,type Path} from '@/world/RoadPath';
import type {HeightProvider} from '@/geography/WorldHeight';
import {segmentDistance} from '@/geography/CityGeography';
export interface ElevatedRoad extends RoadData {height:number;sourceWayIds:number[]}
export interface ElevatedPath {road:ElevatedRoad;path:Path;heightAt:(distance:number)=>number}
export class CityStructures {
  readonly object=new THREE.Group();
  readonly paths:ElevatedPath[]=[];
  private constructor(){}
  static async load(ground:HeightProvider):Promise<CityStructures>{
    const response=await fetch('/world/chattogram/compact/elevated.json');
    if(!response.ok)throw new Error('Elevated road data unavailable');
    const {elevated}=await response.json() as {elevated:ElevatedRoad[]};
    return CityStructures.build(elevated,ground);
  }
  static build(elevated:ElevatedRoad[],ground:HeightProvider):CityStructures{
    const result=new CityStructures();result.object.name='FlyoversAndBridge';
    const pierMat=new THREE.MeshStandardMaterial({color:0xe1e7df,roughness:.85});
    for(const road of elevated){
      const path=buildPaths([road],0)[0];if(!path)continue;
      const start=samplePath(path,0),end=samplePath(path,path.total);
      const base0=ground(start.x,start.z),base1=ground(end.x,end.z);
      const ramp=Math.min(40,path.total*.22);
      // A smooth grade between the two ends. Following the terrain mid-path made
      // the deck jump at the shoreline cliff and blocked crossing the bridge.
      const h=(d:number)=>{
        const t=Math.max(0,Math.min(1,Math.min(d,path.total-d)/ramp));
        return base0+(base1-base0)*(d/path.total)+road.height*t*t*(3-2*t);
      };
      result.paths.push({road,path,heightAt:h});
      const deckHeight=(x:number,z:number)=>{
        let best=Infinity,along=0;
        for(let i=1;i<path.points.length;i++){
          const a=path.points[i-1]!,b=path.points[i]!,distance=segmentDistance(x,z,a,b);
          if(distance<best){best=distance;const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));along=path.cum[i-1]!+t*(path.cum[i]!-path.cum[i-1]!);}
        }return h(along);
      };
      const mesh=new THREE.Mesh(buildRoadGeometry([road],deckHeight,.7,0),pierMat);mesh.castShadow=true;result.object.add(mesh);
      const asphalt=new THREE.Mesh(buildRoadGeometry([road],deckHeight,0,.15),new THREE.MeshStandardMaterial({color:0x334e61,roughness:.8}));result.object.add(asphalt);
      const line=new THREE.Mesh(buildRoadGeometry([{...road,width:.18}],deckHeight,0,.2),new THREE.MeshBasicMaterial({color:0xfff3c4}));result.object.add(line);
      const railSegments:THREE.Vector3[]=[];
      for(let d=0;d<path.total;d+=3){const a=samplePath(path,d),b=samplePath(path,Math.min(path.total,d+3));for(const side of [-1,1]){
        const offset=road.width/2+.35;
        railSegments.push(new THREE.Vector3(a.x+Math.cos(a.yaw)*offset*side,h(d)+1,a.z-Math.sin(a.yaw)*offset*side),new THREE.Vector3(b.x+Math.cos(b.yaw)*offset*side,h(Math.min(path.total,d+3))+1,b.z-Math.sin(b.yaw)*offset*side));
      }}
      result.object.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(railSegments),new THREE.LineBasicMaterial({color:0xfff0c5})));
      for(let d=18;d<path.total-15;d+=25){const p=samplePath(path,d),base=Math.max(-3,ground(p.x,p.z)),height=h(d)-base;
        const pier=new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.55,Math.max(.1,height),8),pierMat);pier.position.set(p.x,base+height/2,p.z);pier.castShadow=true;result.object.add(pier);
        const cap=new THREE.Mesh(new THREE.BoxGeometry(road.width+1,1.1,2.3),pierMat);cap.position.set(p.x,h(d)-.7,p.z);cap.rotation.y=p.yaw;result.object.add(cap);
      }
      if(road.id==='shah-amanat-bridge'){
        const cables:THREE.Vector3[]=[];
        for(const f of [.32,.68]){const d=path.total*f,p=samplePath(path,d),top=h(d)+16;
          for(const side of [-1,1]){
            const px=p.x+Math.cos(p.yaw)*(road.width/2+1)*side,pz=p.z-Math.sin(p.yaw)*(road.width/2+1)*side;
            const tower=new THREE.Mesh(new THREE.BoxGeometry(1.8,21,1.8),pierMat);tower.position.set(px,top-10.5,pz);result.object.add(tower);
            for(const delta of [-12,-8,-4,4,8,12]){const qd=Math.max(0,Math.min(path.total,d+delta)),q=samplePath(path,qd);cables.push(new THREE.Vector3(px,top,pz),new THREE.Vector3(q.x+Math.cos(q.yaw)*road.width*.5*side,h(qd)+.7,q.z-Math.sin(q.yaw)*road.width*.5*side));}
          }
        }
        result.object.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(cables),new THREE.LineBasicMaterial({color:0xffecbc})));
      }
    }
    const parts=result.object.children.filter(c=>c instanceof THREE.Mesh) as THREE.Mesh[];
    const geometry=mergeGeometries(parts.map(p=>{p.updateMatrix();const g=p.geometry.clone().applyMatrix4(p.matrix);g.deleteAttribute('uv');const color=(p.material as THREE.MeshStandardMaterial).color;const colors=[];for(let i=0;i<g.getAttribute('position').count;i++)colors.push(color.r,color.g,color.b);g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));return g;}));
    if(geometry){const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8,side:THREE.DoubleSide}));mesh.castShadow=true;parts.forEach(p=>result.object.remove(p));result.object.add(mesh);}
    return result;
  }

  /** Top of any elevated deck covering (x,z), or null when the point is off-deck. */
  deckTop(x:number,z:number):number|null {
    let best:number|null=null;
    for(const {road,path,heightAt} of this.paths){
      const reach=road.width/2+1.4;
      // Follow the nearest segment; a long bridge can be within reach of several,
      // and picking an earlier one reported a different (lower) deck height.
      let bestDistance=Infinity,along=-1;
      for(let i=1;i<path.points.length;i++){
        const a=path.points[i-1]!,b=path.points[i]!,distance=segmentDistance(x,z,a,b);
        if(distance>=bestDistance)continue;
        bestDistance=distance;
        const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));
        along=path.cum[i-1]!+t*(path.cum[i]!-path.cum[i-1]!);
      }
      if(bestDistance>reach||along<0)continue;
      const top=heightAt(along)+.15;
      if(best===null||top>best)best=top;
    }
    return best;
  }
}
