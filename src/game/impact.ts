export interface ImpactEvent {id:number;obstacle:string;time:number;severity:number;direction:{x:number;z:number}}
export const collisionDamage=(previous:number)=>Math.min(8,Math.max(0,previous)*.25);
export function impactMotion(event:ImpactEvent|null,time:number,reduced=false){
 const age=event?time-event.time:1,active=event&&age>=0&&age<.6;
 const envelope=active?Math.pow(1-age/.6,2)*event.severity:0;
 const pulse=active?Math.sin(Math.min(1,age/.07)*Math.PI/2)*envelope:0;
 const spring=active?Math.cos(age*25)*pulse:0;
 return {flash:envelope*(reduced?.16:.36),x:reduced?0:-(event?.direction.x??0)*spring*.045,y:reduced?0:spring*.025,z:reduced?0:-(event?.direction.z??1)*spring*.12,pitch:reduced?0:spring*Math.PI/100,roll:reduced?0:-(event?.direction.x??0)*spring*Math.PI/225,fov:reduced?0:pulse*2,lag:reduced?0:spring*.025};
}
