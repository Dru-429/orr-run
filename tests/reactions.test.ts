import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,emptyInput} from '../src/game/simulation';
import {collisionDamage,impactMotion} from '../src/game/impact';
import {laneCentresAt} from '../src/survey/corridor';
import {TrafficOverview} from '../src/game/trafficMap';
import {facadeSignFaces} from '../src/game/facadeSigns';
const tick=(s:Simulation,n:number,horn=false)=>{for(let i=0;i<n*60;i++)s.update(1/60,{...emptyInput(),horn});};
test('damage is quarter-strength and capped independently of visual impact',()=>{assert.equal(collisionDamage(20),5);assert.equal(collisionDamage(100),8);const event={id:1,obstacle:'test',time:0,severity:1,direction:{x:1,z:1}};for(let t=0;t<1;t+=.01){const m=impactMotion(event,t);assert.ok(Math.abs(m.x)<=.045&&Math.abs(m.z)<=.12&&Math.abs(m.fov)<=2);const r=impactMotion(event,t,true);assert.equal(r.x+r.y+r.z+r.pitch+r.roll+r.fov+r.lag,0);}assert.equal(impactMotion(event,.7).flash,0);});
test('holding against one vehicle cannot repeatedly drain health',()=>{const s=new Simulation();s.start();s.x=laneCentresAt(0)[0];s.traffic=[{...s.traffic[0],kind:'car',s:8,x:s.x,lane:0,targetLane:0,speed:0,cruise:0}];s.speed=24;for(let i=0;i<60;i++)s.update(1/60,{...emptyInput(),throttle:true});const health=s.health;assert.ok(health>=92&&health<100);for(let i=0;i<600;i++)s.update(1/60,{...emptyInput(),throttle:true});assert.equal(s.health,health);});
test('honking elicits safe acceleration and pauses reaction clocks',()=>{const s=new Simulation();s.start();s.s=4100;s.x=laneCentresAt(s.s)[0];s.traffic=[{...s.traffic[0],kind:'car',s:4110,x:s.x,lane:0,targetLane:0,speed:1,cruise:10}];tick(s,.8,true);assert.equal(s.traffic[0].responding,true);assert.ok(s.traffic[0].speed>2);s.pause();const snap=JSON.stringify(s.traffic);tick(s,3,true);assert.equal(JSON.stringify(s.traffic),snap);});
test('blocked honking triggers right-window gesture, with cooldown and recycle reset',()=>{const s=new Simulation();s.start();s.s=4100;s.x=laneCentresAt(s.s)[0];const base=s.traffic[0];s.traffic=[];for(let lane=0;lane<3;lane++)for(let row=0;row<2;row++)s.traffic.push({...base,id:lane*2+row,kind:'car',s:4110+row*9,x:laneCentresAt(4100)[lane],lane,targetLane:lane,speed:0,cruise:0});tick(s,4.3,true);const v=s.traffic[0];assert.ok(v.gestureUntil>s.time);const cooldown=v.gestureCooldown;tick(s,3,true);assert.equal(v.gestureCooldown,cooldown);assert.ok(v.gestureUntil<s.time);s.restart();assert.ok(s.traffic.every(v=>v.gestureUntil===0&&!v.responding));});
test('traffic colours use actual speeds and discard stale distant sections',()=>{const o=new TrafficOverview();o.update(.5,500,[{s:501,speed:0},{s:551,speed:4},{s:601,speed:10}]);assert.equal(o.sections.find(t=>t.from===500)?.color,'red');assert.equal(o.sections.find(t=>t.from===550)?.color,'yellow');assert.equal(o.sections.find(t=>t.from===600)?.color,'blue');o.update(.5,4000,[]);assert.ok(o.sections.every(t=>t.from>=3850));});
test('nameplates use outward road-facing and approaching-side walls',()=>{const faces=facadeSignFaces([[0,0],[20,0],[20,20],[0,20],[0,0]],[-20,10],[-20,60]);assert.equal(faces.length,2);assert.equal(faces[0].nx,-1);assert.equal(faces[1].nz,1);assert.ok(faces.every(f=>f.length===20));});
test('NPC lane changes and horn requests do not overlap each other on a straight road',()=>{
 const s=new Simulation(381);s.start();s.s=4000;s.x=laneCentresAt(s.s)[0];s.traffic=s.traffic.filter(v=>!v.opposite).slice(0,18);s.traffic.forEach((v,i)=>{v.s=4012+Math.floor(i/3)*20;v.lane=i%3;v.targetLane=v.lane;v.x=laneCentresAt(v.s)[v.lane];v.speed=2+i%5;v.changeTimer=0;});
 for(let frame=0;frame<1800;frame++){s.update(1/60,{...emptyInput(),horn:true});for(let i=0;i<s.traffic.length;i++)for(let j=i+1;j<s.traffic.length;j++){const a=s.traffic[i],b=s.traffic[j];assert.ok(Math.abs(a.s-b.s)>=(a.length+b.length)/2||Math.abs(a.x-b.x)>=(a.width+b.width)/2,`overlap ${a.id}/${b.id}`);}}
});
test('separated impacts respect the two-second cooldown and zero health ends the run',()=>{
 const s=new Simulation();s.start();s.s=4000;s.x=laneCentresAt(s.s)[0];
 const car={...s.traffic[0],id:500,kind:'car' as const,length:4.2,width:1.8,s:4003,x:s.x,lane:0,targetLane:0,speed:0,cruise:0};s.traffic=[car];s.speed=24;s.update(1/60,emptyInput());assert.equal(s.health,92);const first=s.impactEvent!.id;
 car.s=s.s+100;s.speed=0;tick(s,.4);car.s=s.s+3;s.speed=24;s.update(1/60,emptyInput());assert.equal(s.health,92);assert.ok(s.impactEvent!.id>first,'A new contact still gives feedback during damage cooldown');
 car.s=s.s+100;s.speed=0;tick(s,2.1);car.s=s.s+3;s.speed=24;s.update(1/60,emptyInput());assert.equal(s.health,84);
 car.s=s.s+100;s.speed=0;tick(s,2.1);s.health=3;car.s=s.s+3;s.speed=24;s.update(1/60,emptyInput());assert.equal(s.health,0);assert.equal(s.phase,'ended');assert.equal(s.speed,0);
});
