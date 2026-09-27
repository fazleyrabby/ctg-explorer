import type {CollisionBox} from './Colliders';
/** Conservative bounds for authored solid volumes; paths and low platforms are excluded. */
export function solidBox(x:number,z:number,w:number,d:number,bottom:number,height:number,yaw=0):CollisionBox {
 const halfX=(Math.abs(Math.cos(yaw))*w+Math.abs(Math.sin(yaw))*d)/2;
 const halfZ=(Math.abs(Math.sin(yaw))*w+Math.abs(Math.cos(yaw))*d)/2;
 return {minX:x-halfX,maxX:x+halfX,minZ:z-halfZ,maxZ:z+halfZ,bottom,top:bottom+height};
}
