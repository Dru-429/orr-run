import {buildings,businesses} from '../survey/records';
// Identifications, not claims that a physical sign exists on the facade.
export const buildingLandmarks=buildings.flatMap(b=>{
 const occupants=businesses.filter(p=>p.buildingId===b.id);
 const name=b.name!=='Unidentified building'?b.name:occupants[0]?.name.value;
 if(!name||/^(Block|Tower|Wing)\s/i.test(name)||Math.abs(b.offset)>180)return [];
 return [{id:b.id,name,station:b.station,offset:b.offset,x:b.model.center[0],z:b.model.center[1],height:b.model.height,building:b,source:b.model.source}];
});
