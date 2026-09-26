import * as T from 'three';
import {Batch,canvasTexture} from './assets';
import {pose,ROUTE_LENGTH} from './route';
import {crossSectionAt} from '../survey/corridor';
import {buildings,landscape} from '../survey/records';
import {contains} from '../survey/geometry';
import {junctionRecords} from './junctions';
import {noise} from './roadConditions';

// Fictional environmental dressing, deliberately independent of survey observations.
export const footpathWear=Array.from({length:Math.ceil(ROUTE_LENGTH/9)},(_,i)=>i*9+4).flatMap(s=>{
 if(s>=ROUTE_LENGTH||junctionRecords.some(j=>Math.abs(s-j.centre)<j.halfConflict+25))return [];
 const c=crossSectionAt(s);
 return ([-1,1] as const).flatMap(side=>{
  if(side<0?!c.serviceLeftActive:!c.serviceRightActive)return [];
  const seed=Math.round(s)*5+side,d=side<0?c.serviceLeft[0]-.5:c.serviceRight[1]+.5,p=pose(s,d);
  const occupied=[...buildings.filter(b=>s>b.from-4&&s<b.to+4),...landscape.filter(b=>b.kind==='water')].some(f=>(f.geometry.polygons??[f.geometry.coordinates]).some(r=>contains([p.x,p.z],r))&&!(f.geometry.holes??[]).some(r=>contains([p.x,p.z],r)));
  return occupied?[]:[{s,d,seed,side,x:p.x,z:p.z,yaw:p.yaw}];
 });
});
export function makeStreetWearMaterials(){
 const decal=(map:T.Texture)=>new T.MeshStandardMaterial({map,transparent:true,alphaTest:.035,depthWrite:false,roughness:1,polygonOffset:true,polygonOffsetFactor:-1});
 const dirt=decal(canvasTexture(256,256,c=>{
  for(let i=0;i<280;i++){const x=128+(noise(i*7)-.5)*235,y=128+(noise(i*11)-.5)*235,r=3+noise(i*17)*24;const fade=c.createRadialGradient(x,y,0,x,y,r);fade.addColorStop(0,'rgba(91,69,44,.22)');fade.addColorStop(1,'rgba(91,69,44,0)');c.fillStyle=fade;c.fillRect(x-r,y-r,r*2,r*2);}
 }));
 const stain=decal(canvasTexture(256,256,c=>{
  for(let i=0;i<135;i++){const x=128+(noise(i*13)-.5)*190,y=85+(noise(i*19)-.5)*110,r=1+noise(i*23)*15;c.fillStyle=i%3?'rgba(115,43,23,.62)':'rgba(143,54,28,.5)';c.beginPath();c.ellipse(x,y,r,r*.7,noise(i)*3,0,Math.PI*2);c.fill();if(i%9===0){c.fillStyle='rgba(107,42,24,.35)';c.fillRect(x,y,1+r*.18,30+noise(i*29)*90);}}
 }));
 const packets=['#bc392a','#c7a235','#3c8064'].map(color=>new T.MeshStandardMaterial({roughness:.68,metalness:.12,side:T.DoubleSide,map:canvasTexture(128,192,c=>{
  c.fillStyle=color;c.fillRect(0,0,128,192);c.fillStyle='#dbd9c9';c.fillRect(0,0,128,12);c.fillRect(0,180,128,12);c.fillStyle='#f2db82';for(let i=0;i<5;i++){c.beginPath();c.ellipse(45+i*9,108+(i%2)*18,18,9,i*.7,0,Math.PI*2);c.fill();}c.fillStyle='#fff3cd';c.font='bold 21px Arial';c.textAlign='center';c.fillText('CHIPS',64,52);c.strokeStyle='rgba(255,255,255,.4)';for(let i=0;i<7;i++){c.beginPath();c.moveTo(i*20,0);c.lineTo(i*14,192);c.stroke();}
 })}));
 return {dirt,stain,packets,all:[dirt,stain,...packets]};
}
export type StreetWearMaterials=ReturnType<typeof makeStreetWearMaterials>;
export function addFootpathWear(parent:T.Group,from:number,to:number,m:StreetWearMaterials){
 const batch=new Batch();
 for(const p of footpathWear){if(p.s<from||p.s>=to)continue;
  const dirt=new T.PlaneGeometry(.85,2.8);dirt.rotateX(-Math.PI/2);dirt.rotateY(p.yaw);dirt.translate(p.x,.091,p.z);batch.add(dirt,m.dirt);dirt.dispose();
  for(let i=0;i<1+Math.floor(noise(p.seed)*3);i++){
   const q=pose(p.s+(noise(p.seed+i*7)-.5)*2,p.d+(noise(p.seed+i*19)-.5)*.5);
   const packet=new T.PlaneGeometry(.22,.33,2,3),a=packet.getAttribute('position');
   for(let j=0;j<a.count;j++)a.setZ(j,.006+noise(p.seed+j*23+i)*.045);
   packet.computeVertexNormals();packet.rotateX(-Math.PI/2);packet.rotateY(noise(p.seed+i*37)*Math.PI*2);packet.translate(q.x,.095,q.z);batch.add(packet,m.packets[(p.seed+i)%3]);packet.dispose();
  }
 }
 batch.finish(parent,false);
}
/** Attach stains to actual exterior box faces, never free-floating world decals. */
export function stainConcrete(batch:Batch,m:StreetWearMaterials,x:number,base:number,z:number,yaw:number,width:number,depth:number,height:number,seed:number,ends=false){
 if(height<.8||noise(seed)<.3)return;
 const scale=.65+noise(seed*17)*.5,at=Math.min(.45+noise(seed*31)*.6,height*.5);
 for(const side of [-1,1]){
  const plane=new T.PlaneGeometry(Math.min(1.15*scale,depth*.8),Math.min(.9*scale,height*.7));
  plane.rotateY(side*Math.PI/2);plane.translate(side*(width/2+.008),at,0);plane.rotateY(yaw);plane.translate(x,base,z);batch.add(plane,m.stain);plane.dispose();
 }
 if(ends)for(const side of [-1,1]){
  const plane=new T.PlaneGeometry(width*.8,Math.min(.9,height*.7));plane.rotateY(side<0?Math.PI:0);plane.translate(0,.7,side*(depth/2+.008));plane.rotateY(yaw);plane.translate(x,base,z);batch.add(plane,m.stain);plane.dispose();
 }
}
