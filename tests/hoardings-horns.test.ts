import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hoardings,clearHoardingPoint} from '../src/game/hoardings';
import {pose} from '../src/game/route';
import {crossSectionAt} from '../src/survey/corridor';
import {NPCHornSystem,HORN_PRESETS,hornEnvelope,type HornActor} from '../src/game/npcHorns';
import {DrivingAudio} from '../src/game/audio';
import {Simulation,emptyInput} from '../src/game/simulation';
const player={s:4100,lateral:0,x:0,y:0,z:0,speed:0};
const car=(id:number,s=4092):HornActor=>({id,s,lateral:0,x:0,y:0,z:s-4100,speed:0,length:4.3,width:1.85,opposite:false,kind:'car'});
const tick=(h:NPCHornSystem,seconds:number,actors:HornActor[],signals:{s:number;y:number;red:boolean}[]=[])=>{let priority=0,seen=new Set<number>();for(let i=0;i<seconds*10;i++){h.update(.1,(i+1)*.1,player,actors,signals);assert.ok(h.events.length<=4);assert.ok(h.events.filter(e=>e.priority).length<=2);priority+=h.events.filter(e=>e.priority).length;h.events.forEach(e=>seen.add(e.preset));}return {priority,seen};};
test('14 close left-side hoardings repeat seven unchanged 4:3 posters at exact 800 m stations',()=>{
 assert.equal(hoardings.length,14);assert.equal(new Set(hoardings.map(h=>h.id)).size,14);
 hoardings.forEach((h,i)=>{assert.equal(h.station,400+800*i);assert.equal(h.side,'left');const setback=crossSectionAt(h.station).left-h.offset;assert.ok(setback>=6.75&&setback<=18);assert.equal(h.poster,i%7+1);assert.equal(h.width/h.height,4/3);const png=readFileSync(`public/hoardings/${h.poster}.png`);assert.equal(png.readUInt32BE(16)/png.readUInt32BE(20),4/3);assert.ok(h.bottom>=6&&h.bottom>=pose(h.station).y+3);assert.ok(clearHoardingPoint([h.x,h.z],1.2));for(const t of [-6.3,-3,0,3,6.3])assert.ok(clearHoardingPoint([h.x+Math.cos(h.yaw)*t,h.z-Math.sin(h.yaw)*t],.3,h.bottom));const p=pose(h.station-120);assert.ok(Math.sin(h.yaw)*(p.x-h.x)+Math.cos(h.yaw)*(p.z-h.z)>0);});
});
test('stopped-player horns begin after two seconds, repeat, and stop when moving',()=>{
 const h=new NPCHornSystem();const actors=[car(1),car(2,4083),car(3,4078)];tick(h,1.9,actors);assert.equal(h.events.filter(e=>e.priority).length,0);h.update(.2,2.1,player,actors,[]);assert.equal(h.events.filter(e=>e.priority).length,2);assert.ok(tick(new NPCHornSystem(),15,actors).priority>150);h.update(.1,2.2,{...player,speed:1},actors,[]);assert.ok(h.events.every(e=>!e.priority));
});
test('normal red queues and separate road levels do not trigger impatient followers',()=>{
 assert.equal(tick(new NPCHornSystem(),15,[car(1),car(2,4083)],[{s:4120,y:0,red:true}]).priority,0);
 assert.equal(tick(new NPCHornSystem(),15,[{...car(1),y:7}]).priority,0);
});
test('traffic horns vary by vehicle type, remain bounded, and reset recycled actors',()=>{
 assert.equal(HORN_PRESETS.length,15);assert.equal(new Set(HORN_PRESETS.map(p=>p.frequencies.join(','))).size,15);
 const actors=Array.from({length:24},(_,i)=>({...car(i,4120+Math.floor(i/3)*8),lateral:i%3*4,x:i%3*4,kind:['car','auto','bike','bus','truck'][i%5] as HornActor['kind']}));
 const h=new NPCHornSystem();const result=tick(h,90,actors);assert.ok(result.seen.size>=8);assert.equal(result.priority,0);if(h.events.length){const id=h.events[0].vehicleId;h.recycle(id);assert.ok(h.events.every(e=>e.vehicleId!==id));}h.reset();assert.equal(h.events.length,0);
 for(const p of HORN_PRESETS){assert.equal(hornEnvelope(p,-.1,1),0);assert.equal(hornEnvelope(p,1,1),0);assert.ok(hornEnvelope(p,.1,1)>0);}
});
test('NPC horn choices leave seeded driving behaviour unchanged',()=>{
 const a=new Simulation(51),b=new Simulation(51);a.start();b.start();b.npcHorns.update=()=>{};for(let i=0;i<600;i++){a.update(1/60,emptyInput());b.update(1/60,emptyInput());}assert.deepEqual(a.traffic,b.traffic);assert.equal(a.s,b.s);const before=JSON.stringify(a.npcHorns.events);a.pause();a.update(.05,emptyInput());assert.equal(JSON.stringify(a.npcHorns.events),before);a.restart();assert.equal(a.npcHorns.events.length,0);
});
test('traffic horn levels use a fixed pool while pause still silences playback',()=>{
 const prior=Object.getOwnPropertyDescriptor(globalThis,'AudioContext');let nodes=0,closed=0;const values:number[]=[];
 const param=()=>({value:0,setTargetAtTime(v:number){values.push(v);},setValueAtTime(v:number){values.push(v);}});
 const node=()=>{nodes++;return {connect(){},start(){},gain:param(),frequency:param(),pan:param(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param(),type:''};};
 class FakeContext {currentTime=0;destination={};createGain=node;createOscillator=node;createBiquadFilter=node;createStereoPanner=node;createDynamicsCompressor=node;resume(){return Promise.resolve();}close(){closed++;return Promise.resolve();}}
 Object.defineProperty(globalThis,'AudioContext',{configurable:true,value:FakeContext});
 try{const a=new DrivingAudio();a.start();const count=nodes;const events=Array.from({length:4},(_,i)=>({id:i,vehicleId:i,preset:i,start:0,duration:2,x:i,y:0,z:4,priority:false}));a.trafficHornLevel=1;a.update(0,false,false,true,events,undefined,.5);assert.equal(a.trafficHornLevel,1);assert.equal(a.activeVoices,1);a.trafficHornLevel=2;for(let i=0;i<1000;i++)a.update(0,false,false,true,events,undefined,.5);assert.equal(nodes,count);assert.equal(a.activeVoices,4);assert.equal(a.voiceCount,4);a.trafficHornLevel=0;a.update(0,false,true,true,events,undefined,.5);assert.equal(a.activeVoices,0);a.update(0,false,false,false,events,undefined,.5);assert.equal(a.activeVoices,0);assert.ok(values.every(Number.isFinite));a.dispose();assert.equal(closed,1);}finally{if(prior)Object.defineProperty(globalThis,'AudioContext',prior);else Reflect.deleteProperty(globalThis,'AudioContext');}
});
