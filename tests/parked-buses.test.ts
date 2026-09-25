import {NPCHornSystem,type HornActor} from '../src/game/npcHorns';
import test from 'node:test';
import assert from 'node:assert/strict';
import {parkedBuses,parkedBusGroups,parkedClear} from '../src/game/parkedBuses';
import {Simulation,emptyInput,DIMENSIONS,type VehicleKind} from '../src/game/simulation';
import {laneCentresAt} from '../src/survey/corridor';
import {manifest} from '../src/game/route';
import {roadBody,overlaps} from '../src/game/junctions';
const tick=(s:Simulation,seconds:number)=>{for(let i=0;i<seconds*60;i++)s.update(1/60,emptyInput());};
function setup(start=5300){const s=new Simulation(321);s.start();s.s=start-110;s.x=laneCentresAt(s.s)[2];s.traffic=[];return s;}
function actor(s:Simulation,id:number,station:number,lane:number,kind:VehicleKind='car',speed=8){const base=new Simulation(id+10).traffic[0];const [length,width]=DIMENSIONS[kind];return {...base,id,s:station,x:laneCentresAt(station)[lane],lane,targetLane:lane,kind,length,width,speed,cruise:10,opposite:false,changeTimer:10};}
test('ten fixed coaches have 3/3/4 counts, exact gaps and underpass-relative placement',()=>{
 assert.equal(parkedBuses.length,10);assert.deepEqual(parkedBusGroups.map(g=>g.count),[3,3,4]);assert.equal(parkedBusGroups[2].start,manifest.marathahalliUnderpass.from-500);
 for(const g of parkedBusGroups){const buses=parkedBuses.filter(b=>b.groupId===g.id);assert.ok(Math.abs(buses[0].s-buses[0].length/2-g.start)<1e-8);buses.forEach((b,i)=>{assert.equal(b.x,laneCentresAt(b.s)[0]);assert.equal(b.body.y,0);assert.equal(b.speed,0);if(i)assert.ok(Math.abs(b.s-buses[i-1].s-b.length-2)<1e-8);});}
});
test('each vehicle family merges around every group without touching a coach',()=>{
 for(const group of parkedBusGroups)for(const kind of ['car','cab','auto','bike','bus','truck'] as const){const s=setup(group.start),v=actor(s,1,group.start-65,0,kind);s.traffic=[v];for(let frame=0;frame<60*28;frame++){s.update(1/60,emptyInput());assert.ok(parkedClear(v.s,v.x,v.length,v.width,false,0),`${kind} at ${group.id}`);}assert.ok(v.s>group.start+group.count*12.8,`${kind} must pass ${group.id}`);assert.notEqual(v.lane,0);}
});
test('blocked merge waits, then discharges when player and adjacent queue clear',()=>{
 const s=setup();s.s=5290;s.x=laneCentresAt(s.s)[1];const v=actor(s,1,5290,0,'bus',0);const blockers=[actor(s,2,5275,1,'bus',0),actor(s,3,5310,1,'bus',0)];blockers.forEach(b=>{b.cruise=0;b.changeTimer=1000;});s.traffic=[v,...blockers];tick(s,8);assert.equal(v.targetLane,0);assert.ok(v.s+v.length/2<5300);s.x=laneCentresAt(s.s)[2];s.traffic=[v];tick(s,30);assert.ok(v.s>5340);assert.ok(parkedClear(v.s,v.x,v.length,v.width));
});
test('dense competing merges remain collision-free with fast adjacent traffic',()=>{
 const s=setup(6000);s.traffic=Array.from({length:15},(_,i)=>actor(s,i,5920-Math.floor(i/3)*20,i%3,['car','auto','bike','bus','truck'][i%5] as VehicleKind,i%3===1?16:6));
 for(let frame=0;frame<60*40;frame++){s.update(1/60,emptyInput());for(let i=0;i<s.traffic.length;i++){const a=s.traffic[i];assert.ok(parkedClear(a.s,a.x,a.length,a.width,false,0));for(let j=i+1;j<s.traffic.length;j++){const b=s.traffic[j];assert.ok(!overlaps(roadBody(a.s,a.x,a.length,a.width),roadBody(b.s,b.x,b.length,b.width)),`overlap ${a.id}/${b.id}`);}}}
 assert.ok(s.traffic.some(v=>v.s>6040));
});
test('parked impacts stay capped, cannot move coaches, and sustained contact is one hit',()=>{
 const initial=JSON.stringify(parkedBuses),s=setup();s.s=5296;s.x=laneCentresAt(s.s)[0];s.speed=25;
 for(let i=0;i<60;i++)s.update(1/60,{...emptyInput(),throttle:true,horn:true});assert.equal(s.health,92);assert.equal(s.collisions,1);assert.equal(s.impactEvent?.obstacle,parkedBuses[0].id);
 for(let i=0;i<600;i++)s.update(1/60,{...emptyInput(),throttle:true,horn:true});assert.equal(s.health,92);assert.equal(s.overtakes,0);assert.equal(JSON.stringify(parkedBuses),initial);s.restart();assert.equal(JSON.stringify(parkedBuses),initial);
});
test('spawn reconciliation and recycling avoid coaches; parked sections feed navigation',()=>{
 const s=setup();s.traffic=[actor(s,1,5305,0),actor(s,2,5305,1)];s.clearParkedSpawns();assert.ok(s.traffic.every(v=>parkedClear(v.s,v.x,v.length,v.width)));assert.ok(!overlaps(roadBody(s.traffic[0].s,s.traffic[0].x,4.3,1.85),roadBody(s.traffic[1].s,s.traffic[1].x,4.3,1.85)));
 const v=s.traffic[0];(s as unknown as {recycle(v:typeof v,station:number,behind:boolean):void}).recycle(v,5305,false);assert.ok(parkedClear(v.s,v.x,v.length,v.width));s.traffic=[];tick(s,1);assert.equal(s.snapshot().trafficSections.find(b=>b.from===5300)?.color,'red');assert.equal(s.npcHorns.events.length,0);
});

test('waiting traffic can honk at a silent parked coach',()=>{
 const h=new NPCHornSystem(),b=parkedBuses[0],player={...roadBody(5290,laneCentresAt(5290)[2],4.2,1.8),s:5290,lateral:laneCentresAt(5290)[2],speed:0};
 const actors:HornActor[]=[{...b.body,id:2000,kind:'bus',s:b.s,lateral:b.x,speed:0,opposite:false,silent:true},...Array.from({length:10},(_,i)=>({...roadBody(5296-i*8,b.x,4.3,1.85),id:i,kind:'car' as const,s:5296-i*8,lateral:b.x,speed:0,opposite:false}))];
 let heard=false;for(let i=0;i<300;i++){h.update(.1,i*.1,player,actors,[]);heard ||= h.events.length>0;assert.ok(h.events.every(e=>e.vehicleId!==2000));}assert.ok(heard);
});

test('a tightly packed source-lane queue can escape without its own followers vetoing merges',()=>{
 const s=setup();s.traffic=Array.from({length:12},(_,i)=>actor(s,i,5295-i*5.8,0,'car',0));
 for(let f=0;f<3600;f++){s.update(1/60,emptyInput());for(const v of s.traffic)assert.ok(parkedClear(v.s,v.x,v.length,v.width));}
 assert.ok(s.traffic.every(v=>v.s>5340),'Every queued car must pass once the adjacent lane is clear');
});
