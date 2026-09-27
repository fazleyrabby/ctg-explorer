import {solidBox} from '@/world/SolidFootprints';
import type {CollisionBox} from '@/world/Colliders';
import {inPortDistrict} from '@/geography/PortLayout';
import {inProminentDistrict} from '@/world/ProminentPlaces';
import {inAirportDistrict} from '@/world/Airport';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {localWorldBounds} from '@/geography/Projection';
import {project,shoreDistance,segmentDistance} from '@/geography/CityGeography';
import {buildPaths,samplePath} from '@/world/RoadPath';
import type {RoadData} from '@/world/Roads';
import type {BuildingData} from '@/world/Buildings';
import type {HeightProvider} from '@/geography/WorldHeight';

/** Decorative infill, deliberately separate from the sourced building footprints. */
export class Neighborhoods {
 readonly solids:CollisionBox[]=[];
  readonly object=new THREE.Group();
  readonly buildings:Array<{x:number;z:number;radius:number}>=[];
  readonly trees:Array<{x:number;z:number}>=[];
  private readonly plane=new THREE.Group();
  private time=0;
  constructor(roads:RoadData[],existing:BuildingData[],height:HeightProvider){
    this.object.name='NeighborhoodsAndNature';
    const parts:THREE.BufferGeometry[]=[];
    const add=(geo:THREE.BufferGeometry,color:number,x:number,y:number,z:number,angle=0)=>{
      geo.rotateY(angle).translate(x,y,z);const c=new THREE.Color(color),array=new Float32Array(geo.getAttribute('position').count*3);
      for(let i=0;i<array.length;i+=3){array[i]=c.r;array[i+1]=c.g;array[i+2]=c.b;}
      geo.setAttribute('color',new THREE.BufferAttribute(array,3));parts.push(geo.index?geo.toNonIndexed():geo);
    };
    const box=(w:number,h:number,d:number,c:number,x:number,y:number,z:number,a=0)=>add(new THREE.BoxGeometry(w,h,d),c,x,y,z,a);
    const occupied=existing.map(b=>({minX:Math.min(...b.ring.map(p=>p[0]))-5,maxX:Math.max(...b.ring.map(p=>p[0]))+5,minZ:Math.min(...b.ring.map(p=>p[1]))-5,maxZ:Math.max(...b.ring.map(p=>p[1]))+5}));
    const bounds=localWorldBounds();
    const roadClear=(x:number,z:number,r:number)=>!roads.some(road=>road.points.slice(1).some((p,i)=>segmentDistance(x,z,road.points[i]!,p)<road.width/2+r));
    const clear=(x:number,z:number,r:number)=>!inPortDistrict(x,z,r)&&!inProminentDistrict(x,z,r+6)&&!inAirportDistrict(x,z,r+6)&&x>bounds.minX+r&&x<bounds.maxX-r&&z>bounds.minZ+r&&z<bounds.maxZ-r&&shoreDistance(x,z)>r+5&&roadClear(x,z,r+3)&&!occupied.some(b=>x+r>b.minX&&x-r<b.maxX&&z+r>b.minZ&&z-r<b.maxZ)&&!this.buildings.some(b=>Math.hypot(x-b.x,z-b.z)<r+b.radius+5);
    const palette=[0xffe3a6,0xf4a185,0x71c7ba,0xc3b6dc,0x8dcde3];
    let index=0;
    for(const path of buildPaths(roads,65))for(let d=22;d<path.total;d+=34)for(const side of [-1,1]){
      const p=samplePath(path,d),w=11+(index%3)*3,depth=10+(index%2)*3,r=Math.hypot(w,depth)/2;
      const off=path.width/2+23+(index%3)*6,x=p.x+Math.cos(p.yaw)*off*side,z=p.z-Math.sin(p.yaw)*off*side;
      index++;
      if(!clear(x,z,r))continue;
      const floors=2+index%5,h=floors*3.1,y=height(x,z),angle=p.yaw+(side>0?-Math.PI/2:Math.PI/2);
      this.buildings.push({x,z,radius:r});
      this.solids.push(solidBox(x,z,w,depth,y,h,angle));
      const local=(lx:number,ly:number,lz:number,ww:number,hh:number,dd:number,c:number)=>box(ww,hh,dd,c,x+Math.cos(angle)*lx+Math.sin(angle)*lz,y+ly,z-Math.sin(angle)*lx+Math.cos(angle)*lz,angle);
      local(0,h/2,0,w,h,depth,palette[index%palette.length]!);
      local(0,h+.35,0,w+1,.7,depth+1,0xfff2d4);
      // A varied roof silhouette reads at overview distance as well as on foot.
      if(index%3===1){
        const roof=new THREE.ConeGeometry(1,1,4).rotateY(Math.PI/4).scale((w+2)/Math.SQRT2,3.4,(depth+2)/Math.SQRT2);
        add(roof,index%2?0xe78260:0x3d9f9b,x,y+h+2,z,angle);
      }
      local(0,.25,0,w+2,.5,depth+2,0xf8eacb);
      // A paved frontage separates each facade from the lawn.
      local(0,.10,depth/2+1.6,w+3,.15,3,0xf5e5bf);
      for(let f=0;f<floors;f++){
        for(let col=-1;col<=1;col++){
          local(col*w*.28,2+f*3.1,depth/2+.08,1.6,1.65,.16,0x365d67);
          local(col*w*.28,2+f*3.1,-depth/2-.08,1.6,1.65,.16,0x527781);
          local(w/2+.08,2+f*3.1,col*depth*.28,.16,1.65,1.6,0x527781);
          local(-w/2-.08,2+f*3.1,col*depth*.28,.16,1.65,1.6,0x365d67);
        }
        if(index%3===0&&f>0){local(0,1+f*3.1,depth/2+.8,w*.8,.25,1.7,0xefe7d6);local(0,1.5+f*3.1,depth/2+1.55,w*.8,.6,.12,0x91a9a5);}
      }
      if(index%2===0){local(0,3,depth/2+1,w,.25,2.3,index%4?0x2c9d9c:0xe57550);local(0,1.4,depth/2+.1,w*.65,2.4,.2,0x38616a);
        local(0,3.9,depth/2+.2,w*.72,.85,.25,0x286e78);
        for(let stripe=-2;stripe<=2;stripe++)local(stripe*w*.18,3.15,depth/2+1,w*.085,.1,2.3,0xfff3d4);}
      if(index%3===1){ /* pitched roofs stay clear */ }
      else if(index%4===0)local(0,h+1.1,0,w*.5,1.6,depth*.5,palette[(index+1)%5]!);
      else add(new THREE.CylinderGeometry(1,1,1.5,8),0x687c80,x,y+h+1,z);
    }
    // Seeded distribution gives parks and groves without shifting on every reload.
    let seed=7319;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<1800&&this.trees.length<460;i++){
      const x=bounds.minX+rand()*(bounds.maxX-bounds.minX),z=bounds.minZ+rand()*(bounds.maxZ-bounds.minZ),size=.75+rand()*.65;
      if(!clear(x,z,5)||this.trees.some(t=>Math.hypot(t.x-x,t.z-z)<9))continue;
      this.trees.push({x,z});const y=height(x,z);
      add(new THREE.CylinderGeometry(.4,.65,5*size,6),0x977450,x,y+2.5*size,z);
      for(let j=0;j<3;j++)add(new THREE.IcosahedronGeometry((4.8-j*.5)*size,2).scale(1,.78,1),[0x258568,0x64b955,0x9ad361][j]!,x+Math.sin(j*2)*size*2,y+(5+j*1.2)*size,z+Math.cos(j*2)*size*2);
      if(i%7===0){
        add(new THREE.CylinderGeometry(3,3,.2,12),0x86c562,x,y+.14,z);
        for(let f=0;f<5;f++)add(new THREE.IcosahedronGeometry(.45,0),f%2?0xffc759:0xed7c85,x+Math.sin(f*1.25)*2.5,y+.55,z+Math.cos(f*1.25)*2.5);
      }
      if(i%4===0)add(new THREE.IcosahedronGeometry(1.7,0).scale(1,.5,1),0x7cac57,x+5,y+.8,z);
    }
    // Compact terminal landmark; not a surveyed airport model.
    const [ax,az]=project(22.2496,91.8133),ay=height(ax,az);
    box(23,7,11,0xf1e3c7,ax,ay+3.5,az-17);box(25,.7,13,0x628a82,ax,ay+7.2,az-17);
    box(20,3,.3,0x487885,ax,ay+3,az-11.3);box(3,15,3,0xe4d6bb,ax+17,ay+7.5,az-17);box(6,3,6,0x467181,ax+17,ay+15,az-17);
    const geometry=mergeGeometries(parts);if(!geometry)throw new Error('Neighborhood geometry merge failed');
    const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.88}));mesh.castShadow=true;this.object.add(mesh);
    // Soft contact patches ground the scenery without a whole-map shadow buffer.
    const contacts:THREE.BufferGeometry[]=[];
    for(const item of [...this.buildings.map(b=>({...b,r:b.radius*.85})),...this.trees.map(t=>({...t,r:4}))]){
      for(let layer=0;layer<1;layer++){
        const g=new THREE.CircleGeometry(item.r*(1+layer*.18),16);g.rotateX(-Math.PI/2);g.translate(item.x,0,item.z);
        const pos=g.getAttribute('position');for(let i=0;i<pos.count;i++)pos.setY(i,height(pos.getX(i),pos.getZ(i))+.025+layer*.004);
        contacts.push(g);
      }
    }
    const shadows=new THREE.Mesh(mergeGeometries(contacts)!,new THREE.ShaderMaterial({transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;void main(){float a=(1.-smoothstep(.2,1.,length(vUv-.5)*2.))*.18;gl_FragColor=vec4(.12,.22,.18,a);}'}));
    shadows.name='Soft contact shadows';this.object.add(shadows);
    this.makePlane();this.object.add(this.plane);this.update(0);
  }
  private makePlane():void {
    const white=new THREE.MeshStandardMaterial({color:0xf4eee2,roughness:.45}),green=new THREE.MeshStandardMaterial({color:0x237668}),glass=new THREE.MeshStandardMaterial({color:0x254756});
    const part=(g:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number)=>{const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);this.plane.add(mesh);return mesh;};
    part(new THREE.SphereGeometry(1,16,10).scale(1.4,1.35,9),white,0,0,0);
    part(new THREE.BoxGeometry(21,.3,3.2),white,0,-.2,-1).rotation.y=.12;
    part(new THREE.BoxGeometry(8,.25,2),green,0,.5,-6.5);
    part(new THREE.BoxGeometry(.35,3.5,3),green,0,1.7,-6.2);
    part(new THREE.SphereGeometry(1,8,6).scale(1,.45,1.6),glass,0,.8,6.2);
    for(const x of [-4.5,4.5])part(new THREE.CylinderGeometry(.65,.7,2.5,10).rotateX(Math.PI/2),green,x,-1,-.3);
    for(const x of [-1.35,1.35])for(let z=-4;z<5;z+=1.3)part(new THREE.BoxGeometry(.08,.4,.5),glass,x,.35,z);
    this.plane.name='Decorative aircraft';this.plane.scale.setScalar(1.4);
  }
  update(delta:number):void {
    this.time+=delta;const b=localWorldBounds(),a=this.time*.035;
    this.plane.position.set((b.minX+b.maxX)/2+Math.sin(a)*430,95+Math.sin(a*2)*15,(b.minZ+b.maxZ)/2+Math.cos(a)*590);
    this.plane.rotation.set(0,Math.atan2(Math.cos(a)*430,-Math.sin(a)*590),-.13);
  }
}
