import {map,nearestStation,pose} from '../game/route';
import type {Point,Geometry} from './types';
export const inspectedOn='2026-09-24';
export function geographic(p:Point):[number,number]{const k=6371008.8*Math.PI/180;return [map.origin[0]-p[1]/k,map.origin[1]+p[0]/(k*Math.cos(map.origin[0]*Math.PI/180))];}
export function local(p:[number,number]):Point{const k=6371008.8*Math.PI/180;return [(p[1]-map.origin[1])*k*Math.cos(map.origin[0]*Math.PI/180),-(p[0]-map.origin[0])*k];}
export function extent(geometry:Geometry){const coordinates=geometry.polygons?.length?geometry.polygons.flat():geometry.coordinates;const points=coordinates.map(p=>nearestStation(...p));const x=coordinates.reduce((v,p)=>v+p[0],0)/points.length,z=coordinates.reduce((v,p)=>v+p[1],0)/points.length;const mid=nearestStation(x,z);return {from:Math.min(...points.map(p=>p.s)),to:Math.max(...points.map(p=>p.s)),station:mid.s,offset:mid.offset,side:(points.every(p=>p.offset<0)?'left':points.every(p=>p.offset>0)?'right':'crossing') as 'left'|'right'|'crossing'};}
export function contains(point:Point,polygon:Point[]){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
export function frontageStart(polygon:Point[]){let best={score:Infinity,s:0};for(let i=1;i<polygon.length;i++){const a=nearestStation(...polygon[i-1]),b=nearestStation(...polygon[i]);const score=(Math.abs(a.offset)+Math.abs(b.offset))/2;if(score<best.score)best={score,s:Math.min(a.s,b.s)};}return best.s;}
export function routePoint(s:number,d:number):Point{const p=pose(s,d);return [p.x,p.z];}
export function streetLink(coordinate:[number,number],heading:number){return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${coordinate.map(n=>n.toFixed(7)).join(',')}&heading=${((heading+360)%360).toFixed(1)}&pitch=0&fov=100`;}
