import {buildings,landscape,transport} from '../survey/records';
import {contains} from '../survey/geometry';
import {pose,ROUTE_LENGTH} from './route';
import {crossSectionAt} from '../survey/corridor';
import {junctionRecords} from './junctions';
import type {Point} from '../survey/types';
const water=landscape.filter(f=>f.kind==='water'&&f.geometry.type==='polygon');
function inside(p:Point,f:{geometry:{coordinates:Point[];polygons?:Point[][];holes?:Point[][]}}){return (f.geometry.polygons??[f.geometry.coordinates]).some(r=>contains(p,r))&&!(f.geometry.holes??[]).some(r=>contains(p,r));}
const roads=transport.filter(f=>f.kind==='road'||f.kind==='bridge');
function distance(p:Point,a:Point,b:Point){const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz);}
// Decorative ground-level life, deliberately separate from surveyed features.
export const roadsideProps=Array.from({length:Math.ceil(ROUTE_LENGTH/11)},(_,i)=>i*11+8).flatMap(s=>{
 if(s>ROUTE_LENGTH||junctionRecords.some(j=>Math.abs(j.centre-s)<45))return [];
 const c=crossSectionAt(s),nearBuildings=buildings.filter(b=>s>b.from-15&&s<b.to+15),nearRoads=roads.filter(r=>s>r.from-20&&s<r.to+20);
 return [-1,1].flatMap(side=>{
  const kind=Math.round(s/11)%3===0?'people':'tree';
  const edge=side<0?Math.min(c.left,c.serviceLeftActive?c.serviceLeft[0]:c.left):Math.max(c.oppositeRight,c.serviceRightActive?c.serviceRight[1]:c.oppositeRight);
  const d=edge+side*(kind==='tree'?5:2.2),p=pose(s,d),point:Point=[p.x,p.z],radius=kind==='tree'?2.8:1;
  const samples:Point[]=[point,[p.x-radius,p.z],[p.x+radius,p.z],[p.x,p.z-radius],[p.x,p.z+radius]];
  if(samples.some(p=>nearBuildings.some(b=>inside(p,b))||water.some(f=>inside(p,f))))return [];
  if(nearRoads.some(r=>r.geometry.coordinates.slice(1).some((b,i)=>distance(point,r.geometry.coordinates[i],b)<radius+Number(r.attributes.sceneryWidth?.value??7)/2)))return [];
  return [{s,d,x:p.x,z:p.z,yaw:p.yaw,kind,seed:Math.round(s)*3+(side+1)}];
 });
});
