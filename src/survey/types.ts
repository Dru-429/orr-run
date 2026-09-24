export type Confidence='observed'|'map-derived'|'estimated'|'unknown';
export type Side='left'|'right'|'crossing';
export type Point=[number,number]; // Local metres: east, south. Never screen pixels.
export interface Attribute<T=unknown>{value:T;confidence:Confidence;evidence:string[];note?:string}
export interface Evidence{id:string;url:string;inspectedOn:string|null;imageryDate:string|null;sourceDate?:string;kind:'osm'|'street-view'|'reference';note:string}
export interface Geometry{type:'point'|'line'|'polygon';coordinates:Point[];polygons?:Point[][];holes?:Point[][]}
export interface Feature{segmentId:string;localFrom:number;localTo:number;localStation:number;id:string;kind:string;name:string;geometry:Geometry;from:number;to:number;station:number;offset:number;side:Side;attributes:Record<string,Attribute>;evidence:string[];unresolved:string[]}
export interface Business{id:string;name:Attribute<string>;buildingId:string|null;position:Point;source:string}
export interface Observation{segmentId?:string;localCheckpoint?:number;id:string;checkpoint:number;direction:'forward'|'left'|'right'|'back';requested:[number,number];actual:[number,number]|null;heading:number;imageryDate:string|null;inspectedOn:string;url:string;panoramaId:string|null;locationStatus:'matched'|'service-road'|'unresolved';notes:string;featureIds:string[]}
export interface Checkpoint{segmentId:string;localStation:number;id:string;station:number;coordinate:[number,number];heading:number;links:Record<'forward'|'left'|'right'|'back',string>}
export interface Coverage{segmentId:string;localFrom:number;localTo:number;from:number;to:number;side:'left'|'right';review:'reviewed';status:'unresolved'|'survey-complete';featureIds:string[];observationIds:string[];gaps:string[]}
