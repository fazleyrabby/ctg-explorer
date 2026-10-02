import {geoToLocal,localWorldBounds} from './Projection';
import {segmentDistance,shoreDistance} from './CityGeography';
import {inRailway} from './RailwayLayout';
import {inLaldighi} from './PondLayout';
import {inPortDistrict} from './PortLayout';
import {inAirportDistrict} from '@/world/Airport';
import {DISTRICT_PLACES} from '@/world/DistrictLandmarks';
import {PROMINENT_PLACES,prominentSite} from '@/world/ProminentPlaces';
import {buildPaths,samplePath} from '@/world/RoadPath';
import type {RoadData} from '@/world/Roads';
import type {BuildingData} from '@/world/Buildings';

export interface ShopUnit {
  /** Centre of the unit along the row, in row-local units. */
  offset: number;
  width: number;
  floors: number;
  /** Stable index driving palette, roof and frontage variation. */
  variant: number;
}
export interface ShopRow {
  district: string;
  x: number; z: number;
  /** Row-local +Z faces the road; +X runs along it. */
  yaw: number;
  length: number;
  depth: number;
  /** A tea stall occupies the gap beyond the row's +X end. */
  stall: boolean;
  units: ShopUnit[];
}

export const SHOP_DEPTH=9;
/** Paved frontage between the facade and the road edge; awnings overhang it. */
export const SHOP_FRONTAGE=3.4;
const STALL_SPACE=5.5;
const ROWS_PER_DISTRICT=8;
const REACH=175;

// Old-town trading quarters named in docs/building-direction.md.
const DISTRICTS=[
  {id:'chawkbazar',latitude:22.34657,longitude:91.83835},
  {id:'anderkilla',latitude:22.34045,longitude:91.83655},
  {id:'khatunganj',latitude:22.3357,longitude:91.83184},
];

export const shopRows:ShopRow[]=[];

export function rowToWorld(row:{x:number;z:number;yaw:number},lx:number,lz:number):[number,number] {
  return [row.x+Math.cos(row.yaw)*lx+Math.sin(row.yaw)*lz,row.z-Math.sin(row.yaw)*lx+Math.cos(row.yaw)*lz];
}

/** Row-local extents of the reserved parcel: buildings, frontage and any stall. */
function parcel(row:ShopRow):{minX:number;maxX:number;minZ:number;maxZ:number} {
  return {minX:-row.length/2,maxX:row.length/2+(row.stall?STALL_SPACE:0),minZ:-row.depth/2,maxZ:row.depth/2+SHOP_FRONTAGE};
}

export function inShopRows(x:number,z:number,padding=0):boolean {
  for(const row of shopRows){
    const dx=x-row.x,dz=z-row.z;
    const lx=Math.cos(row.yaw)*dx-Math.sin(row.yaw)*dz,lz=Math.sin(row.yaw)*dx+Math.cos(row.yaw)*dz;
    const p=parcel(row);
    if(lx>p.minX-padding&&lx<p.maxX+padding&&lz>p.minZ-padding&&lz<p.maxZ+padding)return true;
  }
  return false;
}

/**
 * Reserve attached shop-row parcels beside old-town roads before any infill is
 * generated (ADR-0025 pattern). Rows face the road across a paved frontage and
 * leave walkable gaps between runs.
 */
export function planShopRows(roads:RoadData[],elevated:RoadData[],buildings:BuildingData[]):void {
  shopRows.length=0;
  const bounds=localWorldBounds();
  const occupied=buildings.map(b=>{const xs=b.ring.map(p=>p[0]),zs=b.ring.map(p=>p[1]);return {minX:Math.min(...xs)-2.5,maxX:Math.max(...xs)+2.5,minZ:Math.min(...zs)-2.5,maxZ:Math.max(...zs)+2.5};});
  const keepClear=[
    ...DISTRICT_PLACES.map(p=>({...geoToLocal(p),radius:p.type==='park'?52:36})),
    ...PROMINENT_PLACES.map(p=>({...prominentSite(p,roads),radius:p.type==='park'?80:56})),
  ];
  const pointClear=(x:number,z:number,facade:boolean):boolean=>{
    if(x<bounds.minX+14||x>bounds.maxX-14||z<bounds.minZ+14||z>bounds.maxZ-14)return false;
    if(shoreDistance(x,z)<9||inRailway(x,z,4)||inLaldighi(x,z,4)||inPortDistrict(x,z,4)||inAirportDistrict(x,z,4))return false;
    if(keepClear.some(a=>Math.hypot(x-a.x,z-a.z)<a.radius))return false;
    if(occupied.some(b=>x>b.minX&&x<b.maxX&&z>b.minZ&&z<b.maxZ))return false;
    // Facades stay off every carriageway; the paved frontage may touch its own road.
    const margin=facade?1.6:-.4;
    for(const road of roads)for(let i=1;i<road.points.length;i++)if(segmentDistance(x,z,road.points[i-1]!,road.points[i]!)<road.width/2+margin)return false;
    for(const road of elevated)for(let i=1;i<road.points.length;i++)if(segmentDistance(x,z,road.points[i-1]!,road.points[i]!)<road.width/2+7)return false;
    return !inShopRows(x,z,4.5);
  };
  const rowClear=(row:ShopRow):boolean=>{
    const p=parcel(row);
    const stepX=(p.maxX-p.minX)/Math.ceil((p.maxX-p.minX)/3);
    for(let lx=p.minX;lx<=p.maxX+.01;lx+=stepX)for(let lz=p.minZ;lz<=p.maxZ+.01;lz+=2.5){
      const [x,z]=rowToWorld(row,lx,lz);
      if(!pointClear(x,z,lz<=row.depth/2+.01))return false;
    }
    return true;
  };
  // Only ordinary streets carry shop fronts; the wide corridors stay open.
  const paths=buildPaths(roads.filter(r=>r.width<10),40);
  let variant=0;
  DISTRICTS.forEach((district,districtIndex)=>{
    const anchor=geoToLocal(district);
    let placed=0;
    const candidates:Array<{pathIndex:number;d:number;side:number;distance:number}>=[];
    paths.forEach((path,pathIndex)=>{
      for(let d=16;d<path.total-16;d+=4){
        const p=samplePath(path,d),distance=Math.hypot(p.x-anchor.x,p.z-anchor.z);
        if(distance<REACH)for(const side of [-1,1])candidates.push({pathIndex,d,side,distance});
      }
    });
    candidates.sort((a,b)=>a.distance-b.distance);
    for(const c of candidates){
      if(placed>=ROWS_PER_DISTRICT)break;
      const path=paths[c.pathIndex]!;
      const count=3+(variant+districtIndex)%3;
      const units:ShopUnit[]=[];
      let length=0;
      for(let i=0;i<count;i++){const width=5.4+((variant*7+i*5)%5)*.65;units.push({offset:length+width/2,width,floors:2+((variant*3+i*2)%3),variant:variant*5+i});length+=width;}
      for(const unit of units)unit.offset-=length/2;
      if(c.d-length/2<6||c.d+length/2>path.total-6)continue;
      // Orient along the chord so a gentle bend never swings a corner into the street.
      const a=samplePath(path,c.d-length/2),b=samplePath(path,c.d+length/2),mid=samplePath(path,c.d);
      const chord=Math.atan2(b.x-a.x,b.z-a.z);
      if(Math.abs(Math.atan2(Math.sin(mid.yaw-chord),Math.cos(mid.yaw-chord)))>.22)continue;
      const off=path.width/2+SHOP_FRONTAGE+SHOP_DEPTH/2;
      const row:ShopRow={
        district:district.id,
        x:(a.x+b.x)/2+Math.cos(chord)*off*c.side,
        z:(a.z+b.z)/2-Math.sin(chord)*off*c.side,
        yaw:chord+(c.side>0?-Math.PI/2:Math.PI/2),
        length,depth:SHOP_DEPTH,stall:variant%2===0,units,
      };
      if(!rowClear(row)){
        // The stall is optional; drop it before giving up the parcel.
        if(!row.stall)continue;
        row.stall=false;
        if(!rowClear(row))continue;
      }
      shopRows.push(row);placed++;variant++;
    }
  });
}
