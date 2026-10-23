import test from 'node:test';
import assert from 'node:assert/strict';
import {FLIGHT_CONFIG,RoadsterFlightController,rotate} from '../src/game/roadsterFlight';
import {Simulation,emptyInput} from '../src/game/simulation';
import {trafficBody} from '../src/game/weaving';

const controls=(overrides:Partial<Parameters<RoadsterFlightController['step']>[1]>={})=>({lift:false,descend:false,pitchDown:false,pitchUp:false,rollLeft:false,rollRight:false,yawLeft:false,yawRight:false,...overrides});

test('Roadster takes off without teleporting and consumes real fuel',()=>{
 const f=new RoadsterFlightController();f.reset(100,0);const start=[...f.position];f.toggle(100,0,12);assert.equal(f.beginTakeoff(100,0,12),true);
 for(let i=0;i<90;i++)f.step(1/60,controls({lift:true}));
 assert.ok(f.altitude>1);assert.ok(f.snapshot().fuel<1&&f.snapshot().fuel>0);assert.ok(Math.hypot(f.position[0]-start[0],f.position[2]-start[2])>5);assert.notEqual(f.state,'GROUNDED');
});

test('fuel never drops below zero and only recharges while grounded and stable',()=>{
 const f=new RoadsterFlightController();f.reset(100,0);f.toggle(100,0,0);f.beginTakeoff(100,0,0);for(let i=0;i<4200;i++)f.step(1/60,controls({lift:true}));assert.equal(f.fuel,0);const empty=f.fuel;f.grounded(2,false,100,0,0);assert.equal(f.fuel,empty);f.grounded(2,true,100,0,0);assert.ok(f.fuel>empty&&f.fuel<FLIGHT_CONFIG.maxFuel);
});

test('auto-level reduces tilt when attitude controls are released',()=>{
 const f=new RoadsterFlightController();f.reset(100,0);f.toggle(100,0,0);f.beginTakeoff(100,0,0);for(let i=0;i<40;i++)f.step(1/60,controls({lift:true,rollRight:true}));const tilted=rotate(f.orientation,[0,1,0])[1];for(let i=0;i<150;i++)f.step(1/60,controls({lift:true}));const levelled=rotate(f.orientation,[0,1,0])[1];assert.ok(levelled>tilted);
});

test('flight integrates through the existing simulation loop while traffic keeps moving',()=>{
 const sim=new Simulation(12);sim.start();for(let i=0;i<30;i++)sim.update(1/60,{...emptyInput(),throttle:true});const trafficStart=sim.traffic[0]!.s;sim.toggleFlightMode();for(let i=0;i<120;i++)sim.update(1/60,{...emptyInput(),ascend:true});const snap=sim.snapshot();assert.notEqual(snap.flight.state,'GROUNDED');assert.ok(snap.flight.altitude>0);assert.notEqual(sim.traffic[0]!.s,trafficStart);
});

test('a meaningful side landing crashes, ignores controls, and recovers upright without refuelling',()=>{
 const f=new RoadsterFlightController();f.reset(100,0);f.rememberSafeGrounded(100,0,4);const safe=f.lastSafeGroundedTransform;f.fuel=2.5;f.toggle(100,0,0);f.beginTakeoff(100,0,0);
 f.state='FLYING';f.position=[safe.position[0],safe.position[1]+.01,safe.position[2]];f.orientation=[0,0,Math.SQRT1_2,Math.SQRT1_2];f.velocity=[0,-5,0];
 const crash=f.step(1/60,controls());assert.equal(crash?.kind,'side-landing');assert.equal(f.state,'CRASHED');assert.equal(f.active,false);const crashed=[...f.position],fuel=f.fuel;
 f.step(1/10,controls({lift:true,rollRight:true}));assert.deepEqual(f.position,crashed);assert.equal(f.thrust,0);
 for(let i=0;i<80&&f.state!=='GROUNDED';i++)f.advanceRecovery(1/60);
 assert.equal(f.state,'GROUNDED');assert.ok(rotate(f.orientation,[0,1,0])[1]>.99);assert.equal(f.fuel,fuel);assert.deepEqual(f.position,safe.position);
});

test('a slightly tilted low-speed landing remains a normal landing',()=>{
 const f=new RoadsterFlightController();f.reset(100,0);const safe=f.lastSafeGroundedTransform,angle=.2;f.toggle(100,0,0);f.beginTakeoff(100,0,0);f.state='FLYING';f.position=[safe.position[0],safe.position[1]+.03,safe.position[2]];f.orientation=[0,0,Math.sin(angle/2),Math.cos(angle/2)];f.velocity=[0,-.8,0];
 let crash=null;for(let i=0;i<15&&f.state!=='GROUNDED';i++)crash=f.step(1/60,controls());assert.equal(crash,null);assert.equal(f.state,'GROUNDED');
});

test('simulation crash damage and recovery preserve lost health and remaining fuel',()=>{
 const sim=new Simulation(22);sim.start();sim.update(1/60,emptyInput());const safe={...sim.flight.lastSafeGroundedTransform,position:[...sim.flight.lastSafeGroundedTransform.position] as [number,number,number]};sim.flight.fuel=2.5;sim.toggleFlightMode();sim.flight.beginTakeoff(sim.s,sim.x,0);sim.flight.state='FLYING';sim.flight.position=[safe.position[0],safe.position[1]+.01,safe.position[2]];sim.flight.orientation=[0,0,Math.SQRT1_2,Math.SQRT1_2];sim.flight.velocity=[0,-6,0];
 sim.update(1/60,emptyInput());assert.equal(sim.flight.state,'CRASHED');assert.ok(sim.health<100);const damagedHealth=sim.health,fuelAfterCrash=sim.flight.fuel;
 for(let i=0;i<90&&sim.flight.state!=='GROUNDED';i++)sim.update(1/60,{...emptyInput(),ascend:true,throttle:true});
 assert.equal(sim.flight.state,'GROUNDED');assert.equal(sim.health,damagedHealth);assert.equal(sim.flight.fuel,fuelAfterCrash);assert.ok(Math.abs(sim.s-safe.s)<.01);assert.ok(Math.abs(sim.x-safe.x)<.01);
});

test('swept flight collision catches a high-speed traffic pass-through',()=>{
 const sim=new Simulation(33);sim.start();sim.update(1/60,emptyInput());const vehicle=sim.traffic[0]!,body=trafficBody(vehicle),fx=Math.sin(body.yaw),fz=Math.cos(body.yaw),yaw=body.yaw+Math.PI;
 sim.toggleFlightMode();sim.flight.beginTakeoff(sim.s,sim.x,0);sim.flight.state='FLYING';sim.flight.position=[body.x-fx*8,body.y+1.6,body.z-fz*8];sim.flight.orientation=[0,Math.sin(yaw/2),0,Math.cos(yaw/2)];sim.flight.velocity=[fx*320,0,fz*320];
 sim.update(.05,emptyInput());assert.equal(sim.flight.state,'CRASHED');assert.ok(sim.snapshot().impactEvent?.obstacle.startsWith('flight-traffic:'));assert.ok(sim.health<100);
});

test('invalid and distant flight positions trigger the out-of-bounds recovery path',()=>{
 const invalid=new RoadsterFlightController();invalid.reset(100,0);invalid.toggle(100,0,0);invalid.beginTakeoff(100,0,0);invalid.state='FLYING';invalid.position=[Number.NaN,0,0];assert.equal(invalid.step(1/60,controls())?.kind,'invalid');assert.ok(invalid.position.every(Number.isFinite));
 const distant=new RoadsterFlightController();distant.reset(100,0);const safe=distant.lastSafeGroundedTransform;distant.toggle(100,0,0);distant.beginTakeoff(100,0,0);distant.state='FLYING';distant.position=[safe.position[0]+10000,safe.position[1]+10,safe.position[2]+10000];assert.equal(distant.step(1/60,controls())?.kind,'out-of-bounds');assert.equal(distant.state,'CRASHED');
});
