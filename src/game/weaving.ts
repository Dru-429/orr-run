import {roadBody,overlaps,type Body} from './junctions';
import {crossSectionAt,laneCentresAt} from '../survey/corridor';
import {parkedBuses} from './parkedBuses';
import {noise} from './roadConditions';

export interface WeaveState {owner:number;kind:string;targetX:number;originX:number;velocity:number;heading:number;timer:number;check:number;serial:number;temperament:number;preference:number;mode:'flow'|'filter'|'waiting';lastS:number;lastX:number}
export interface WeavingVehicle {id:number;kind:string;s:number;x:number;speed:number;cruise:number;length:number;width:number;opposite:boolean;lane:number;targetLane:number;weave?:WeaveState}
export interface WeavePlayer {s:number;x:number;speed:number;velocity:number}
export const isWeaver=(v:Pick<WeavingVehicle,'kind'>)=>v.kind==='bike'||v.kind==='auto';
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
export const weaveRate=(v:WeavingVehicle)=>v.kind==='bike'?1.3:.85;
export const weaveMargin=(v:WeavingVehicle)=>(v.kind==='bike'?.25:.4)+Math.min(.25,v.speed*.015);
export function resetWeave(v:WeavingVehicle,seed=0){
 if(!isWeaver(v)){v.weave=undefined;return;}
 const temperament=noise(seed+v.id*31),preference=(noise(seed+v.id*73+811)>.5?1:-1)*(.65+temperament*.7);
 v.weave={owner:v.id,kind:v.kind,targetX:v.x,originX:v.x,velocity:0,heading:0,timer:0,check:0,serial:0,temperament,preference,mode:'flow',lastS:v.s,lastX:v.x};
}
export function ensureWeave(v:WeavingVehicle,seed=0){
 if(!isWeaver(v)){v.weave=undefined;return;}
 if(!v.weave||v.weave.owner!==v.id||v.weave.kind!==v.kind||Math.abs(v.s-v.weave.lastS)>5||Math.abs(v.x-v.weave.lastX)>1)resetWeave(v,seed);
}
export function trafficBody(v:WeavingVehicle,s=v.s,x=v.x,heading=isWeaver(v)?v.weave?.heading??0:0):Body{
 const b=roadBody(s,x,v.length,v.width,v.opposite,v.speed);b.yaw+=heading;return b;
}
export function lateralHalf(v:WeavingVehicle){const h=isWeaver(v)?v.weave?.heading??0:0;return (Math.abs(Math.cos(h))*v.width+Math.abs(Math.sin(h))*v.length)/2;}
export function longitudinalHalf(v:WeavingVehicle){const h=isWeaver(v)?v.weave?.heading??0:0;return (Math.abs(Math.cos(h))*v.length+Math.abs(Math.sin(h))*v.width)/2;}
export function weaveBounds(v:WeavingVehicle,s=v.s){const c=crossSectionAt(s),margin=v.width/2+(isWeaver(v)?Math.sin((v.kind==='bike'?12:8)*Math.PI/180)*v.length/2:0)+.1;return {left:(v.opposite?c.oppositeLeft:c.left)+margin,right:(v.opposite?c.oppositeRight:c.right)-margin};}
export function reservedX(v:WeavingVehicle){return isWeaver(v)?v.weave?.targetX??v.x:laneCentresAt(v.s,v.opposite)[v.targetLane]??v.x;}
function futureX(v:WeavingVehicle,t:number,target=reservedX(v),speed=v.speed){const rate=isWeaver(v)?Math.min(weaveRate(v),speed*.8):Math.min(3.6,Math.abs(target-v.x)*.8);return v.x+clamp(target-v.x,-rate*t,rate*t);}
/** Required bumper room to match a constant-speed leader after .65 s reaction at 6 m/s². */
export function cutInGap(playerSpeed:number,leaderSpeed:number){const closing=Math.max(0,playerSpeed-leaderSpeed);return 2+closing*.65+closing*closing/12;}
export function playerCutInSafe(v:WeavingVehicle,s:number,x:number,player:WeavePlayer){
 if(v.opposite||Math.abs(roadBody(s,x,v.length,v.width).y-roadBody(player.s,player.x,4.2,1.8).y)>2.5)return true;
 if(Math.abs(x-player.x)>lateralHalf(v)+.9+.2)return true;
 const gap=s-player.s-longitudinalHalf(v)-2.1;
 return gap>=0?gap>=cutInGap(player.speed,v.speed):player.s-s-longitudinalHalf(v)-2.1>=Math.max(1,Math.max(0,v.speed-player.speed)*.8);
}
// Relative-motion slab test covers the space between prediction samples, not just their endpoints.
function sweptRect(ds0:number,dx0:number,ds1:number,dx1:number,hs:number,hx:number,startHx=hx){
 let enter=0,exit=1;
 for(const [a,b,h0,h1] of [[ds0,ds1,hs,hs],[dx0,dx1,startHx,hx]])for(const sign of [-1,1]){
  const value=sign*a-h0,slope=sign*(b-a)-(h1-h0);
  if(Math.abs(slope)<1e-8){if(value>0)return false;}
  else if(slope>0)exit=Math.min(exit,-value/slope);else enter=Math.max(enter,-value/slope);
  if(enter>exit)return false;
 }return true;
}
export function weavePathSafe(v:WeavingVehicle,targetX:number,speed:number,near:WeavingVehicle[],crossing:Body[],player:WeavePlayer,stop=Infinity){
 const dir=v.opposite?-1:1,margin=weaveMargin(v);
 const obstacles=near.filter(o=>o!==v&&o.opposite===v.opposite&&Math.abs(o.s-v.s)<65);
 const parked=v.opposite?[]:parkedBuses.filter(b=>Math.abs(b.s-v.s)<65);
 const samples=12;
 for(let i=1;i<=samples;i++){
  const t=i*.25,prev=t-.25,travel=Math.min(speed*t,Math.max(0,stop-.4)),lastTravel=Math.min(speed*prev,Math.max(0,stop-.4));
  const s=v.s+dir*travel,x=futureX(v,t,targetX,speed),oldX=futureX(v,prev,targetX,speed),bounds=weaveBounds(v,s);
  const heading=Math.min((v.kind==='bike'?12:8)*Math.PI/180,Math.abs(Math.atan2(x-oldX,Math.max(.01,travel-lastTravel)))),ownHalf=v.width/2+Math.sin(heading)*v.length/2;
  const earlier=prev-.25,earlierX=earlier>0?futureX(v,earlier,targetX,speed):v.x,previousHeading=i===1?Math.abs(v.weave?.heading??0):Math.min((v.kind==='bike'?12:8)*Math.PI/180,Math.abs(Math.atan2(oldX-earlierX,Math.max(.01,speed*.25)))),previousHalf=v.width/2+Math.sin(previousHeading)*v.length/2;
  if(x<bounds.left||x>bounds.right)return false;
  for(const o of obstacles){const os=o.s+dir*o.speed*t,lastS=o.s+dir*o.speed*prev,ox=futureX(o,t),lastX=futureX(o,prev);
   // Same-carriageway geometry follows the route; final commitment uses world-space SAT.
   if(sweptRect(v.s+dir*lastTravel-lastS,oldX-lastX,s-os,x-ox,(v.length+o.length)/2+.3,ownHalf+lateralHalf(o)+margin,previousHalf+lateralHalf(o)+margin))return false;
  }
  for(const b of parked)if(sweptRect(v.s+lastTravel-b.s,oldX-b.x,s-b.s,x-b.x,(v.length+b.length)/2+.3,ownHalf+b.width/2+margin,previousHalf+b.width/2+margin))return false;
  if(!v.opposite){
   const ps=player.s+player.speed*t,px=player.x+clamp(player.velocity*t,-2,2);
   if(Math.abs(x-px)<ownHalf+1.1){const gap=s-ps-(v.length+4.2)/2;if(gap>=0){if(gap<cutInGap(player.speed,speed))return false;}else if(-gap-(v.length+4.2)<Math.max(1,Math.max(0,speed-player.speed)*.8))return false;}
  }
  if(crossing.length){const b=roadBody(s,x,v.length+.4,v.width+margin*2,v.opposite,speed);for(const o of crossing){const d=(o.speed??0)*t,predicted={...o,x:o.x-Math.sin(o.yaw)*d,z:o.z-Math.cos(o.yaw)*d};if(Math.hypot(b.x-predicted.x,b.z-predicted.z)<20&&overlaps(b,predicted,.2))return false;}}
 }
 return true;
}
export function gapAt(v:WeavingVehicle,x:number,near:WeavingVehicle[],player:WeavePlayer){
 const dir=v.opposite?-1:1,margin=weaveMargin(v);let gap=150,leaderSpeed=v.cruise;
 for(const o of near){if(o===v||o.opposite!==v.opposite||(o.s-v.s)*dir<=0||Math.abs(o.x-x)>lateralHalf(o)+v.width/2+margin)continue;const d=(o.s-v.s)*dir-longitudinalHalf(o)-v.length/2;if(d<gap){gap=Math.max(0,d);leaderSpeed=o.speed;}}
 if(!v.opposite){for(const b of parkedBuses){if(b.s>v.s&&Math.abs(b.x-x)<(b.width+v.width)/2+margin){const d=b.s-v.s-(b.length+v.length)/2;if(d<gap){gap=Math.max(0,d);leaderSpeed=0;}}}if(player.s>v.s&&Math.abs(player.x-x)<(v.width+1.8)/2+margin){const d=player.s-v.s-(v.length+4.2)/2;if(d<gap){gap=Math.max(0,d);leaderSpeed=player.speed;}}}
 return {gap,leaderSpeed};
}
export function chooseWeave(v:WeavingVehicle,near:WeavingVehicle[],crossing:Body[],player:WeavePlayer,stop:number,dt:number){
 const w=v.weave!;w.timer-=dt;w.check-=dt;
 const current=gapAt(v,v.x,near,player),queue=near.filter(o=>o!==v&&o.opposite===v.opposite&&(o.s-v.s)*(v.opposite?-1:1)>0&&Math.abs(o.s-v.s)<28&&o.speed<6);
 const parked=!v.opposite&&parkedBuses.some(b=>b.s>v.s&&b.s-v.s<45);
 const filtering=queue.length>0||parked;
 const surrounding=queue.length?Math.min(...queue.map(o=>o.speed)):0;
 const limit=filtering?Math.min(25/3.6,surrounding+10/3.6):v.cruise;
 w.mode=filtering?'filter':'flow';
 // Recheck a committed path at 5 Hz; physical movement is checked every step.
 if(w.check<=0){w.check=.2;if(Math.abs(w.targetX-v.x)>.12&&!weavePathSafe(v,w.targetX,Math.min(limit,Math.max(v.speed,1)),near,crossing,player,stop)){w.targetX=v.x;w.velocity=0;w.timer=0;}}
 if(w.timer<=0&&Math.abs(w.targetX-v.x)<.3&&stop>.5&&v.cruise>0){
  const bounds=weaveBounds(v),lanes=laneCentresAt(v.s,v.opposite),candidates=[v.x,lanes[v.lane]+w.preference];
  for(let x=bounds.left;x<=bounds.right;x+=.55)candidates.push(x);
  for(let i=1;i<lanes.length;i++)candidates.push((lanes[i-1]+lanes[i])/2);
  for(const o of near.filter(o=>o!==v&&o.opposite===v.opposite&&Math.abs(o.s-v.s)<35))for(const side of [-1,1])candidates.push(o.x+side*((o.width+v.width)/2+weaveMargin(v)+.22));
  const corridorObstacles=[...near.filter(o=>o!==v&&o.opposite===v.opposite&&(o.s-v.s)*(v.opposite?-1:1)>-2&&Math.abs(o.s-v.s)<30),...(!v.opposite?parkedBuses.filter(o=>o.s>v.s&&o.s-v.s<45):[])];
  const evaluate=(x:number)=>{const g=gapAt(v,x,near,player),room=Math.min(1.5,...corridorObstacles.map(o=>Math.abs(o.x-x)-(o.width+v.width)/2));return Math.min(45,g.gap)*.55+Math.max(0,room)*2.4-Math.abs(x-v.x)*.8-Math.abs(x-(lanes[v.lane]+w.preference))*.32+(Math.abs(x-w.targetX)<.15?.5:0);};
  const ranked=[...new Set(candidates.map(x=>clamp(Math.round(x*100)/100,bounds.left,bounds.right)))].map(x=>({x,score:evaluate(x)})).sort((a,b)=>b.score-a.score);
  for(const c of ranked.slice(0,12))if(c.score>evaluate(v.x)+.15&&weavePathSafe(v,c.x,Math.min(limit,Math.max(.8,Math.min(v.speed,current.gap>8?v.speed:1.2))),near,crossing,player,stop)){w.originX=v.x;w.targetX=c.x;break;}
  w.timer=(v.kind==='bike'?1:2)+noise(v.id*199+(++w.serial)*37+w.temperament*1000)*(v.kind==='bike'?1.5:2);
 }
 if(current.gap<1&&Math.abs(w.targetX-v.x)<.15)w.mode='waiting';
 return {limit,...current};
}
export function weaveStep(v:WeavingVehicle,dt:number,travel:number){
 const w=v.weave!,bounds=weaveBounds(v,v.s+(v.opposite?-travel:travel));w.targetX=clamp(w.targetX,bounds.left,bounds.right);
 const distance=w.targetX-v.x,rate=Math.min(weaveRate(v),travel/dt*.8),desired=clamp(distance*1.7,-rate,rate),acceleration=v.kind==='bike'?2.4:1.6;
 const velocity=w.velocity+clamp(desired-w.velocity,-acceleration*dt,acceleration*dt);
 const dx=clamp(velocity*dt,-Math.abs(distance),Math.abs(distance));
 const x=clamp(v.x+(Math.sign(dx)===Math.sign(distance)?dx:0),bounds.left,bounds.right);
 const desiredHeading=clamp(-Math.atan2((x-v.x)*(v.opposite?-1:1),Math.max(.01,travel)),-(v.kind==='bike'?12:8)*Math.PI/180,(v.kind==='bike'?12:8)*Math.PI/180);
 const heading=w.heading+clamp(desiredHeading-w.heading,-dt*.28,dt*.28);
 return {x:travel>0?x:v.x,velocity:travel>0?(x-v.x)/dt:0,heading:travel>0?heading:w.heading};
}
