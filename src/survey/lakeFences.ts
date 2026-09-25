import map from '../data/map.json';
import {nearestStation,pose} from '../game/route';
import {crossSectionAt} from './corridor';
import {contains} from './geometry';
import type {Point} from './types';
export const lakeFenceRuns=map.landscape.filter(f=>['relation/8469370','relation/3120373'].includes(f.id)).flatMap(lake=>{
 const result:{id:string;lakeId:string;name:string;points:Point[];source:string}[]=[];
 const rings=lake.polygons as Point[][];let run:Point[]=[];let index=0;
 const flush=()=>{if(run.length>1)result.push({id:lake.id==='relation/8469370'&&index===0?'landscape:agara-frontage-fence':`landscape:${lake.id}:road-fence:${index}`,lakeId:lake.id,name:(lake.tags.name??'Lake')+' roadside fence',points:run,source:lake.source});if(run.length>1)index++;run=[];};
 for(const ring of rings){for(let i=1;i<ring.length;i++){
  const a=ring[i-1],b=ring[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(!len)continue;
  const mid:Point=[(a[0]+b[0])/2,(a[1]+b[1])/2],near=nearestStation(...mid),p=pose(near.s),parallel=Math.abs((b[0]-a[0])*p.tx+(b[1]-a[1])*p.tz)/len;
  if(near.d>110||parallel<.45){flush();continue;}
  const nx=(p.x-mid[0])/near.d,nz=(p.z-mid[1])/near.d;
  for(let d=0;d<=len;d+=Math.min(3,len)){const t=d/len,q:Point=[a[0]+(b[0]-a[0])*t+nx*.8,a[1]+(b[1]-a[1])*t+nz*.8],n=nearestStation(...q),c=crossSectionAt(n.s);
   if(contains(q,ring)||n.offset>c.left-1&&n.offset<c.oppositeRight+1||c.serviceLeftActive&&n.offset>c.serviceLeft[0]-.5&&n.offset<c.serviceLeft[1]+.5){flush();continue;}
   if(run.length&&Math.hypot(q[0]-run.at(-1)![0],q[1]-run.at(-1)![1])>6)flush();run.push(q);
  }
 }flush();}return result;
});
