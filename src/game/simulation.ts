import {parkedBuses,parkedClear,parkedGap} from './parkedBuses';
import {NPCHornSystem,type NPCHornEvent,type HornActor} from './npcHorns';
import {collisionDamage,type ImpactEvent} from './impact';
import {TrafficOverview,type TrafficSection} from './trafficMap';
import {JunctionSystem,roadBody,crossingBody,overlaps} from './junctions';
import {ROUTE_LENGTH,pose} from './route';
import {driveBounds,laneCentresAt} from '../survey/corridor';
import {TRAFFIC_CONFIG,TRAFFIC_COUNT} from '../data/traffic';
export type VehicleKind='car'|'cab'|'auto'|'bike'|'bus'|'truck';
export type Phase='ready'|'driving'|'paused'|'looping'|'ended';
export interface Input {throttle:boolean;brake:boolean;left:boolean;right:boolean;horn:boolean}
export const emptyInput=():Input=>({throttle:false,brake:false,left:false,right:false,horn:false});
export interface Traffic {id:number;s:number;x:number;lane:number;targetLane:number;speed:number;cruise:number;kind:VehicleKind;length:number;width:number;opposite:boolean;braking:boolean;changeTimer:number;passed:boolean;color:number;hornPressure:number;gestureUntil:number;gestureCooldown:number;responding:boolean}
export interface Snapshot {phase:Phase;s:number;x:number;speed:number;health:number;distance:number;lap:number;collisions:number;overtakes:number;time:number;steer:number;impact:number;impactEvent:ImpactEvent|null;trafficSections:TrafficSection[];npcHorns:NPCHornEvent[];fade:number}
export const DIMENSIONS:Record<VehicleKind,[number,number]>={car:[4.3,1.85],cab:[4.2,1.8],auto:[2.7,1.5],bike:[2.05,.7],bus:[10.8,2.6],truck:[8.0,2.5]};
function random(seed:number){let a=seed;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
export class Simulation {
  npcHorns:NPCHornSystem;private hornStep=0;
  phase:Phase='ready';s=0;x=laneCentresAt(0)[0];speed=0;health=100;distance=0;lap=1;collisions=0;overtakes=0;time=0;steer=0;impact=0;fade=0;
  impactEvent:ImpactEvent|null=null;private impactId=0;private contacts=new Map<string,number>();private frameContacts=new Set<string>();private hornTarget:number|null=null;private hornGap=0;private overview=new TrafficOverview();
  junctions=new JunctionSystem();traffic:Traffic[]=[];private seed:number;private rng:()=>number;private cooldown=0;private loopTimer=0;private loopReset=false;private resumePhase:Phase='driving';
  constructor(seed=TRAFFIC_CONFIG.seed){this.seed=seed;this.npcHorns=new NPCHornSystem(seed);this.rng=random(seed);this.populate();}
  populate(){
    this.npcHorns.reset();this.hornStep=0;
    const r=this.rng; const kinds:VehicleKind[]=['car','car','cab','auto','bike','car','bus','bike','truck','auto'];
    this.traffic=Array.from({length:TRAFFIC_COUNT},(_,id)=>{
      const opposite=id>=TRAFFIC_CONFIG.sameDirection;const n=opposite?id-TRAFFIC_CONFIG.sameDirection:id;const lane=n%laneCentresAt(22+Math.floor(n/3)*36,opposite).length;const kind=kinds[Math.floor(r()*kinds.length)];
      const [length,width]=DIMENSIONS[kind];const cruise=kind==='bike'?10+r()*5:kind==='bus'||kind==='truck'?6+r()*4:7+r()*7;
      return {id,s:22+Math.floor(n/3)*(opposite?TRAFFIC_CONFIG.opposingSpacing:TRAFFIC_CONFIG.sameSpacing)+lane*9+r()*8,x:laneCentresAt(22+Math.floor(n/3)*(opposite?TRAFFIC_CONFIG.opposingSpacing:TRAFFIC_CONFIG.sameSpacing)+lane*9,opposite)[lane]??0,lane,targetLane:lane,speed:cruise*.7,cruise,kind,length,width,opposite,braking:false,changeTimer:3+r()*14,passed:false,color:Math.floor(r()*7),hornPressure:0,gestureUntil:0,gestureCooldown:0,responding:false};
    });
    this.clearParkedSpawns();
  }
  /** Used only during population/inspection, never to correct visible driving positions. */
  clearParkedSpawns(){
    for(const v of this.traffic){
      if(parkedClear(v.s,v.x,v.length,v.width,v.opposite,3))continue;
      const lanes=laneCentresAt(v.s,v.opposite);
      const lane=lanes.findIndex(x=>parkedClear(v.s,x,v.length,v.width,v.opposite,3)&&this.traffic.every(o=>o===v||o.opposite!==v.opposite||Math.abs(o.x-x)>(o.width+v.width)/2+.5||Math.abs(o.s-v.s)>(o.length+v.length)/2+3));
      if(lane>=0){v.lane=lane;v.targetLane=lane;v.x=lanes[lane];}
      else{let station=v.s;do{station-=15;}while(!parkedClear(station,v.x,v.length,v.width,v.opposite,3)||this.traffic.some(o=>o!==v&&o.opposite===v.opposite&&Math.abs(o.x-v.x)<(o.width+v.width)/2+.5&&Math.abs(o.s-station)<(o.length+v.length)/2+3));v.s=station;}
    }
  }
  start(){if(this.phase==='ready')this.phase='driving';}
  pause(){if(this.phase==='driving'||this.phase==='looping'){this.resumePhase=this.phase;this.phase='paused';}}
  resume(){if(this.phase==='paused')this.phase=this.resumePhase;}
  restart(){this.s=0;this.x=laneCentresAt(0)[0];this.speed=0;this.health=100;this.distance=0;this.lap=1;this.collisions=0;this.overtakes=0;this.time=0;this.steer=0;this.impact=0;this.fade=0;this.cooldown=0;this.contacts.clear();this.impactEvent=null;this.overview.reset();this.hornTarget=null;this.hornGap=0;this.rng=random(++this.seed);this.populate();this.junctions.reset();this.phase='driving';}
  snapshot():Snapshot{return {phase:this.phase,s:this.s,x:this.x,speed:this.speed,health:this.health,distance:this.distance,lap:this.lap,collisions:this.collisions,overtakes:this.overtakes,time:this.time,steer:this.steer,impact:this.impact,impactEvent:this.impactEvent,trafficSections:this.overview.sections,npcHorns:this.npcHorns.events,fade:this.fade};}
  update(dt:number,input:Input){
    dt=Math.min(dt,.05);
    if(this.phase==='looping'){
      this.impactEvent=null;this.impact=0;this.contacts.clear();this.npcHorns.reset();this.hornStep=0;
      this.loopTimer+=dt;this.fade=this.loopTimer<.65?this.loopTimer/.65:Math.max(0,1-(this.loopTimer-.65)/.65);
      if(this.loopTimer>=.65&&!this.loopReset){this.s=0;this.x=laneCentresAt(0)[0];this.speed=Math.min(this.speed,8);this.lap++;this.hornTarget=null;this.hornGap=0;this.overview.reset();this.populate();this.junctions.reset();this.loopReset=true;}
      if(this.loopTimer>=1.3){this.phase='driving';this.fade=0;}
      return;
    }
    if(this.phase!=='driving')return;
    this.time+=dt;this.cooldown=Math.max(0,this.cooldown-dt);this.impact=this.impactEvent?Math.max(0,1-(this.time-this.impactEvent.time)/.6)*this.impactEvent.severity:0;this.frameContacts.clear();
    const previousS=this.s,previousX=this.x;
    const target=(Number(input.right)-Number(input.left));this.steer+=(target-this.steer)*Math.min(1,dt*7);
    const acceleration=input.brake?-10.5:input.throttle?4.0-this.speed*.075:-(.4+this.speed*.024);
    this.speed=Math.max(0,Math.min(25,this.speed+acceleration*dt));
    this.x+=this.steer*Math.min(4.7,this.speed*.38)*dt;
    const {left:leftLimit,right:rightLimit}=driveBounds(this.s);
    if(this.x<leftLimit||this.x>rightLimit){this.x=Math.max(leftLimit,Math.min(rightLimit,this.x));this.contact(this.x<=leftLimit?'curb:left':'curb:right',3+this.speed*.35,this.speed,{x:this.x<=leftLimit?-1:1,z:0},this.speed>1);this.speed*=Math.max(0,1-dt*2);}
    this.junctions.tick(dt,this.s,[...parkedBuses.map(b=>b.body),{...roadBody(this.s,this.x,4.2,1.8,false,this.speed),player:true},...this.traffic.filter(v=>this.junctions.states.some(j=>Math.abs(j.record.centre-v.s)<45)||this.junctions.vehicles.some(c=>c.active&&c.d>10&&Math.abs(this.junctions.state(c.junctionId!).record.centre+c.d-v.s)<50)).map(v=>roadBody(v.s,v.x,v.length,v.width,v.opposite,v.speed))]);
    this.updateHorn(dt,input.horn);this.updateTraffic(dt);
    const travel=Math.min(this.speed*dt,ROUTE_LENGTH-this.s);this.s+=travel;
    for(const v of this.traffic){
      if(v.opposite)continue;
      if(Math.abs(v.s-this.s)<(v.length+4.2)/2&&Math.abs(v.x-this.x)<(v.width+1.8)/2){
        const relative=Math.abs(this.speed-v.speed);this.contact('road:'+v.id,5+relative*2.1,relative,{x:Math.max(-1,Math.min(1,(v.x-this.x)/2)),z:v.s>=this.s?1:-1},relative>.25||this.speed>.5);
        if(v.s>=this.s){this.s=Math.max(0,v.s-(v.length+4.2)/2-.03);this.speed=Math.min(this.speed,v.speed*.68);}
        else {v.s=this.s-(v.length+4.2)/2-.1;v.speed=Math.min(v.speed,this.speed);}
      }
      if(v.s>this.s+v.length+4)v.passed=false;
      if(!v.passed&&v.s<this.s-v.length&&this.speed>1){v.passed=true;this.overtakes++;}
    }
    for(const b of parkedBuses){
      if(Math.abs(b.s-this.s)>20)continue;
      if(overlaps(roadBody(this.s,this.x,4.2,1.8),b.body)){
        this.contact(b.id,5+this.speed*2.1,this.speed,{x:Math.max(-1,Math.min(1,(b.x-this.x)/2)),z:b.s>=this.s?1:-1},this.speed>.25);
        if(previousS<=b.s-(b.length+4.2)/2){this.s=Math.min(this.s,b.s-(b.length+4.2)/2-.03);}
        else{this.s=previousS;this.x=previousX;}
        this.speed=0;
      }
      if(overlaps(roadBody(this.s,this.x,4.2,1.8),b.body,.2))this.frameContacts.add(b.id);
    }
    for(const v of this.junctions.vehicles){if(!v.active)continue;const j=this.junctions.state(v.junctionId!).record;const player=roadBody(this.s,this.x,4.2,1.8),other=crossingBody(v,j);if(overlaps(player,other)){this.contact('cross:'+v.id,6+Math.hypot(this.speed,v.speed)*1.5,Math.hypot(this.speed,v.speed),{x:Math.sign((other.x-player.x)*pose(this.s).rx+(other.z-player.z)*pose(this.s).rz),z:1},this.speed>.5||v.speed>.5);if(Math.cos(player.yaw-other.yaw)>.85&&j.layout==='right-branch'&&v.d>35){if(other.s!>=this.s){this.s=Math.max(0,other.s!-(v.length+4.2)/2-.1);this.speed=Math.min(this.speed,v.speed*.68);}else{v.d-=Math.max(0,(v.length+4.2)/2-(this.s-other.s!))+.1;v.speed=Math.min(v.speed,this.speed);}}else this.speed*=.3;}}
    // Retain contact until there has been a genuine separation, including tiny solver gaps.
    for(const v of this.traffic)if(!v.opposite&&Math.abs(v.s-this.s)<(v.length+4.2)/2+.18&&Math.abs(v.x-this.x)<(v.width+1.8)/2+.12)this.frameContacts.add('road:'+v.id);
    for(const v of this.junctions.vehicles)if(v.active&&overlaps(roadBody(this.s,this.x,4.2,1.8),crossingBody(v,this.junctions.state(v.junctionId!).record),.2))this.frameContacts.add('cross:'+v.id);
    if(this.x<=leftLimit+.04)this.frameContacts.add('curb:left');if(this.x>=rightLimit-.04)this.frameContacts.add('curb:right');
    for(const [key,last] of this.contacts)if(this.frameContacts.has(key))this.contacts.set(key,this.time);else if(this.time-last>=.3)this.contacts.delete(key);
    this.overview.update(dt,this.s,[...parkedBuses,...this.traffic.filter(v=>!v.opposite),...this.junctions.vehicles.filter(v=>v.active&&v.d>35&&this.junctions.state(v.junctionId!).record.layout==='right-branch').map(v=>({s:crossingBody(v,this.junctions.state(v.junctionId!).record).s!,speed:v.speed}))]);
    this.hornStep+=dt;if(this.hornStep>=.1){
      const p=pose(this.s,this.x);const actors:HornActor[]=this.traffic.filter(v=>Math.abs(v.s-this.s)<160).map(v=>({...roadBody(v.s,v.x,v.length,v.width,v.opposite,v.speed),s:v.s,speed:v.speed,id:v.id,kind:v.kind,lateral:v.x,opposite:v.opposite}));
      parkedBuses.forEach((b,i)=>{if(Math.abs(b.s-this.s)<160)actors.push({...b.body,id:2000+i,kind:'bus',s:b.s,speed:0,lateral:b.x,opposite:false,silent:true});});
      for(const v of this.junctions.vehicles)if(v.active){const body=crossingBody(v,this.junctions.state(v.junctionId!).record),q=pose(body.s!);actors.push({...body,id:1000+v.id,kind:v.kind,s:body.s!,speed:v.speed,lateral:(body.x-q.x)*q.rx+(body.z-q.z)*q.rz,opposite:false});}
      this.npcHorns.update(this.hornStep,this.time,{...p,s:this.s,lateral:this.x,speed:this.speed},actors,this.junctions.states.map(j=>({s:j.record.stopLine,y:j.record.elevation,red:j.orr!=='green'})));this.hornStep=0;
    }
    this.distance=Math.max(this.distance,(this.lap-1)*ROUTE_LENGTH+this.s);
    if(this.health<=0){this.health=0;this.phase='ended';this.speed=0;}
    else if(this.s>=ROUTE_LENGTH-0.001){this.phase='looping';this.loopTimer=0;this.loopReset=false;}
  }
  private contact(obstacle:string,rawDamage:number,closingSpeed:number,direction:{x:number;z:number},moving=true){
    this.frameContacts.add(obstacle);if(this.contacts.has(obstacle)||!moving)return;this.contacts.set(obstacle,this.time);
    this.impactEvent={id:++this.impactId,obstacle,time:this.time,severity:Math.min(1,.18+closingSpeed/17),direction};this.impact=this.impactEvent.severity;
    if(this.cooldown>0)return;this.health=Math.max(0,Math.min(100,this.health-collisionDamage(rawDamage)));this.collisions++;this.cooldown=2;
  }
  private updateHorn(dt:number,horn:boolean){
    this.hornGap=horn?0:this.hornGap+dt;
    const target=this.traffic.filter(v=>!v.opposite&&['car','cab'].includes(v.kind)&&v.s>this.s&&v.s-this.s-(v.length+4.2)/2<=25&&Math.abs(v.x-this.x)<(v.width+1.8)/2+.35&&Math.abs(pose(v.s).y-pose(this.s).y)<2).sort((a,b)=>a.s-b.s)[0];
    const leader=parkedBuses.some(v=>v.s>this.s&&v.s<(target?.s??0)&&Math.abs(v.x-this.x)<(v.width+1.8)/2+.35)||this.traffic.some(v=>!v.opposite&&v.s>this.s&&v.s<(target?.s??0)&&Math.abs(v.x-this.x)<(v.width+1.8)/2+.35);
    const id=leader?null:target?.id??null;
    if(id!==this.hornTarget||this.hornGap>.5){for(const v of this.traffic){v.hornPressure=0;v.responding=false;}this.hornTarget=id;}
    if(horn&&id!==null){const v=this.traffic.find(v=>v.id===id)!;v.hornPressure+=dt;v.responding=v.hornPressure>=.5;}
  }
  private updateTraffic(dt:number){
    const crossingBodies=this.junctions.vehicles.filter(v=>v.active).map(v=>crossingBody(v,this.junctions.state(v.junctionId!).record));
    const decisions=this.traffic.map(v=>{
      const direction=v.opposite?-1:1;
      const obstruction=parkedGap(v.s,v.x,v.length,v.width,v.opposite);
      let gap=obstruction,frontSpeed=Number.isFinite(obstruction)?0:v.cruise;
      for(const o of this.traffic){
        if(o===v||o.opposite!==v.opposite||Math.abs(o.x-v.x)>(v.width+o.width)/2+.5)continue;
        const d=(o.s-v.s)*direction-(o.length+v.length)/2;
        if(d>=-1&&d<gap){gap=d;frontSpeed=o.speed;}
      }
      if(!v.opposite&&Math.abs(this.x-v.x)<(1.8+v.width)/2+.4&&this.s>v.s){const d=this.s-v.s-(4.2+v.length)/2;if(d<gap){gap=d;frontSpeed=this.speed;}}
      // Merged junction vehicles participate in the same leader/follower rules.
      if(crossingBodies.length){const body=roadBody(v.s,v.x,v.length,v.width,v.opposite),tx=-Math.sin(body.yaw),tz=-Math.cos(body.yaw);for(const b of crossingBodies){if(Math.abs(body.y-b.y)>2.5||Math.cos(body.yaw-b.yaw)<.85)continue;const dx=b.x-body.x,dz=b.z-body.z,forward=dx*tx+dz*tz,lateral=Math.abs(-dx*tz+dz*tx);if(forward<=0||lateral>(v.width+b.width)/2+.15)continue;const d=forward-(v.length+b.length)/2;if(d<gap){gap=Math.max(0,d);frontSpeed=b.speed??0;}}}
      // Slow waves feel busy, but recover and never permanently seal the three lanes.
      const wave=(Math.sin(this.time*.15+v.s*.014)+1)*.5;
      const cruise=v.responding?v.cruise:v.cruise*(.65+.35*wave);
      const desired=Math.max(3, v.speed*1.15);
      let target=gap<desired?Math.max(0,frontSpeed+(gap-desired)*.7):cruise;
      if(gap<1.5)target=0;
      let stop=this.junctions.stopFor(v.s,v.speed,v.length,v.opposite,v.id);
      for(const {record:j} of this.junctions.states){const line=v.opposite?j.centre+j.halfConflict+9:j.stopLine,approach=(line-v.s)*direction-v.length/2;if(approach<0||approach>75)continue;const body=roadBody(v.s,v.x,v.length,v.width,v.opposite);if(Math.abs(body.y-j.elevation)>2.5)continue;const exit=j.centre+direction*(j.halfConflict+v.length+5);if(this.traffic.some(o=>o!==v&&o.opposite===v.opposite&&Math.abs(o.x-v.x)<(o.width+v.width)/2+.4&&Math.abs(o.s-exit)<(o.length+v.length)/2+3&&o.speed<2))stop=Math.min(stop,approach);}
      target=Math.min(target,Math.sqrt(2*4*Math.max(0,stop-.4)));
      if(crossingBodies.length){const current=roadBody(v.s,v.x,v.length,v.width,v.opposite),look=4+v.speed*v.speed/8;for(const b of crossingBodies){if(Math.cos(current.yaw-b.yaw)>.85)continue;if((current.x-b.x)**2+(current.z-b.z)**2>(look+15)**2)continue;if(overlaps(roadBody(v.s+direction*look/2,v.x,v.length+look,v.width,v.opposite),b,.15))target=0;}}
      target=Math.min(target,Math.sqrt(8*Math.max(0,obstruction-2)));
      return {v,target,front:gap,stop,obstruction};
    });
    // Stable priority and swept reservations prevent two cars claiming the same opening.
    const ordered=[...decisions].sort((a,b)=>Number(a.v.opposite)-Number(b.v.opposite)||(a.v.opposite?a.v.s-b.v.s:b.v.s-a.v.s)||a.v.id-b.v.id);
    for(const {v,target,front,stop,obstruction} of ordered){
      const lanes=laneCentresAt(v.s,v.opposite);v.targetLane=Math.min(v.targetLane,lanes.length-1);v.lane=Math.min(v.lane,lanes.length-1);
      v.changeTimer-=dt;
      if(!v.opposite&&(v.changeTimer<=0||v.responding||obstruction<80)&&stop>35&&(front<35||obstruction<80)&&Math.abs(v.x-lanes[v.targetLane])<.1){
        const candidates=[v.lane-1,v.lane+1].filter(l=>l>=0&&l<lanes.length).map(l=>({lane:l,gap:Math.min(150,parkedGap(v.s,lanes[l],v.length,v.width),...this.traffic.filter(o=>o!==v&&!o.opposite&&o.s>v.s&&Math.abs(o.x-lanes[l])<(o.width+v.width)/2+.8).map(o=>o.s-v.s-(o.length+v.length)/2))})).sort((a,b)=>b.gap-a.gap||a.lane-b.lane);
        for(const choice of candidates)if(choice.gap>front+4&&this.laneSafe(v,lanes[choice.lane],crossingBodies)){v.targetLane=choice.lane;break;}
        v.changeTimer=4+this.rng()*9;
      }
      const blocked=target<Math.max(2,v.speed+.25)&&v.targetLane===v.lane&&front<12||stop<12;
      if(v.responding&&blocked&&v.hornPressure>=4&&this.time>=v.gestureCooldown){v.gestureUntil=this.time+2;v.gestureCooldown=this.time+20;v.hornPressure=0;}
      v.braking=target<v.speed-.7;v.speed=Math.max(0,v.speed+Math.max(-7*dt,Math.min(2.2*dt,target-v.speed)));
      const oldX=v.x,oldS=v.s;let x=v.x+(lanes[v.targetLane]-v.x)*Math.min(1,dt*.8)*Math.min(1,Math.max(.22,v.speed));
      if(!v.opposite)x=Math.max(driveBounds(v.s,v.width/2+.1).left,Math.min(driveBounds(v.s,v.width/2+.1).right,x));
      const s=v.s+Math.min(v.speed*dt,stop,Math.max(0,front-.5))*(v.opposite?-1:1);
      const safe=(ns:number,nx:number)=>{let body:ReturnType<typeof roadBody>|undefined;const candidate=()=>body??(body=roadBody(ns,nx,v.length,v.width,v.opposite));return parkedClear(ns,nx,v.length,v.width,v.opposite,.2)&&!this.traffic.some(o=>o!==v&&Math.abs(o.s-ns)<(o.length+v.length)/2+4&&Math.abs(o.x-nx)<(o.width+v.width)/2+2&&overlaps(candidate(),roadBody(o.s,o.x,o.length,o.width,o.opposite),.12))&&!crossingBodies.some(o=>Math.abs((o.s??ns)-ns)<30&&overlaps(candidate(),o,.12));};
      if(safe(s,x)){v.s=s;v.x=x;}else if(safe(s,oldX)){v.s=s;v.x=oldX;}else{v.s=oldS;v.x=oldX;v.speed=0;v.braking=true;}
      if(Math.abs(v.x-lanes[v.targetLane])<.1)v.lane=v.targetLane;
      if(v.s<this.s-220)this.recycle(v,this.s+900,false);
      if(v.s>this.s+940)this.recycle(v,this.s-180,true);
    }
  }
  private laneSafe(v:Traffic,targetX:number,crossingBodies:ReturnType<typeof crossingBody>[]){
    const lo=Math.min(v.x,targetX)-v.width/2-.5,hi=Math.max(v.x,targetX)+v.width/2+.5;
    for(const o of this.traffic){if(o===v||o.opposite!==v.opposite)continue;const ox=laneCentresAt(o.s,o.opposite)[o.targetLane]??o.x;if(Math.max(o.x,ox)+o.width/2<lo||Math.min(o.x,ox)-o.width/2>hi)continue;
      const gap=Math.abs(o.s-v.s)-(o.length+v.length)/2,closing=o.s>v.s?Math.max(0,v.speed-o.speed):Math.max(0,o.speed-v.speed);
      const destination=Math.abs(o.x-targetX)<(o.width+v.width)/2+.5||Math.abs(ox-targetX)<(o.width+v.width)/2+.5;
      // A tightly queued follower in the lane being vacated must not veto an
      // escape into an empty lane. Destination traffic still reserves closing space.
      if(gap<(destination?Math.max(12,closing*3+7):.4))return false;
    }
    if(this.x+1>lo&&this.x-1<hi&&Math.abs(this.s-v.s)<Math.max(18,Math.abs(this.speed-v.speed)*3+7))return false;
    if(parkedBuses.some(b=>Math.abs(b.s-v.s)<30&&overlaps(roadBody(v.s,(v.x+targetX)/2,v.length,hi-lo,v.opposite),b.body,.25)))return false;
    return !crossingBodies.some(o=>{if(Math.abs((o.s??v.s)-v.s)>60)return false;const destination=roadBody(v.s,targetX,v.length+24,v.width,v.opposite),swept=roadBody(v.s,(v.x+targetX)/2,v.length,hi-lo,v.opposite);return overlaps(swept,o,.3)||overlaps(destination,o,.5);});
  }
  private recycle(v:Traffic,station:number,behind:boolean){
    const lanes=laneCentresAt(station,v.opposite);
    for(let j=0;j<lanes.length;j++){
      const lane=(v.lane+j)%lanes.length,x=lanes[lane];
      const clear=parkedClear(station,x,v.length,v.width,v.opposite,12)&&this.traffic.every(o=>o===v||o.opposite!==v.opposite||Math.abs(o.x-x)>2.8||Math.abs(o.s-station)>(o.length+v.length)/2+12);
      if(clear){this.npcHorns.recycle(v.id);v.s=station;v.lane=lane;v.targetLane=lane;v.x=x;v.speed=v.cruise*.7;v.passed=behind;v.hornPressure=0;v.responding=false;v.gestureUntil=0;v.gestureCooldown=0;this.contacts.delete('road:'+v.id);return;}
    }
    // Wait out of sight until a safe gap exists; never spawn overlapping a queue.
  }
}
