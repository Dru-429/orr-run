import test from 'node:test';
import * as T from 'three';
import {addFootpathWear,stainConcrete} from '../src/game/streetWear';
import {Batch} from '../src/game/assets';
import {ROUTE_LENGTH} from '../src/game/route';
import assert from 'node:assert/strict';
import {Simulation,emptyInput} from '../src/game/simulation';
import {laneCentresAt,crossSectionAt} from '../src/survey/corridor';
import {NPCHornSystem,type HornActor} from '../src/game/npcHorns';
import {footpathWear} from '../src/game/streetWear';
import {roadBody,overlaps} from '../src/game/junctions';

test('buses retain safe voluntary lane changes in both directions',()=>{
 for(const kind of ['bus'] as const)for(const opposite of [false,true]){
  const sim=new Simulation(21);sim.start();sim.s=1600;sim.x=laneCentresAt(1600)[0];
  const v=sim.traffic[0],lane=1;Object.assign(v,{kind,length:kind==='bus'?10.8:kind==='auto'?2.7:2.05,width:kind==='bus'?2.6:kind==='auto'?1.5:.7,opposite,s:1700,x:laneCentresAt(1700,opposite)[lane],lane,targetLane:lane,speed:8,cruise:10,changeTimer:0});sim.traffic=[v];
  sim.update(1/60,emptyInput());assert.notEqual(v.targetLane,lane,kind+' should propose an unblocked adjacent lane');assert.ok(Math.abs(v.x-laneCentresAt(1700,opposite)[lane])<.15,'no lateral teleport');
  assert.ok(v.changeTimer>=9);
 }
});
test('voluntary merges wait for occupied adjacent lanes and remain collision-free',()=>{
 const sim=new Simulation(19);sim.start();sim.s=1600;sim.x=laneCentresAt(1600)[0];const cars=sim.traffic.slice(0,3);sim.traffic=cars;
 cars.forEach((v,lane)=>Object.assign(v,{opposite:false,kind:lane===1?'bus':'car',length:lane===1?10.8:4.3,width:lane===1?2.6:1.85,s:1680,x:laneCentresAt(1680)[lane],lane,targetLane:lane,speed:6,cruise:8,changeTimer:lane===1?0:1000}));
 sim.update(1/60,emptyInput());assert.equal(cars[1].targetLane,1);
 for(let i=0;i<600;i++){sim.update(1/60,emptyInput());for(const a of cars)for(const b of cars)if(a.id<b.id)assert.ok(!overlaps(roadBody(a.s,a.x,a.length,a.width),roadBody(b.s,b.x,b.length,b.width)));}
});
test('four vehicles in cockpit view sustain varied horns; three or off-screen traffic do not',()=>{
 const actors:HornActor[]=Array.from({length:6},(_,i)=>({id:i,kind:(['auto','bike','bus','car','cab','truck'] as const)[i],s:50+i*12,lateral:i%3*4,x:i%3*4,y:0,z:-50-i*12,speed:9,length:4,width:2,opposite:false}));
 const player={s:0,lateral:0,x:0,y:0,z:0,speed:9};
 const h=new NPCHornSystem();let sounding=0;const sources=new Set<number>();
 for(let i=0;i<300;i++){h.update(.1,i*.1,player,actors,[],[0,1,2,3,4,5]);if(h.events.length)sounding++;assert.ok(h.events.length<=4);h.events.forEach(e=>sources.add(e.vehicleId));}
 assert.ok(sounding>270);assert.ok(sources.size>=4);
 for(const visible of [[],[0,1,2]]){const quiet=new NPCHornSystem();for(let i=0;i<100;i++)quiet.update(.1,i*.1,player,actors,[],visible);assert.equal(quiet.events.length,0);}
 h.reset();assert.equal(h.events.length,0);
});
test('litter remains deterministic on service-road footpaths, away from junction conflict areas',()=>{
 assert.ok(footpathWear.length>200);const ids=new Set<string>();
 for(const p of footpathWear){const c=crossSectionAt(p.s);assert.equal(p.d,p.side<0?c.serviceLeft[0]-.5:c.serviceRight[1]+.5);assert.ok(p.side<0?c.serviceLeftActive:c.serviceRightActive);const id=p.s+':'+p.side;assert.ok(!ids.has(id));ids.add(id);}
});

test('street dressing batches finite geometry and reuses five materials across three route sweeps',()=>{
 const mats=Array.from({length:5},()=>new T.MeshStandardMaterial()),m={dirt:mats[0],stain:mats[1],packets:mats.slice(2),all:mats};let initial=0;
 for(let lap=0;lap<3;lap++){let meshes=0;for(let from=0;from<ROUTE_LENGTH;from+=200){const group=new T.Group();addFootpathWear(group,from,from+200,m);const b=new Batch();stainConcrete(b,m,0,0,0,.3,1.6,2.3,6,Math.round(from),true);b.finish(group,false);assert.ok(group.children.length<=5);group.traverse(o=>{if(o instanceof T.Mesh){assert.ok(mats.includes(o.material));for(const value of o.geometry.getAttribute('position').array)assert.ok(Number.isFinite(value));o.geometry.dispose();meshes++;}});}if(lap===0)initial=meshes;else assert.equal(meshes,initial);}
 mats.forEach(m=>m.dispose());
});

test('busy-view horn selection tolerates recycled actors without stale reaction state',()=>{
 const h=new NPCHornSystem(),player={s:0,lateral:0,x:0,y:0,z:0,speed:10};
 const actors:HornActor[]=Array.from({length:4},(_,id)=>({id,kind:'car',s:20+id*8,lateral:0,x:0,y:0,z:-20-id*8,speed:10,length:4,width:2,opposite:false}));
 h.update(.1,0,player,actors,[],[0,1,2,3]);actors.forEach(v=>{v.s+=85;v.z-=85;});
 h.update(.1,3,player,actors,[],[0,1,2,3]);h.update(.1,3.1,player,actors,[],[0,1,2,3]);assert.ok(h.events.length<=4);
});
