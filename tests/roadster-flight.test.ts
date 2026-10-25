import test from 'node:test';
import assert from 'node:assert/strict';
import {FLIGHT_CONFIG,LANDING_ASSIST_CONFIG,RoadsterFlightController,rotate,type Quat} from '../src/game/roadsterFlight';
import {Simulation,emptyInput} from '../src/game/simulation';
import {trafficBody} from '../src/game/weaving';

const controls=(overrides:Partial<Parameters<RoadsterFlightController['step']>[1]>={})=>({lift:false,descend:false,pitchDown:false,pitchUp:false,rollLeft:false,rollRight:false,yawLeft:false,yawRight:false,...overrides});
const multiply=(a:Quat,b:Quat):Quat=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];

test('held and repeated lift stop at the altitude ceiling without storing upward momentum',()=>{
 const f=new RoadsterFlightController();f.reset(100,0);f.beginTakeoff(100,0,0);
 for(let i=0;i<1200;i++){
  assert.equal(f.step(1/60,controls({lift:true})),null);
  assert.ok(f.altitude<=FLIGHT_CONFIG.maxAltitude+1e-8);
 }
 assert.ok(Math.abs(f.altitude-FLIGHT_CONFIG.maxAltitude)<1e-8);assert.equal(f.velocity[1],0);
 for(let i=0;i<120;i++){
  f.step(1/60,controls({lift:i%2===0}));assert.ok(f.altitude<=FLIGHT_CONFIG.maxAltitude+1e-8);
 }
 const before=f.position[1];for(let i=0;i<30;i++)f.step(1/60,controls({descend:true}));
 assert.ok(f.position[1]<before);assert.ok(f.velocity[1]<0);
});

test('Roadster takes off without teleporting and consumes real fuel',()=>{
 const f=new RoadsterFlightController();f.reset(100,0);const start=[...f.position];assert.equal(f.beginTakeoff(100,0,12),true);
 for(let i=0;i<90;i++)f.step(1/60,controls({lift:true}));
 assert.ok(f.altitude>1);assert.ok(f.snapshot().fuel<1&&f.snapshot().fuel>0);assert.ok(Math.hypot(f.position[0]-start[0],f.position[2]-start[2])>5);assert.notEqual(f.state,'GROUNDED');
});

test('fuel never drops below zero and only recharges while grounded and stable',()=>{
 const f=new RoadsterFlightController();f.reset(100,0);f.beginTakeoff(100,0,0);for(let i=0;i<4200;i++)f.step(1/60,controls({lift:true}));assert.equal(f.fuel,0);
 // Fuel exhaustion may settle through the emergency landing path below the ceiling.
 for(let i=0;i<120&&(f.state==='CRASHED'||f.state==='RECOVERING');i++)f.advanceRecovery(1/60);
 const empty=f.fuel;f.grounded(2,false,100,0,0);assert.equal(f.fuel,empty);f.grounded(2,true,100,0,0);assert.ok(f.fuel>empty&&f.fuel<FLIGHT_CONFIG.maxFuel);
});

test('auto-level reduces tilt when attitude controls are released',()=>{
 const f=new RoadsterFlightController();f.reset(100,0);f.beginTakeoff(100,0,0);for(let i=0;i<40;i++)f.step(1/60,controls({lift:true,rollRight:true}));const tilted=rotate(f.orientation,[0,1,0])[1];for(let i=0;i<150;i++)f.step(1/60,controls({lift:true}));const levelled=rotate(f.orientation,[0,1,0])[1];assert.ok(levelled>tilted);
});

test('flight integrates through the existing simulation loop while traffic keeps moving',()=>{
 const sim=new Simulation(12);sim.start();for(let i=0;i<30;i++)sim.update(1/60,{...emptyInput(),throttle:true});const trafficStart=sim.traffic[0]!.s;for(let i=0;i<120;i++)sim.update(1/60,{...emptyInput(),ascend:true});const snap=sim.snapshot();assert.notEqual(snap.flight.state,'GROUNDED');assert.ok(snap.flight.altitude>0);assert.notEqual(sim.traffic[0]!.s,trafficStart);
});

test('a sideways high-spin road impact converts to an upright soft landing with a boost cloud pulse',()=>{
 const f=new RoadsterFlightController();f.reset(100,0);f.rememberSafeGrounded(100,0,4);const safe=f.lastSafeGroundedTransform;f.fuel=2.5;f.beginTakeoff(100,0,0);
 f.state='FLYING';f.position=[safe.position[0],safe.position[1]+.01,safe.position[2]];f.orientation=[0,0,Math.SQRT1_2,Math.SQRT1_2];f.velocity=[0,-5,0];f.angularVelocity=[7,-5,9];
 const crash=f.step(1/60,controls());assert.equal(crash,null);assert.equal(f.state,'GROUNDED');assert.equal(f.active,true);
 assert.ok(rotate(f.orientation,[0,1,0])[1]>.99);assert.equal(f.velocity[1],0);assert.equal(f.touchdownBoost,1);
});

test('a slightly tilted low-speed landing remains a normal landing',()=>{
 const f=new RoadsterFlightController();f.reset(100,0);const safe=f.lastSafeGroundedTransform,angle=.2;f.beginTakeoff(100,0,0);f.state='FLYING';f.position=[safe.position[0],safe.position[1]+.03,safe.position[2]];f.orientation=[0,0,Math.sin(angle/2),Math.cos(angle/2)];f.velocity=[0,-.8,0];
 let crash=null;for(let i=0;i<15&&f.state!=='GROUNDED';i++)crash=f.step(1/60,controls());assert.equal(crash,null);assert.equal(f.state,'GROUNDED');
});

test('landing assist levels and brakes a recoverable descent while preserving forward motion',()=>{
 const f=new RoadsterFlightController();f.reset(100,0);const safe=f.lastSafeGroundedTransform,roll=.42;
 f.beginTakeoff(100,0,8);f.state='FLYING';f.position=[safe.position[0],safe.position[1]+2.6,safe.position[2]];
 f.orientation=multiply(safe.orientation,[0,0,Math.sin(roll/2),Math.cos(roll/2)]);f.velocity=[safe.forward[0]*8,-5,safe.forward[2]*8];
 const initialUp=rotate(f.orientation,[0,1,0])[1],initialFuel=f.fuel;let assisted=false,braked=false,crash=null;
 for(let i=0;i<300&&f.state!=='GROUNDED'&&!crash;i++){
  crash=f.step(1/60,controls());assisted ||= f.landingAssist>0;braked ||= f.thrust>.55;
 }
 assert.equal(crash,null);assert.equal(f.state,'GROUNDED');assert.equal(assisted,true);assert.equal(braked,true);
 assert.ok(rotate(f.orientation,[0,1,0])[1]>initialUp);assert.ok(f.fuel<initialFuel);assert.ok(Math.hypot(f.velocity[0],f.velocity[2])>3);
});

test('landing assist converts an extreme descent into a boosted soft landing',()=>{
 const f=new RoadsterFlightController();f.reset(100,0);const safe=f.lastSafeGroundedTransform;
 f.beginTakeoff(100,0,0);f.state='FLYING';f.position=[safe.position[0],safe.position[1]+1,safe.position[2]];f.velocity=[0,-LANDING_ASSIST_CONFIG.maxDescentSpeed-3,0];
 let crash=null,boosted=false;for(let i=0;i<90&&f.state!=='GROUNDED'&&!crash;i++){crash=f.step(1/60,controls());boosted ||= f.thrust===1;}
 assert.equal(crash,null);assert.equal(boosted,true);assert.equal(f.state,'GROUNDED');assert.equal(f.touchdownBoost,1);
});

test('simulation converts a dangerous road landing without damage or recovery teleport',()=>{
 const sim=new Simulation(22);sim.start();sim.update(1/60,emptyInput());const safe={...sim.flight.lastSafeGroundedTransform,position:[...sim.flight.lastSafeGroundedTransform.position] as [number,number,number]};sim.flight.fuel=2.5;sim.flight.beginTakeoff(sim.s,sim.x,0);sim.flight.state='FLYING';sim.flight.position=[safe.position[0],safe.position[1]+.01,safe.position[2]];sim.flight.orientation=[0,0,Math.SQRT1_2,Math.SQRT1_2];sim.flight.velocity=[0,-6,0];
 sim.update(1/60,emptyInput());assert.equal(sim.flight.state,'GROUNDED');assert.equal(sim.health,100);assert.equal(sim.flight.touchdownBoost,1);
 assert.ok(Math.abs(sim.s-safe.s)<.01);assert.ok(Math.abs(sim.x-safe.x)<.01);
});

test('swept flight collision catches a high-speed traffic pass-through',()=>{
 const sim=new Simulation(33);sim.start();sim.update(1/60,emptyInput());const vehicle=sim.traffic[0]!,body=trafficBody(vehicle),fx=Math.sin(body.yaw),fz=Math.cos(body.yaw),yaw=body.yaw+Math.PI;
 sim.flight.beginTakeoff(sim.s,sim.x,0);sim.flight.state='FLYING';sim.flight.position=[body.x-fx*8,body.y+1.6,body.z-fz*8];sim.flight.orientation=[0,Math.sin(yaw/2),0,Math.cos(yaw/2)];sim.flight.velocity=[fx*320,0,fz*320];
 sim.update(.05,emptyInput());assert.equal(sim.flight.state,'CRASHED');assert.ok(sim.snapshot().impactEvent?.obstacle.startsWith('flight-traffic:'));assert.ok(sim.health<100);
});

test('invalid and distant flight positions trigger the out-of-bounds recovery path',()=>{
 const invalid=new RoadsterFlightController();invalid.reset(100,0);invalid.beginTakeoff(100,0,0);invalid.state='FLYING';invalid.position=[Number.NaN,0,0];assert.equal(invalid.step(1/60,controls())?.kind,'invalid');assert.ok(invalid.position.every(Number.isFinite));
 const distant=new RoadsterFlightController();distant.reset(100,0);const safe=distant.lastSafeGroundedTransform;distant.beginTakeoff(100,0,0);distant.state='FLYING';distant.position=[safe.position[0]+10000,safe.position[1]+10,safe.position[2]+10000];assert.equal(distant.step(1/60,controls())?.kind,'out-of-bounds');assert.equal(distant.state,'CRASHED');
});
