import * as THREE from 'three';
import { shoreDistance } from '@/geography/CityGeography';
import { localWorldBounds } from '@/geography/Projection';
import type { HeightProvider } from '@/geography/WorldHeight';

/** A small, finely tessellated district; the same height function drives physics. */
export class Terrain {
  readonly object: THREE.Group;
  constructor(getHeight: HeightProvider) {
    const b=localWorldBounds(), width=b.maxX-b.minX, depth=b.maxZ-b.minZ;
    const geometry=new THREE.PlaneGeometry(width,depth,Math.ceil(width/5),Math.ceil(depth/5));
    geometry.rotateX(-Math.PI/2);
    geometry.translate((b.minX+b.maxX)/2,0,(b.minZ+b.maxZ)/2);
    const pos=geometry.getAttribute('position');
    const colors=[];
    const low=new THREE.Color(0xb9e77f),high=new THREE.Color(0x74c781);
    for(let i=0;i<pos.count;i++) {
      const y=getHeight(pos.getX(i),pos.getZ(i));pos.setY(i,y);
      const color=low.clone().lerp(high,Math.min(1,(y-2)/8)); if(shoreDistance(pos.getX(i),pos.getZ(i))<14)color.setHex(0xffd788);
      colors.push(color.r,color.g,color.b);
    }
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
    const top=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));
    // Broad ground does not receive shadow-map acne at overview distances.
    top.receiveShadow=false;
    this.object=new THREE.Group();this.object.name='Terrain';this.object.add(top);
    // The shared shoreline slopes below the sea; no rectangular box skirt.
  }
}
