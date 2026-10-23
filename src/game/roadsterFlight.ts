// Adapted from eduardmur/tesla-roadster-simulator (MIT): quaternion integration,
// body-rate stabilisation and cold-gas lift/attitude-control concepts.
import {nearestStation,pose,roadHeight,ROUTE_LENGTH} from './route';

export type FlightState='GROUNDED'|'TAKEOFF'|'FLYING'|'LANDING'|'CRASHED'|'RECOVERING';
export type FlightCrashKind='hard-landing'|'side-landing'|'roof-landing'|'solid-impact'|'stuck'|'out-of-bounds'|'invalid';
export type V3=[number,number,number];
export type Quat=[number,number,number,number];

export interface FlightControls {lift:boolean;descend:boolean;pitchDown:boolean;pitchUp:boolean;rollLeft:boolean;rollRight:boolean;yawLeft:boolean;yawRight:boolean}
export interface FlightCrash {kind:FlightCrashKind;severity:number;speed:number;upDot:number}
export interface SafeGroundedTransform {s:number;x:number;position:V3;orientation:Quat;forward:V3;timestamp:number}
export interface FlightSnapshot {active:boolean;state:FlightState;fuel:number;position:V3;orientation:Quat;velocity:V3;angularVelocity:V3;altitude:number;thrust:number}

export const FLIGHT_CONFIG={
 gravity:9.81,liftAcceleration:18,forwardAcceleration:6,maxFuel:5,
 liftFuelPerSecond:.085,attitudeFuelPerSecond:.018,rechargePerSecond:.035,
 linearDrag:.055,angularDrag:1.7,maxRate:[1.7,1.25,2.15] as V3,
 rateGain:6,levelGain:3.1,touchdownSpeed:2.4,
 crashDelay:.7,recoveryDelay:.35,minWorldY:-40,maxWorldOffset:180,maxFallingTime:12,
};

const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const length=(v:V3)=>Math.hypot(...v);
const scale=(v:V3,s:number):V3=>[v[0]*s,v[1]*s,v[2]*s];
const add=(a:V3,b:V3):V3=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const cross=(a:V3,b:V3):V3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const normalize=(v:V3)=>{const n=length(v)||1;return scale(v,1/n);};
const finiteV3=(v:V3)=>v.every(Number.isFinite);
const finiteQuat=(q:Quat)=>q.every(Number.isFinite);
const multiply=(a:Quat,b:Quat):Quat=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
const quatNormalize=(q:Quat):Quat=>{const n=Math.hypot(...q)||1;return [q[0]/n,q[1]/n,q[2]/n,q[3]/n];};
const axisAngle=(axis:V3,angle:number):Quat=>{const n=normalize(axis),s=Math.sin(angle/2);return [n[0]*s,n[1]*s,n[2]*s,Math.cos(angle/2)];};
export const rotate=(q:Quat,v:V3):V3=>{const t=scale(cross([q[0],q[1],q[2]],v),2);return add(v,add(scale(t,q[3]),cross([q[0],q[1],q[2]],t)));};
const conjugate=(q:Quat):Quat=>[-q[0],-q[1],-q[2],q[3]];
const integrate=(q:Quat,w:V3,dt:number):Quat=>{const a=length(w)*dt;return a<1e-9?q:quatNormalize(multiply(q,axisAngle(w,a)));};
const yawQuat=(yaw:number):Quat=>[0,Math.sin(yaw/2),0,Math.cos(yaw/2)];

function safeTransform(s:number,x:number,timestamp:number):SafeGroundedTransform{
 const p=pose(s,x),orientation=yawQuat(p.yaw+Math.PI);
 return {s,x,position:[p.x,p.y+.46,p.z],orientation,forward:[p.tx,0,p.tz],timestamp};
}

export class RoadsterFlightController{
 active=false;
 state:FlightState='GROUNDED';
 fuel=FLIGHT_CONFIG.maxFuel;
 position:V3=[0,0,0];
 orientation:Quat=[0,0,0,1];
 velocity:V3=[0,0,0];
 angularVelocity:V3=[0,0,0];
 altitude=0;
 thrust=0;
 lastSafeGroundedTransform:SafeGroundedTransform=safeTransform(0,0,0);
 private stateTimer=0;
 private tippedContactTime=0;
 private fallingTime=0;

 reset(s:number,x:number){
  const safe=safeTransform(s,x,0);
  this.active=false;this.state='GROUNDED';this.fuel=FLIGHT_CONFIG.maxFuel;
  this.position=[...safe.position];this.orientation=[...safe.orientation];this.velocity=[0,0,0];this.angularVelocity=[0,0,0];
  this.altitude=0;this.thrust=0;this.stateTimer=0;this.tippedContactTime=0;this.fallingTime=0;this.lastSafeGroundedTransform=safe;
 }

 toggle(s:number,x:number,speed:number){
  if(this.state==='CRASHED'||this.state==='RECOVERING')return false;
  this.active=!this.active;
  if(this.active&&this.state==='GROUNDED'){
   const p=pose(s,x);this.position=[p.x,p.y+.46,p.z];this.orientation=yawQuat(p.yaw+Math.PI);this.velocity=[p.tx*speed,0,p.tz*speed];
  }
  return this.active;
 }

 beginTakeoff(s:number,x:number,speed:number){
  if(!this.active||this.state!=='GROUNDED'||this.fuel<=0)return false;
  const p=pose(s,x);this.position=[p.x,p.y+.46,p.z];this.orientation=yawQuat(p.yaw+Math.PI);this.velocity=[p.tx*speed,0,p.tz*speed];this.state='TAKEOFF';
  this.tippedContactTime=0;this.fallingTime=0;return true;
 }

 rememberSafeGrounded(s:number,x:number,timestamp:number){
  if(this.state!=='GROUNDED'||![s,x,timestamp].every(Number.isFinite))return;
  this.lastSafeGroundedTransform=safeTransform(s,x,timestamp);
 }

 crash(kind:FlightCrashKind,severity:number,speed=length(this.velocity),upDot=rotate(this.orientation,[0,1,0])[1]):FlightCrash|null{
  if(this.state==='CRASHED'||this.state==='RECOVERING'||this.state==='GROUNDED'&&kind!=='solid-impact')return null;
  const safe=this.lastSafeGroundedTransform;
  if(!finiteV3(this.position)||!finiteQuat(this.orientation)){
   this.position=[...safe.position];this.orientation=[...safe.orientation];
  }
  this.active=false;this.state='CRASHED';this.stateTimer=0;this.thrust=0;
  this.velocity=[0,0,0];this.angularVelocity=[0,0,0];this.tippedContactTime=0;this.fallingTime=0;
  return {kind,severity:clamp(severity,.15,1),speed:Number.isFinite(speed)?Math.max(0,speed):50,upDot:Number.isFinite(upDot)?upDot:-1};
 }

 advanceRecovery(dt:number):'waiting'|'recovering'|'complete'|null{
  if(this.state!=='CRASHED'&&this.state!=='RECOVERING')return null;
  this.stateTimer+=Math.max(0,dt);this.thrust=0;this.velocity=[0,0,0];this.angularVelocity=[0,0,0];
  if(this.state==='CRASHED'){
   if(this.stateTimer<FLIGHT_CONFIG.crashDelay)return 'waiting';
   this.state='RECOVERING';this.stateTimer=0;
   const safe=this.lastSafeGroundedTransform;this.position=[safe.position[0],safe.position[1]+.14,safe.position[2]];this.orientation=[...safe.orientation];this.altitude=.14;
   return 'recovering';
  }
  const safe=this.lastSafeGroundedTransform;this.position=[safe.position[0],safe.position[1]+.14,safe.position[2]];this.orientation=[...safe.orientation];
  if(this.stateTimer<FLIGHT_CONFIG.recoveryDelay)return 'recovering';
  this.state='GROUNDED';this.stateTimer=0;this.position=[...safe.position];this.altitude=0;this.active=false;
  return 'complete';
 }

 grounded(dt:number,stable:boolean,s?:number,x?:number,speed=0){
  if(this.state==='CRASHED'||this.state==='RECOVERING')return;
  this.state='GROUNDED';this.thrust=0;this.altitude=0;this.tippedContactTime=0;this.fallingTime=0;
  if(s!==undefined&&x!==undefined){const p=pose(s,x);this.position=[p.x,p.y+.46,p.z];this.orientation=yawQuat(p.yaw+Math.PI);this.velocity=[p.tx*speed,0,p.tz*speed];this.angularVelocity=[0,0,0];}
  if(stable)this.fuel=Math.min(FLIGHT_CONFIG.maxFuel,this.fuel+FLIGHT_CONFIG.rechargePerSecond*dt);
 }

 step(dt:number,c:FlightControls):FlightCrash|null{
  if(this.state==='CRASHED'||this.state==='RECOVERING'||this.state==='GROUNDED')return null;
  const cfg=FLIGHT_CONFIG;
  if(!finiteV3(this.position)||!finiteV3(this.velocity)||!finiteV3(this.angularVelocity)||!finiteQuat(this.orientation))return this.crash('invalid',1);
  if(this.position[1]<cfg.minWorldY)return this.crash('out-of-bounds',1);
  const near=nearestStation(this.position[0],this.position[2]);
  if(near.d>cfg.maxWorldOffset||near.s< -100||near.s>ROUTE_LENGTH+100)return this.crash('out-of-bounds',.9);

  const ground=roadHeight(near.s),up=rotate(this.orientation,[0,1,0]),forward=rotate(this.orientation,[0,0,1]);
  this.altitude=Math.max(0,this.position[1]-(ground+.46));
  const liftCommand=c.lift&&this.fuel>0?1:0,descend=c.descend ? .45 : 0;this.thrust=Math.max(0,liftCommand-descend);
  const pitch=Number(c.pitchDown)-Number(c.pitchUp),roll=Number(c.rollRight)-Number(c.rollLeft),yaw=Number(c.yawLeft)-Number(c.yawRight),manual=Math.abs(pitch)+Math.abs(roll)+Math.abs(yaw)>0;
  const worldUpBody=rotate(conjugate(this.orientation),[0,1,0]);
  const target:V3=[pitch*cfg.maxRate[0],yaw*cfg.maxRate[1],roll*cfg.maxRate[2]];
  if(!manual){
   target[0]=clamp(Math.atan2(worldUpBody[2],Math.max(.05,worldUpBody[1]))*cfg.levelGain,-cfg.maxRate[0],cfg.maxRate[0]);
   target[2]=clamp(-Math.atan2(worldUpBody[0],Math.max(.05,worldUpBody[1]))*cfg.levelGain,-cfg.maxRate[2],cfg.maxRate[2]);
  }
  const attitudeAuthority=this.fuel>0?1:0;
  for(let i=0;i<3;i++)this.angularVelocity[i]+=clamp((target[i]-this.angularVelocity[i])*cfg.rateGain*dt,-3*dt,3*dt)*attitudeAuthority;
  this.angularVelocity=scale(this.angularVelocity,Math.exp(-cfg.angularDrag*dt));this.orientation=integrate(this.orientation,this.angularVelocity,dt);

  let liftAccel=liftCommand*cfg.liftAcceleration;
  if(this.state==='LANDING'&&!c.descend&&this.velocity[1]<-cfg.touchdownSpeed&&up[1]>.35&&this.fuel>0)liftAccel=Math.max(liftAccel,Math.min(cfg.liftAcceleration,cfg.gravity+(-cfg.touchdownSpeed-this.velocity[1])*2.2));
  this.thrust=liftAccel/cfg.liftAcceleration;
  const forwardAccel=c.pitchDown&&this.fuel>0?cfg.forwardAcceleration:0;
  this.velocity[0]+=(up[0]*liftAccel+forward[0]*forwardAccel)*dt;
  this.velocity[1]+=(up[1]*liftAccel-cfg.gravity+forward[1]*forwardAccel)*dt;
  this.velocity[2]+=(up[2]*liftAccel+forward[2]*forwardAccel)*dt;
  this.velocity=scale(this.velocity,Math.exp(-cfg.linearDrag*dt));
  const contactVerticalSpeed=Math.max(0,-this.velocity[1]),contactSpeed=length(this.velocity);
  this.position=add(this.position,scale(this.velocity,dt));

  const attitudeUse=Math.min(1,(Math.abs(target[0])/cfg.maxRate[0]+Math.abs(target[1])/cfg.maxRate[1]+Math.abs(target[2])/cfg.maxRate[2])*.34);
  this.fuel=Math.max(0,this.fuel-dt*(liftAccel/cfg.liftAcceleration*cfg.liftFuelPerSecond+attitudeUse*cfg.attitudeFuelPerSecond));
  if(!finiteV3(this.position)||!finiteV3(this.velocity)||!finiteQuat(this.orientation))return this.crash('invalid',1,contactSpeed,-1);
  if(this.position[1]<cfg.minWorldY)return this.crash('out-of-bounds',1,contactSpeed,up[1]);

  const nextNear=nearestStation(this.position[0],this.position[2]);
  if(nextNear.d>cfg.maxWorldOffset||nextNear.s< -100||nextNear.s>ROUTE_LENGTH+100)return this.crash('out-of-bounds',.9,contactSpeed,up[1]);
  const nextGround=roadHeight(nextNear.s),landingUp=rotate(this.orientation,[0,1,0])[1],angularSpeed=length(this.angularVelocity);
  this.altitude=this.position[1]-(nextGround+.46);
  if(this.velocity[1]<-1&&this.altitude>1)this.fallingTime+=dt;else this.fallingTime=0;
  if(this.fallingTime>cfg.maxFallingTime)return this.crash('out-of-bounds',.8,contactSpeed,landingUp);
  if(this.state==='TAKEOFF'&&this.altitude>.18)this.state='FLYING';
  if(this.velocity[1]<-.25&&this.altitude<3)this.state='LANDING';

  const nearContact=this.altitude<=.28;
  if(nearContact&&landingUp<.48)this.tippedContactTime+=dt;else this.tippedContactTime=0;
  if(this.tippedContactTime>.75)return this.crash('stuck',clamp(.45+(1-landingUp)*.35+angularSpeed*.08,.45,1),contactSpeed,landingUp);

  if(this.altitude<=0&&this.velocity[1]<=0){
   this.position[1]=nextGround+.46;
   const roof=landingUp<-.12,side=landingUp<.48;
   const hard=contactVerticalSpeed>8.5;
   const violent=contactSpeed>24&&(contactVerticalSpeed>2.5||landingUp<.7);
   const meaningful=contactVerticalSpeed>1.25||contactSpeed>8||angularSpeed>1.25;
   if((roof&&meaningful)||(side&&meaningful)||hard||violent){
    const kind:FlightCrashKind=roof?'roof-landing':side?'side-landing':'hard-landing';
    const severity=clamp((contactVerticalSpeed-2)/12+(1-landingUp)*.48+angularSpeed*.08+(violent?.2:0),.2,1);
    return this.crash(kind,severity,contactSpeed,landingUp);
   }
   if(landingUp>.58){
    this.velocity[1]=0;this.angularVelocity=[0,0,0];this.state='GROUNDED';this.active=false;this.tippedContactTime=0;
   }else{
    this.velocity[1]=Math.abs(this.velocity[1])*.16;this.velocity[0]*=.45;this.velocity[2]*=.45;this.angularVelocity=scale(this.angularVelocity,.45);
   }
  }
  return null;
 }

 snapshot():FlightSnapshot{
  return {active:this.active,state:this.state,fuel:this.fuel/FLIGHT_CONFIG.maxFuel,position:[...this.position],orientation:[...this.orientation],velocity:[...this.velocity],angularVelocity:[...this.angularVelocity],altitude:Math.max(0,this.altitude),thrust:this.thrust};
 }
}
