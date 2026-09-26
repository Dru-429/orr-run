import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {roadConditions,surfaceCoverage,waterPatches,potholes,protectedSurface,patchRadius,sampleSurface,surfaceLimits,approachingSurfaceLimit,RoadResponse,surfaceMotion,roadConditionExport,conditionAt} from '../src/game/roadConditions';
import {addRoadSurfaces} from '../src/game/roadSurfaceScene';
import {Simulation,emptyInput} from '../src/game/simulation';
import {crossSectionAt,laneCentresAt} from '../src/survey/corridor';
import {ROUTE_LENGTH} from '../src/game/route';
import {TRAFFIC_CONFIG,TRAFFIC_COUNT} from '../src/data/traffic';
import {roadBody,overlaps} from '../src/game/junctions';
const tick=(s:Simulation,seconds:number)=>{for(let i=0;i<seconds*60;i++)s.update(1/60,{...emptyInput(),throttle:true});};

test('158 moving vehicles retain safe density, stable pools and existing coach/crossing counts',()=>{
 const sim=new Simulation();assert.equal(TRAFFIC_COUNT,158);assert.equal(TRAFFIC_CONFIG.sameDirection,105);assert.equal(sim.traffic.filter(v=>v.opposite).length,53);assert.equal(sim.junctions.vehicles.length,12);
 assert.equal(TRAFFIC_CONFIG.sameSpacing,36/1.25);assert.equal(TRAFFIC_CONFIG.opposingSpacing,78/1.25);
 for(const a of sim.traffic)for(const b of sim.traffic)if(a.id<b.id)assert.ok(!overlaps(roadBody(a.s,a.x,a.length,a.width,a.opposite),roadBody(b.s,b.x,b.length,b.width,b.opposite)),`${a.id} and ${b.id}`);
});
test('road coverage is exact, contiguous, stable and severe areas exclude transitions',()=>{
 assert.ok(Math.abs(surfaceCoverage.mild-.5)<1e-10);assert.ok(Math.abs(surfaceCoverage.severe-.2)<1e-10);assert.ok(Math.abs(surfaceCoverage.smooth-.3)<1e-10);
 assert.equal(roadConditions[0].from,0);assert.equal(roadConditions.at(-1)!.to,ROUTE_LENGTH);
 roadConditions.forEach((c,i)=>{if(i)assert.equal(c.from,roadConditions[i-1].to);if(c.from<100)assert.equal(c.kind,'smooth');if(c.kind==='severe')assert.equal(protectedSurface(c.from,c.to),false);});
 const original=JSON.stringify(roadConditionExport);const sim=new Simulation();sim.restart();sim.restart();assert.equal(JSON.stringify(roadConditionExport),original);
});
test('six water patches are ground-level, traversable and their muddy edges stay inside the road',()=>{
 assert.equal(waterPatches.length,6);assert.equal(new Set(waterPatches.map(w=>w.s)).size,6);
 for(const p of waterPatches){assert.ok(p.length>=25&&p.length<=60);assert.equal(protectedSurface(p.s-p.length/2,p.s+p.length/2),false);
  const c=crossSectionAt(p.s);assert.equal(c.elevation,0);assert.ok(c.laneCentres.some(x=>!sampleSurface(p.s,x).wet));
  for(let i=0;i<96;i++){const a=i/96*Math.PI*2,r=patchRadius(p,a)*1.07,x=p.x+Math.cos(a)*p.width/2*r,s=p.s+Math.sin(a)*p.length/2*r,road=crossSectionAt(s);assert.ok(x>road.left&&x<road.right);assert.ok(Math.abs(road.elevation)<.001);}
  assert.ok(sampleSurface(p.s,p.x).wet);assert.equal(sampleSurface(p.s,p.x).limit,surfaceLimits.water);assert.equal(sampleSurface(p.s,c.oppositeCentres[0],2,4,true).wet,false);
 }
});
test('individual wheel contact can hit, avoid or straddle a small pothole',()=>{
 const p=potholes.find(p=>p.width<.65)!;
 assert.ok(sampleSurface(p.s-4.2*.32,p.x+1.8*.39).holes.some(h=>h.id===p.id));
 assert.ok(!sampleSurface(p.s-4.2*.32,p.x).holes.some(h=>h.id===p.id));
 assert.ok(!sampleSurface(p.s-4.2*.32,p.x+2.5).holes.some(h=>h.id===p.id));
});
test('surface resistance slows progressively without health loss, collisions or score inflation',()=>{
 const p=waterPatches[0],s=new Simulation();s.traffic=[];s.start();s.s=p.s-5;s.x=p.x;s.distance=s.s;s.speed=20;
 s.update(1/60,{...emptyInput(),throttle:true});assert.ok(s.speed<20&&s.speed>19.9);assert.equal(s.health,100);assert.equal(s.collisions,0);assert.equal(s.impactEvent,null);
 const start=s.s;tick(s,1);assert.ok(s.speed<18);assert.equal(s.health,100);assert.equal(s.overtakes,0);assert.equal(s.distance,s.s);assert.ok(s.s-start<20);
 s.speed=1;s.update(1/60,{...emptyInput(),brake:true});assert.ok(s.speed<1);const x=s.x;s.update(1/60,{...emptyInput(),right:true});assert.ok(s.x>x);
});
test('rough-road speed ceilings and anticipation are independent of visible motion',()=>{
 for(const kind of ['mild','severe'] as const){const c=roadConditions.find(c=>c.kind===kind&&c.to-c.from>15)!;const s=(c.from+c.to)/2,x=laneCentresAt(s)[2];assert.equal(sampleSurface(s,x).limit,surfaceLimits[kind]);assert.ok(approachingSurfaceLimit(s,x,22,1.8,4.2)<=surfaceLimits[kind]);}
 const p=waterPatches[0];assert.ok(approachingSurfaceLimit(p.s-p.length/2-12,p.x,20,1.8,4.2)<20);
});
test('suspension is speed sensitive, swept, bounded, pauseable, and reduced motion removes all offsets',()=>{
 const p=potholes.find(p=>p.severity===1)!,x=p.x+1.8*.39,start=p.s-3;
 const run=(speed:number)=>{const r=new RoadResponse();let max=0,s=start;for(let i=0;i<120;i++){const to=s+speed/60;r.update(1/60,s,x,to,x,speed);s=to;max=Math.max(max,Math.abs(r.state.y));assert.ok(Math.abs(r.state.y)<=.040001);assert.ok(Math.abs(r.state.pitch)<=.014001);assert.ok(Math.abs(r.state.roll)<=.007001);}return max;};
 assert.ok(run(20)>run(2));const r=new RoadResponse();r.update(.05,start,x,p.s+3,x,25);assert.notEqual(r.state.y,0);assert.deepEqual(surfaceMotion(r.state,true),{y:0,pitch:0,roll:0,lag:0});
 const s=new Simulation();s.traffic=[];s.start();s.s=start;s.x=x;s.speed=15;tick(s,.15);s.pause();const snapshot=s.snapshot();tick(s,2);assert.deepEqual(s.snapshot(),snapshot);s.restart();assert.equal(s.snapshot().surface.y,0);
 s.phase='looping';s.update(.05,emptyInput());assert.equal(s.snapshot().surface.y,0);
});
test('stopping settles vibration; smooth and mild stretches stay gentle',()=>{
 const mild=roadConditions.find(c=>c.kind==='mild')!,x=laneCentresAt(mild.from)[2],r=new RoadResponse();let s=mild.from+2;
 // Use a clear wheel path to measure the continuous vibration, independent of individual holes.
 for(let i=0;i<60;i++){r.update(1/60,s,x,s+.03,x,2);s+=.03;assert.ok(Math.abs(r.state.y)<.01);}
 for(let i=0;i<120;i++)r.update(1/60,s,x,s,x,0);assert.ok(Math.abs(r.state.y)<1e-8);
 assert.equal(conditionAt(50)?.kind,'smooth');
});
test('surface meshes face upward, use finite geometry and reuse materials over three chunk sweeps',()=>{
 const material=()=>new T.MeshStandardMaterial(),m={mild:material(),severe:material(),holes:material(),mud:material(),water:material(),time:{value:0},detail:{value:1},all:[] as T.MeshStandardMaterial[]};
 const resources=new Set<T.Material>([m.mild,m.severe,m.holes,m.mud,m.water]);let first=0;
 for(let loop=0;loop<3;loop++){let total=0;for(let from=0;from<ROUTE_LENGTH;from+=200){const group=new T.Group();addRoadSurfaces(group,from,Math.min(ROUTE_LENGTH,from+200),m);assert.ok(group.children.length<=7);
  group.traverse(o=>{if(!(o instanceof T.Mesh))return;assert.ok(resources.has(o.material));const normals=o.geometry.getAttribute('normal'),positions=o.geometry.getAttribute('position');assert.ok(normals.getY(0)>0);for(const v of positions.array)assert.ok(Number.isFinite(v));total++;o.geometry.dispose();});group.clear();}
  if(!loop)first=total;else assert.equal(total,first);
 }resources.forEach(m=>m.dispose());
});

// Captured from the second-lap density regression near 2,183 m: neither car
// can move forward across the next bend while the outside car is mid-merge.
test('a stalled partial merge retreats safely instead of permanently locking adjacent lanes',()=>{
 const sim=new Simulation(42);sim.s=2148;sim.x=-1.327;sim.start();
 sim.traffic=[{...sim.traffic[0],id:12,kind:'car',length:4.3,width:1.85,s:2182.0480418847974,x:-5.9,lane:0,targetLane:0,speed:0,cruise:10.7},{...sim.traffic[1],id:96,kind:'car',length:4.3,width:1.85,s:2182.957609656223,x:-3.9099346856692057,lane:1,targetLane:0,speed:0,cruise:10.07}];
 for(let i=0;i<60*30;i++){const positions=sim.traffic.map(v=>({s:v.s,x:v.x}));sim.update(1/30,emptyInput());
  const [a,b]=sim.traffic;assert.ok(!overlaps(roadBody(a.s,a.x,a.length,a.width),roadBody(b.s,b.x,b.length,b.width)));
  sim.traffic.forEach((v,j)=>{assert.ok(Math.abs(v.x-positions[j].x)<.15,'No sideways teleport');assert.ok(v.s>=positions[j].s);});
 }
 assert.ok(sim.traffic.every(v=>v.s>2400),'Both lanes must discharge');
});
test('merge recovery waits for a player occupying its source lane, then releases both cars',()=>{
 const sim=new Simulation(42);sim.start();sim.s=2183;sim.x=-1.3;
 sim.traffic=[{...sim.traffic[0],id:12,kind:'car',length:4.3,width:1.85,s:2182.0480418847974,x:-5.9,lane:0,targetLane:0,speed:0,cruise:10.7},{...sim.traffic[1],id:96,kind:'car',length:4.3,width:1.85,s:2182.957609656223,x:-3.9099346856692057,lane:1,targetLane:0,speed:0,cruise:10.07}];
 for(let i=0;i<90;i++){sim.update(1/30,emptyInput());for(const v of sim.traffic)assert.ok(!overlaps(roadBody(v.s,v.x,v.length,v.width),roadBody(sim.s,sim.x,4.2,1.8)));}
 assert.equal(sim.health,100);sim.x=3.3;
 for(let i=0;i<1800;i++)sim.update(1/30,emptyInput());assert.ok(sim.traffic.every(v=>v.s>2400));
});
