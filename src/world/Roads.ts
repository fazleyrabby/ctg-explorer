import * as THREE from 'three';
import type { HeightProvider } from '@/geography/WorldHeight';

export interface RoadData {
  id: string; type: string; name?: string; bridge: boolean; tunnel: boolean;
  width: number; points: Array<[number,number]>;
}
interface Buffers {positions:number[];indices:number[]}

/** Independent short quads and round joins cannot fold over at acute corners. */
export function buildRoadGeometry(roads:RoadData[],height:HeightProvider,padding=0,lift=.12):THREE.BufferGeometry {
  const b:Buffers={positions:[],indices:[]};
  const vertex=(x:number,z:number)=>{const i=b.positions.length/3;b.positions.push(x,height(x,z)+lift,z);return i;};
  for(const road of roads) {
    const half=road.width/2+padding;
    if(half<=0)continue;
    for(let i=1;i<road.points.length;i++) {
      const a=road.points[i-1]!,c=road.points[i]!;
      const dx=c[0]-a[0],dz=c[1]-a[1],length=Math.hypot(dx,dz);
      if(length<.001)continue;
      const nx=-dz/length*half,nz=dx/length*half,steps=Math.ceil(length/2);
      for(let j=0;j<steps;j++) {
        const x=a[0]+dx*j/steps,z=a[1]+dz*j/steps;
        const ex=a[0]+dx*(j+1)/steps,ez=a[1]+dz*(j+1)/steps;
        const v=vertex(x+nx,z+nz);vertex(x-nx,z-nz);vertex(ex+nx,ez+nz);vertex(ex-nx,ez-nz);
        b.indices.push(v,v+2,v+1,v+1,v+2,v+3);
      }
    }
    // Round joins include the closing vertex of roundabouts and dead-end caps.
    for(const [x,z] of road.points) {
      const center=vertex(x,z),segments=16;
      for(let i=0;i<=segments;i++){const angle=i/segments*Math.PI*2;vertex(x+Math.cos(angle)*half,z+Math.sin(angle)*half);}
      for(let i=0;i<segments;i++)b.indices.push(center,center+i+2,center+i+1);
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(b.positions,3));g.setIndex(b.indices);g.computeVertexNormals();return g;
}
export class Roads {
  private constructor(readonly object:THREE.Group,readonly roads:RoadData[]){}
  static async load(height:HeightProvider):Promise<Roads> {
    const response=await fetch('/world/chattogram/compact/roads.json');
    if(!response.ok)throw new Error(`Failed to load district roads: ${response.status}`);
    const {roads}=await response.json() as {roads:RoadData[]};
    const group=new THREE.Group();group.name='Roads';
    const add=(geometry:THREE.BufferGeometry,color:number,name:string,order:number)=>{
      const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:.95,polygonOffset:true,polygonOffsetFactor:-order,polygonOffsetUnits:-order}));
      mesh.name=name;mesh.receiveShadow=true;mesh.renderOrder=order;group.add(mesh);
    };
    add(buildRoadGeometry(roads,height,3.2,.08),0xf5e9ca,'RoadShoulders',1);
    add(buildRoadGeometry(roads,height),0x435666,'RoadAsphalt',2);
    const lines=roads.filter(r=>r.width>=4.5&&!r.name?.includes('Circle')).map(r=>({...r,width:.16}));
    add(buildRoadGeometry(lines,height,0,.16),0xfff3ce,'RoadMarkings',3);
    return new Roads(group,roads);
  }
}
