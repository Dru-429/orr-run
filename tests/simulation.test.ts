import {writeFileSync} from 'node:fs';
import {lateralHalf} from '../src/game/weaving';
import {crossingBody} from '../src/game/junctions';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,emptyInput} from '../src/game/simulation';
import {map,pose,roadHeight,ROUTE_LENGTH,LEGACY_OFFSET} from '../src/game/route';
import {TRAFFIC_COUNT} from '../src/data/traffic';
import {driveBounds} from '../src/survey/corridor';
import legacy from '../src/data/segments/adobe-electra.json';
import {INFRASTRUCTURE} from '../src/data/appearance';
const tick=(s:Simulation,seconds:number,input=emptyInput())=>{for(let i=0;i<seconds*60;i++)s.update(1/60,input);};
test('surveyed polyline is exactly 1,000 horizontal metres and has unique footprint IDs',()=>{
 const p=legacy.centerline;const length=p.slice(1).reduce((sum,b,i)=>sum+Math.hypot(b.p[0]-p[i].p[0],b.p[1]-p[i].p[1]),0);
 assert.ok(Math.abs(length-1000)<.00001);assert.equal(new Set(map.buildings.map(b=>b.id)).size,map.buildings.length);
 assert.ok(map.buildings.some(b=>b.id==='381171222'));assert.ok(map.buildings.some(b=>b.name==='Electra'));
});
test('road direction and elevation stay continuous at every source vertex',()=>{
 for(const p of map.centerline){const a=pose(p.s-.001),b=pose(p.s+.001);assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<.003);assert.ok(Math.abs(a.y-b.y)<.001);}
 assert.equal(roadHeight(LEGACY_OFFSET+100),-4.2);assert.equal(roadHeight(LEGACY_OFFSET+500),0);
});
test('throttle moves forward and brake stops without reversing',()=>{
 const s=new Simulation();s.traffic=[];s.start();tick(s,5,{...emptyInput(),throttle:true});assert.ok(s.speed>14);assert.ok(s.distance>30);tick(s,3,{...emptyInput(),brake:true});assert.equal(s.speed,0);const d=s.distance;tick(s,3,{...emptyInput(),brake:true});assert.equal(s.distance,d);
});
test('pause freezes simulation and resume continues',()=>{
 const s=new Simulation();s.start();tick(s,2,{...emptyInput(),throttle:true});s.pause();const state=s.snapshot();const traffic=JSON.stringify(s.traffic);tick(s,10,{...emptyInput(),throttle:true});assert.deepEqual(s.snapshot(),state);assert.equal(JSON.stringify(s.traffic),traffic);s.resume();tick(s,1);assert.ok(s.time>state.time);
});
test('simultaneous braking and steering uses the brake and respects the curb',()=>{
 const s=new Simulation();s.traffic=[];s.start();const initialX=s.x;s.speed=18;tick(s,1,{...emptyInput(),throttle:true,brake:true,right:true});assert.ok(s.speed<9);assert.ok(s.x>initialX);tick(s,6,{...emptyInput(),throttle:true,right:true});assert.ok(s.x<=4.65);assert.ok(s.health<100);
});
test('a rear-end impact damages the player, cannot tunnel, and does not award blocked distance',()=>{
 const s=new Simulation();s.start();s.x=0;s.traffic=[{...s.traffic[0],s:8,x:0,lane:1,targetLane:1,speed:0,cruise:0}];s.speed=24;tick(s,.4,{...emptyInput(),throttle:true});assert.ok(s.health<100);assert.ok(s.collisions>=1);assert.ok(s.s<s.traffic[0].s);assert.ok(s.distance<=s.s+.5);const d=s.distance;tick(s,5,{...emptyInput(),throttle:true});assert.ok(s.distance<d+.5,'Pushing a stopped vehicle must not farm distance');
});
test('work-zone barrier is a physical boundary',()=>{
 const s=new Simulation();s.traffic=[];s.start();s.s=LEGACY_OFFSET+870;s.x=4.4;s.speed=10;tick(s,.1,{...emptyInput(),right:true});const z=INFRASTRUCTURE.workZone;assert.ok(s.x<=z.offset-z.barrierWidth/2-.95);assert.ok(s.health<100);
});
test('lap transition preserves score and damage and restarts at the exact origin',()=>{
 const s=new Simulation();s.start();s.traffic=[];s.s=ROUTE_LENGTH-.2;s.distance=ROUTE_LENGTH-.2;s.speed=10;s.health=63;tick(s,.1);assert.equal(s.phase,'looping');assert.equal(s.distance,ROUTE_LENGTH);tick(s,1.35);assert.equal(s.lap,2);assert.equal(s.health,63);assert.ok(s.s<1);assert.ok(s.distance>=ROUTE_LENGTH);assert.equal(s.traffic.length,TRAFFIC_COUNT);
});
test('stationary player never depletes the pooled traffic',()=>{
 const s=new Simulation();s.start();tick(s,180);assert.equal(s.traffic.length,TRAFFIC_COUNT);assert.ok(s.traffic.some(v=>!v.opposite&&v.s>0&&v.s<300));assert.ok(s.traffic.every(v=>Number.isFinite(v.s)&&Number.isFinite(v.x)));assert.equal(s.overtakes,0,'Recycled traffic must not award idle overtakes');
});
test('pausing during a lap fade resumes the transition without losing the lap',()=>{
 const s=new Simulation();s.start();s.traffic=[];s.s=ROUTE_LENGTH-.1;s.speed=10;tick(s,.1);assert.equal(s.phase,'looping');s.pause();tick(s,2);assert.equal(s.lap,1);assert.equal(s.phase,'paused');s.resume();tick(s,1.4);assert.equal(s.lap,2);assert.equal(s.phase,'driving');
});
test('three full connected-route loops with live traffic preserve a fixed pool and score',()=>{
 const s=new Simulation(42);s.start();
 // Filtering bikes in a neighbouring gap are not in the test driver's corridor.
 for(let i=0;i<6500*30&&s.lap<4;i++){
  if(process.env.ORR_SIM_TRACE&&i%3000===0)writeFileSync(process.env.ORR_SIM_TRACE,JSON.stringify({step:i,lap:s.lap,s:s.s,x:s.x,time:s.time,health:s.health,traffic:s.traffic,junctions:s.junctions}));
  let gap=s.junctions.stopFor(s.s,s.speed,4.2,false),lead=25;const bounds=driveBounds(s.s+15);const targetX=(bounds.left+bounds.right)/2;
  for(const v of s.traffic){if(!v.opposite&&Math.abs(v.x-s.x)<lateralHalf(v)+.9+.25&&v.s>s.s){const d=v.s-s.s-(v.length+4.2)/2;if(d<gap){gap=d;lead=v.speed;}}}
  for(const v of s.junctions.vehicles){if(!v.active)continue;const b=crossingBody(v,s.junctions.state(v.junctionId!).record),p=pose(s.s,s.x);if(b.s!>s.s&&Math.cos(b.yaw-p.yaw)>.85&&Math.abs(b.y-p.y)<2.5&&Math.abs((b.x-p.x)*p.rx+(b.z-p.z)*p.rz)<b.width/2+.9+.25){const d=b.s!-s.s-(v.length+4.2)/2;if(d<gap){gap=d;lead=v.speed;}}}
  s.update(1/30,{...emptyInput(),left:s.x>targetX+.15,right:s.x<targetX-.15,throttle:gap>Math.max(18,s.speed*2)&&s.speed<15,brake:gap<Math.max(10,s.speed*1.5)||gap<30&&s.speed>lead+1});
  assert.notEqual(s.phase,'ended','Autopilot died at '+s.distance.toFixed(1)+' m');
 }
 assert.ok(s.lap>=4,'Expected multiple passes, got '+s.lap+' at '+s.distance.toFixed(0)+'m');assert.equal(s.traffic.length,TRAFFIC_COUNT);
});
test('restart clears run state while leaving a fresh fixed-size vehicle pool',()=>{
 const s=new Simulation();s.start();s.health=0;s.phase='ended';s.lap=4;s.distance=3210;s.collisions=9;s.restart();assert.equal(s.health,100);assert.equal(s.distance,0);assert.equal(s.lap,1);assert.equal(s.collisions,0);assert.equal(s.traffic.length,TRAFFIC_COUNT);assert.equal(s.phase,'driving');
});
