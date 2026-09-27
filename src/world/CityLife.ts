import {inPortDistrict} from '@/geography/PortLayout';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CITY_STOPS,coastX,project,shoreDistance,segmentDistance} from '@/geography/CityGeography';
import type {HeightProvider} from '@/geography/WorldHeight';
import type {RoadData} from '@/world/Roads';
import type {NamedBuilding} from '@/world/Buildings';
import {buildPaths,samplePath} from '@/world/RoadPath';
import {buildRoadGeometry} from '@/world/Roads';

export class CityLife {
 readonly object=new THREE.Group();readonly named:NamedBuilding[]=[];

 constructor(roads:RoadData[],height:HeightProvider){
  this.object.name='CityLife';const staticParts:THREE.BufferGeometry[]=[];
  const add=(geo:THREE.BufferGeometry,color:number,x:number,y:number,z:number,angle=0)=>{
    geo.rotateY(angle).translate(x,y,z);const c=new THREE.Color(color),colors=[];for(let i=0;i<geo.getAttribute('position').count;i++)colors.push(c.r,c.g,c.b);geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));staticParts.push(geo);
  };
  const box=(w:number,h:number,d:number,color:number,x:number,y:number,z:number,angle=0)=>add(new THREE.BoxGeometry(w,h,d),color,x,y,z,angle);
  const palm=(x:number,z:number,size=1)=>{
    const y=height(x,z);add(new THREE.CylinderGeometry(.32*size,.55*size,8*size,7),0xc29454,x,y+4*size,z);
    for(let k=0;k<7;k++){const angle=k*Math.PI*2/7;const leaf=new THREE.SphereGeometry(1,6,4).scale(1.1*size,.3*size,4*size).rotateX(-.25).translate(0,0,2*size);add(leaf,k%2?0x25ae62:0x68d647,x,y+8*size,z,angle);}
  };
  const shop=(x:number,z:number,angle:number,index:number)=>{
    const y=height(x,z),palette=[0xff915c,0x48c6ba,0xffd65c,0xf58cac];
    box(8,6,6,palette[index%4]!,x,y+3,z,angle);box(8.8,.5,7,0xfaf3d1,x,y+6.2,z,angle);
    const nx=Math.sin(angle),nz=Math.cos(angle);
    box(5.5,2.8,.25,0x185c73,x+nx*3.1,y+2.3,z+nz*3.1,angle);
    for(let j=-3;j<=3;j++)box(.95,.2,2,index%2?0xff675b:0x168aa0,x+Math.cos(angle)*j+nx*3.8,y+4.4,z-Math.sin(angle)*j+nz*3.8,angle);
    box(5,.35,1,0xcb8250,x+nx*5,y+.7,z+nz*5,angle);
  };
  const paths=buildPaths(roads,50);
  paths.forEach((path,index)=>{
    for(let d=18;d<path.total;d+=38){const p=samplePath(path,d),side=Math.floor(d/38)%2?1:-1,off=path.width/2+10;
      const x=p.x+Math.cos(p.yaw)*off*side,z=p.z-Math.sin(p.yaw)*off*side;
      if(shoreDistance(x,z)<12||inPortDistrict(x,z,8))continue;
      if(index%3===0&&d%114<40)shop(x,z,p.yaw+(side>0?-Math.PI/2:Math.PI/2),index);else palm(x,z,.7+(index%3)*.15);
    }
  });
  for(const place of CITY_STOPS){const [x,z]=project(place.latitude,place.longitude);this.named.push({...place,x,z});}
  const [px,pz]=project(22.23444,91.79226);
  for(let i=-5;i<=5;i++){
    const z=pz+i*22,x=coastX(z)+25;if(i%2===0)shop(x+13,z,-Math.PI/2,i+6);palm(x+25,z+8,1.1);
    const y=height(x,z);add(new THREE.CylinderGeometry(.12,.12,3,6),0xc8874e,x,y+1.5,z);
    const canopy=new THREE.ConeGeometry(3,1.3,12);add(canopy,i%2?0xff6571:0xffd33d,x,y+3,z);
    box(2,.25,1,0xffffff,x,y+.8,z);box(3,.35,1.5,0xe7b579,x+4,y+.45,z);
  }
  // Breakwater stones and a shoreline promenade frame the water.
  for(let i=-30;i<=30;i++){const z=pz+i*5,x=coastX(z)+3;add(new THREE.DodecahedronGeometry(1.6+(i%3)*.15),0xaebfc1,x,height(x,z)+.4,z,i);}
  const promenade:RoadData={id:'beach-promenade',name:'Patenga promenade',type:'footway',width:7,bridge:false,tunnel:false,points:Array.from({length:50},(_,i)=>{const z=pz-140+i*6;return [coastX(z)+12,z];})};
  const walk=new THREE.Mesh(buildRoadGeometry([promenade],height,0,.15),new THREE.MeshStandardMaterial({color:0xffe5a0,roughness:.8}));this.object.add(walk);
  // A small, colorful Bahaddarhat market cluster, clear of the elevated deck.
  const [bx,bz]=project(22.36848,91.84375);for(let i=0;i<7;i++)shop(bx+25+(i%3)*14,bz-24+Math.floor(i/3)*20,Math.PI/2,i);
  // Sparse planted groves, only on land and away from street geometry.
  for(let i=0;i<100;i++){
    const x=px+60+(i*131%700),z=pz+80+(i*197%1000);
    if(shoreDistance(x,z)<25||inPortDistrict(x,z,8))continue;
    const nearRoad=roads.some(r=>r.points.slice(1).some((b,j)=>segmentDistance(x,z,r.points[j]!,b)<18));
    if(!nearRoad)palm(x,z,.8);
  }
  const merged=mergeGeometries(staticParts.map(g=>g.index?g.toNonIndexed():g));if(merged){const mesh=new THREE.Mesh(merged,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85}));mesh.castShadow=true;this.object.add(mesh);}
 }

}
