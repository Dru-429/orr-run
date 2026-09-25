import * as T from 'three';
import {Batch,material} from './assets';
import {hoardings} from './hoardings';
export function addHoardings(world:T.Group,from:number,to:number,posters:T.MeshBasicMaterial[],palette:typeof material){
 for(const h of hoardings.filter(h=>h.station>=from&&h.station<to)){
  const group=new T.Group();group.name=h.id;group.userData.poster=h.poster;
  const steel=palette('#c4c8c6',.55),dark=palette('#455251',.6),concrete=palette('#a1a397');const batch=new Batch();
  const box=(w:number,height:number,d:number,x:number,y:number,z:number,m:T.Material)=>batch.box(w,height,d,h.x+Math.cos(h.yaw)*x+Math.sin(h.yaw)*z,y,h.z-Math.sin(h.yaw)*x+Math.cos(h.yaw)*z,m,h.yaw);
  box(2.4,.65,2.4,0,.325,0,concrete);box(.85,h.bottom+4.5,.85,0,(h.bottom+4.5)/2,-.55,steel);
  box(12.5,9.5,.32,0,h.bottom+4.5,-.04,dark);
  for(const x of [-6.15,6.15])box(.3,9.6,.38,x,h.bottom+4.5,.05,steel);
  for(const y of [h.bottom-.15,h.bottom+9.15])box(12.6,.3,.38,0,y,.05,steel);
  for(const y of [h.bottom+1.5,h.bottom+4.5,h.bottom+7.5])box(12,.18,.4,0,y,-.45,steel);
  for(const x of [-4,4])box(.16,9,.4,x,h.bottom+4.5,-.45,steel);
  box(12.4,.14,1,0,h.bottom-.6,.2,steel);
  for(const x of [-4,0,4]){box(.12,.5,.12,x,h.bottom-.8,.65,dark);box(.65,.22,.4,x,h.bottom-.55,.8,dark);}
  batch.finish(group);
  const poster=new T.Mesh(new T.PlaneGeometry(12,9),posters[h.poster-1]);poster.name='poster-face';poster.position.set(h.x+Math.sin(h.yaw)*.3,h.bottom+4.5,h.z+Math.cos(h.yaw)*.3);poster.rotation.y=h.yaw;group.add(poster);world.add(group);
 }
}
