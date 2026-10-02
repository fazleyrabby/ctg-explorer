import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {shopRows,rowToWorld,SHOP_FRONTAGE,type ShopRow} from '@/geography/ShopRowLayout';
import {solidBox} from '@/world/SolidFootprints';
import type {CollisionBox} from '@/world/Colliders';
import type {HeightProvider} from '@/geography/WorldHeight';

const GROUND_FLOOR=3.4;
const FLOOR=3;
// Coordinated walls with saturated colour kept to awnings, doors and signs
// (docs/building-direction.md).
const WALLS=[0xf6e7c6,0xe6a58f,0xeed489,0x7fc1b4,0xb6d3e6,0xcbbbe0];
const ROOFS=[0xc4623f,0x2f8f8a,0xf1e7d2];
const ACCENTS=[0xe2553f,0x1f8f9a,0xf2b63c,0xd8487a,0x3d7fd0];
const SHUTTERS=[0x35606c,0x7a4a38,0x4f5b66,0x2f6f5e];
const GLASS=[0x365d67,0x527781];
const TRIM=0xfff2d4;

/** Gable prism with its ridge along local X; origin at the eave centre. */
function gable(width:number,rise:number,depth:number):THREE.BufferGeometry {
  const w=width/2,d=depth/2;
  const a=[-w,0,d],b=[w,0,d],c=[w,0,-d],e=[-w,0,-d],r0=[-w,rise,0],r1=[w,rise,0];
  const tris=[a,b,r1, a,r1,r0, c,e,r0, c,r0,r1, e,a,r0, b,c,r1];
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(tris.flat(),3));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Old-town shop rows (docs/building-direction.md, step 1): short attached runs
 * of two- to four-storey shops with awnings, shutters, signs and rooftop tanks,
 * plus a few corner tea stalls. One merged vertex-coloured mesh for all rows.
 */
export class ShopRows {
  readonly solids:CollisionBox[]=[];
  readonly object=new THREE.Group();
  unitCount=0;
  stallCount=0;

  constructor(height:HeightProvider,rows:ShopRow[]=shopRows) {
    this.object.name='ShopRows';
    const parts:THREE.BufferGeometry[]=[];
    for(const row of rows){
      const y=height(row.x,row.z),front=row.depth/2;
      // Local placement: X along the row, Z toward the road.
      const add=(geo:THREE.BufferGeometry,color:number,lx:number,ly:number,lz:number,tilt=0)=>{
        if(tilt)geo.rotateX(tilt);
        geo.translate(lx,ly,lz).rotateY(row.yaw).translate(row.x,y,row.z);
        const c=new THREE.Color(color),count=geo.getAttribute('position').count,colors=new Float32Array(count*3);
        for(let i=0;i<count;i++){colors[i*3]=c.r;colors[i*3+1]=c.g;colors[i*3+2]=c.b;}
        geo.deleteAttribute('uv');
        geo.setAttribute('color',new THREE.BufferAttribute(colors,3));
        parts.push(geo.index?geo.toNonIndexed():geo);
      };
      const box=(w:number,h:number,d:number,color:number,lx:number,ly:number,lz:number,tilt=0)=>add(new THREE.BoxGeometry(w,h,d),color,lx,ly,lz,tilt);
      const solid=(lx:number,lz:number,w:number,d:number,h:number)=>{const [x,z]=rowToWorld(row,lx,lz);this.solids.push(solidBox(x,z,w,d,y,h,row.yaw));};

      // Paved frontage ties the run together and reads as a footpath.
      // It stops short of the kerb: overlapping the road ribbon at nearly the same height flickers.
      box(row.length+1.2,.14,SHOP_FRONTAGE-.6,0xeadcb9,0,.07,front+(SHOP_FRONTAGE-.6)/2);

      for(const unit of row.units){
        const v=unit.variant,w=unit.width,h=GROUND_FLOOR+(unit.floors-1)*FLOOR,x=unit.offset;
        const wall=WALLS[v%WALLS.length]!,accent=ACCENTS[(v*3+1)%ACCENTS.length]!;
        this.unitCount++;
        solid(x,0,w,row.depth,h);
        box(w,h,row.depth,wall,x,h/2,0);
        // Party-wall piers separate neighbours without leaving a gap. They stand
        // proud of the side wall; a face coplanar with it would z-fight.
        for(const edge of [-1,1])box(.3,h+.25,row.depth+.2,TRIM,x+edge*(w/2-.1),(h+.25)/2,0);

        // Ground floor: roller shutter or open bay, sign band and deep awning.
        const open=v%3!==0;
        box(w-1.3,2.5,.16,open?0x2c3f45:SHUTTERS[v%SHUTTERS.length]!,x,1.3,front+.06);
        if(open){box(w-1.9,.9,.7,0xc08a57,x,.5,front-.55);box(w-2.4,.45,.5,ACCENTS[(v+2)%ACCENTS.length]!,x,1.15,front-.55);}
        else for(let s=0;s<4;s++)box(w-1.3,.05,.3,TRIM,x,.55+s*.6,front+.08);
        box(w-.7,.6,.14,accent,x,GROUND_FLOOR-.38,front+.1);
        box(w*.5,.2,.3,TRIM,x,GROUND_FLOOR-.38,front+.13);
        box(w-.5,.1,2.3,accent,x,2.72,front+1.12,.22);
        for(let stripe=-1;stripe<=1;stripe++)box((w-.5)*.16,.26,2.34,TRIM,x+stripe*(w-.5)*.32,2.72,front+1.12,.22);

        // Upper floors: shuttered windows in front, plain openings behind.
        for(let f=1;f<unit.floors;f++){
          const wy=GROUND_FLOOR+(f-1)*FLOOR+1.55;
          for(const side of [-1,1]){
            const wx=x+side*w*.24;
            box(1.15,1.45,.14,GLASS[(v+f)%2]!,wx,wy,front+.06);
            box(1.45,.14,.3,TRIM,wx,wy-.82,front+.12);
            if(v%2===0)for(const leaf of [-1,1])box(.22,1.45,.1,SHUTTERS[(v+1)%SHUTTERS.length]!,wx+leaf*.7,wy,front+.09);
            box(1.05,1.25,.14,GLASS[(v+f+1)%2]!,wx,wy,-front-.06);
          }
          // A balcony stack is this unit's silhouette feature.
          if(v%4===1){box(w-1,.14,1.1,TRIM,x,wy-1.1,front+.55);box(w-1,.7,.08,0x8fa7a3,x,wy-.68,front+1.06);}
        }

        const roof=v%4;
        if(roof===0){
          add(gable(w+.3,1.9,row.depth+.9),ROOFS[v%2]!,x,h,0);
        } else if(roof===2){
          box(w+.3,.3,row.depth+.5,ROOFS[2]!,x,h+.15,0);
          box(w*.5,1.9,row.depth*.4,wall,x-w*.12,h+1.1,-row.depth*.18);
          box(w*.5+.4,.18,row.depth*.4+.4,ROOFS[1-v%2]!,x-w*.12,h+2.12,-row.depth*.18);
        } else {
          // Parapet roof with a water tank on a short stand.
          box(w,.7,.25,TRIM,x,h+.36,front-.12);box(w,.7,.25,TRIM,x,h+.36,-front+.12);
          box(1.5,.7,1.5,0x9aa3a8,x+w*.16,h+.35,-1.6);
          add(new THREE.CylinderGeometry(.75,.75,1.3,10),v%2?0x23282d:0x2b62a3,x+w*.16,h+1.35,-1.6);
          if(roof===3){add(new THREE.CylinderGeometry(.04,.04,2.6,5),0x6f7a80,x-w*.28,h+1.3,1.2);box(.9,.05,.05,0x6f7a80,x-w*.28,h+2.3,1.2);}
        }
      }

      if(row.stall){
        // Corner tea stall with a tin roof and a shaded bench.
        const sx=row.length/2+2.9,sz=front-1.4;
        this.stallCount++;
        solid(sx,sz,2.6,2.4,2.3);
        box(2.6,2.3,2.4,0x3f8f86,sx,1.15,sz);
        box(2.1,.9,.12,0x26343a,sx,1.55,sz+1.22);
        box(2.5,.12,.6,0xc08a57,sx,1.05,sz+1.45);
        box(3.2,.1,3.6,0xb7c0c4,sx,2.55,sz+.5,.16);
        for(const post of [-1.4,1.4])add(new THREE.CylinderGeometry(.05,.05,2.2,5),0x6f7a80,sx+post,1.1,sz+2.1);
        box(2.2,.1,.45,0xa9744a,sx,.5,sz+2.9);
        for(const leg of [-.9,.9])box(.1,.45,.4,0x7d5636,sx+leg,.23,sz+2.9);
        add(new THREE.CylinderGeometry(.22,.26,.42,8),0xd9d2c0,sx-.6,1.32,sz+1.45);
        add(new THREE.CylinderGeometry(.12,.1,.3,8),ACCENTS[this.stallCount%ACCENTS.length]!,sx+.5,1.26,sz+1.45);
      }
    }
    const merged=parts.length?mergeGeometries(parts):null;
    if(merged){
      const mesh=new THREE.Mesh(merged,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.86}));
      mesh.castShadow=true;mesh.receiveShadow=true;
      this.object.add(mesh);
    }
  }
}
