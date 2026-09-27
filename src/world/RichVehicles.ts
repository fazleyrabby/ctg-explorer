import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
export type TrafficKind='car'|'cng'|'rickshaw'|'bus';
/** Contrasting paint, tyres, windows, trim and turning wheels; shared by traffic. */
export function richVehicle(kind:TrafficKind,paint:number):THREE.Group {
  const g=new THREE.Group();
  const mat=(color:number)=>new THREE.MeshStandardMaterial({color,roughness:.55});
  const body=mat(paint),glass=mat(0x184e70),rubber=mat(0x202d3b),chrome=mat(0xe3edf1),cream=mat(0xffedb8);
  const box=(w:number,h:number,d:number,m:THREE.Material,x=0,y=0,z=0)=>{const q=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);q.position.set(x,y,z);q.castShadow=true;g.add(q);return q;};
  const bus=kind==='bus',car=kind==='car',rickshaw=kind==='rickshaw';
  const width=bus?2.3:car?1.85:1.5,length=bus?6.5:car?4:2.6;
  box(width,.6,length,body,0,.72);
  if(car||bus){
    box(width*.88,bus?1.4:.7,length*.65,glass,0,bus?1.7:1.3,-.1);
    box(width*.94,.16,length*.68,body,0,bus?2.5:1.75,-.1);
    for(const side of [-1,1]){
      box(.12,.75,length*.65,body,side*width*.46,1.3,-.1);
      if(bus)for(let z=-2;z<=2;z+=.7)box(.08,.95,.09,cream,side*width*.46,1.8,z);
      box(.18,.18,.35,body,side*(width/2+.1),1.35,.7);
    }
  }else{
    box(width*.95,.18,1.7,rickshaw?mat(0xf74486):rubber,0,1.9,-.3);
    box(width*.8,.45,.6,rickshaw?mat(0x32bfe0):cream,0,1,-.65);
    for(const side of [-1,1])box(.09,1,.09,chrome,side*.64,1.4,-.8);
    box(.8,.55,.15,glass,0,1.35,.95);
    if(rickshaw){box(width,.5,.12,mat(0xffd345),0,1.2,-1.15);for(let i=-2;i<=2;i++)box(.13,.3,.14,mat(i%2?0x2cd7a1:0xff6174),i*.22,1.2,-1.24);}
  }
  for(const side of [-1,1]){
    box(.28,.15,.1,mat(0xfff1a1),side*width*.32,.82,length/2+.05);
    box(.22,.14,.1,mat(0xff485d),side*width*.32,.82,-length/2-.05);
  }
  const axles=car||bus?[-length*.32,length*.32]:[-length*.31];
  const wheelPositions:Array<[number,number]>=axles.flatMap(z=>[[-width*.49,z],[width*.49,z]] as Array<[number,number]>);
  if(!car&&!bus)wheelPositions.push([0,length*.39]);
  for(const [x,z] of wheelPositions){const w=new THREE.Group();w.position.set(x,.37,z);w.userData.wheel=true;
    const tyre=new THREE.Mesh(new THREE.CylinderGeometry(.37,.37,.2,12),rubber);tyre.rotation.z=Math.PI/2;w.add(tyre);
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,.23,10),chrome);hub.rotation.z=Math.PI/2;w.add(hub);
    const spoke=new THREE.Mesh(new THREE.BoxGeometry(.25,.06,.56),chrome);w.add(spoke);g.add(w);
  }
  // Bake material colors into vertices: one draw for the body, one per wheel.
  const mergeParts=(parts:THREE.Mesh[])=>{
    const geos=parts.map(p=>{p.updateMatrix();const geo=p.geometry.clone().applyMatrix4(p.matrix);const color=(p.material as THREE.MeshStandardMaterial).color;const colors=[];for(let i=0;i<geo.getAttribute('position').count;i++)colors.push(color.r,color.g,color.b);geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));return geo;});
    const mesh=new THREE.Mesh(mergeGeometries(geos)!,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.65}));mesh.castShadow=true;return mesh;
  };
  const bodyParts=g.children.filter(p=>p instanceof THREE.Mesh) as THREE.Mesh[];
  g.add(mergeParts(bodyParts));bodyParts.forEach(p=>g.remove(p));
  for(const w of g.children.filter(p=>p.userData.wheel)){
    const parts=[...w.children] as THREE.Mesh[];w.add(mergeParts(parts));parts.forEach(p=>w.remove(p));
  }
  return g;
}
