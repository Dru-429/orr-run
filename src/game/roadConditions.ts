import {ROUTE_LENGTH,ROUTE_ID} from './route';
import {crossSectionAt} from '../survey/corridor';
import {junctionRecords} from './junctions';
import {parkedBusGroups} from './parkedBuses';

export type SurfaceKind='smooth'|'mild'|'severe';
export interface RoadCondition {id:string;from:number;to:number;kind:SurfaceKind;seed:number;left:number;right:number;level:'carriageway-relative';gameAdded:true}
export interface SurfacePatch {id:string;kind:'pothole'|'water';s:number;x:number;length:number;width:number;seed:number;severity:number;level:'forward-carriageway';gameAdded:true}
export const SURFACE_VERSION=1;
export const surfaceLimits={smooth:25,mild:55/3.6,severe:30/3.6,water:20/3.6};
export function noise(seed:number){let t=Math.imul(seed^0x9e3779b9,0x85ebca6b);t=Math.imul(t^t>>>13,0xc2b2ae35);return ((t^t>>>16)>>>0)/4294967296;}
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export function protectedSurface(from:number,to:number){
 if(from<100||junctionRecords.some(j=>from<j.centre+j.halfConflict+35&&to>j.centre-j.halfConflict-35))return true;
 // Include both carriageway profiles and a transition buffer, including the old underpass.
 for(let s=Math.max(0,from-25);s<=Math.min(ROUTE_LENGTH,to+25);s+=5){const a=crossSectionAt(s-3),b=crossSectionAt(s+3);if(Math.abs(a.elevation-b.elevation)>.018||Math.abs(a.oppositeElevation-b.oppositeElevation)>.018)return true;}
 return false;
}
// Allocate by length, with seeded 100 m clusters, rather than a repeated texture pattern.
const cells=Array.from({length:Math.ceil(ROUTE_LENGTH/20)},(_,i)=>({from:i*20,to:Math.min(ROUTE_LENGTH,(i+1)*20),kind:'smooth' as SurfaceKind,seed:i+250925}));
function allocate(kind:SurfaceKind,fraction:number){
 let remaining=ROUTE_LENGTH*fraction;
 const candidates=cells.filter(c=>c.from>=100&&c.kind==='smooth'&&(kind!=='severe'||!protectedSurface(c.from,c.to))).sort((a,b)=>(noise(Math.floor(a.from/100)+(kind==='severe'?83:191))-noise(Math.floor(b.from/100)+(kind==='severe'?83:191)))||a.from-b.from);
 for(const c of candidates){if(remaining<=.000001)break;const length=c.to-c.from;if(length>remaining){const split={...c,from:c.from+remaining};cells.push(split);c.to=split.from;}c.kind=kind;remaining-=c.to-c.from;}
 if(remaining>.001)throw new Error('Not enough eligible road for '+kind+' coverage');
}
allocate('severe',.2);allocate('mild',.5);
export const roadConditions:RoadCondition[]=cells.sort((a,b)=>a.from-b.from).map(c=>{const section=crossSectionAt((c.from+c.to)/2);return {...c,id:`game-surface:${c.from.toFixed(3)}`,left:section.left,right:section.right,level:'carriageway-relative',gameAdded:true};});
export const surfaceCoverage=Object.fromEntries((['smooth','mild','severe'] as const).map(k=>[k,roadConditions.filter(c=>c.kind===k).reduce((n,c)=>n+c.to-c.from,0)/ROUTE_LENGTH]));
export const potholes:SurfacePatch[]=roadConditions.flatMap(c=>{
 if(c.kind==='smooth')return [];
 const count=c.kind==='severe'?4:1;
 return Array.from({length:count},(_,i)=>{const seed=c.seed*7+i,s=c.from+(c.to-c.from)*(i+.5)/count,lanes=crossSectionAt(s).laneCentres,lane=Math.floor(noise(seed)*lanes.length);return {id:c.id+':hole:'+i,kind:'pothole' as const,s,x:lanes[lane]+(noise(seed+1)-.5)*2.3,length:c.kind==='severe'?1.1+noise(seed+2)*1.4:.7+noise(seed+2)*.6,width:c.kind==='severe'?.8+noise(seed+3)*1.1:.55+noise(seed+3)*.5,seed,severity:c.kind==='severe'?1:.35,level:'forward-carriageway' as const,gameAdded:true as const};});
});
export const waterPatches:SurfacePatch[]=Array.from({length:6},(_,i)=>{
 const length=30+i*5,target=ROUTE_LENGTH*(i+1)/7;
 const eligible=roadConditions.filter(c=>{
  const s=(c.from+c.to)/2,from=s-length/2,to=s+length/2;
  return !protectedSurface(from,to)&&Math.abs(crossSectionAt(s).elevation)<.02&&!parkedBusGroups.some(b=>Math.abs(b.start-s)<130);
 }).sort((a,b)=>Math.abs((a.from+a.to)/2-target)-Math.abs((b.from+b.to)/2-target));
 const s=(eligible[0].from+eligible[0].to)/2,c=crossSectionAt(s),width=(c.right-c.left)*.42;
 return {id:`game-water:${i+1}`,kind:'water',s,x:c.left+.75+width/2,length,width,seed:390+i,severity:.5,level:'forward-carriageway',gameAdded:true};
});
const patchBuckets=new Map<number,SurfacePatch[]>();
for(const p of [...potholes,...waterPatches])for(let n=Math.floor((p.s-p.length/2)/20);n<=Math.floor((p.s+p.length/2)/20);n++){const list=patchBuckets.get(n)??[];list.push(p);patchBuckets.set(n,list);}
export function conditionAt(s:number):RoadCondition|undefined{
 let lo=0,hi=roadConditions.length-1;while(lo<=hi){const m=(lo+hi)>>1,c=roadConditions[m];if(s<c.from)hi=m-1;else if(s>=c.to)lo=m+1;else return c;}return undefined;
}
/** Same irregular outline is used by wheel sampling and the scene mesh. */
export function patchRadius(p:SurfacePatch,angle:number){return 1+.08*Math.sin(angle*5+p.seed)+.05*Math.cos(angle*9+p.seed);}
export function inPatch(p:SurfacePatch,s:number,x:number){const u=(x-p.x)/(p.width/2),v=(s-p.s)/(p.length/2);return Math.hypot(u,v)<=patchRadius(p,Math.atan2(v,u));}
export interface SurfaceSample {kind:SurfaceKind;limit:number;wet:boolean;holes:SurfacePatch[];left:number;right:number}
export function sampleSurface(s:number,x:number,width=1.8,length=4.2,opposite=false):SurfaceSample{
 const c=crossSectionAt(s),left=opposite?c.oppositeLeft:c.left,right=opposite?c.oppositeRight:c.right;
 const valid=x>=left&&x<=right,kind=valid?conditionAt(s)?.kind??'smooth':'smooth';
 const result:SurfaceSample={kind,limit:surfaceLimits[kind],wet:false,holes:[],left:0,right:0};
 if(!valid||opposite)return result;
 const seen=new Set<string>();
 for(const axle of [-length*.32,length*.32])for(const side of [-1,1]){
  const ws=s+axle,wx=x+side*width*.39;
  for(const p of patchBuckets.get(Math.floor(ws/20))??[])if(inPatch(p,ws,wx)){
   if(p.kind==='water'){result.wet=true;result.limit=Math.min(result.limit,surfaceLimits.water);}
   else{if(!seen.has(p.id)){seen.add(p.id);result.holes.push(p);}if(side<0)result.left=Math.max(result.left,p.severity);else result.right=Math.max(result.right,p.severity);}
  }
 }
 return result;
}
/** Speed at which an NPC can enter the next surface using comfortable deceleration. */
export function approachingSurfaceLimit(s:number,x:number,speed:number,width:number,length:number,opposite=false){
 let limit=25;const direction=opposite?-1:1,look=Math.max(12,speed*speed/5+10);
 for(let d=0;d<=look;d+=5){
  const station=s+direction*d;let t=surfaceLimits[conditionAt(station)?.kind??'smooth'];
  // NPC look-ahead only needs speed restrictions, not pothole contacts or suspension.
  if(!opposite)for(const p of waterPatches){if(Math.abs(p.s-station)>p.length/2+length)continue;
   if([-length*.32,length*.32].some(axle=>[-1,1].some(side=>inPatch(p,station+axle,x+side*width*.39))))t=Math.min(t,surfaceLimits.water);
  }
  limit=Math.min(limit,Math.sqrt(t*t+5*d));
 }return limit;
}
export interface Suspension {kind:SurfaceKind;wet:boolean;limit:number;y:number;pitch:number;roll:number;lag:number}
export const calmSuspension=():Suspension=>({kind:'smooth',wet:false,limit:25,y:0,pitch:0,roll:0,lag:0});
export class RoadResponse {
 state=calmSuspension();private contacts=new Set<string>();private bumps:{age:number;strength:number;side:number}[]=[];
 reset(){this.state=calmSuspension();this.contacts.clear();this.bumps=[];}
 update(dt:number,fromS:number,fromX:number,s:number,x:number,speed:number){
  const sample=sampleSurface(s,x),distance=Math.hypot(s-fromS,x-fromX),steps=Math.max(1,Math.ceil(distance/.2));
  // Sweep tyre paths so a narrow pothole cannot be skipped at high speed / low frame rate.
  for(let i=1;i<=steps;i++){
   const q=sampleSurface(fromS+(s-fromS)*i/steps,fromX+(x-fromX)*i/steps),next=new Set(q.holes.map(p=>p.id));
   for(const p of q.holes)if(!this.contacts.has(p.id)&&speed>.2){this.bumps.push({age:0,strength:p.severity*clamp(speed/14,0,1),side:Math.sign(q.right-q.left)});}
   this.contacts=next;
  }
  this.bumps=this.bumps.filter(b=>(b.age+=dt)<.6).slice(-8);
  const energy=clamp(speed/12,0,1),amp=sample.kind==='severe'?.012:sample.kind==='mild'?.005:0;
  const vibration=(Math.sin(s*3.1+x)*.65+Math.sin(s*7.7)*.35)*amp*energy;
  const bump=this.bumps.reduce((a,b)=>a+Math.sin(b.age/.6*Math.PI*3)*Math.pow(1-b.age/.6,2)*b.strength,0)*energy;
  const amplitude=sample.kind==='severe'||this.bumps.some(b=>b.strength>.5)?.04:.01;
  const target=clamp(vibration+bump*.034,-amplitude,amplitude),blend=1-Math.exp(-dt*22);
  const y=this.state.y+(target-this.state.y)*blend;
  this.state={kind:sample.kind,wet:sample.wet,limit:sample.limit,y,pitch:clamp((y-this.state.y)*1.8,-.014,.014),roll:clamp(bump*this.bumps.reduce((a,b)=>a+b.side,0)*.004,-.007,.007),lag:y*.35};
  return this.state;
 }
}
export function surfaceMotion(state:Suspension,reduced=false){return reduced?{y:0,pitch:0,roll:0,lag:0}:state;}
export const roadConditionExport={version:SURFACE_VERSION,routeId:ROUTE_ID,note:'Game-added damaged roads and shallow waterlogging, not surveyed current conditions. No health damage.',coverage:surfaceCoverage,conditions:roadConditions,potholes,water:waterPatches};
