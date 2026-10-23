import test from 'node:test';
import assert from 'node:assert/strict';
import {FLIGHT_CONFIG,RoadsterFlightController,rotate} from '../src/game/roadsterFlight';
import {Simulation,emptyInput} from '../src/game/simulation';

const controls=(overrides:Partial<Parameters<RoadsterFlightController['step']>[1]>={})=>({lift:false,descend:false,pitchDown:false,pitchUp:false,rollLeft:false,rollRight:false,yawLeft:false,yawRight:false,...overrides});

test('Roadster takes off without teleporting and consumes real fuel',()=>{
 const f=new RoadsterFlightController();f.reset(100,0);const start=[...f.position];f.toggle(100,0,12);assert.equal(f.beginTakeoff(100,0,12),true);
 for(let i=0;i<90;i++)f.step(1/60,controls({lift:true}));
 assert.ok(f.altitude>1);assert.ok(f.snapshot().fuel<1&&f.snapshot().fuel>0);assert.ok(Math.hypot(f.position[0]-start[0],f.position[2]-start[2])>5);assert.notEqual(f.state,'GROUNDED');
});

test('fuel never drops below zero and only recharges while grounded and stable',()=>{
 const f=new RoadsterFlightController();f.reset(100,0);f.toggle(100,0,0);f.beginTakeoff(100,0,0);for(let i=0;i<4200;i++)f.step(1/60,controls({lift:true,rollRight:true}));assert.equal(f.fuel,0);const empty=f.fuel;f.grounded(2,false,100,0,0);assert.equal(f.fuel,empty);f.grounded(2,true,100,0,0);assert.ok(f.fuel>empty&&f.fuel<FLIGHT_CONFIG.maxFuel);
});

test('auto-level reduces tilt when attitude controls are released',()=>{
 const f=new RoadsterFlightController();f.reset(100,0);f.toggle(100,0,0);f.beginTakeoff(100,0,0);for(let i=0;i<40;i++)f.step(1/60,controls({lift:true,rollRight:true}));const tilted=rotate(f.orientation,[0,1,0])[1];for(let i=0;i<150;i++)f.step(1/60,controls({lift:true}));const levelled=rotate(f.orientation,[0,1,0])[1];assert.ok(levelled>tilted);
});

test('flight integrates through the existing simulation loop while traffic keeps moving',()=>{
 const sim=new Simulation(12);sim.start();for(let i=0;i<30;i++)sim.update(1/60,{...emptyInput(),throttle:true});const trafficStart=sim.traffic[0]!.s;sim.toggleFlightMode();for(let i=0;i<120;i++)sim.update(1/60,{...emptyInput(),ascend:true});const snap=sim.snapshot();assert.notEqual(snap.flight.state,'GROUNDED');assert.ok(snap.flight.altitude>0);assert.notEqual(sim.traffic[0]!.s,trafficStart);
});
