import {map,pose,nearestStation} from './route';
import {crossSectionAt,supportOffset} from '../survey/corridor';
import {contains} from '../survey/geometry';
import {junctionRecords} from './junctions';
import placements from '../data/hoardings.json';
export interface HoardingPlacement {id:string;poster:number;station:number;side:'left'|'right';offset:number;x:number;z:number;bottom:number;yaw:number;width:number;height:number}
export const hoardings=placements as HoardingPlacement[];
type P=[number,number];
const segmentDistance=(p:P,a:P,b:P)=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dz*t);};
const inRing=(p:P,r:number[][],margin=0)=>contains(p,r as P[])||r.some((a,i)=>i>0&&segmentDistance(p,r[i-1] as P,a as P)<margin);
/** Test the rendered road envelope and scenery, not unrendered/raw road centrelines.
 * These are game-added verge props; survey geometry is left unchanged. */
export function clearHoardingPoint(p:P,margin=1,height=0){
 const n=nearestStation(...p),c=crossSectionAt(n.s);
 if(n.offset>c.left-margin&&n.offset<c.oppositeRight+margin)return false;
 for(const [active,range] of [[c.serviceLeftActive,c.serviceLeft],[c.serviceRightActive,c.serviceRight]] as const)if(active&&n.offset>range[0]-margin&&n.offset<range[1]+margin)return false;
 if(junctionRecords.some(j=>Math.abs(j.centre-n.s)<j.halfConflict+14&&Math.abs(n.offset)<70))return false;
 if(map.buildings.some(b=>b.height+2>height&&Math.abs(b.station-n.s)<180&&b.polygons.some(r=>inRing(p,r,margin))))return false;
 if(height<=0&&map.landscape.some(f=>f.kind==='water'&&(f.polygons.length?f.polygons:[f.points]).some(r=>inRing(p,r,margin))))return false;
 return !map.supports.some(s=>{const q=pose(s.station,supportOffset(s.station,s.offset));return Math.hypot(p[0]-q.x,p[1]-q.z)<2+margin;});
}
export function selectHoarding(index:number):HoardingPlacement{
 const station=400+800*index,c=crossSectionAt(station),target=pose(station-120,c.laneCentres[0]);
 const options:{record:HoardingPlacement;score:number}[]=[];
 // Keep the full 12 m panel off the carriageway, with its nearest edge outside
 // the verge. Never switch to the opposite side or search far-away plots.
 for(let distance=6.75;distance<=18;distance+=.25){
  const offset=c.left-distance,p=pose(station,offset),yaw=Math.atan2(target.x-p.x,target.z-p.z),base=Math.max(6,p.y+3);
  if(!clearHoardingPoint([p.x,p.z],1.2))continue;
  for(const bottom of [base,base+3,base+6]){
   if(![-6.3,-3,0,3,6.3].every(t=>clearHoardingPoint([p.x+Math.cos(yaw)*t,p.z-Math.sin(yaw)*t],.3,bottom)))continue;
   let occlusion=0;
   for(let i=1;i<16;i++){const t=i/16,q:P=[target.x+(p.x-target.x)*t,target.z+(p.z-target.z)*t],h=target.y+1.5+(bottom+4.5-target.y-1.5)*t;if(map.buildings.some(b=>b.height>h&&Math.abs(b.station-station)<180&&b.polygons.some(r=>contains(q,r as P[]))))occlusion+=20;}
   options.push({record:{id:`game-hoarding-${String(index+1).padStart(2,'0')}`,poster:index%7+1,station,side:'left',offset,x:p.x,z:p.z,bottom,yaw,width:12,height:9},score:distance*3+occlusion+(bottom-base)*2});
  }
 }
 options.sort((a,b)=>a.score-b.score);if(!options.length)throw new Error(`No close left-side hoarding site at ${station} m`);return options[0].record;
}
