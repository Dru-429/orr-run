import test from 'node:test';
import assert from 'node:assert/strict';
import {JunctionSystem,junctionRecords,roadBody,crossingBody,overlaps,CROSSING_POOL_SIZE} from '../src/game/junctions';
import {Simulation,emptyInput} from '../src/game/simulation';
import {crossSectionAt} from '../src/survey/corridor';
import {manifest,pose,SILK_LENGTH,LEGACY_OFFSET} from '../src/game/route';
import {landscape,observations,archivedObservations} from '../src/survey/records';

test('signal movement releases never conflict and clearance holds for occupied ground lanes',()=>{
 const system=new JunctionSystem(),state=system.states[0],j=state.record;
 state.phase=2;state.elapsed=2;const body=roadBody(j.centre,0,4.3,1.85);
 system.tick(.05,-2000,[body]);assert.equal(state.phase,2);assert.equal(state.held,true);assert.equal(state.orr,'red');assert.equal(state.cross,'red');
 system.tick(.05,-2000,[{...body,y:7}]);assert.equal(state.phase,3,'deck traffic must not occupy the ground junction');
 for(let i=0;i<57*10*20;i++){system.tick(.05,-2000,[]);for(const s of system.states)assert.ok(s.orr==='red'||s.cross==='red');}
});
test('amber decision stays committed through all-red; safe approaches stop',()=>{
 const system=new JunctionSystem(),state=system.states[0],j=state.record;state.phase=1;state.orr='amber';
 assert.equal(system.stopFor(j.stopLine-6,15,4,false,7),Infinity);
 assert.ok(Number.isFinite(system.stopFor(j.stopLine-60,10,4,false,8)));
 state.phase=2;state.orr='red';assert.equal(system.stopFor(j.stopLine-3,15,4,false,7),Infinity);
 assert.ok(Number.isFinite(system.stopFor(j.stopLine-40,8,4,false,8)));
});
test('Sarjapur stops the ground route and leaves the directional opposing flyover free',()=>{
 const system=new JunctionSystem(),state=system.states.find(s=>s.record.id==='signal:1083470977')!,j=state.record;state.phase=3;state.orr='red';
 assert.ok(system.stopFor(j.stopLine-30,8,4,false)<30);
 assert.equal(system.stopFor(j.centre+50,8,4,true),Infinity);
 assert.ok(crossSectionAt(j.centre).oppositeElevation>5);assert.equal(crossSectionAt(j.centre).elevation,0);
});
test('crossing pool queues on red, clears progressively on green, and retains fixed identities',()=>{
 const sys=new JunctionSystem(),j=sys.states[0].record,identities=[...sys.vehicles];
 for(let i=0;i<30*20;i++){sys.states[0].phase=0;sys.states[0].elapsed=0;sys.tick(.05,j.station,[]);}
 const c=crossSectionAt(j.centre);for(const v of sys.vehicles){assert.ok(v.direction===1?v.d+v.length/2<=c.left-5+.001:v.d-v.length/2>=c.oppositeRight+5-.001);}
 let inBox=0;for(let i=0;i<90*20;i++){sys.tick(.05,j.station,[]);inBox+=sys.vehicles.filter(v=>v.active&&v.d>c.left&&v.d<c.oppositeRight).length;}
 assert.ok(inBox>100);assert.equal(sys.vehicles.length,CROSSING_POOL_SIZE);sys.vehicles.forEach((v,i)=>assert.equal(v,identities[i]));
});
test('oriented crossing collisions use world position and elevation',()=>{
 const j=junctionRecords[0],sys=new JunctionSystem(),v=sys.vehicles[0];v.direction=1;v.d=0;
 const crossing=crossingBody(v,j),player=roadBody(j.centre+2.1,0,4.2,1.8);
 assert.ok(overlaps(player,crossing));assert.ok(!overlaps({...player,y:6.2},crossing));assert.ok(!overlaps({...player,x:player.x+20},crossing));
 const sim=new Simulation();sim.start();sim.traffic=[];sim.s=j.centre+2.1;sim.x=0;sim.speed=10;const cross=sim.junctions.vehicles[0];Object.assign(cross,{active:true,junctionId:j.id,direction:1,d:0,speed:0});sim.update(1/60,emptyInput());assert.ok(sim.health<100);assert.equal(sim.collisions,1);
});
test('pause freezes junctions; restart and loop use the same initial offsets',()=>{
 const sim=new Simulation();sim.start();for(let i=0;i<90;i++)sim.update(1/60,emptyInput());sim.pause();const before=JSON.stringify(sim.junctions);for(let i=0;i<90;i++)sim.update(1/60,emptyInput());assert.equal(JSON.stringify(sim.junctions),before);sim.restart();assert.deepEqual(sim.junctions.states.map(s=>[s.phase,s.elapsed]),new JunctionSystem().states.map(s=>[s.phase,s.elapsed]));
});
test('lake, route join and archival records retain geographic identities',()=>{
 const lake=landscape.find(f=>f.id==='landscape:relation/8469370')!;assert.ok(lake.geometry.holes?.length);assert.equal(lake.name,'Agara Lake');assert.ok(lake.to<SILK_LENGTH);assert.ok(lake.from<lake.to);
 assert.equal(manifest.segments.find(s=>s.id==='adobe-electra')!.length,1000);const a=pose(SILK_LENGTH-.001),b=pose(SILK_LENGTH+.001);assert.ok(Math.hypot(a.x-b.x,a.z-b.z,a.y-b.y)<.003);assert.ok(LEGACY_OFFSET>SILK_LENGTH);
 assert.ok(archivedObservations.length>0);assert.ok(observations.every(o=>o.segmentId!=='manipal-approach'||o.localCheckpoint!>=manifest.archivedApproach.sourceTo));
});

test('right-side branches turn onto ORR without extending across the lakes',()=>{
 const sys=new JunctionSystem(),j=junctionRecords.find(j=>j.layout==='right-branch')!,v={...sys.vehicles[0],direction:1 as const,d:-100};
 const approach=crossingBody(v,j),p=pose(j.centre-2);assert.ok((approach.x-p.x)*p.rx+(approach.z-p.z)*p.rz>90);
 const merged=crossingBody({...v,d:100},j);assert.ok(merged.s!>j.centre+80);const q=pose(merged.s!,crossSectionAt(merged.s!).laneCentres[0]);assert.ok(Math.hypot(merged.x-q.x,merged.z-q.z)<.01);assert.ok(Math.abs(merged.yaw-q.yaw)<.01);
});
test('merged crossing cars do not lock adjacent ORR lanes after the Agara ramp',()=>{
 const sim=new Simulation(42);sim.start();sim.s=3707;sim.x=0;const c=crossSectionAt(3730);
 sim.traffic=[{...sim.traffic[0],s:3718,x:crossSectionAt(3718).laneCentres[0],lane:0,targetLane:0,kind:'bus',length:10.8,width:2.6,speed:0,cruise:8,changeTimer:100}, {...sim.traffic[1],s:3730,x:c.laneCentres[1],lane:1,targetLane:1,kind:'truck',length:8,width:2.5,speed:0,cruise:8,changeTimer:100}];
 const cross=sim.junctions.vehicles[4];Object.assign(cross,{active:true,junctionId:'signal:650141450',direction:1,d:1046.69,speed:0});
 for(let i=0;i<45*30;i++)sim.update(1/30,emptyInput());
 assert.ok(sim.traffic.every(v=>v.s>3900),'Both adjacent lanes should discharge');assert.ok(cross.d>1200);
});

test('crossing traffic unable to stop safely at amber clears through all-red',()=>{
 const system=new JunctionSystem(),state=system.states[0],j=state.record,c=crossSectionAt(j.centre),v=system.vehicles[0];v.active=true;v.junctionId=j.id;v.direction=1;v.speed=9;const stop=c.left-5;v.d=stop-v.length/2-2;state.phase=4;state.elapsed=0;
 system.tick(.05,j.station,[]);assert.ok(v.committed);state.phase=5;state.elapsed=0;for(let i=0;i<20;i++)system.tick(.05,j.station,[]);assert.ok(v.d>stop);assert.equal(state.orr,'red');
});
