// Adapted from eduardmur/tesla-roadster-simulator (MIT): quaternion integration,
// body-rate stabilisation and cold-gas lift/attitude-control concepts.
import {nearestStation,pose,roadHeight,ROUTE_LENGTH} from './route';
import {driveBounds} from '../survey/corridor';

export type FlightState='GROUNDED'|'TAKEOFF'|'FLYING'|'LANDING'|'CRASHED'|'RECOVERING';
export type StuntState='NONE'|'BACKFLIP'|'BACKFLIP_RECOVERY';
export type FlightCrashKind='hard-landing'|'side-landing'|'roof-landing'|'solid-impact'|'stuck'|'out-of-bounds'|'invalid';
export type V3=[number,number,number];
export type Quat=[number,number,number,number];

export interface FlightControls {lift:boolean;descend:boolean;forward:boolean;reverse:boolean;pitchDown:boolean;pitchUp:boolean;rollLeft:boolean;rollRight:boolean;yawLeft:boolean;yawRight:boolean}
export interface FlightCrash {kind:FlightCrashKind;severity:number;speed:number;upDot:number}
export interface SafeGroundedTransform {s:number;x:number;position:V3;orientation:Quat;forward:V3;timestamp:number}
export interface FlightSnapshot {active:boolean;state:FlightState;stunt:StuntState;backflipRotation:number;fuel:number;position:V3;orientation:Quat;velocity:V3;angularVelocity:V3;altitude:number;thrust:number;forwardThrust:number;landingAssist:number;touchdownBoost:number}

export const FLIGHT_CONFIG={
 gravity:9.81,liftAcceleration:18,forwardAcceleration:6,reverseAcceleration:4.5,maxFuel:5,
 liftFuelPerSecond:.085,forwardFuelPerSecond:.04,attitudeFuelPerSecond:.018,rechargePerSecond:.035,
 linearDrag:.055,quadraticHorizontalDrag:.003,hoverVelocityGain:1.35,angularDrag:1.7,maxRate:[1.7,1.25,2.15] as V3,
 rateGain:6,levelGain:3.1,touchdownSpeed:2.4,maxAltitude:30,
 crashDelay:.7,recoveryDelay:.35,minWorldY:-40,maxWorldOffset:180,maxFallingTime:12,
};

export const FLIGHT_ROAD_ASSIST_CONFIG={
 lookAhead:16,lookAheadPerSpeed:1.2,maxLookAhead:52,
 yawStrength:1.45,yawDamping:.22,maxYawRate:.78,
 bankStrength:.6,maxBank:Math.PI/15,bankDamping:4.2,
 pathStrength:1.05,maxLateralAcceleration:4.5,minPathSpeed:.75,
 manualBlend:.18,recoveryBlend:.35,landingYawReduction:.18,landingPathBoost:.2,
};

export const LANDING_ASSIST_CONFIG={
 height:5.5,fullHeight:1.1,maxDescentSpeed:12,maxAngularSpeed:3.4,minUprightness:.3,
 rotationStrength:4.8,rotationDamping:3.2,yawDamping:1.15,
 farDescentSpeed:2.25,touchdownDescentSpeed:.65,verticalGain:2.8,
 touchdownMaxSpeed:3.2,touchdownMinUprightness:.72,touchdownMaxAngularSpeed:1.3,
};

export const BACKFLIP_CONFIG={
 minClearance:7,targetRotation:Math.PI*2,targetAngularSpeed:3.2,
 torque:11,maxTorque:10,damping:1.1,recoveryStrength:4.5,recoveryDuration:.7,
 worldLiftBlend:.72,
};

const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const length=(v:V3)=>Math.hypot(...v);
const scale=(v:V3,s:number):V3=>[v[0]*s,v[1]*s,v[2]*s];
const add=(a:V3,b:V3):V3=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const cross=(a:V3,b:V3):V3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a:V3,b:V3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
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

function roadNormal(s:number):V3{
 const p=pose(s),sample=2,slope=(roadHeight(s+sample)-roadHeight(s-sample))/(sample*2);
 return normalize([-p.tx*slope,1,-p.tz*slope]);
}

function roadIsValid(s:number,offset:number){
 const bounds=driveBounds(s,.05);
 return offset>=bounds.left&&offset<=bounds.right;
}

function computeForwardThrust(c:FlightControls,fuel:number,landingAssist:number){
 if(fuel<=0)return 0;
 const command=c.forward?1:c.reverse?-FLIGHT_CONFIG.reverseAcceleration/FLIGHT_CONFIG.forwardAcceleration:0;
 return command*(1-landingAssist*.72);
}

function computeLiftAcceleration(c:FlightControls,translating:boolean,fuel:number,verticalSpeed:number,forwardVerticalAcceleration:number){
 if(fuel<=0)return 0;
 const command=clamp(Number(c.lift)-Number(c.descend)*.45,0,1);
 if(command>0)return command*FLIGHT_CONFIG.liftAcceleration;
 return translating?clamp(FLIGHT_CONFIG.gravity-forwardVerticalAcceleration-verticalSpeed*FLIGHT_CONFIG.hoverVelocityGain,0,FLIGHT_CONFIG.liftAcceleration*.72):0;
}

const pitchAngle=(forward:V3)=>Math.asin(clamp(forward[1],-1,1));
const horizontalDirection=(v:V3,fallback:V3):V3=>{const n=Math.hypot(v[0],v[2]);return n>.0001?[v[0]/n,0,v[2]/n]:fallback;};
const signedHorizontalAngle=(from:V3,to:V3)=>Math.atan2(from[2]*to[0]-from[0]*to[2],from[0]*to[0]+from[2]*to[2]);

function computeRoadGuidance(s:number,forward:V3,velocity:V3,angularVelocity:V3){
 const cfg=FLIGHT_ROAD_ASSIST_CONFIG,horizontalSpeed=Math.hypot(velocity[0],velocity[2]);
 const lookAhead=Math.min(cfg.maxLookAhead,cfg.lookAhead+horizontalSpeed*cfg.lookAheadPerSpeed);
 const station=clamp(s,0,ROUTE_LENGTH),current=pose(station),ahead=pose(Math.min(ROUTE_LENGTH,station+lookAhead));
 const routeDelta:V3=[ahead.x-current.x,0,ahead.z-current.z],routeFallback:V3=[current.tx,0,current.tz];
 const desiredForward=horizontalDirection(routeDelta,routeFallback),currentForward=horizontalDirection(forward,horizontalDirection(velocity,routeFallback));
 const velocityForward=horizontalDirection(velocity,currentForward),headingError=signedHorizontalAngle(currentForward,desiredForward);
 const pathError=signedHorizontalAngle(velocityForward,desiredForward),right:V3=[velocityForward[2],0,-velocityForward[0]];
 return {
  headingError,pathError,right,horizontalSpeed,
  yawRate:clamp(headingError*cfg.yawStrength-angularVelocity[1]*cfg.yawDamping,-cfg.maxYawRate,cfg.maxYawRate),
  targetBank:clamp(-headingError*cfg.bankStrength,-cfg.maxBank,cfg.maxBank),
  lateralAcceleration:horizontalSpeed>=cfg.minPathSpeed?clamp(pathError*cfg.pathStrength*horizontalSpeed,-cfg.maxLateralAcceleration,cfg.maxLateralAcceleration):0,
 };
}

export class RoadsterFlightController{
 active=true;
 state:FlightState='GROUNDED';
 fuel=FLIGHT_CONFIG.maxFuel;
 position:V3=[0,0,0];
 orientation:Quat=[0,0,0,1];
 velocity:V3=[0,0,0];
 angularVelocity:V3=[0,0,0];
 altitude=0;
 thrust=0;
 forwardThrust=0;
 landingAssist=0;
 touchdownBoost=0;
 stunt:StuntState='NONE';
 backflipRotation=0;
 lastSafeGroundedTransform:SafeGroundedTransform=safeTransform(0,0,0);
 private stateTimer=0;
 private stuntTimer=0;
 private tippedContactTime=0;
 private fallingTime=0;
 private heldPitch:number|null=null;

 reset(s:number,x:number){
  const safe=safeTransform(s,x,0);
  this.active=true;this.state='GROUNDED';this.fuel=FLIGHT_CONFIG.maxFuel;
  this.position=[...safe.position];this.orientation=[...safe.orientation];this.velocity=[0,0,0];this.angularVelocity=[0,0,0];
  this.altitude=0;this.thrust=0;this.forwardThrust=0;this.landingAssist=0;this.touchdownBoost=0;this.stunt='NONE';this.backflipRotation=0;this.stuntTimer=0;this.stateTimer=0;this.tippedContactTime=0;this.fallingTime=0;this.heldPitch=null;this.lastSafeGroundedTransform=safe;
 }

 beginTakeoff(s:number,x:number,speed:number){
  if(this.state!=='GROUNDED'||this.fuel<=0)return false;
  const p=pose(s,x);this.position=[p.x,p.y+.46,p.z];this.orientation=yawQuat(p.yaw+Math.PI);this.velocity=[p.tx*speed,0,p.tz*speed];this.state='TAKEOFF';
  this.tippedContactTime=0;this.fallingTime=0;this.heldPitch=null;return true;
 }

 rememberSafeGrounded(s:number,x:number,timestamp:number){
  if(this.state!=='GROUNDED'||![s,x,timestamp].every(Number.isFinite))return;
  this.lastSafeGroundedTransform=safeTransform(s,x,timestamp);
 }

 startBackflip(){
  if(this.stunt!=='NONE'||(this.state!=='TAKEOFF'&&this.state!=='FLYING')||this.altitude<BACKFLIP_CONFIG.minClearance||this.fuel<=0)return false;
  this.stunt='BACKFLIP';this.backflipRotation=0;this.stuntTimer=0;this.landingAssist=0;this.heldPitch=null;return true;
 }

 crash(kind:FlightCrashKind,severity:number,speed=length(this.velocity),upDot=rotate(this.orientation,[0,1,0])[1]):FlightCrash|null{
  if(this.state==='CRASHED'||this.state==='RECOVERING'||this.state==='GROUNDED'&&kind!=='solid-impact')return null;
  const safe=this.lastSafeGroundedTransform;
  if(!finiteV3(this.position)||!finiteQuat(this.orientation)){
   this.position=[...safe.position];this.orientation=[...safe.orientation];
  }
  this.active=false;this.state='CRASHED';this.stunt='NONE';this.backflipRotation=0;this.stuntTimer=0;this.stateTimer=0;this.thrust=0;this.forwardThrust=0;this.landingAssist=0;this.touchdownBoost=0;this.heldPitch=null;
  this.velocity=[0,0,0];this.angularVelocity=[0,0,0];this.tippedContactTime=0;this.fallingTime=0;
  return {kind,severity:clamp(severity,.15,1),speed:Number.isFinite(speed)?Math.max(0,speed):50,upDot:Number.isFinite(upDot)?upDot:-1};
 }

 advanceRecovery(dt:number):'waiting'|'recovering'|'complete'|null{
  if(this.state!=='CRASHED'&&this.state!=='RECOVERING')return null;
  this.stateTimer+=Math.max(0,dt);this.thrust=0;this.forwardThrust=0;this.landingAssist=0;this.touchdownBoost=0;this.velocity=[0,0,0];this.angularVelocity=[0,0,0];
  if(this.state==='CRASHED'){
   if(this.stateTimer<FLIGHT_CONFIG.crashDelay)return 'waiting';
   this.state='RECOVERING';this.stateTimer=0;
   const safe=this.lastSafeGroundedTransform;this.position=[safe.position[0],safe.position[1]+.14,safe.position[2]];this.orientation=[...safe.orientation];this.altitude=.14;
   return 'recovering';
  }
  const safe=this.lastSafeGroundedTransform;this.position=[safe.position[0],safe.position[1]+.14,safe.position[2]];this.orientation=[...safe.orientation];
  if(this.stateTimer<FLIGHT_CONFIG.recoveryDelay)return 'recovering';
  this.state='GROUNDED';this.stunt='NONE';this.backflipRotation=0;this.stateTimer=0;this.position=[...safe.position];this.altitude=0;this.active=true;
  return 'complete';
 }

 grounded(dt:number,stable:boolean,s?:number,x?:number,speed=0){
  if(this.state==='CRASHED'||this.state==='RECOVERING')return;
  this.active=true;this.state='GROUNDED';this.stunt='NONE';this.backflipRotation=0;this.thrust=0;this.forwardThrust=0;this.landingAssist=0;this.touchdownBoost=Math.max(0,this.touchdownBoost-dt*1.25);this.altitude=0;this.tippedContactTime=0;this.fallingTime=0;this.heldPitch=null;
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

  const ground=roadHeight(near.s),up=rotate(this.orientation,[0,1,0]),forward=rotate(this.orientation,[0,0,1]),normal=roadNormal(near.s);
  this.altitude=Math.max(0,this.position[1]-(ground+.46));
  const stunting=this.stunt==='BACKFLIP',translationRequested=c.forward||c.reverse;
  const pitch=stunting?0:Number(c.pitchDown)-Number(c.pitchUp),roll=Number(c.rollRight)-Number(c.rollLeft),yaw=Number(c.yawLeft)-Number(c.yawRight);
  const worldUpBody=rotate(conjugate(this.orientation),[0,1,0]);
  const guidance=computeRoadGuidance(near.s,forward,this.velocity,this.angularVelocity),manualTurning=roll!==0||yaw!==0;
  const stuntGuidance=stunting?0:this.stunt==='BACKFLIP_RECOVERY'?FLIGHT_ROAD_ASSIST_CONFIG.recoveryBlend:1;
  const guidanceWeight=(this.fuel>0?1:0)*stuntGuidance*(manualTurning?FLIGHT_ROAD_ASSIST_CONFIG.manualBlend:1);
  const target:V3=[pitch*cfg.maxRate[0],clamp(yaw*cfg.maxRate[1]+guidance.yawRate*guidanceWeight,-cfg.maxRate[1],cfg.maxRate[1]),roll*cfg.maxRate[2]];
  if(stunting)this.heldPitch=null;
  else if(pitch===0){
   if(translationRequested&&this.stunt==='NONE'){
    const currentPitch=pitchAngle(forward);if(this.heldPitch===null)this.heldPitch=currentPitch;
    target[0]=clamp((currentPitch-this.heldPitch)*cfg.levelGain,-cfg.maxRate[0],cfg.maxRate[0]);
   }else{this.heldPitch=null;target[0]=clamp(Math.atan2(worldUpBody[2],Math.max(.05,worldUpBody[1]))*cfg.levelGain,-cfg.maxRate[0],cfg.maxRate[0]);}
  }else this.heldPitch=null;
  if(roll===0&&!stunting){
   const currentRoll=Math.atan2(worldUpBody[0],Math.max(.05,worldUpBody[1])),targetBank=guidance.targetBank*guidanceWeight;
   target[2]=clamp((targetBank-currentRoll)*FLIGHT_ROAD_ASSIST_CONFIG.bankDamping,-cfg.maxRate[2],cfg.maxRate[2]);
  }
  const landing=LANDING_ASSIST_CONFIG,uprightness=dot(up,normal),angularSpeedBefore=length(this.angularVelocity),validRoad=roadIsValid(near.s,near.offset);
  const emergencyLanding=uprightness<=landing.minUprightness||this.velocity[1]<=-landing.maxDescentSpeed||angularSpeedBefore>=landing.maxAngularSpeed;
  const landingEligible=!stunting&&(this.state==='FLYING'||this.state==='LANDING')&&validRoad&&
   this.altitude<landing.height&&this.velocity[1]<=.15;
  if(landingEligible){
   const proximity=clamp((landing.height-this.altitude)/(landing.height-landing.fullHeight),0,1);
   this.landingAssist=Math.max(emergencyLanding ? .45 : 0,proximity*proximity*(3-2*proximity));
   const roadUpBody=rotate(conjugate(this.orientation),normal),inputWeight=1-this.landingAssist*.72;
   const levelX=clamp(Math.atan2(roadUpBody[2],Math.max(.05,roadUpBody[1]))*landing.rotationStrength,-cfg.maxRate[0],cfg.maxRate[0]);
   const levelZ=clamp(-Math.atan2(roadUpBody[0],Math.max(.05,roadUpBody[1]))*landing.rotationStrength,-cfg.maxRate[2],cfg.maxRate[2]);
   target[0]=target[0]*inputWeight+levelX*this.landingAssist;
   target[2]=target[2]*inputWeight+levelZ*this.landingAssist;
   target[1]*=1-this.landingAssist*FLIGHT_ROAD_ASSIST_CONFIG.landingYawReduction;
   this.angularVelocity[0]*=Math.exp(-landing.rotationDamping*this.landingAssist*dt);
   this.angularVelocity[1]*=Math.exp(-landing.yawDamping*this.landingAssist*dt);
   this.angularVelocity[2]*=Math.exp(-landing.rotationDamping*this.landingAssist*dt);
   this.state='LANDING';
  }else this.landingAssist=0;
  const attitudeAuthority=this.fuel>0?1:0,orientationBefore:[number,number,number,number]=[...this.orientation];
  for(let i=stunting?1:0;i<3;i++)this.angularVelocity[i]+=clamp((target[i]-this.angularVelocity[i])*cfg.rateGain*dt,-3*dt,3*dt)*attitudeAuthority;
  if(stunting&&this.fuel>0){
   const remaining=Math.max(0,BACKFLIP_CONFIG.targetRotation-this.backflipRotation),speedScale=clamp(remaining/.72,.24,1),desired=-BACKFLIP_CONFIG.targetAngularSpeed*speedScale;
   this.angularVelocity[0]+=clamp((desired-this.angularVelocity[0])*BACKFLIP_CONFIG.torque*dt,-BACKFLIP_CONFIG.maxTorque*dt,BACKFLIP_CONFIG.maxTorque*dt);
  }
  if(this.stunt==='BACKFLIP_RECOVERY'){
   this.stuntTimer+=dt;this.angularVelocity[0]*=Math.exp(-BACKFLIP_CONFIG.recoveryStrength*dt);this.angularVelocity[2]*=Math.exp(-BACKFLIP_CONFIG.recoveryStrength*.45*dt);
   if(this.stuntTimer>=BACKFLIP_CONFIG.recoveryDuration)this.stunt='NONE';
  }
  this.angularVelocity=scale(this.angularVelocity,Math.exp(-(stunting?BACKFLIP_CONFIG.damping:cfg.angularDrag)*dt));this.orientation=integrate(this.orientation,this.angularVelocity,dt);
  if(stunting){
   let delta=multiply(conjugate(orientationBefore),this.orientation);if(delta[3]<0)delta=[-delta[0],-delta[1],-delta[2],-delta[3]];
   this.backflipRotation+=Math.max(0,-2*Math.atan2(delta[0],delta[3]));
   if(this.backflipRotation>=BACKFLIP_CONFIG.targetRotation||(this.fuel<=0&&Math.abs(this.angularVelocity[0])<.2)){this.stunt='BACKFLIP_RECOVERY';this.stuntTimer=0;}
  }

  this.forwardThrust=computeForwardThrust(c,this.fuel,this.landingAssist);
  const forwardAccel=this.forwardThrust*cfg.forwardAcceleration;
  let liftAccel=computeLiftAcceleration(c,Math.abs(this.forwardThrust)>0,this.fuel,this.velocity[1],forward[1]*forwardAccel);
  if(this.landingAssist>0&&(this.fuel>0||emergencyLanding)){
   const targetDescent=-(landing.farDescentSpeed+(landing.touchdownDescentSpeed-landing.farDescentSpeed)*this.landingAssist);
   if(this.velocity[1]<targetDescent){
    const braking=cfg.gravity+(targetDescent-this.velocity[1])*landing.verticalGain;
    liftAccel=Math.max(liftAccel,Math.min(cfg.liftAcceleration,braking));
   }
   if(emergencyLanding)liftAccel=cfg.liftAcceleration;
  }
  this.thrust=liftAccel/cfg.liftAcceleration;
  const liftVector:V3=stunting?[up[0]*(1-BACKFLIP_CONFIG.worldLiftBlend),up[1]*(1-BACKFLIP_CONFIG.worldLiftBlend)+BACKFLIP_CONFIG.worldLiftBlend,up[2]*(1-BACKFLIP_CONFIG.worldLiftBlend)]:[0,1,0];
  this.velocity[0]+=(liftVector[0]*liftAccel+forward[0]*forwardAccel)*dt;
  this.velocity[1]+=(liftVector[1]*liftAccel-cfg.gravity+forward[1]*forwardAccel)*dt;
  this.velocity[2]+=(liftVector[2]*liftAccel+forward[2]*forwardAccel)*dt;
  // A bounded force-equivalent acceleration turns horizontal momentum without
  // pulling the car toward the centreline or changing altitude/pitch.
  const roadPathAcceleration=guidance.lateralAcceleration*guidanceWeight*(1+this.landingAssist*FLIGHT_ROAD_ASSIST_CONFIG.landingPathBoost);
  this.velocity[0]+=guidance.right[0]*roadPathAcceleration*dt;
  this.velocity[2]+=guidance.right[2]*roadPathAcceleration*dt;
  if(emergencyLanding&&this.landingAssist>0){
   const emergencyTarget=-(landing.farDescentSpeed+(landing.touchdownDescentSpeed-landing.farDescentSpeed)*this.landingAssist);
   if(this.velocity[1]<emergencyTarget)this.velocity[1]+=(emergencyTarget-this.velocity[1])*Math.min(1,dt*(5+this.landingAssist*24));
  }
  const horizontalSpeed=Math.hypot(this.velocity[0],this.velocity[2]),horizontalDamping=Math.exp(-(cfg.linearDrag+cfg.quadraticHorizontalDrag*horizontalSpeed)*dt),verticalDamping=Math.exp(-cfg.linearDrag*dt);
  this.velocity=[this.velocity[0]*horizontalDamping,this.velocity[1]*verticalDamping,this.velocity[2]*horizontalDamping];
  const contactVerticalSpeed=Math.max(0,-this.velocity[1]),contactSpeed=length(this.velocity);
  this.position=add(this.position,scale(this.velocity,dt));

  const attitudeUse=stunting?1:Math.min(1,(Math.abs(target[0])/cfg.maxRate[0]+Math.abs(target[1])/cfg.maxRate[1]+Math.abs(target[2])/cfg.maxRate[2])*.34);
  this.fuel=Math.max(0,this.fuel-dt*(liftAccel/cfg.liftAcceleration*cfg.liftFuelPerSecond+Math.abs(this.forwardThrust)*cfg.forwardFuelPerSecond+attitudeUse*cfg.attitudeFuelPerSecond));
  if(!finiteV3(this.position)||!finiteV3(this.velocity)||!finiteQuat(this.orientation))return this.crash('invalid',1,contactSpeed,-1);
  if(this.position[1]<cfg.minWorldY)return this.crash('out-of-bounds',1,contactSpeed,up[1]);

  const nextNear=nearestStation(this.position[0],this.position[2]);
  if(nextNear.d>cfg.maxWorldOffset||nextNear.s< -100||nextNear.s>ROUTE_LENGTH+100)return this.crash('out-of-bounds',.9,contactSpeed,up[1]);
  const nextGround=roadHeight(nextNear.s),nextNormal=roadNormal(nextNear.s),landingUp=dot(rotate(this.orientation,[0,1,0]),nextNormal),angularSpeed=length(this.angularVelocity);
  // Limit both position and upward momentum; held lift cannot accumulate velocity
  // against the ceiling. Downward velocity remains free for normal descent.
  const ceiling=nextGround+.46+cfg.maxAltitude;
  if(this.position[1]>ceiling){this.position[1]=ceiling;this.velocity[1]=Math.min(0,this.velocity[1]);}
  this.altitude=this.position[1]-(nextGround+.46);
  if(this.velocity[1]<-1&&this.altitude>1)this.fallingTime+=dt;else this.fallingTime=0;
  if(this.fallingTime>cfg.maxFallingTime)return this.crash('out-of-bounds',.8,contactSpeed,landingUp);
  if(this.state==='TAKEOFF'&&this.altitude>.18)this.state='FLYING';
  if(this.state==='LANDING'&&(this.velocity[1]>.6||this.altitude>landing.height+.3))this.state='FLYING';
  if(this.velocity[1]<-.25&&this.altitude<3)this.state='LANDING';

  const nearContact=this.altitude<=.28;
  if(nearContact&&landingUp<.48)this.tippedContactTime+=dt;else this.tippedContactTime=0;
  if(this.tippedContactTime>.75&&!roadIsValid(nextNear.s,nextNear.offset))return this.crash('stuck',clamp(.45+(1-landingUp)*.35+angularSpeed*.08,.45,1),contactSpeed,landingUp);

  if(this.altitude<=0&&this.velocity[1]<=0){
   this.position[1]=nextGround+.46;
   if(roadIsValid(nextNear.s,nextNear.offset)){
    const heading=rotate(this.orientation,[0,0,1]),horizontal=Math.hypot(heading[0],heading[2]);
    const fallback=pose(nextNear.s),yaw=horizontal>.001?Math.atan2(heading[0],heading[2]):fallback.yaw+Math.PI;
    this.orientation=yawQuat(yaw);this.velocity[1]=0;this.angularVelocity=[0,0,0];this.state='GROUNDED';this.stunt='NONE';this.backflipRotation=0;this.forwardThrust=0;this.heldPitch=null;this.active=true;
    this.landingAssist=0;this.touchdownBoost=1;this.tippedContactTime=0;return null;
   }
   const roof=landingUp<-.12,side=landingUp<.48;
   const hard=contactVerticalSpeed>8.5;
   const violent=contactSpeed>24&&(contactVerticalSpeed>2.5||landingUp<.7);
   const meaningful=contactVerticalSpeed>1.25||contactSpeed>8||angularSpeed>1.25;
   if((roof&&meaningful)||(side&&meaningful)||hard||violent){
    const kind:FlightCrashKind=roof?'roof-landing':side?'side-landing':'hard-landing';
    const severity=clamp((contactVerticalSpeed-2)/12+(1-landingUp)*.48+angularSpeed*.08+(violent?.2:0),.2,1);
    return this.crash(kind,severity,contactSpeed,landingUp);
   }
   const stableTouchdown=roadIsValid(nextNear.s,nextNear.offset)&&landingUp>landing.touchdownMinUprightness&&contactVerticalSpeed<=landing.touchdownMaxSpeed&&angularSpeed<=landing.touchdownMaxAngularSpeed;
   if(stableTouchdown){
    this.velocity[1]=0;this.angularVelocity=[this.angularVelocity[0]*.12,this.angularVelocity[1]*.5,this.angularVelocity[2]*.12];this.state='GROUNDED';this.stunt='NONE';this.backflipRotation=0;this.forwardThrust=0;this.heldPitch=null;this.active=true;this.landingAssist=0;this.tippedContactTime=0;
   }else{
    this.velocity[1]=Math.abs(this.velocity[1])*.16;this.velocity[0]*=.45;this.velocity[2]*=.45;this.angularVelocity=scale(this.angularVelocity,.45);
   }
  }
  return null;
 }

 snapshot():FlightSnapshot{
  return {active:this.active,state:this.state,stunt:this.stunt,backflipRotation:this.backflipRotation,fuel:this.fuel/FLIGHT_CONFIG.maxFuel,position:[...this.position],orientation:[...this.orientation],velocity:[...this.velocity],angularVelocity:[...this.angularVelocity],altitude:Math.max(0,this.altitude),thrust:this.thrust,forwardThrust:this.forwardThrust,landingAssist:this.landingAssist,touchdownBoost:this.touchdownBoost};
 }
}
