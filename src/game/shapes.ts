import * as T from 'three';
import {contains} from '../survey/geometry';
import type {Geometry} from '../survey/types';
/** Geographic outer rings and holes remain in their original planar coordinates. */
export function polygonShapes(geometry:Pick<Geometry,'coordinates'|'polygons'|'holes'>){
 return (geometry.polygons?.length?geometry.polygons:[geometry.coordinates]).map(ring=>{
  const shape=new T.Shape(ring.map(p=>new T.Vector2(p[0],-p[1])));
  for(const hole of geometry.holes??[])if(hole.length&&contains(hole[0],ring))shape.holes.push(new T.Path(hole.map(p=>new T.Vector2(p[0],-p[1]))));
  return shape;
 });
}
