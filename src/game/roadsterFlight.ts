// Adapted from eduardmur/tesla-roadster-simulator (MIT): quaternion integration,
// body-rate stabilisation and cold-gas lift/attitude-control concepts.
import {nearestStation,pose,roadHeight} from './route';

export type FlightState='GROUNDED'|'TAKEOFF'|'FLYING'|'LANDING';
export type V3=[number,number,number];
export type Quat=[number,number,number,number];
export interface FlightControls {lift:boolean;descend:boolean;pitchDown:boolean;pitchUp:boolean;rollLeft:boolean;rollRight:boolean;yawLeft:boolean;yawRight:boolean}
export interface FlightSnapshot {active:boolean;state:FlightState;fuel:number;position:V3;orientation:Quat;velocity:V3;angularVelocity:V3;altitude:number;thrust:number}
export const FLIGHT_CONFIG={gravity:9.81,liftAcceleration:18,forwardAcceleration:6,maxFuel:5,liftFuelPerSecond:.085,attitudeFuelPerSecond:.018,rechargePerSecond:.035,linearDrag:.055,angularDrag:1.7,maxRate:[1.7,1.25,2.15] as V3,rateGain:6,levelGain:3.1,touchdownSpeed:2.4};
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const length=(v:V3)=>Math.hypot(...v);
const scale=(v:V3,s:number):V3=>[v[0]*s,v[1]*s,v[2]*s];
const add=(a:V3,b:V3):V3=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const cross=(a:V3,b:V3):V3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const normalize=(v:V3)=>{const n=length(v)||1;return scale(v,1/n);};
const multiply=(a:Quat,b:Quat):Quat=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
const quatNormalize=(q:Quat):Quat=>{const n=Math.hypot(...q)||1;return [q[0]/n,q[1]/n,q[2]/n,q[3]/n];};
const axisAngle=(axis:V3,angle:number):Quat=>{const n=normalize(axis),s=Math.sin(angle/2);return [n[0]*s,n[1]*s,n[2]*s,Math.cos(angle/2)];};
export const rotate=(q:Quat,v:V3):V3=>{const t=scale(cross([q[0],q[1],q[2]],v),2);return add(v,add(scale(t,q[3]),cross([q[0],q[1],q[2]],t)));};
const conjugate=(q:Quat):Quat=>[-q[0],-q[1],-q[2],q[3]];
const integrate=(q:Quat,w:V3,dt:number):Quat=>{const a=length(w)*dt;return a<1e-9?q:quatNormalize(multiply(q,axisAngle(w,a)));};
const yawQuat=(yaw:number):Quat=>[0,Math.sin(yaw/2),0,Math.cos(yaw/2)];

export class RoadsterFlightController{
 active=false;state:FlightState='GROUNDED';fuel=FLIGHT_CONFIG.maxFuel;position:V3=[0,0,0];orientation:Quat=[0,0,0,1];velocity:V3=[0,0,0];angularVelocity:V3=[0,0,0];altitude=0;thrust=0;
 reset(s:number,x:number){const p=pose(s,x);this.active=false;this.state='GROUNDED';this.fuel=FLIGHT_CONFIG.maxFuel;this.position=[p.x,p.y+.46,p.z];this.orientation=yawQuat(p.yaw+Math.PI);this.velocity=[0,0,0];this.angularVelocity=[0,0,0];this.altitude=0;this.thrust=0;}
 toggle(s:number,x:number,speed:number){this.active=!this.active;if(this.active&&this.state==='GROUNDED'){const p=pose(s,x);this.position=[p.x,p.y+.46,p.z];this.orientation=yawQuat(p.yaw+Math.PI);this.velocity=[p.tx*speed,0,p.tz*speed];}return this.active;}
 beginTakeoff(s:number,x:number,speed:number){if(!this.active||this.state!=='GROUNDED'||this.fuel<=0)return false;const p=pose(s,x);this.position=[p.x,p.y+.46,p.z];this.orientation=yawQuat(p.yaw+Math.PI);this.velocity=[p.tx*speed,0,p.tz*speed];this.state='TAKEOFF';return true;}
 grounded(dt:number,stable:boolean,s?:number,x?:number,speed=0){this.state='GROUNDED';this.thrust=0;this.altitude=0;if(s!==undefined&&x!==undefined){const p=pose(s,x);this.position=[p.x,p.y+.46,p.z];this.orientation=yawQuat(p.yaw+Math.PI);this.velocity=[p.tx*speed,0,p.tz*speed];this.angularVelocity=[0,0,0];}if(stable)this.fuel=Math.min(FLIGHT_CONFIG.maxFuel,this.fuel+FLIGHT_CONFIG.rechargePerSecond*dt);}
 step(dt:number,c:FlightControls){
  const cfg=FLIGHT_CONFIG,ground=roadHeight(nearestStation(this.position[0],this.position[2]).s),up=rotate(this.orientation,[0,1,0]),forward=rotate(this.orientation,[0,0,1]);
  this.altitude=Math.max(0,this.position[1]-(ground+.46));
  const liftCommand=c.lift&&this.fuel>0?1:0,descend=c.descend ? .45 : 0;this.thrust=Math.max(0,liftCommand-descend);
  const pitch=Number(c.pitchDown)-Number(c.pitchUp),roll=Number(c.rollRight)-Number(c.rollLeft),yaw=Number(c.yawLeft)-Number(c.yawRight),manual=Math.abs(pitch)+Math.abs(roll)+Math.abs(yaw)>0;
  const worldUpBody=rotate(conjugate(this.orientation),[0,1,0]);
  const target:V3=[pitch*cfg.maxRate[0],yaw*cfg.maxRate[1],roll*cfg.maxRate[2]];
  if(!manual){target[0]=clamp(Math.atan2(worldUpBody[2],Math.max(.05,worldUpBody[1]))*cfg.levelGain,-cfg.maxRate[0],cfg.maxRate[0]);target[2]=clamp(-Math.atan2(worldUpBody[0],Math.max(.05,worldUpBody[1]))*cfg.levelGain,-cfg.maxRate[2],cfg.maxRate[2]);}
  const attitudeAuthority=this.fuel>0?1:0;for(let i=0;i<3;i++)this.angularVelocity[i]+=clamp((target[i]-this.angularVelocity[i])*cfg.rateGain*dt,-3*dt,3*dt)*attitudeAuthority;
  this.angularVelocity=scale(this.angularVelocity,Math.exp(-cfg.angularDrag*dt));this.orientation=integrate(this.orientation,this.angularVelocity,dt);
  let liftAccel=liftCommand*cfg.liftAcceleration;if(this.state==='LANDING'&&!c.descend&&this.velocity[1]<-cfg.touchdownSpeed&&up[1]>.35&&this.fuel>0)liftAccel=Math.max(liftAccel,Math.min(cfg.liftAcceleration,cfg.gravity+(-cfg.touchdownSpeed-this.velocity[1])*2.2));this.thrust=liftAccel/cfg.liftAcceleration;
  const forwardAccel=(c.pitchDown&&this.fuel>0?cfg.forwardAcceleration:0);this.velocity[0]+=(up[0]*liftAccel+forward[0]*forwardAccel)*dt;this.velocity[1]+=(up[1]*liftAccel-cfg.gravity+forward[1]*forwardAccel)*dt;this.velocity[2]+=(up[2]*liftAccel+forward[2]*forwardAccel)*dt;this.velocity=scale(this.velocity,Math.exp(-cfg.linearDrag*dt));this.position=add(this.position,scale(this.velocity,dt));
  const attitudeUse=Math.min(1,(Math.abs(target[0])/cfg.maxRate[0]+Math.abs(target[1])/cfg.maxRate[1]+Math.abs(target[2])/cfg.maxRate[2])*.34);this.fuel=Math.max(0,this.fuel-dt*(liftAccel/cfg.liftAcceleration*cfg.liftFuelPerSecond+attitudeUse*cfg.attitudeFuelPerSecond));
  const nextGround=roadHeight(nearestStation(this.position[0],this.position[2]).s);this.altitude=this.position[1]-(nextGround+.46);if(this.state==='TAKEOFF'&&this.altitude>.18)this.state='FLYING';if(this.velocity[1]<-.25&&this.altitude<3)this.state='LANDING';
  if(this.altitude<=0&&this.velocity[1]<=0){const upright=rotate(this.orientation,[0,1,0])[1];this.position[1]=nextGround+.46;if(upright>.58){this.velocity[1]=0;this.angularVelocity=[0,0,0];this.state='GROUNDED';this.active=false;}else{this.velocity[1]=Math.abs(this.velocity[1])*.22;this.angularVelocity=scale(this.angularVelocity,.55);}}
 }
 snapshot():FlightSnapshot{return {active:this.active,state:this.state,fuel:this.fuel/FLIGHT_CONFIG.maxFuel,position:[...this.position],orientation:[...this.orientation],velocity:[...this.velocity],angularVelocity:[...this.angularVelocity],altitude:Math.max(0,this.altitude),thrust:this.thrust};}
}
