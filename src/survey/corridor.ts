import serviceRoads from '../data/service-roads.json';
import map from '../data/map.json';
import manifest from '../data/route-manifest.json';
export const LEGACY_OFFSET=manifest.segments.find(s=>s.id==='adobe-electra')!.offset;
export const OLD_SHIFT=manifest.oldRouteShift;
export const SILK_LENGTH=manifest.segments.find(s=>s.id==='silk-hsr')!.length;
export const oldStation=(s:number)=>s+OLD_SHIFT;
export const oldLocal=(s:number)=>s-OLD_SHIFT;
export function flyoverHeight(s:number,opposite=false){
 const profiles=opposite?oppositeFlyovers:manifest.flyovers;
 for(const f of profiles)if(s>=f.from&&s<=f.to)return s<f.upTo?f.height*smooth((s-f.from)/(f.upTo-f.from)):s>f.downFrom?f.height*(1-smooth((s-f.downFrom)/(f.to-f.downFrom))):f.height;
 return 0;
}
import oppositeFlyovers from '../data/opposite-flyovers.json';
export const ROAD_WORK={id:'construction:station-edge',from:LEGACY_OFFSET+840,to:LEGACY_OFFSET+950,offset:5,barrierWidth:.5,height:1.05,stage:'station-works',confidence:'estimated' as const,source:'https://www.openstreetmap.org/way/1508372367',note:'Mapped station; exact barrier placement remains estimated. No potholes.'};
const smooth=(t:number)=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function elevationAt(s:number){
 const local=s-LEGACY_OFFSET;
 const u=manifest.marathahalliUnderpass;if(s>=u.from&&s<=u.to)return s<u.downTo?u.depth*smooth((s-u.from)/(u.downTo-u.from)):s>u.upFrom?u.depth*(1-smooth((s-u.upFrom)/(u.to-u.upFrom))):u.depth;
 if(s<SILK_LENGTH)return flyoverHeight(s);
 if(local>=0){if(local<205)return -4.2;if(local>435)return 0;return -4.2*(1-smooth((local-205)/230));}
 if(s>LEGACY_OFFSET-260)return -4.2*smooth((s-(LEGACY_OFFSET-260))/200);
 for(const [a,b,c,d,h] of [[1161,1285,1691,1797,6],[2200,2375,2571,2743,6]])if(oldLocal(s)>=a&&oldLocal(s)<=d)return oldLocal(s)<b?h*smooth((oldLocal(s)-a)/(b-a)):oldLocal(s)>c?h*(1-smooth((oldLocal(s)-c)/(d-c))):h;
 return 0;
}
export interface CrossSection {station:number;left:number;right:number;laneCentres:number[];oppositeCentres:number[];oppositeLeft:number;oppositeRight:number;median:number;serviceLeft:[number,number];serviceRight:[number,number];serviceLeftActive:boolean;serviceRightActive:boolean;elevation:number;oppositeElevation:number;confidence:'estimated';source:string}
function section(s:number):CrossSection{
 const source=manifest.roadRanges.find(r=>s>=r.from&&s<r.to);
 // Gameplay width: three generous lanes, independent of raw mapped pier offsets.
 // Geographic centreline and source geometry remain unchanged in the atlas.
 const desired=3;
 let left=-8.2,right=5.6;
 if(s>=ROAD_WORK.from-15&&s<=ROAD_WORK.to+15){const edge=ROAD_WORK.offset-ROAD_WORK.barrierWidth/2;right=Math.min(right,edge+Math.max(0,ROAD_WORK.from-s,s-ROAD_WORK.to)*.06);}
 const n=desired,width=(right-left)/n;
 const laneCentres=Array.from({length:n},(_,i)=>left+width*(i+.5));
 const median=8.6,oppositeLeft=11.6,oppositeRight=23;
 const nearby=serviceRoads.filter(r=>s>=r.from-5&&s<=r.to+5);const serviceL=nearby.filter(r=>r.offset<0).sort((a,b)=>b.offset-a.offset)[0],serviceR=nearby.filter(r=>r.offset>oppositeRight+2).sort((a,b)=>a.offset-b.offset)[0];
 return {station:s,left,right,laneCentres,oppositeCentres:[oppositeLeft+1.9,oppositeLeft+5.7,oppositeLeft+9.5],oppositeLeft,oppositeRight,median,serviceLeft:serviceL?[Math.min(serviceL.offset-3,left-8),Math.min(left-2,serviceL.offset+3)]:[left-1,left-1],serviceRight:serviceR?[serviceR.offset-3,serviceR.offset+3]:[oppositeRight+1,oppositeRight+1],serviceLeftActive:!!serviceL,serviceRightActive:!!serviceR,elevation:elevationAt(s),oppositeElevation:s<SILK_LENGTH?flyoverHeight(s,true):oldLocal(s)<230?6.4:oldLocal(s)<380?6.4*(1-smooth((oldLocal(s)-230)/150)):elevationAt(s),confidence:'estimated',source:source?.source??'https://www.openstreetmap.org/way/378720749'};
}
// Shared sampled profiles are exported with the survey; dimensions are modelling estimates.
export const crossSections=Array.from({length:Math.ceil(manifest.length/5)+1},(_,i)=>section(Math.min(manifest.length,i*5)));
export function crossSectionAt(s:number):CrossSection{
 const index=Math.max(0,Math.min(crossSections.length-2,Math.floor(s/5))),a=crossSections[index],b=crossSections[index+1],t=Math.max(0,Math.min(1,(s-a.station)/Math.max(.001,b.station-a.station)));
 const lerp=(x:number,y:number)=>x+(y-x)*t,left=lerp(a.left,b.left),right=lerp(a.right,b.right),count=Math.min(a.laneCentres.length,b.laneCentres.length);
 return {...a,station:s,left,right,median:lerp(a.median,b.median),laneCentres:Array.from({length:count},(_,i)=>left+(right-left)*(i+.5)/count),oppositeLeft:lerp(a.oppositeLeft,b.oppositeLeft),oppositeRight:lerp(a.oppositeRight,b.oppositeRight),oppositeCentres:a.oppositeCentres.map((v,i)=>lerp(v,b.oppositeCentres[i])),serviceLeft:[lerp(a.serviceLeft[0],b.serviceLeft[0]),lerp(a.serviceLeft[1],b.serviceLeft[1])],serviceRight:[lerp(a.serviceRight[0],b.serviceRight[0]),lerp(a.serviceRight[1],b.serviceRight[1])],elevation:elevationAt(s),oppositeElevation:lerp(a.oppositeElevation,b.oppositeElevation)};
}
export const medianOffset=(s:number)=>crossSectionAt(s).median;
export function oppositeOffset(s:number,nominal:number){return crossSectionAt(s).oppositeCentres[1]+nominal-14.5;}
export function driveBounds(s:number,halfWidth=.95){const c=crossSectionAt(s);return {left:c.left+halfWidth,right:c.right-halfWidth};}
export const laneCentresAt=(s:number,opposite=false)=>opposite?crossSectionAt(s).oppositeCentres:crossSectionAt(s).laneCentres;

/** Render-only clearance adjustment. Never modifies surveyed coordinates. */
export function supportOffset(s:number,d:number,radius=1.1){
 const c=crossSectionAt(s),margin=radius+.75;
 if(d<c.left)return Math.min(d,c.left-margin);
 if(d>c.oppositeRight)return Math.max(d,c.oppositeRight+margin);
 return c.median;
}
