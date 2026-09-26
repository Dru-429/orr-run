import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,emptyInput,DIMENSIONS,type VehicleKind,type Traffic} from '../src/game/simulation';
import {laneCentresAt,crossSectionAt,ROAD_WORK} from '../src/survey/corridor';
import {overlaps,roadBody,junctionRecords} from '../src/game/junctions';
import {parkedBuses} from '../src/game/parkedBuses';
import {trafficBody,isWeaver,resetWeave,weavePathSafe,cutInGap,playerCutInSafe,weaveBounds,weaveStep} from '../src/game/weaving';
const base=new Simulation(11).traffic[0];
function actor(id:number,kind:VehicleKind,s:number,x:number,speed=0,opposite=false):Traffic {const [length,width]=DIMENSIONS[kind];const lanes=laneCentresAt(s,opposite),lane=lanes.reduce((a,b,i)=>Math.abs(b-x)<Math.abs(lanes[a]-x)?i:a,0);const v={...base,weave:undefined,id,kind,s,x,speed,cruise:kind==='car'?0:10,length,width,opposite,lane,targetLane:lane,changeTimer:10000};resetWeave(v,41);return v;}
function check(sim:Simulation){for(let i=0;i<sim.traffic.length;i++){const a=sim.traffic[i];for(const b of sim.traffic.slice(i+1))if(Math.abs(a.s-b.s)<20)assert.ok(!overlaps(trafficBody(a),trafficBody(b)),`overlap ${a.id}/${b.id} at ${a.s}`);for(const b of parkedBuses)if(Math.abs(a.s-b.s)<20)assert.ok(!overlaps(trafficBody(a),b.body));if(isWeaver(a)){const c=crossSectionAt(a.s),h=Math.abs(Math.cos(a.weave!.heading))*a.width/2+Math.abs(Math.sin(a.weave!.heading))*a.length/2;assert.ok(a.x-h>=(a.opposite?c.oppositeLeft:c.left)-.01);assert.ok(a.x+h<=(a.opposite?c.oppositeRight:c.right)+.01);assert.ok(Math.abs(a.weave!.velocity)<=(a.kind==='bike'?1.3:.85)+1e-6);}}}
function queue(opposite=false){const sim=new Simulation(41);sim.start();sim.s=3950;sim.x=3.3;sim.traffic=[];const lanes=laneCentresAt(4020,opposite),direction=opposite?-1:1;let id=0;for(let row=0;row<3;row++)for(let lane=0;lane<3;lane++)sim.traffic.push(actor(id++,'car',4020+direction*row*15,lanes[lane],0,opposite));for(const [kind,lane] of [['bike',0],['auto',1],['bike',2]] as const)sim.traffic.push(actor(id++,kind,4020-direction*16,lanes[lane],2,opposite));return sim;}
test('bikes and autos filter off lane centres through stopped queues in both directions',()=>{
 for(const opposite of [false,true]){const sim=queue(opposite),dir=opposite?-1:1;let angled=0;for(let i=0;i<60*40;i++){const before=sim.traffic.map(v=>v.x);sim.update(1/60,emptyInput());check(sim);for(const [n,v] of sim.traffic.entries())if(isWeaver(v)){assert.ok(Math.abs(v.x-before[n])<.023);if(Math.abs(v.weave!.heading)>.025)angled++;}}
 assert.ok(angled>30);for(const v of sim.traffic.filter(isWeaver)){if(opposite&&v.kind==='auto'){assert.ok(v.s>4020,'Auto must wait where the narrower opposing gaps cannot fit it');continue;}assert.ok((v.s-4050*Number(!opposite)-3990*Number(opposite))*dir>5,`${v.kind} ${v.id} stayed behind queue: ${v.s}`);assert.ok(Math.min(...laneCentresAt(v.s,opposite).map(x=>Math.abs(v.x-x)))>.3);}}
});
test('physical widths reject an auto where a bike fits',()=>{
 const sim=queue(),bike=actor(50,'bike',3990,-3.6,2),auto=actor(51,'auto',3990,-3.6,2);
 const cars=[actor(1,'car',3995,-5.1),actor(2,'car',3995,-2.1)];const player={s:3900,x:3.3,speed:0,velocity:0};
 assert.equal(weavePathSafe(bike,-3.6,2,cars,[],player),true);assert.equal(weavePathSafe(auto,-3.6,2,cars,[],player),false);assert.equal(sim.health,100);
});
test('a stopped bike can start filtering, but cannot slide sideways without forward travel',()=>{
 const sim=queue();const v=sim.traffic.find(isWeaver)!;v.speed=0;v.s=4006;resetWeave(v);v.weave!.targetX=v.x+1;v.weave!.velocity=1;
 const still=weaveStep(v,.05,0);assert.equal(still.x,v.x);assert.equal(still.velocity,0);
 for(let i=0;i<1200;i++){sim.update(1/60,emptyInput());check(sim);}assert.ok(v.s>4045);
});
test('player cut-ins leave reaction and braking room and reject sudden occupied gaps',()=>{
 const v=actor(1,'bike',4020,-3.6,5),p={s:4000,x:-1.3,speed:20,velocity:0};
 assert.equal(cutInGap(20,5),30.5);assert.equal(playerCutInSafe(v,4020,-1.3,p),false);assert.equal(playerCutInSafe(v,4040,-1.3,p),true);
 assert.equal(weavePathSafe(v,-1.3,5,[],[],p),false);
 const near={...p,s:4018,speed:5,x:v.x};assert.equal(playerCutInSafe(v,v.s,v.x,near),false);
});
test('three-second reservations reject fast rear traffic and simultaneous crossing paths',()=>{
 const v=actor(1,'bike',4000,-5.9,5),rear=actor(2,'car',3980,-3.6,20),p={s:3900,x:3.3,speed:0,velocity:0};
 assert.equal(weavePathSafe(v,-3.6,5,[v,rear],[],p),false);
 const other=actor(3,'auto',4000,-1.3,5);other.weave!.targetX=-4.5;
 assert.equal(weavePathSafe(v,-2.5,5,[v,other],[],p),false);
 const crossing=roadBody(4005,-4,5,2);crossing.yaw+=Math.PI/2;crossing.speed=3;
 assert.equal(weavePathSafe(v,-3.6,5,[v],[crossing],p),false);
});
test('queue filtering speed remains within 10 km/h of stopped surrounding cars',()=>{
 const sim=queue();sim.traffic.filter(isWeaver).forEach(v=>v.speed=0);
 for(let i=0;i<900;i++){sim.update(1/60,emptyInput());for(const v of sim.traffic.filter(isWeaver))if(v.s<4048)assert.ok(v.speed<=10/3.6+.001);}
});
test('pause freezes manoeuvres; restart, inspection reset and recycling clear them',()=>{
 const sim=queue();for(let i=0;i<90;i++)sim.update(1/60,emptyInput());sim.pause();const frozen=JSON.stringify(sim.traffic);sim.update(.05,emptyInput());assert.equal(JSON.stringify(sim.traffic),frozen);sim.resume();
 const v=sim.traffic.find(isWeaver)!;v.s=sim.s-240;sim.update(.05,emptyInput());assert.equal(v.weave!.velocity,0);assert.equal(v.weave!.heading,0);assert.equal(v.weave!.targetX,v.x);
 sim.resetWeaving();assert.ok(sim.traffic.filter(isWeaver).every(v=>v.weave!.velocity===0));sim.restart();assert.ok(sim.traffic.filter(isWeaver).every(v=>v.weave!.heading===0&&v.weave!.targetX===v.x));
});
test('seeded movement is deterministic and heading is shared with collision bodies',()=>{
 const a=queue(),b=queue();for(let i=0;i<120;i++){a.update(1/60,emptyInput());b.update(1/60,emptyInput());}assert.deepEqual(a.traffic,b.traffic);
 for(const v of a.traffic.filter(isWeaver)){const body=trafficBody(v),road=roadBody(v.s,v.x,v.length,v.width);assert.ok(Math.abs(body.yaw-road.yaw-v.weave!.heading)<1e-10);assert.ok(Math.abs(v.weave!.heading)<=(v.kind==='bike'?12:8)*Math.PI/180);}
});
test('filtering respects red signals and road bounds across narrowing and elevated sections',()=>{
 const record=junctionRecords[0],sim=new Simulation(41);sim.start();sim.s=record.stopLine-100;sim.x=3.3;sim.junctions.states.forEach(j=>{j.phase=3;j.elapsed=0;j.orr='red';});
 const v=actor(7,'bike',record.stopLine-8,laneCentresAt(record.stopLine)[0],2);sim.traffic=[v];for(let i=0;i<240;i++){sim.update(1/60,emptyInput());assert.ok(v.s+v.length/2<=record.stopLine+.001);check(sim);}
 for(const s of [300,1800,3600,9000,10890]){const v=actor(8,'auto',s,laneCentresAt(s)[1],8),bounds=weaveBounds(v);assert.ok(bounds.left<bounds.right);v.weave!.targetX=bounds.right;const step=weaveStep(v,.05,.4);assert.ok(step.x<=bounds.right&&step.x>=bounds.left);}
});

test('a tightly queued auto can turn away from a beside-bike without a false reservation deadlock',()=>{
 const sim=new Simulation(42);sim.start();sim.s=5182;sim.x=-1.25;
 const auto=actor(15,'auto',5264.032492771868,-1.8500135871358792),bike=actor(93,'bike',5264.36,-3.47),ahead=actor(44,'auto',5267.850421700775,-3.6);bike.cruise=0;ahead.cruise=0;sim.traffic=[auto,bike,ahead];
 for(let i=0;i<900;i++){sim.update(1/60,emptyInput());check(sim);}assert.ok(auto.s>5290,'The auto should take the clear corridor to its right');
});

test('mixed weaving traffic stays collision-free on bends, flyovers, works and the underpass',()=>{
 for(const station of [1720,3650,ROAD_WORK.from-30,10880]){
  const sim=new Simulation(92);sim.start();sim.s=station-70;sim.x=3.3;
  sim.traffic=Array.from({length:18},(_,i)=>{const s=station+Math.floor(i/3)*17,kind=(['bike','auto','car','bus','truck','bike'] as const)[i%6];const v=actor(i,kind,s,laneCentresAt(s)[i%3],i%3===0?4:8);v.cruise=8+i%4;return v;});
  for(let i=0;i<60*25;i++){sim.update(1/60,emptyInput());check(sim);}
 }
});

test('a turning auto with a small projected front gap completes its clear escape',()=>{
 const sim=new Simulation(42);sim.start();sim.s=5248;sim.x=-1.25;
 const auto=actor(89,'auto',5271.639028179124,-3.350502366773963),truck=actor(63,'truck',5277.690644400316,-5.9);truck.cruise=0;auto.weave!.heading=-8*Math.PI/180;auto.weave!.targetX=-2.39;
 sim.traffic=[auto,truck];for(let i=0;i<900;i++){sim.update(1/60,emptyInput());check(sim);}assert.ok(auto.s>5290,'Projected clearance must not prevent a collision-free escape');
});
