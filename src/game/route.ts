import map from '../data/map.json';
import manifest from '../data/route-manifest.json';
import {elevationAt,LEGACY_OFFSET,OLD_SHIFT,SILK_LENGTH,oldLocal} from '../survey/corridor';
export const ROUTE_LENGTH = manifest.length;
export const ROUTE_ID = manifest.id;
export {manifest,LEGACY_OFFSET,OLD_SHIFT,SILK_LENGTH};
export const LANES = [-3.4, 0, 3.4];
export { map };
export const roadHeight=elevationAt;
function xy(s:number):[number,number] {
  const points=map.centerline;
  let lo=0,hi=points.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(points[mid].s<s)lo=mid+1;else hi=mid;}let index=lo;
  if(index===0)index=1;
  const a=points[index-1],b=points[index];
  const t=(s-a.s)/(b.s-a.s);
  return [a.p[0]+(b.p[0]-a.p[0])*t,a.p[1]+(b.p[1]-a.p[1])*t];
}
export function pose(s:number,offset=0) {
  const p=xy(s),a=xy(s-2),b=xy(s+2),len=Math.hypot(b[0]-a[0],b[1]-a[1]);
  const tx=(b[0]-a[0])/len,tz=(b[1]-a[1])/len;
  return {x:p[0]-tz*offset,y:roadHeight(s),z:p[1]+tx*offset,yaw:Math.atan2(-tx,-tz),rx:-tz,rz:tx,tx,tz};
}
export function nearestStation(x:number,z:number) {
  let best={s:0,offset:0,d:Infinity};
  const points=map.centerline;
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],dx=b.p[0]-a.p[0],dz=b.p[1]-a.p[1],l=Math.hypot(dx,dz);
    const raw=((x-a.p[0])*dx+(z-a.p[1])*dz)/(l*l);
    const t=Math.max(i===1?-100/l:0,Math.min(i===points.length-1?1+100/l:1,raw));
    const px=a.p[0]+t*dx,pz=a.p[1]+t*dz,d=Math.hypot(x-px,z-pz);
    if(d<best.d)best={s:a.s+t*(b.s-a.s),offset:((x-px)*-dz+(z-pz)*dx)/l,d};
  }
  return best;
}
export function locationName(s:number){
 if(s<600)return 'Silk Board · ORR';
 if(s<1450)return 'HSR Layout · ORR';
 if(s<2000)return 'HSR / 14th Main flyover';
 if(s<3200)return 'Agara Lake';
 if(s<3850)return 'Agara flyover';
 if(s<SILK_LENGTH-200)return 'Agara → Ibbalur';
 if(s<SILK_LENGTH)return 'Ibbalur · Sarjapur crossing';
 if(oldLocal(s)<520)return 'Ibbalur Lake';
 if(oldLocal(s)<1800)return 'Bellandur · ORR';
 if(s<LEGACY_OFFSET)return 'Devarabisanahalli · ORR';
 if(s>=manifest.marathahalliUnderpass.from)return 'Marathahalli · ORR underpass';
 if(s>=LEGACY_OFFSET+1000)return 'Marathahalli · Outer Ring Road';
 const local=s-LEGACY_OFFSET;
 if(local<300)return 'Kadubeesanahalli underpass';
 if(local<565)return 'Prestige Tech Park';
 if(local<800)return 'Adobe · Prestige Platina';
 return 'Towards Marathahalli';
}
