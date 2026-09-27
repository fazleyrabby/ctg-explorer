import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {type RoadData} from '@/world/Roads';
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
      const rise=road.id==='bahaddarhat-flyover'?6:road.height;
      const ramp=Math.min(Math.max(60,rise*7),path.total*.43);
      // A smooth grade between the two ends. Following the terrain mid-path made
      // the deck jump at the shoreline cliff and blocked crossing the bridge.
      const h=(d:number)=>{
        const t=Math.max(0,Math.min(1,Math.min(d,path.total-d)/ramp));
        return base0+(base1-base0)*(d/path.total)+rise*t*t*(3-2*t);
      };
      result.paths.push({road,path,heightAt:h});
      // Shared cross-sections keep both sides level through bends. Ground-road
      // round caps and nearest-segment height lookup folded the tight ramps.
      const ribbon=(width:number,lift:number)=>elevatedRibbon(path,h,width,lift);
      const mesh=new THREE.Mesh(solidDeck(ribbon(road.width+1.4,0),.7),pierMat);mesh.castShadow=true;result.object.add(mesh);
      const asphalt=new THREE.Mesh(ribbon(road.width,.15),new THREE.MeshStandardMaterial({color:0x334e61,roughness:.8}));result.object.add(asphalt);
      const line=new THREE.Mesh(ribbon(.18,.2),new THREE.MeshBasicMaterial({color:0xfff3c4}));result.object.add(line);
      const railSegments:THREE.Vector3[]=[];
      for(let d=0;d<path.total;d+=3){const a=samplePath(path,d),b=samplePath(path,Math.min(path.total,d+3));for(const side of [-1,1]){
        const offset=road.width/2+.35;
        railSegments.push(new THREE.Vector3(a.x+Math.cos(a.yaw)*offset*side,h(d)+1,a.z-Math.sin(a.yaw)*offset*side),new THREE.Vector3(b.x+Math.cos(b.yaw)*offset*side,h(Math.min(path.total,d+3))+1,b.z-Math.sin(b.yaw)*offset*side));
      }}
      result.object.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(railSegments),new THREE.LineBasicMaterial({color:0xfff0c5})));
      for(let d=18;d<path.total-15;d+=25){const p=samplePath(path,d),base=Math.max(-3,ground(p.x,p.z)),height=h(d)-base;
        if(height<3)continue;
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
    const geometry=mergeGeometries(parts.map(p=>{p.updateMatrix();const g=p.geometry.clone().applyMatrix4(p.matrix);g.deleteAttribute('uv');const color=(p.material as THREE.MeshStandardMaterial).color;const colors=[];for(let i=0;i<g.getAttribute('position').count;i++)colors.push(color.r,color.g,color.b);g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));return g.index?g.toNonIndexed():g;}));
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

/** Closed slab: every top triangle has a bottom and thickness at its edges. */
export function solidDeck(top:THREE.BufferGeometry,thickness:number):THREE.BufferGeometry {
 const source=top.toNonIndexed(),p=source.getAttribute('position'),vertices:number[]=[];
 const vertex=(i:number,down=0)=>vertices.push(p.getX(i),p.getY(i)-down,p.getZ(i));
 for(let i=0;i<p.count;i+=3){
  vertex(i);vertex(i+1);vertex(i+2);vertex(i+2,thickness);vertex(i+1,thickness);vertex(i,thickness);
  for(let j=0;j<3;j++){const a=i+j,b=i+(j+1)%3;vertex(a);vertex(a,thickness);vertex(b);vertex(b);vertex(a,thickness);vertex(b,thickness);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();top.dispose();source.dispose();return g;
}

/** A continuous strip sampled by distance, with no overlapping round join fans. */
export function elevatedRibbon(path:Path,heightAt:(d:number)=>number,width:number,lift=0):THREE.BufferGeometry {
  const positions:number[]=[],indices:number[]=[];
  const steps=Math.ceil(path.total/1.5);
  for(let i=0;i<=steps;i++){
    const d=path.total*i/steps,p=samplePath(path,d);
    const before=samplePath(path,Math.max(0,d-2)),after=samplePath(path,Math.min(path.total,d+2));
    const dx=after.x-before.x,dz=after.z-before.z,len=Math.hypot(dx,dz)||1;
    const nx=-dz/len*width/2,nz=dx/len*width/2,y=heightAt(d)+lift;
    positions.push(p.x+nx,y,p.z+nz,p.x-nx,y,p.z-nz);
    if(i<steps){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
