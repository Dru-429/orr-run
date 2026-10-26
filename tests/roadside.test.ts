import test from 'node:test';
import assert from 'node:assert/strict';
import {roadsideProps} from '../src/game/roadside';
import {buildingLandmarks} from '../src/game/landmarks';
import {crossSectionAt} from '../src/survey/corridor';
import {buildings,businesses} from '../src/survey/records';
import {mapLocations} from '../src/data/mapLocations';
test('ambient people and trees stay beyond main and service carriageways',()=>{
 assert.ok(roadsideProps.filter(p=>p.kind==='tree').length>100);
 assert.ok(roadsideProps.filter(p=>p.kind==='people').length>40);
 for(const p of roadsideProps){const c=crossSectionAt(p.s);assert.ok(p.d<c.left-1||p.d>c.oppositeRight+1);for(const [active,edges] of [[c.serviceLeftActive,c.serviceLeft],[c.serviceRightActive,c.serviceRight]] as const)if(active)assert.ok(p.d<edges[0]-1||p.d>edges[1]+1);}
});
test('building labels identify existing footprints or evidence-linked occupants only',()=>{
 assert.ok(buildingLandmarks.length>100);assert.equal(new Set(buildingLandmarks.map(b=>b.id)).size,buildingLandmarks.length);
 for(const label of buildingLandmarks){const b=buildings.find(b=>b.id===label.id)!;const location=mapLocations.find(location=>location.id===label.id)!;assert.equal(label.name,location.name);assert.equal(label.station,location.distanceFromStart);assert.ok(location.name===b.name||businesses.some(p=>p.buildingId===b.id&&p.name.value===location.name));assert.notEqual(label.name,'Unidentified building');}
});
