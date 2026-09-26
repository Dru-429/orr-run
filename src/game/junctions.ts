import records from '../data/junctions.json';
import {pose} from './route';
import {crossSectionAt} from '../survey/corridor';
export const junctionRecords=[...records].sort((a,b)=>a.station-b.station);
export type JunctionRecord=typeof records[number];
export type Lamp='green'|'amber'|'red';
export interface JunctionState {record:JunctionRecord;phase:number;elapsed:number;held:boolean;orr:Lamp;cross:Lamp}
export interface Body {player?:boolean;s?:number;speed?:number;x:number;z:number;y:number;yaw:number;length:number;width:number}
export interface CrossingVehicle {id:number;junctionId:string|null;direction:1|-1;d:number;speed:number;active:boolean;braking:boolean;committed:boolean;kind:'car'|'cab'|'auto';length:number;width:number;color:number}
export const CROSSING_POOL_SIZE=12;
export function overlaps(a:Body,b:Body,margin=0){
 if(Math.abs(a.y-b.y)>2.5)return false;
 // SAT in world coordinates: handles bends, perpendicular paths, and separated decks.
 const axes=[[Math.sin(a.yaw),Math.cos(a.yaw)],[Math.cos(a.yaw),-Math.sin(a.yaw)],[Math.sin(b.yaw),Math.cos(b.yaw)],[Math.cos(b.yaw),-Math.sin(b.yaw)]];
 for(const [x,z] of axes){const radius=(v:Body)=>Math.abs(x*Math.sin(v.yaw)+z*Math.cos(v.yaw))*v.length/2+Math.abs(x*Math.cos(v.yaw)-z*Math.sin(v.yaw))*v.width/2;
  if(Math.abs((a.x-b.x)*x+(a.z-b.z)*z)>radius(a)+radius(b)+margin)return false;
 }return true;
}
export function crossingBody(v:CrossingVehicle,j:JunctionRecord):Body{
 let station=j.centre+v.direction*2.1,d=v.d,yawOffset=-v.direction*Math.PI/2;
 if(j.layout==='right-branch'){
  // Inbound traffic turns from the right-hand branch into ORR. No road is drawn into the lake.
  const target=crossSectionAt(j.centre).laneCentres[0],radius=12,u=v.d+target+radius;
  if(u<=0){station=j.centre-2;d=-v.d;yawOffset=Math.PI/2;}
  else if(u<radius*Math.PI/2){const angle=u/radius;station=j.centre-2+radius*(1-Math.cos(angle));d=target+radius*(1-Math.sin(angle));yawOffset=Math.PI/2-angle;}
  else{station=j.centre-2+radius+u-radius*Math.PI/2;d=crossSectionAt(station).laneCentres[0];yawOffset=0;}
 }
 const p=pose(station,d);return {s:station,speed:v.speed,x:p.x,z:p.z,y:j.layout==='right-branch'&&v.d>35?p.y:j.elevation,yaw:p.yaw+yawOffset,length:v.length,width:v.width};
}

export function roadBody(s:number,d:number,length:number,width:number,opposite=false,speed=0):Body{const p=pose(s,d);return {...p,s,speed,y:opposite?crossSectionAt(s).oppositeElevation:p.y,yaw:p.yaw+(opposite?Math.PI:0),length,width};}
function lamps(state:JunctionState){state.orr=state.phase===0?'green':state.phase===1?'amber':'red';state.cross=state.phase===3?'green':state.phase===4?'amber':'red';}
export class JunctionSystem {
 states:JunctionState[]=[];private amberEntries=new Map<string,boolean>();
 vehicles:CrossingVehicle[]=Array.from({length:CROSSING_POOL_SIZE},(_,id)=>({id,junctionId:null,d:0,direction:id%2?1:-1,speed:0,active:false,braking:false,committed:false,kind:id%3===0?'auto':id%3===1?'cab':'car',length:id%3===0?2.7:4.3,width:id%3===0?1.5:1.85,color:id%7}));
 constructor(){this.reset();}
 reset(){this.amberEntries.clear();this.states=junctionRecords.map(record=>{let elapsed=record.phaseOffset,phase=0;while(elapsed>=record.timing[phase]){elapsed-=record.timing[phase];phase=(phase+1)%6;}const s:JunctionState={record,phase,elapsed,held:false,orr:'red',cross:'red'};lamps(s);return s;});for(const v of this.vehicles){v.active=false;v.junctionId=null;v.speed=0;v.committed=false;}}
 state(id:string){return this.states.find(s=>s.record.id===id)!;}
 tick(dt:number,playerStation:number,bodies:Body[],surfaceLimit?:(s:number,x:number,speed:number,width:number,length:number)=>number){
  for(const s of this.states){const j=s.record,c=crossSectionAt(j.centre),p=pose(j.centre,(c.left+c.oppositeRight)/2);const conflict:Body={...p,y:j.elevation,length:j.halfConflict*2,width:c.oppositeRight-c.left+4};
   const occupied=s.phase===2?(bodies.some(b=>overlaps(b,conflict))||this.vehicles.some(v=>v.active&&v.junctionId!==j.id&&overlaps(crossingBody(v,this.state(v.junctionId!).record),conflict))):s.phase===5?this.vehicles.some(v=>v.active&&v.junctionId===j.id&&overlaps(crossingBody(v,j),conflict)):false;
   s.held=false;s.elapsed+=dt;if(s.elapsed>=j.timing[s.phase]){if(occupied){s.elapsed=j.timing[s.phase];s.held=true;}else{s.elapsed-=j.timing[s.phase];s.phase=(s.phase+1)%6;if(s.phase===0)for(const key of this.amberEntries.keys())if(key.startsWith(j.id+':'))this.amberEntries.delete(key);}}lamps(s);
  }
  const nearby=this.states.filter(s=>Math.abs(s.record.centre-playerStation)<600);
  for(const v of this.vehicles){if(v.active&&Math.abs(this.state(v.junctionId!).record.centre-playerStation)>850){const b=crossingBody(v,this.state(v.junctionId!).record),p=pose(playerStation);if(Math.hypot(b.x-p.x,b.z-p.z)>450){v.active=false;v.junctionId=null;}}if(!v.active&&nearby.length){const j=nearby[v.id%nearby.length].record;v.active=true;v.committed=false;v.junctionId=j.id;v.direction=j.layout==='right-branch'?1:v.id%2?1:-1;v.d=-v.direction*(j.crossingHalfLength+(j.layout==='right-branch'?v.id:v.id>>1)*14);v.speed=8;}}
  const decisions=this.vehicles.filter(v=>v.active).map(v=>{
   const state=this.state(v.junctionId!),j=state.record,c=crossSectionAt(j.centre),stop=j.layout==='right-branch'?-c.oppositeRight-7:v.direction===1?c.left-5:c.oppositeRight+5;
   const gap=(stop-v.d)*v.direction-v.length/2;
   if(state.cross==='amber'&&gap>=0&&gap<v.speed*v.speed/8+v.speed*.3)v.committed=true;
   let target=9,mergedStop=Infinity,frontGap=Infinity;if(j.layout==='right-branch'&&v.d>35){const b=crossingBody(v,j);target=Math.min(target,surfaceLimit?.(b.s!,crossSectionAt(b.s!).laneCentres[0],v.speed,v.width,v.length)??25);mergedStop=this.stopFor(crossingBody(v,j).s!,v.speed,v.length,false,1000+v.id);target=Math.min(target,Math.sqrt(8*Math.max(0,mergedStop-.4)));}
   const exitD=j.layout==='right-branch'?45:v.direction===1?c.oppositeRight+9:c.left-9,exit=crossingBody({...v,d:exitD},j);
   const exitClear=!bodies.some(b=>overlaps(b,exit,3));
   // Crossing amber clears committed cars; waiting cars stay outside the conflict area.
   if(gap>=0&&((state.cross!=='green'&&!v.committed)||!exitClear))target=Math.min(target,Math.sqrt(2*4*Math.max(0,gap-.7)));
   for(const o of this.vehicles)if(o!==v&&o.active&&o.junctionId===v.junctionId&&o.direction===v.direction){const front=(o.d-v.d)*v.direction-(o.length+v.length)/2;if(front>=-.1)target=Math.min(target,Math.max(0,o.speed+(front-Math.max(3,v.speed))*.65));}
   if(j.layout==='right-branch'&&v.d>35){const current=crossingBody(v,j),tx=-Math.sin(current.yaw),tz=-Math.cos(current.yaw);for(const b of bodies){const dx=b.x-current.x,dz=b.z-current.z,forward=dx*tx+dz*tz,lateral=Math.abs(-dx*tz+dz*tx);if(forward<=0||forward>80||Math.abs(current.y-b.y)>2.5||lateral>(v.width+b.width)/2+.15)continue;const gap=forward-(v.length+b.length)/2;frontGap=Math.min(frontGap,Math.max(0,gap-.5));target=Math.min(target,Math.max(0,(b.speed??0)+(gap-Math.max(3,v.speed*1.15))*.7));}}
   // Never enter an occupied exit. Cars already crossing continue clearing on red.
   return {v,j,target,gap,stop,mergedStop,frontGap,blocked:gap>=0&&((state.cross!=='green'&&!v.committed)||!exitClear)};
  });
  for(const {v,j,target,gap,stop,mergedStop,frontGap,blocked} of decisions){v.braking=target<v.speed-.5;v.speed=Math.max(0,v.speed+Math.max(-5*dt,Math.min(2*dt,target-v.speed)));let step=Math.min(v.speed*dt,mergedStop,frontGap);if(blocked)step=Math.min(step,Math.max(0,gap));// Test the swept step against NPC bodies before committing movement.
   const canMove=(amount:number)=>{const candidate=crossingBody({...v,d:v.d+amount*v.direction},j);return !bodies.some(b=>!b.player&&Math.abs(b.x-candidate.x)<25&&Math.abs(b.z-candidate.z)<25&&overlaps(candidate,b,.1))&&!this.vehicles.some(o=>o!==v&&o.active&&overlaps(candidate,crossingBody(o,this.state(o.junctionId!).record),.1));};
   if(!canMove(step)){step=0;v.speed=0;v.braking=true;}v.d+=step*v.direction;
   if(v.d*v.direction>j.crossingHalfLength+90){const b=crossingBody(v,j),p=pose(playerStation);if(Math.hypot(b.x-p.x,b.z-p.z)>450){v.active=false;v.junctionId=null;}}
  }
 }
 /** Virtual stop line shared by AI and the rendered signal. Elevated lanes pass above. */
 stopFor(s:number,speed:number,length:number,opposite:boolean,vehicleId?:number):number{
  let best=Infinity;const height=opposite?crossSectionAt(s).oppositeElevation:pose(s).y;
  for(const state of this.states){const j=state.record;if(Math.abs(height-j.elevation)>2.5||state.orr==='green')continue;const line=opposite?j.centre+j.halfConflict+9:j.stopLine;const gap=(line-s)*(opposite?-1:1)-length/2;
   if(gap<-.01||gap>160)continue;
   const key=j.id+':'+vehicleId;
   if(state.orr==='amber'&&vehicleId!==undefined&&!this.amberEntries.has(key))this.amberEntries.set(key,gap<speed*speed/8+speed*.35);
   if(vehicleId!==undefined?this.amberEntries.get(key):state.orr==='amber'&&gap<speed*speed/8+speed*.35)continue;
   best=Math.min(best,Math.max(0,gap));
  }return best;
 }
}
