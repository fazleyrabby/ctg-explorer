import { geoToLocal, localWorldBounds } from '@/geography/Projection';
export type MapPoint = [number, number];
export function project(latitude:number,longitude:number):MapPoint {const p=geoToLocal({latitude,longitude});return [p.x,p.z];}
export const CITY_STOPS = [
  {id:'airport',name:'Shah Amanat International Airport',latitude:22.2496,longitude:91.8133,type:'airport',height:14,description:'A compact airport marker and access road. Nearby aircraft are decorative, not live flight traffic.'},
  {id:'patenga',name:'Patenga Sea Beach',latitude:22.23444,longitude:91.79226,type:'beach',height:8,wikipedia:'en:Patenga',description:'The Bay of Bengal waterfront at Patenga. The shoreline, surf and promenade are a stylized miniature.'},
  {id:'bahaddarhat',name:'Bahaddarhat',latitude:22.36848,longitude:91.84375,type:'market',height:12,wikipedia:'en:Bahaddarhat',description:'A busy eastern gateway to Chattogram, represented with market stalls, buses and its elevated road.'},
  {id:'shah-amanat',name:'Shah Amanat Bridge · Notun Bridge',latitude:22.32526,longitude:91.85283,type:'bridge',height:24,wikipedia:'en:Shah_Amanat_Bridge',description:'The distinctive extradosed bridge across the Karnaphuli. Its miniature alignment follows mapped OpenStreetMap bridge ways; scale and tower details are simplified.'},
  {id:'lalkhan',name:'Lalkhan Bazar · Expressway',latitude:22.3484154,longitude:91.8203622,type:'flyover',height:16,description:'The northern end of the Patenga elevated expressway, beside the connection toward the Akhtaruzzaman flyover. Road geometry is based on OpenStreetMap.'},
  {id:'muradpur',name:'Muradpur · Akhtaruzzaman Flyover',latitude:22.3690,longitude:91.8326,type:'flyover',height:16,wikipedia:'en:Muradpur_Flyover',description:'The Muradpur–Lalkhan Bazar flyover corridor. This model includes elevated decks, piers, rails and moving traffic.'},
];
// Generalized coast and river bank layout; geographic anchors, not a coastal survey.
const coast:MapPoint[]=[[22.221,91.794],[22.23444,91.79226],[22.25,91.782],[22.28,91.767],[22.315,91.760],[22.345,91.752],[22.387,91.748]].map(p=>project(p[0]!,p[1]!));
export function coastX(z:number):number {
  for(let i=1;i<coast.length;i++){const a=coast[i-1]!,b=coast[i]!;if(z<=b[1]){const t=Math.max(0,Math.min(1,(z-a[1])/(b[1]-a[1])));return a[0]+(b[0]-a[0])*t;}}
  return coast.at(-1)![0];
}
const riverAnchors:MapPoint[]=[[22.224,91.801],[22.241,91.816],[22.267,91.831],[22.29,91.837],[22.312,91.834],[22.32526,91.85283],[22.331,91.870],[22.345,91.876]].map(p=>project(p[0]!,p[1]!));
// Round the miniature's corners while retaining the mapped bridge anchor.
export const RIVER:MapPoint[]=[];
for(let i=0;i<riverAnchors.length;i++){
  const p=riverAnchors[i]!;
  if(i===0||i===riverAnchors.length-1||i===5){RIVER.push(p);continue;}
  const a=riverAnchors[i-1]!,b=riverAnchors[i+1]!;
  const enter:MapPoint=[p[0]+(a[0]-p[0])*.12,p[1]+(a[1]-p[1])*.12];
  const leave:MapPoint=[p[0]+(b[0]-p[0])*.12,p[1]+(b[1]-p[1])*.12];
  for(let j=0;j<=8;j++){const t=j/8,u=1-t;RIVER.push([u*u*enter[0]+2*u*t*p[0]+t*t*leave[0],u*u*enter[1]+2*u*t*p[1]+t*t*leave[1]]);}
}
export function segmentDistance(x:number,z:number,a:MapPoint,b:MapPoint):number {
  const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));
  return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);
}
/** Rounded miniature boundary; physical terrain and all scenery share this shore. */
export function islandDistance(x:number,z:number):number {
  const b=localWorldBounds(),cx=(b.minX+b.maxX)/2,cz=(b.minZ+b.maxZ)/2;
  const radius=360;
  const qx=Math.abs(x-cx)-((b.maxX-b.minX)/2-radius-12);
  const qz=Math.abs(z-cz)-((b.maxZ-b.minZ)/2-radius-12);
  const rounded=-(Math.hypot(Math.max(qx,0),Math.max(qz,0))+Math.min(Math.max(qx,qz),0)-radius);
  // Small coves soften long edges without bending any interior streets.
  const coves=9+5*Math.sin(z*.012+x*.003)+4*Math.sin(x*.019-z*.005);
  return rounded-coves;
}
/** Positive on land, negative in water. */
export function shoreDistance(x:number,z:number):number {
  const river=Math.min(...RIVER.slice(1).map((b,i)=>segmentDistance(x,z,RIVER[i]!,b)))-13;
  return Math.min(x-coastX(z),river,islandDistance(x,z));
}
