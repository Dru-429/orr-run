import {mapLocations,navigationMapLocations} from '../data/mapLocations';
import {buildings} from '../survey/records';

const buildingById=new Map(buildings.map(building=>[building.id,building]));

// Identifications, not claims that a physical sign exists on the facade.
// Names and board overrides are owned by mapLocations; survey records supply
// only the existing footprint/render geometry.
export const buildingLandmarks=mapLocations.flatMap(location=>{
 const building=buildingById.get(location.id);
 if(!building)return [];
 return [{...location,station:location.distanceFromStart,offset:building.offset,x:building.model.center[0],z:building.model.center[1],height:building.model.height,building,source:building.model.source}];
});

export const navigationLandmarks=navigationMapLocations.flatMap(location=>{
 const building=buildingById.get(location.id);
 if(!building)return [];
 return [{...location,station:location.distanceFromStart,x:building.model.center[0],z:building.model.center[1]}];
});
