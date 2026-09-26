import test from 'node:test';
import assert from 'node:assert/strict';
import {buildings,businesses,transport,landscape,features,coverage,observations,evidence,checkpoints} from '../src/survey/records';
import {pose,nearestStation,ROUTE_LENGTH,LEGACY_OFFSET,manifest,map} from '../src/game/route';
import {local,geographic,contains} from '../src/survey/geometry';
import {driveBounds,medianOffset,oppositeOffset,ROAD_WORK,crossSectionAt,supportOffset} from '../src/survey/corridor';
import {Simulation,emptyInput} from '../src/game/simulation';
test('survey has stable unique IDs and distinct serial order on both sides',()=>{
 assert.equal(new Set(features.map(f=>f.id)).size,features.length);
 for(const side of ['left','right']){const ordered=buildings.filter(b=>b.side===side).sort((a,b)=>a.frontage-b.frontage||a.id.localeCompare(b.id));ordered.forEach((b,i)=>assert.equal(b.serial,(side==='left'?'L':'R')+String(i+1).padStart(3,'0')));}
 assert.ok(buildings.length>1300);assert.ok(buildings.every(b=>b.geometry.type==='polygon'));
});
test('business points never create buildings or attach across a footprint boundary',()=>{
 for(const p of businesses){if(!p.buildingId)continue;const candidates=buildings.filter(b=>contains(p.position,b.geometry.coordinates));assert.equal(candidates.length,1);assert.equal(candidates[0].id,p.buildingId);assert.ok(candidates[0].businessIds.includes(p.id));}
});
test('every attribute reference resolves and observed claims have evidence',()=>{
 const ids=new Set(evidence.map(e=>e.id));
 for(const f of features)for(const [key,a] of Object.entries(f.attributes)){
  if(a.confidence==='observed')assert.ok(a.evidence.length,`${f.id}.${key} has no evidence`);
  for(const ref of a.evidence)assert.ok(ids.has(ref),`${f.id}.${key}: ${ref}`);
 }
 assert.equal(buildings.find(b=>b.id==='building:431536369')!.attributes.height.confidence,'estimated');
 assert.equal(buildings.find(b=>b.id==='building:431536369')!.attributes.facade.confidence,'observed');
});
test('preserved inspection IDs and segment-local checkpoints keep incomplete extension explicit',()=>{
 const legacyCheckpoints=checkpoints.filter(c=>c.segmentId==='adobe-electra');assert.equal(legacyCheckpoints.length,41);assert.equal(observations.filter(o=>o.segmentId==='adobe-electra').length,123);
 for(const cp of legacyCheckpoints)for(const direction of ['forward','left','right'])assert.equal(observations.filter(o=>o.segmentId===cp.segmentId&&o.checkpoint===cp.station&&o.direction===direction).length,1);
 assert.equal(coverage.length,manifest.segments.reduce((n,s)=>n+2*(Math.ceil((s.sourceFrom+s.length)/50)-Math.floor(s.sourceFrom/50)),0));assert.ok(coverage.every(c=>c.status==='unresolved'&&c.gaps.length));
 assert.equal(observations.find(o=>o.checkpoint===LEGACY_OFFSET+500)!.locationStatus,'service-road');
 assert.equal(observations.find(o=>o.checkpoint===LEGACY_OFFSET+450)!.imageryDate,'2020-11');
});
test('geographic footprints round-trip and buffers do not collapse onto endpoints',()=>{
 for(const s of [-80,0,250,500,750,1000,1080]){const p=pose(s);const q=nearestStation(p.x,p.z);assert.ok(Math.abs(q.s-s)<1e-6);const restored=local(geographic([p.x,p.z]));assert.ok(Math.hypot(restored[0]-p.x,restored[1]-p.z)<1e-6);}
 for(const s of [25,275,525,775,975]){const p=pose(s,-10);assert.ok(nearestStation(p.x,p.z).offset<0);}
});
test('mapped metro axis is finite and keeps opposing lanes clear of supports',()=>{
 assert.ok(transport.filter(f=>f.kind==='metro-pier').length>150);
 for(let s=LEGACY_OFFSET;s<=ROUTE_LENGTH;s++){assert.ok(Number.isFinite(medianOffset(s)));assert.ok(medianOffset(s)>5);assert.ok(oppositeOffset(s,11)-medianOffset(s)>3);}
});
test('work-zone traffic respects the same barrier boundary as the player',()=>{
 const sim=new Simulation(19);sim.start();sim.s=LEGACY_OFFSET+870;
 sim.traffic=sim.traffic.filter(v=>!v.opposite);sim.traffic.forEach((v,i)=>{v.s=LEGACY_OFFSET+840+i*4;v.x=3.4;v.lane=2;v.targetLane=2;});
 for(let i=0;i<120;i++)sim.update(1/60,emptyInput());
 for(const v of sim.traffic.filter(v=>v.s>=ROAD_WORK.from-2&&v.s<=ROAD_WORK.to+2)){assert.ok(v.x<=driveBounds(v.s,v.width/2).right+.01);}
 assert.ok(driveBounds(LEGACY_OFFSET+870,1.3).right-driveBounds(LEGACY_OFFSET+870,1.3).left>7);
});
test('Ibbalur lake retains its island; game-added potholes stay outside survey evidence',()=>{
 assert.ok(!features.some(f=>/pothole/i.test(f.name+' '+f.kind)));
 const lake=landscape.find(f=>f.id==='landscape:relation/3120373');assert.ok(lake);assert.ok(lake.to<LEGACY_OFFSET);assert.ok(lake.geometry.holes?.length);assert.ok(landscape.some(f=>f.kind==='water'));assert.ok(landscape.some(f=>f.id==='landscape:row:adobe-left'));
});

test('extension measurement and seam preserve original metre geometry',()=>{
 const measure=(points:typeof map.centerline)=>points.slice(1).reduce((sum,b,i)=>sum+Math.hypot(b.p[0]-points[i].p[0],b.p[1]-points[i].p[1]),0);
 assert.ok(Math.abs(measure(map.centerline)-ROUTE_LENGTH)<1e-6);
 assert.equal(manifest.segments.find(s=>s.id==='adobe-electra')!.length,1000);assert.ok(Math.abs(manifest.segments.find(s=>s.id==='adobe-marathahalli')!.offset-LEGACY_OFFSET-1000)<1e-8);
 const a=pose(LEGACY_OFFSET-.001),b=pose(LEGACY_OFFSET+.001);assert.ok(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<.003);
 for(const p of [crossSectionAt(LEGACY_OFFSET-.001),crossSectionAt(LEGACY_OFFSET+.001)])assert.equal(p.laneCentres.length,3);
 assert.equal(checkpoints.at(-1)?.station,ROUTE_LENGTH);assert.equal(coverage.at(-1)?.to,ROUTE_LENGTH);
});
test('wide driving lanes and all rendered metro shafts have clearance on both carriageways',()=>{
 for(let s=0;s<=ROUTE_LENGTH;s+=5){const c=crossSectionAt(s);assert.ok(c.right-c.left>=12.9);assert.equal(c.laneCentres.length,3);assert.ok(c.laneCentres.every(x=>x>c.left&&x<c.right));}
 for(const f of transport.filter(f=>['metro-pier','metro-support-estimate'].includes(f.kind))){
  const c=crossSectionAt(f.station),d=supportOffset(f.station,f.offset);
  for(const [left,right] of [[c.left,c.right],[c.oppositeLeft,c.oppositeRight]])assert.ok(d+1.1<left||d-1.1>right,`Pier ${f.id} intersects rendered road`);
 }
 const c=crossSectionAt(1048);assert.ok(c.laneCentres[1]-c.laneCentres[0]>4.3);
});
test('Marathahalli appends to the exact prior endpoint and ends 100 m after the north ramp',async()=>{
 const previous=(await import('../src/data/segments/silk-v3.json')).default;
 assert.deepEqual(map.centerline.slice(0,previous.centerline.length),previous.centerline);
 const segment=manifest.segments.find(s=>s.id==='adobe-marathahalli')!;assert.equal(segment.offset,previous.length);assert.ok(Math.abs(ROUTE_LENGTH-manifest.marathahalliUnderpass.to-100)<1e-7);
 for(const s of [segment.offset,manifest.marathahalliUnderpass.from,manifest.marathahalliUnderpass.downTo,manifest.marathahalliUnderpass.upFrom,manifest.marathahalliUnderpass.to]){const a=pose(s-.001),b=pose(s+.001);assert.ok(Math.abs(a.y-b.y)<.001);}
 assert.equal(pose((manifest.marathahalliUnderpass.coveredFrom+manifest.marathahalliUnderpass.coveredTo)/2).y,-5.5);
});
