import {isWeaver,ensureWeave,resetWeave,trafficBody,lateralHalf,longitudinalHalf,reservedX,chooseWeave,weaveStep,playerCutInSafe,type WeaveState} from './weaving';
import {RoadResponse,sampleSurface,approachingSurfaceLimit,type Suspension} from './roadConditions';
import {parkedBuses,parkedClear,parkedGap} from './parkedBuses';
import {NPCHornSystem,type NPCHornEvent,type HornActor} from './npcHorns';
import {collisionDamage,type ImpactEvent} from './impact';
import {TrafficOverview,type TrafficSection} from './trafficMap';
import {JunctionSystem,roadBody,crossingBody,overlaps} from './junctions';
import {ROUTE_LENGTH,nearestStation,pose,roadHeight} from './route';
import {driveBounds,laneCentresAt,ROAD_WORK} from '../survey/corridor';
import {TRAFFIC_CONFIG,TRAFFIC_COUNT} from '../data/traffic';
import {RoadsterFlightController,rotate,type FlightCrash,type FlightSnapshot,type V3} from './roadsterFlight';
import {buildings} from '../survey/records';
import {contains} from '../survey/geometry';
import type {Point} from '../survey/types';
export type VehicleKind='car'|'cab'|'auto'|'bike'|'bus'|'truck';
export type Phase='ready'|'driving'|'paused'|'looping'|'ended';
export interface Input {throttle:boolean;brake:boolean;left:boolean;right:boolean;horn:boolean;ascend?:boolean;descend?:boolean;yawLeft?:boolean;yawRight?:boolean}
export const emptyInput=():Input=>({throttle:false,brake:false,left:false,right:false,horn:false,ascend:false,descend:false,yawLeft:false,yawRight:false});
export interface Traffic {weave?:WeaveState;id:number;s:number;x:number;lane:number;targetLane:number;speed:number;cruise:number;kind:VehicleKind;length:number;width:number;opposite:boolean;braking:boolean;changeTimer:number;passed:boolean;color:number;hornPressure:number;gestureUntil:number;gestureCooldown:number;responding:boolean}
export interface Snapshot {phase:Phase;s:number;x:number;speed:number;health:number;distance:number;lap:number;collisions:number;overtakes:number;time:number;steer:number;impact:number;impactEvent:ImpactEvent|null;trafficSections:TrafficSection[];npcHorns:NPCHornEvent[];fade:number;surface:Suspension;flight:FlightSnapshot}
export const DIMENSIONS:Record<VehicleKind,[number,number]>={car:[4.3,1.85],cab:[4.2,1.8],auto:[2.7,1.5],bike:[2.05,.7],bus:[10.8,2.6],truck:[8.0,2.5]};
interface FlightCollision {obstacle:string;severity:number;safePosition:V3;direction:{x:number;z:number}}
const CHASSIS_LENGTH=4.34,CHASSIS_WIDTH=2,CHASSIS_HALF_HEIGHT=.58;
const distanceToSegmentSquared=(p:Point,a:Point,b:Point)=>{const dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz||1,t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/l)),x=a[0]+dx*t,z=a[1]+dz*t;return (p[0]-x)**2+(p[1]-z)**2;};
function footprintHit(point:Point,polygon:Point[],radius:number){if(contains(point,polygon))return true;for(let i=1;i<polygon.length;i++)if(distanceToSegmentSquared(point,polygon[i-1],polygon[i])<=radius*radius)return true;return false;}
const vehicleHeight=(kind:VehicleKind)=>kind==='bus'||kind==='truck'?3.45:kind==='auto'?1.8:kind==='bike'?1.5:1.7;
function random(seed:number){let a=seed;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
export class Simulation {
  flight=new RoadsterFlightController();
  visibleHornActors:readonly number[]=[];roadResponse=new RoadResponse();npcHorns:NPCHornSystem;private hornStep=0;
  phase:Phase='ready';s=0;x=laneCentresAt(0)[0];speed=0;health=100;distance=0;lap=1;collisions=0;overtakes=0;time=0;steer=0;impact=0;fade=0;
  impactEvent:ImpactEvent|null=null;private impactId=0;private contacts=new Map<string,number>();private frameContacts=new Set<string>();private hornTarget:number|null=null;private hornGap=0;private overview=new TrafficOverview();
  junctions=new JunctionSystem();traffic:Traffic[]=[];private seed:number;private rng:()=>number;private cooldown=0;private loopTimer=0;private loopReset=false;private resumePhase:Phase='driving';
  constructor(seed=TRAFFIC_CONFIG.seed){this.seed=seed;this.npcHorns=new NPCHornSystem(seed);this.rng=random(seed);this.populate();this.flight.reset(this.s,this.x);}
  populate(){
    this.npcHorns.reset();this.visibleHornActors=[];this.hornStep=0;
    const r=this.rng; const kinds:VehicleKind[]=['car','car','cab','auto','bike','car','bus','bike','truck','auto'];
    this.traffic=Array.from({length:TRAFFIC_COUNT},(_,id)=>{
      const opposite=id>=TRAFFIC_CONFIG.sameDirection;const n=opposite?id-TRAFFIC_CONFIG.sameDirection:id;const lane=n%laneCentresAt(22+Math.floor(n/3)*(opposite?TRAFFIC_CONFIG.opposingSpacing:TRAFFIC_CONFIG.sameSpacing),opposite).length;const kind=kinds[Math.floor(r()*kinds.length)];
      const [length,width]=DIMENSIONS[kind];const cruise=kind==='bike'?10+r()*5:kind==='bus'||kind==='truck'?6+r()*4:7+r()*7;
      return {id,s:22+Math.floor(n/3)*(opposite?TRAFFIC_CONFIG.opposingSpacing:TRAFFIC_CONFIG.sameSpacing)+lane*9+r()*8,x:laneCentresAt(22+Math.floor(n/3)*(opposite?TRAFFIC_CONFIG.opposingSpacing:TRAFFIC_CONFIG.sameSpacing)+lane*9,opposite)[lane]??0,lane,targetLane:lane,speed:cruise*.7,cruise,kind,length,width,opposite,braking:false,changeTimer:3+r()*14,passed:false,color:Math.floor(r()*7),hornPressure:0,gestureUntil:0,gestureCooldown:0,responding:false};
    });
    this.clearParkedSpawns();this.resetWeaving();
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
  resetWeaving(){for(const v of this.traffic)resetWeave(v,this.seed);}
  start(){if(this.phase==='ready')this.phase='driving';}
  pause(){if(this.phase==='driving'||this.phase==='looping'){this.resumePhase=this.phase;this.phase='paused';}}
  resume(){if(this.phase==='paused')this.phase=this.resumePhase;}
  restart(){this.roadResponse.reset();this.s=0;this.x=laneCentresAt(0)[0];this.speed=0;this.health=100;this.distance=0;this.lap=1;this.collisions=0;this.overtakes=0;this.time=0;this.steer=0;this.impact=0;this.fade=0;this.cooldown=0;this.contacts.clear();this.impactEvent=null;this.overview.reset();this.hornTarget=null;this.hornGap=0;this.rng=random(++this.seed);this.populate();this.junctions.reset();this.flight.reset(this.s,this.x);this.phase='driving';}
  toggleFlightMode(){return this.flight.toggle(this.s,this.x,this.speed);}
  snapshot():Snapshot{return {phase:this.phase,s:this.s,x:this.x,speed:this.speed,health:this.health,distance:this.distance,lap:this.lap,collisions:this.collisions,overtakes:this.overtakes,time:this.time,steer:this.steer,impact:this.impact,impactEvent:this.impactEvent,trafficSections:this.overview.sections,npcHorns:this.npcHorns.events,fade:this.fade,surface:{...this.roadResponse.state},flight:this.flight.snapshot()};}
  update(dt:number,input:Input){
    dt=Math.min(dt,.05);if(dt<=0)return;
    if(this.phase==='looping'){
      this.roadResponse.reset();
      this.impactEvent=null;this.impact=0;this.contacts.clear();this.npcHorns.reset();this.visibleHornActors=[];this.hornStep=0;
      this.loopTimer+=dt;this.fade=this.loopTimer<.65?this.loopTimer/.65:Math.max(0,1-(this.loopTimer-.65)/.65);
      if(this.loopTimer>=.65&&!this.loopReset){this.s=0;this.x=laneCentresAt(0)[0];this.speed=Math.min(this.speed,8);this.lap++;this.hornTarget=null;this.hornGap=0;this.overview.reset();this.populate();this.junctions.reset();this.loopReset=true;}
      if(this.loopTimer>=1.3){this.phase='driving';this.fade=0;}
      return;
    }
    if(this.phase!=='driving')return;
    this.time+=dt;this.cooldown=Math.max(0,this.cooldown-dt);this.impact=this.impactEvent?Math.max(0,1-(this.time-this.impactEvent.time)/.6)*this.impactEvent.severity:0;this.frameContacts.clear();
    if(this.flight.state==='CRASHED'||this.flight.state==='RECOVERING'){
      const recovery=this.flight.advanceRecovery(dt),safe=this.flight.lastSafeGroundedTransform;
      if(recovery==='recovering'||recovery==='complete'){this.s=safe.s;this.x=safe.x;}
      this.speed=0;this.steer=0;this.roadResponse.reset();this.updateFlightWorld(dt);this.distance=Math.max(this.distance,(this.lap-1)*ROUTE_LENGTH+this.s);
      if(this.health<=0){this.health=0;this.phase='ended';}return;
    }
    if(this.flight.active&&this.flight.state==='GROUNDED'&&input.ascend)this.flight.beginTakeoff(this.s,this.x,this.speed);
    if(this.flight.state!=='GROUNDED'){
      const previous:[number,number,number]=[...this.flight.position];
      let crash=this.flight.step(dt,{lift:!!input.ascend,descend:!!input.descend,pitchDown:input.throttle,pitchUp:input.brake,rollLeft:input.left,rollRight:input.right,yawLeft:!!input.yawLeft,yawRight:!!input.yawRight});
      let crashDirection={x:0,z:1},obstacle=crash?`flight:${crash.kind}`:'';
      if(!crash){
        const moving=this.flight.snapshot(),collision=this.flightCollision(previous,moving.position,moving.orientation,moving.velocity);
        if(collision){this.flight.position=[...collision.safePosition];crash=this.flight.crash('solid-impact',collision.severity,Math.hypot(...moving.velocity));crashDirection=collision.direction;obstacle=collision.obstacle;}
      }
      if(crash)this.applyFlightCrash(crash,obstacle,crashDirection);
      const f=this.flight.snapshot(),nearest=nearestStation(f.position[0],f.position[2]);this.s=Math.max(0,Math.min(ROUTE_LENGTH,nearest.s));this.x=nearest.offset;const p=pose(this.s);this.speed=f.state==='GROUNDED'?Math.max(0,f.velocity[0]*p.tx+f.velocity[2]*p.tz):f.state==='CRASHED'||f.state==='RECOVERING'?0:Math.hypot(...f.velocity);this.steer=0;this.roadResponse.reset();
      this.updateFlightWorld(dt);this.distance=Math.max(this.distance,(this.lap-1)*ROUTE_LENGTH+this.s);if(this.health<=0){this.health=0;this.phase='ended';this.speed=0;}return;
    }
    const previousS=this.s,previousX=this.x;
    const target=(Number(input.right)-Number(input.left));this.steer+=(target-this.steer)*Math.min(1,dt*7);
    let acceleration=input.brake?-10.5:input.throttle?4.0-this.speed*.075:-(.4+this.speed*.024);
    const surface=sampleSurface(this.s,this.x);
    if(!input.brake&&this.speed>surface.limit)acceleration=-Math.min(3,1+(this.speed-surface.limit)*.7);
    else if(!input.brake&&acceleration>0)acceleration=Math.min(acceleration,Math.max(0,(surface.limit-this.speed)/dt));
    this.speed=Math.max(0,Math.min(25,this.speed+acceleration*dt));
    this.x+=this.steer*Math.min(4.7,this.speed*.38)*dt;
    const {left:leftLimit,right:rightLimit}=driveBounds(this.s);
    if(this.x<leftLimit||this.x>rightLimit){this.x=Math.max(leftLimit,Math.min(rightLimit,this.x));this.contact(this.x<=leftLimit?'curb:left':'curb:right',3+this.speed*.35,this.speed,{x:this.x<=leftLimit?-1:1,z:0},this.speed>1);this.speed*=Math.max(0,1-dt*2);}
    this.junctions.tick(dt,this.s,[...parkedBuses.map(b=>b.body),{...roadBody(this.s,this.x,4.2,1.8,false,this.speed),player:true},...this.traffic.filter(v=>this.junctions.states.some(j=>Math.abs(j.record.centre-v.s)<45)||this.junctions.vehicles.some(c=>c.active&&c.d>10&&Math.abs(this.junctions.state(c.junctionId!).record.centre+c.d-v.s)<50)).map(v=>trafficBody(v))],approachingSurfaceLimit);
    this.updateHorn(dt,input.horn);this.updateTraffic(dt);
    const travel=Math.min(this.speed*dt,ROUTE_LENGTH-this.s);this.s+=travel;
    for(const v of this.traffic){
      if(v.opposite)continue;
      if(isWeaver(v)?Math.abs(v.s-this.s)<15&&overlaps(roadBody(this.s,this.x,4.2,1.8),trafficBody(v)):Math.abs(v.s-this.s)<(v.length+4.2)/2&&Math.abs(v.x-this.x)<(v.width+1.8)/2){
        const relative=Math.abs(this.speed-v.speed);this.contact('road:'+v.id,5+relative*2.1,relative,{x:Math.max(-1,Math.min(1,(v.x-this.x)/2)),z:v.s>=this.s?1:-1},relative>.25||this.speed>.5);
        if(isWeaver(v)){this.s=previousS;this.x=previousX;this.speed=Math.min(this.speed,v.speed*.68);}
        else if(v.s>=this.s){this.s=Math.max(0,v.s-(v.length+4.2)/2-.03);this.speed=Math.min(this.speed,v.speed*.68);}
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
    for(const v of this.traffic)if(!v.opposite&&Math.abs(v.s-this.s)<15&&overlaps(roadBody(this.s,this.x,4.2,1.8),trafficBody(v),.2))this.frameContacts.add('road:'+v.id);
    for(const v of this.junctions.vehicles)if(v.active&&overlaps(roadBody(this.s,this.x,4.2,1.8),crossingBody(v,this.junctions.state(v.junctionId!).record),.2))this.frameContacts.add('cross:'+v.id);
    if(this.x<=leftLimit+.04)this.frameContacts.add('curb:left');if(this.x>=rightLimit-.04)this.frameContacts.add('curb:right');
    for(const [key,last] of this.contacts)if(this.frameContacts.has(key))this.contacts.set(key,this.time);else if(this.time-last>=.3)this.contacts.delete(key);
    this.overview.update(dt,this.s,[...parkedBuses,...this.traffic.filter(v=>!v.opposite),...this.junctions.vehicles.filter(v=>v.active&&v.d>35&&this.junctions.state(v.junctionId!).record.layout==='right-branch').map(v=>({s:crossingBody(v,this.junctions.state(v.junctionId!).record).s!,speed:v.speed}))]);
    this.hornStep+=dt;if(this.hornStep>=.1){
      const p=pose(this.s,this.x);const actors:HornActor[]=this.traffic.filter(v=>Math.abs(v.s-this.s)<160).map(v=>({...trafficBody(v),s:v.s,speed:v.speed,id:v.id,kind:v.kind,lateral:v.x,opposite:v.opposite,width:lateralHalf(v)*2,length:longitudinalHalf(v)*2}));
      parkedBuses.forEach((b,i)=>{if(Math.abs(b.s-this.s)<160)actors.push({...b.body,id:2000+i,kind:'bus',s:b.s,speed:0,lateral:b.x,opposite:false,silent:true});});
      for(const v of this.junctions.vehicles)if(v.active){const body=crossingBody(v,this.junctions.state(v.junctionId!).record),q=pose(body.s!);actors.push({...body,id:1000+v.id,kind:v.kind,s:body.s!,speed:v.speed,lateral:(body.x-q.x)*q.rx+(body.z-q.z)*q.rz,opposite:false});}
      this.npcHorns.update(this.hornStep,this.time,{...p,s:this.s,lateral:this.x,speed:this.speed},actors,this.junctions.states.map(j=>({s:j.record.stopLine,y:j.record.elevation,red:j.orr!=='green'})),this.visibleHornActors);this.hornStep=0;
    }
    this.roadResponse.update(dt,previousS,previousX,this.s,this.x,this.speed);
    this.flight.grounded(dt,this.speed<.5,this.s,this.x,this.speed);
    if(this.frameContacts.size===0&&this.x>=leftLimit&&this.x<=rightLimit&&Number.isFinite(this.s)&&Number.isFinite(this.x)&&Number.isFinite(this.speed))this.flight.rememberSafeGrounded(this.s,this.x,this.time);
    this.distance=Math.max(this.distance,(this.lap-1)*ROUTE_LENGTH+this.s);
    if(this.health<=0){this.health=0;this.phase='ended';this.speed=0;}
    else if(this.s>=ROUTE_LENGTH-0.001){this.phase='looping';this.loopTimer=0;this.loopReset=false;}
  }
  private updateFlightWorld(dt:number){
    this.junctions.tick(dt,this.s,[...parkedBuses.map(b=>b.body),...this.traffic.filter(v=>Math.abs(v.s-this.s)<150).map(v=>trafficBody(v))],approachingSurfaceLimit);
    this.updateTraffic(dt,false);
    this.overview.update(dt,this.s,this.traffic.filter(v=>!v.opposite).map(v=>({s:v.s,speed:v.speed})));
  }
  private applyFlightCrash(crash:FlightCrash,obstacle:string,direction:{x:number;z:number}){
    const damage=collisionDamage(8+crash.severity*30);
    this.health=Math.max(0,Math.min(100,this.health-damage));this.collisions++;this.cooldown=2;
    this.impactEvent={id:++this.impactId,obstacle:obstacle||`flight:${crash.kind}`,time:this.time,severity:crash.severity,direction};this.impact=crash.severity;
  }
  private flightCollision(from:V3,to:V3,orientation:FlightSnapshot['orientation'],velocity:V3):FlightCollision|null{
    if(![...from,...to,...orientation,...velocity].every(Number.isFinite))return null;
    // Deterministic CCD equivalent: test the complete motion segment in sub-metre increments
    // before committing it, using a chassis box that matches the procedural Roadster body.
    const forward=rotate(orientation,[0,0,1]),yaw=Math.atan2(forward[0],forward[2]),travel=Math.hypot(to[0]-from[0],to[1]-from[1],to[2]-from[2]);
    const steps=Math.max(1,Math.ceil(travel/.55)),horizontalSpeed=Math.hypot(velocity[0],velocity[2]),speed=Math.hypot(...velocity),direction=horizontalSpeed>.01?{x:velocity[0]/horizontalSpeed,z:velocity[2]/horizontalSpeed}:{x:0,z:1};
    const dynamic=[
      ...this.traffic.map(v=>({id:`flight-traffic:${v.id}`,body:trafficBody(v),height:vehicleHeight(v.kind),speed:v.speed})),
      ...parkedBuses.map(b=>({id:`flight-${b.id}`,body:b.body,height:3.45,speed:0})),
      ...this.junctions.vehicles.filter(v=>v.active).map(v=>({id:`flight-cross:${v.id}`,body:crossingBody(v,this.junctions.state(v.junctionId!).record),height:vehicleHeight(v.kind),speed:v.speed})),
    ];
    let safePosition:[number,number,number]=[...from];
    for(let i=0;i<=steps;i++){
      const t=i/steps,sample:[number,number,number]=[from[0]+(to[0]-from[0])*t,from[1]+(to[1]-from[1])*t,from[2]+(to[2]-from[2])*t];
      const near=nearestStation(sample[0],sample[2]),bottom=sample[1]-CHASSIS_HALF_HEIGHT,top=sample[1]+CHASSIS_HALF_HEIGHT;
      if(near.s>=ROAD_WORK.from-1.5&&near.s<=ROAD_WORK.to+1.5&&Math.abs(near.offset-ROAD_WORK.offset)<CHASSIS_WIDTH/2+ROAD_WORK.barrierWidth/2&&bottom<roadHeight(near.s)+ROAD_WORK.height&&top>roadHeight(near.s))return {obstacle:'flight:construction-barrier',severity:Math.min(1,.3+speed/28),safePosition,direction};

      const sin=Math.sin(yaw),cos=Math.cos(yaw),rightX=cos,rightZ=-sin,forwardX=sin,forwardZ=cos;
      const probes:Point[]=[[sample[0],sample[2]]];
      for(const longitudinal of [-CHASSIS_LENGTH/2,CHASSIS_LENGTH/2])for(const lateral of [-CHASSIS_WIDTH/2,CHASSIS_WIDTH/2])probes.push([sample[0]+forwardX*longitudinal+rightX*lateral,sample[2]+forwardZ*longitudinal+rightZ*lateral]);
      for(const building of buildings){
        if(near.s<building.from-8||near.s>building.to+8)continue;
        const height=Number(building.attributes.height.value??building.model.height);if(bottom>height||top<0)continue;
        const polygons=building.geometry.polygons?.length?building.geometry.polygons:[building.geometry.coordinates],holes=building.geometry.holes??[];
        const hit=probes.some(point=>polygons.some(polygon=>footprintHit(point,polygon,.2))&&!holes.some(hole=>contains(point,hole)&&hole.every((p,index)=>index===0||distanceToSegmentSquared(point,hole[index-1],p)>.04)));
        if(hit)return {obstacle:`flight:${building.id}`,severity:Math.min(1,.35+speed/24),safePosition,direction};
      }

      for(const other of dynamic){
        if(Math.abs(other.body.x-sample[0])>15||Math.abs(other.body.z-sample[2])>15||bottom>other.body.y+other.height||top<other.body.y)continue;
        const chassis={x:sample[0],z:sample[2],y:other.body.y,yaw,length:CHASSIS_LENGTH,width:CHASSIS_WIDTH};
        if(overlaps(chassis,other.body,.08))return {obstacle:other.id,severity:Math.min(1,.3+Math.hypot(horizontalSpeed,other.speed)/26),safePosition,direction};
      }
      safePosition=sample;
    }
    return null;
  }
  private contact(obstacle:string,rawDamage:number,closingSpeed:number,direction:{x:number;z:number},moving=true){
    this.frameContacts.add(obstacle);if(this.contacts.has(obstacle)||!moving)return;this.contacts.set(obstacle,this.time);
    this.impactEvent={id:++this.impactId,obstacle,time:this.time,severity:Math.min(1,.18+closingSpeed/17),direction};this.impact=this.impactEvent.severity;
    if(this.cooldown>0)return;this.health=Math.max(0,Math.min(100,this.health-collisionDamage(rawDamage)));this.collisions++;this.cooldown=2;
  }
  private updateHorn(dt:number,horn:boolean){
    this.hornGap=horn?0:this.hornGap+dt;
    const target=this.traffic.filter(v=>!v.opposite&&['car','cab'].includes(v.kind)&&v.s>this.s&&v.s-this.s-(v.length+4.2)/2<=25&&Math.abs(v.x-this.x)<(v.width+1.8)/2+.35&&Math.abs(pose(v.s).y-pose(this.s).y)<2).sort((a,b)=>a.s-b.s)[0];
    const leader=parkedBuses.some(v=>v.s>this.s&&v.s<(target?.s??0)&&Math.abs(v.x-this.x)<(v.width+1.8)/2+.35)||this.traffic.some(v=>!v.opposite&&v.s>this.s&&v.s<(target?.s??0)&&Math.abs(v.x-this.x)<lateralHalf(v)+.9+.35);
    const id=leader?null:target?.id??null;
    if(id!==this.hornTarget||this.hornGap>.5){for(const v of this.traffic){v.hornPressure=0;v.responding=false;}this.hornTarget=id;}
    if(horn&&id!==null){const v=this.traffic.find(v=>v.id===id)!;v.hornPressure+=dt;v.responding=v.hornPressure>=.5;}
  }
  private updateTraffic(dt:number,includePlayer=true){
    for(const v of this.traffic)ensureWeave(v,this.seed);
    const player=includePlayer?{s:this.s,x:this.x,speed:this.speed,velocity:this.steer*Math.min(4.7,this.speed*.38)}:{s:-1e9,x:0,speed:0,velocity:0};
    const crossingBodies=this.junctions.vehicles.filter(v=>v.active).map(v=>crossingBody(v,this.junctions.state(v.junctionId!).record));
    const neighbourhood=new Map(this.traffic.map(v=>[v.id,this.traffic.filter(o=>Math.abs(o.s-v.s)<120)]));
    const decisions=this.traffic.map(v=>{
      const nearby=neighbourhood.get(v.id)!,half=lateralHalf(v);
      const direction=v.opposite?-1:1;
      const obstruction=parkedGap(v.s,v.x,v.length,v.width,v.opposite);
      let gap=obstruction,frontSpeed=Number.isFinite(obstruction)?0:v.cruise;
      for(const o of nearby){
        if(o===v||o.opposite!==v.opposite||Math.abs(o.x-v.x)>half+lateralHalf(o)+(isWeaver(v)?(v.kind==='bike'?.25:.4):.5))continue;
        const d=(o.s-v.s)*direction-longitudinalHalf(o)-longitudinalHalf(v);
        if(d>=-1&&d<gap){gap=d;frontSpeed=o.speed;}
      }
      if(includePlayer&&!v.opposite&&Math.abs(this.x-v.x)<(1.8+v.width)/2+.4&&this.s>v.s){const d=this.s-v.s-(4.2+v.length)/2;if(d<gap){gap=d;frontSpeed=this.speed;}}
      // Merged junction vehicles participate in the same leader/follower rules.
      if(crossingBodies.length){const body=trafficBody(v),tx=-Math.sin(body.yaw),tz=-Math.cos(body.yaw);for(const b of crossingBodies){if(Math.abs(body.y-b.y)>2.5||Math.cos(body.yaw-b.yaw)<.85)continue;const dx=b.x-body.x,dz=b.z-body.z,forward=dx*tx+dz*tz,lateral=Math.abs(-dx*tz+dz*tx);if(forward<=0||lateral>(v.width+b.width)/2+.15)continue;const d=forward-(v.length+b.length)/2;if(d<gap){gap=Math.max(0,d);frontSpeed=b.speed??0;}}}
      // Slow waves feel busy, but recover and never permanently seal the three lanes.
      const wave=(Math.sin(this.time*.15+v.s*.014)+1)*.5;
      const cruise=v.responding?v.cruise:v.cruise*(.65+.35*wave);
      // Anticipate a weaver approaching this corridor before its body reaches the lane.
      if(!isWeaver(v))for(const o of nearby){if(o===v||!isWeaver(o)||o.opposite!==v.opposite||(o.s-v.s)*direction<=0||Math.abs(o.s-v.s)>45)continue;
        const projected=o.x+(o.weave?.velocity??0)*.9;
        const toward=Math.min(o.x,projected)-v.width/2-lateralHalf(o);
        if(toward>v.x||Math.max(o.x,projected)+v.width/2+lateralHalf(o)<v.x)continue;
        const d=(o.s-v.s)*direction-longitudinalHalf(o)-longitudinalHalf(v);if(d<gap){gap=Math.max(0,d);frontSpeed=o.speed;}
      }
      const desired=isWeaver(v)?Math.max(v.kind==='auto'?3:2,v.speed*.65):Math.max(3, v.speed*1.15);
      let target=gap<desired?Math.max(0,frontSpeed+(gap-desired)*.7):cruise;
      if(gap<1.5)target=0;
      let stop=this.junctions.stopFor(v.s,v.speed,v.length,v.opposite,v.id);
      for(const {record:j} of this.junctions.states){const line=v.opposite?j.centre+j.halfConflict+9:j.stopLine,approach=(line-v.s)*direction-v.length/2;if(approach<0||approach>75)continue;const body=trafficBody(v);if(Math.abs(body.y-j.elevation)>2.5)continue;const exit=j.centre+direction*(j.halfConflict+v.length+5);if(this.traffic.some(o=>o!==v&&o.opposite===v.opposite&&Math.abs(o.x-v.x)<(o.width+v.width)/2+.4&&Math.abs(o.s-exit)<(o.length+v.length)/2+3&&o.speed<2))stop=Math.min(stop,approach);}
      target=Math.min(target,Math.sqrt(2*4*Math.max(0,stop-.4)));
      if(crossingBodies.length){const current=trafficBody(v),look=4+v.speed*v.speed/8;for(const b of crossingBodies){if(Math.cos(current.yaw-b.yaw)>.85)continue;if((current.x-b.x)**2+(current.z-b.z)**2>(look+15)**2)continue;if(overlaps(roadBody(v.s+direction*look/2,v.x,v.length+look,v.width,v.opposite),b,.15))target=0;}}
      target=Math.min(target,Math.sqrt(8*Math.max(0,obstruction-(isWeaver(v)?(v.kind==='auto'?4:3):2))),approachingSurfaceLimit(v.s,v.x,v.speed,v.width,v.length,v.opposite));
      return {v,target,front:gap,stop,obstruction};
    });
    // Stable priority and swept reservations prevent two cars claiming the same opening.
    const ordered=[...decisions].sort((a,b)=>Number(a.v.opposite)-Number(b.v.opposite)||(a.v.opposite?a.v.s-b.v.s:b.v.s-a.v.s)||a.v.id-b.v.id);
    for(const decision of ordered){
      let {v,target,front,stop,obstruction}=decision;
      const lanes=laneCentresAt(v.s,v.opposite);v.targetLane=Math.min(v.targetLane,lanes.length-1);v.lane=Math.min(v.lane,lanes.length-1);
      v.changeTimer-=dt;
      const discretionary=v.kind==='bus'&&v.changeTimer<=0&&v.speed>2&&
        !this.junctions.states.some(j=>Math.abs(j.record.centre-v.s)<65);
      const escape=!isWeaver(v)&&!v.opposite&&(front<35||obstruction<80);
      if((v.changeTimer<=0||v.responding||obstruction<80)&&stop>35&&(escape||discretionary)&&Math.abs(v.x-lanes[v.targetLane])<.1){
        const direction=v.opposite?-1:1;
        const candidates=[v.lane-1,v.lane+1].filter(l=>l>=0&&l<lanes.length).map(l=>({lane:l,gap:Math.min(150,parkedGap(v.s,lanes[l],v.length,v.width,v.opposite),...this.traffic.filter(o=>o!==v&&o.opposite===v.opposite&&(o.s-v.s)*direction>0&&Math.abs(o.x-lanes[l])<(o.width+v.width)/2+.8).map(o=>(o.s-v.s)*direction-(o.length+v.length)/2))}));
        if(escape)candidates.sort((a,b)=>b.gap-a.gap||a.lane-b.lane);
        else if(this.rng()<.5)candidates.reverse();
        for(const choice of candidates)if((escape?choice.gap>front+4:choice.gap>Math.max(24,v.speed*3))&&this.laneSafe(v,lanes[choice.lane],crossingBodies,includePlayer)){v.targetLane=choice.lane;break;}
        // Coaches wander less often than nimble autos and bikes; failed requests also wait.
        v.changeTimer=escape?4+this.rng()*9:(v.kind==='bus'?18:9)+this.rng()*16;
      }
      if(isWeaver(v)){
        const w=chooseWeave(v,neighbourhood.get(v.id)!,crossingBodies,player,stop,dt);front=Math.min(front,w.gap);
        target=Math.min(target,w.limit);
        // Crawl forward into an escape path; lateral movement is tied to forward travel.
        if(Math.abs(v.weave!.targetX-v.x)>.015&&front>.35&&stop>.8)target=Math.min(w.limit,Math.max(target,.8));
      }
      const blocked=target<Math.max(2,v.speed+.25)&&v.targetLane===v.lane&&front<12||stop<12;
      if(v.responding&&blocked&&v.hornPressure>=4&&this.time>=v.gestureCooldown){v.gestureUntil=this.time+2;v.gestureCooldown=this.time+20;v.hornPressure=0;}
      v.braking=target<v.speed-.7;v.speed=Math.max(0,v.speed+Math.max(-7*dt,Math.min(2.2*dt,target-v.speed)));
      const oldX=v.x,oldS=v.s;let x=v.x+(lanes[v.targetLane]-v.x)*Math.min(1,dt*.8)*Math.min(1,Math.max(.22,v.speed));
      if(!v.opposite)x=Math.max(driveBounds(v.s,v.width/2+.1).left,Math.min(driveBounds(v.s,v.width/2+.1).right,x));
      const travel=Math.min(v.speed*dt,stop,Math.max(0,front-(isWeaver(v)?.3:.5))),s=v.s+travel*(v.opposite?-1:1);
      const movement=isWeaver(v)?weaveStep(v,dt,travel):null;if(movement)x=movement.x;
      const safe=(ns:number,nx:number,heading=isWeaver(v)?movement?.heading??0:0)=>{
        const candidate=trafficBody(v,ns,nx,heading),steps=isWeaver(v)?3:1;
        if(isWeaver(v)&&Math.abs(nx-oldX)>.00001&&!playerCutInSafe(v,ns,nx,player))return false;
        for(let i=1;i<=steps;i++){
          const t=i/steps,b=i===steps?candidate:trafficBody(v,oldS+(ns-oldS)*t,oldX+(nx-oldX)*t,(v.weave?.heading??0)+(heading-(v.weave?.heading??0))*t);
          if(parkedBuses.some(o=>Math.abs(o.s-ns)<(o.length+v.length)/2+3&&overlaps(b,o.body,.2))||neighbourhood.get(v.id)!.some(o=>o!==v&&Math.abs(o.s-ns)<(o.length+v.length)/2+4&&Math.abs(o.x-nx)<(o.width+v.width)/2+2&&overlaps(b,trafficBody(o),.12))||crossingBodies.some(o=>Math.abs((o.s??ns)-ns)<30&&overlaps(b,o,.12)))return false;
        }return true;
      };
      if(safe(s,x)){v.s=s;v.x=x;if(movement){v.weave!.velocity=movement.velocity;v.weave!.heading=movement.heading;}}
      else if(safe(s,oldX,0)){v.s=s;v.x=oldX;if(v.weave){v.weave.velocity=0;v.weave.heading=0;v.weave.targetX=v.x;v.weave.timer=0;}}
      else{
        // At a bend a partially completed merge can lose its reserved space.
        // Retreat incrementally into the source lane instead of holding two lanes forever.
        const retreatX=oldX+(lanes[v.lane]-oldX)*Math.min(1,dt*.8)*.22;
        if(!isWeaver(v)&&v.targetLane!==v.lane&&(!includePlayer||!overlaps(roadBody(oldS,lanes[v.lane],v.length+12,v.width,v.opposite),roadBody(this.s,this.x,4.2,1.8),.4))&&safe(oldS,retreatX)){v.targetLane=v.lane;v.x=retreatX;v.changeTimer=4;}
        else v.x=oldX;
        v.s=oldS;v.speed=0;v.braking=true;if(v.weave){v.weave.velocity=0;v.weave.timer=0;v.weave.targetX=v.x;}
      }
      if(isWeaver(v)){v.lane=lanes.reduce((best,x,i)=>Math.abs(x-v.x)<Math.abs(lanes[best]-v.x)?i:best,0);v.targetLane=v.lane;v.weave!.lastS=v.s;v.weave!.lastX=v.x;}
      else if(Math.abs(v.x-lanes[v.targetLane])<.1)v.lane=v.targetLane;
      if(v.s<this.s-220)this.recycle(v,this.s+900,false);
      if(v.s>this.s+940)this.recycle(v,this.s-180,true);
    }
  }
  private laneSafe(v:Traffic,targetX:number,crossingBodies:ReturnType<typeof crossingBody>[],includePlayer=true){
    const lo=Math.min(v.x,targetX)-v.width/2-.5,hi=Math.max(v.x,targetX)+v.width/2+.5;
    for(const o of this.traffic){if(o===v||o.opposite!==v.opposite)continue;const ox=reservedX(o);if(Math.max(o.x,ox)+o.width/2<lo||Math.min(o.x,ox)-o.width/2>hi)continue;
      const gap=Math.abs(o.s-v.s)-(o.length+v.length)/2,closing=(o.s-v.s)*(v.opposite?-1:1)>0?Math.max(0,v.speed-o.speed):Math.max(0,o.speed-v.speed);
      const destination=Math.abs(o.x-targetX)<(o.width+v.width)/2+.5||Math.abs(ox-targetX)<(o.width+v.width)/2+.5;
      // A tightly queued follower in the lane being vacated must not veto an
      // escape into an empty lane. Destination traffic still reserves closing space.
      if(gap<(destination?Math.max(12,closing*3+7):.4))return false;
    }
    if(includePlayer&&!v.opposite&&this.x+1>lo&&this.x-1<hi&&Math.abs(this.s-v.s)<Math.max(18,Math.abs(this.speed-v.speed)*3+7))return false;
    if(parkedBuses.some(b=>Math.abs(b.s-v.s)<30&&overlaps(roadBody(v.s,(v.x+targetX)/2,v.length,hi-lo,v.opposite),b.body,.25)))return false;
    return !crossingBodies.some(o=>{if(Math.abs((o.s??v.s)-v.s)>60)return false;const destination=roadBody(v.s,targetX,v.length+24,v.width,v.opposite),swept=roadBody(v.s,(v.x+targetX)/2,v.length,hi-lo,v.opposite);return overlaps(swept,o,.3)||overlaps(destination,o,.5);});
  }
  private recycle(v:Traffic,station:number,behind:boolean){
    const lanes=laneCentresAt(station,v.opposite);
    for(let j=0;j<lanes.length;j++){
      const lane=(v.lane+j)%lanes.length,x=lanes[lane];
      const clear=parkedClear(station,x,v.length,v.width,v.opposite,12)&&this.traffic.every(o=>o===v||o.opposite!==v.opposite||Math.abs(o.x-x)>2.8||Math.abs(o.s-station)>(o.length+v.length)/2+12);
      if(clear){this.npcHorns.recycle(v.id);v.s=station;v.lane=lane;v.targetLane=lane;v.x=x;v.speed=v.cruise*.7;v.passed=behind;v.hornPressure=0;v.responding=false;v.gestureUntil=0;v.gestureCooldown=0;v.changeTimer=6+this.rng()*14;this.contacts.delete('road:'+v.id);resetWeave(v,this.seed);return;}
    }
    // Wait out of sight until a safe gap exists; never spawn overlapping a queue.
  }
}
