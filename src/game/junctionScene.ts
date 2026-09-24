import * as T from 'three';
import {junctionRecords,type JunctionSystem} from './junctions';
import {pose} from './route';
import {crossSectionAt} from '../survey/corridor';
import {Batch,material,sign} from './assets';
/** Signal placement and crossing roads derive from the simulation's junction records. */
export function makeJunctionScene(scene:T.Scene){
 const root=new T.Group(),batch=new Batch(),heads:{id:string;movement:'orr'|'cross';lamps:T.Mesh[]}[]=[];
 const dark=material('#303b38'),pole=material('#647b81'),white=material('#e7e6d6'),asphalt=material('#606760');
 const lampGeometry=new T.CircleGeometry(.14,12),lampMaterials=['#ff594a','#ffbf42','#5aff93'].map(color=>new T.MeshBasicMaterial({color})),off=material('#202a25');
 const groups=junctionRecords.map(j=>{const group=new T.Group();root.add(group);const c=crossSectionAt(j.centre),p=pose(j.centre,(c.left+c.oppositeRight)/2);
  // Original cross-road geometry. Its exact width and movements remain estimated.
  const half=j.layout==='right-branch'?j.crossingHalfLength/2:j.crossingHalfLength,roadCentre=j.layout==='right-branch'?pose(j.centre-2,j.crossingHalfLength/2):p;const road=new T.Mesh(new T.BoxGeometry(half*2,.08,11),asphalt);road.position.set(roadCentre.x,j.elevation+.01,roadCentre.z);road.rotation.y=p.yaw;group.add(road);
  function head(s:number,d:number,yawOffset:number,movement:'orr'|'cross'){
   const p=pose(s,d),mast=new T.Mesh(new T.CylinderGeometry(.09,.11,5.3,8),pole);mast.position.set(p.x,j.elevation+2.65,p.z);group.add(mast);
   const housing=new T.Group();housing.position.set(p.x,j.elevation+4.4,p.z);housing.rotation.y=p.yaw+yawOffset;
   const box=new T.Mesh(new T.BoxGeometry(.56,1.4,.3),dark);housing.add(box);
   const lamps=lampMaterials.map((mat,i)=>{const mesh=new T.Mesh(lampGeometry,off);mesh.position.set(0,.44-i*.44,.16);housing.add(mesh);return mesh;});group.add(housing);heads.push({id:j.id,movement,lamps});
  }
  for(const d of [c.left-1,c.right+1])head(j.stopLine+2,d,0,'orr');
  if(Math.abs(c.oppositeElevation-j.elevation)<2.5)head(j.centre+j.halfConflict+7,c.oppositeRight+1,Math.PI,'orr');
  if(j.layout==='crossroad')head(j.centre-6,c.left-7,-Math.PI/2,'cross');head(j.centre+6,c.oppositeRight+7,Math.PI/2,'cross');
  for(const opposite of [false,true]){if(opposite&&Math.abs(c.oppositeElevation-j.elevation)>2.5)continue;const a=opposite?c.oppositeLeft:c.left,b=opposite?c.oppositeRight:c.right,s=opposite?j.centre+j.halfConflict+9:j.stopLine,q=pose(s,(a+b)/2);batch.box(b-a,.025,.4,q.x,j.elevation+.095,q.z,white,q.yaw);}
  if(j.id==='signal:1083470977'){
   const boundary=sign('NO ENTRY',3.2,1.2,'#f9eee4','#973a32','GAME BOUNDARY · STAY ON ORR');const q=pose(j.centre+9,c.right+3);boundary.position.set(q.x,3.1,q.z);boundary.rotation.y=q.yaw;group.add(boundary);
  }
  return {group,station:j.station};
 });batch.finish(root,false);scene.add(root);
 return {update(system:JunctionSystem,station:number){for(const g of groups)g.group.visible=Math.abs(g.station-station)<650;for(const h of heads){const lamp=system.state(h.id)[h.movement],active=lamp==='red'?0:lamp==='amber'?1:2;h.lamps.forEach((l,i)=>l.material=i===active?lampMaterials[i]:off);}},dispose(){const geos=new Set<T.BufferGeometry>(),mats=new Set<T.Material>(),textures=new Set<T.Texture>();root.traverse(o=>{if(o instanceof T.Mesh){geos.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){mats.add(m);Object.values(m).forEach(v=>{if(v instanceof T.Texture)textures.add(v);});}}});geos.forEach(g=>g.dispose());new Set([...mats,...lampMaterials,off]).forEach(m=>m.dispose());textures.forEach(t=>t.dispose());scene.remove(root);}};
}
