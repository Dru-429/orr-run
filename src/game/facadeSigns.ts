import {contains} from '../survey/geometry';
import type {Point} from '../survey/types';
export interface SignFace {x:number;z:number;nx:number;nz:number;length:number}
export function facadeSignFaces(ring:Point[],road:Point,approach:Point):SignFace[]{
 const faces:SignFace[]=[];
 for(let i=0;i<ring.length-1;i++){const a=ring[i],b=ring[i+1],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length<4)continue;const x=(a[0]+b[0])/2,z=(a[1]+b[1])/2;let nx=-dz/length,nz=dx/length;if(contains([x+nx*.05,z+nz*.05],ring)){nx=-nx;nz=-nz;}faces.push({x,z,nx,nz,length});}
 const score=(f:SignFace,p:Point)=>{const dx=p[0]-f.x,dz=p[1]-f.z,d=Math.hypot(dx,dz);return (f.nx*dx+f.nz*dz)/Math.max(d,.01)-d*.001;};
 const front=[...faces].sort((a,b)=>score(b,road)-score(a,road))[0];if(!front)return [];
 const side=faces.filter(f=>f!==front&&f.nx*front.nx+f.nz*front.nz<.8&&score(f,approach)>0).sort((a,b)=>score(b,approach)-score(a,approach))[0];return side?[front,side]:[front];
}
