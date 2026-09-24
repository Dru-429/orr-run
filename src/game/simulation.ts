import {JunctionSystem,roadBody,crossingBody,overlaps} from './junctions';
import {ROUTE_LENGTH} from './route';
import {driveBounds,laneCentresAt} from '../survey/corridor';
import {TRAFFIC_CONFIG,TRAFFIC_COUNT} from '../data/traffic';
export type VehicleKind='car'|'cab'|'auto'|'bike'|'bus'|'truck';
export type Phase='ready'|'driving'|'paused'|'looping'|'ended';
export interface Input {throttle:boolean;brake:boolean;left:boolean;right:boolean;horn:boolean}
export const emptyInput=():Input=>({throttle:false,brake:false,left:false,right:false,horn:false});
export interface Traffic {id:number;s:number;x:number;lane:number;targetLane:number;speed:number;cruise:number;kind:VehicleKind;length:number;width:number;opposite:boolean;braking:boolean;changeTimer:number;passed:boolean;color:number}
export interface Snapshot {phase:Phase;s:number;x:number;speed:number;health:number;distance:number;lap:number;collisions:number;overtakes:number;time:number;steer:number;impact:number;fade:number}
export const DIMENSIONS:Record<VehicleKind,[number,number]>={car:[4.3,1.85],cab:[4.2,1.8],auto:[2.7,1.5],bike:[2.05,.7],bus:[10.8,2.6],truck:[8.0,2.5]};
function random(seed:number){let a=seed;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
export class Simulation {
  phase:Phase='ready';s=0;x=laneCentresAt(0)[0];speed=0;health=100;distance=0;lap=1;collisions=0;overtakes=0;time=0;steer=0;impact=0;fade=0;
  junctions=new JunctionSystem();traffic:Traffic[]=[];private seed:number;private rng:()=>number;private cooldown=0;private loopTimer=0;private loopReset=false;private resumePhase:Phase='driving';
  constructor(seed=TRAFFIC_CONFIG.seed){this.seed=seed;this.rng=random(seed);this.populate();}
  populate(){
    const r=this.rng; const kinds:VehicleKind[]=['car','car','cab','auto','bike','car','bus','bike','truck','auto'];
    this.traffic=Array.from({length:TRAFFIC_COUNT},(_,id)=>{
      const opposite=id>=TRAFFIC_CONFIG.sameDirection;const n=opposite?id-TRAFFIC_CONFIG.sameDirection:id;const lane=n%laneCentresAt(22+Math.floor(n/3)*36,opposite).length;const kind=kinds[Math.floor(r()*kinds.length)];
      const [length,width]=DIMENSIONS[kind];const cruise=kind==='bike'?10+r()*5:kind==='bus'||kind==='truck'?6+r()*4:7+r()*7;
      return {id,s:22+Math.floor(n/3)*(opposite?TRAFFIC_CONFIG.opposingSpacing:TRAFFIC_CONFIG.sameSpacing)+lane*9+r()*8,x:laneCentresAt(22+Math.floor(n/3)*(opposite?TRAFFIC_CONFIG.opposingSpacing:TRAFFIC_CONFIG.sameSpacing)+lane*9,opposite)[lane]??0,lane,targetLane:lane,speed:cruise*.7,cruise,kind,length,width,opposite,braking:false,changeTimer:3+r()*14,passed:false,color:Math.floor(r()*7)};
    });
  }
  start(){if(this.phase==='ready')this.phase='driving';}
  pause(){if(this.phase==='driving'||this.phase==='looping'){this.resumePhase=this.phase;this.phase='paused';}}
  resume(){if(this.phase==='paused')this.phase=this.resumePhase;}
  restart(){this.s=0;this.x=laneCentresAt(0)[0];this.speed=0;this.health=100;this.distance=0;this.lap=1;this.collisions=0;this.overtakes=0;this.time=0;this.steer=0;this.impact=0;this.fade=0;this.cooldown=0;this.rng=random(++this.seed);this.populate();this.junctions.reset();this.phase='driving';}
  snapshot():Snapshot{return {phase:this.phase,s:this.s,x:this.x,speed:this.speed,health:this.health,distance:this.distance,lap:this.lap,collisions:this.collisions,overtakes:this.overtakes,time:this.time,steer:this.steer,impact:this.impact,fade:this.fade};}
  update(dt:number,input:Input){
    dt=Math.min(dt,.05);
    if(this.phase==='looping'){
      this.loopTimer+=dt;this.fade=this.loopTimer<.65?this.loopTimer/.65:Math.max(0,1-(this.loopTimer-.65)/.65);
      if(this.loopTimer>=.65&&!this.loopReset){this.s=0;this.x=laneCentresAt(0)[0];this.speed=Math.min(this.speed,8);this.lap++;this.populate();this.junctions.reset();this.loopReset=true;}
      if(this.loopTimer>=1.3){this.phase='driving';this.fade=0;}
      return;
    }
    if(this.phase!=='driving')return;
    this.time+=dt;this.cooldown=Math.max(0,this.cooldown-dt);this.impact=Math.max(0,this.impact-dt*1.5);
    const target=(Number(input.right)-Number(input.left));this.steer+=(target-this.steer)*Math.min(1,dt*7);
    const acceleration=input.brake?-10.5:input.throttle?4.0-this.speed*.075:-(.4+this.speed*.024);
    this.speed=Math.max(0,Math.min(25,this.speed+acceleration*dt));
    this.x+=this.steer*Math.min(4.7,this.speed*.38)*dt;
    const {left:leftLimit,right:rightLimit}=driveBounds(this.s);
    if(this.x<leftLimit||this.x>rightLimit){this.x=Math.max(leftLimit,Math.min(rightLimit,this.x));if(this.speed>1&&this.cooldown===0)this.hit(3+this.speed*.35);this.speed*=Math.max(0,1-dt*2);}
    this.junctions.tick(dt,this.s,[roadBody(this.s,this.x,4.2,1.8,false,this.speed),...this.traffic.filter(v=>this.junctions.states.some(j=>Math.abs(j.record.centre-v.s)<45)||this.junctions.vehicles.some(c=>c.active&&c.d>10&&Math.abs(this.junctions.state(c.junctionId!).record.centre+c.d-v.s)<50)).map(v=>roadBody(v.s,v.x,v.length,v.width,v.opposite,v.speed))]);
    this.updateTraffic(dt);
    const travel=Math.min(this.speed*dt,ROUTE_LENGTH-this.s);this.s+=travel;
    for(const v of this.traffic){
      if(v.opposite)continue;
      if(Math.abs(v.s-this.s)<(v.length+4.2)/2&&Math.abs(v.x-this.x)<(v.width+1.8)/2){
        if(this.cooldown===0){const relative=Math.abs(this.speed-v.speed);this.hit(5+relative*2.1);}
        if(v.s>=this.s){this.s=Math.max(0,v.s-(v.length+4.2)/2-.03);this.speed=Math.min(this.speed,v.speed*.68);}
        else {v.s=this.s-(v.length+4.2)/2-.1;v.speed=Math.min(v.speed,this.speed);}
      }
      if(v.s>this.s+v.length+4)v.passed=false;
      if(!v.passed&&v.s<this.s-v.length&&this.speed>1){v.passed=true;this.overtakes++;}
    }
    for(const v of this.junctions.vehicles){if(!v.active)continue;const j=this.junctions.state(v.junctionId!).record;const player=roadBody(this.s,this.x,4.2,1.8),other=crossingBody(v,j);if(overlaps(player,other)){if(this.cooldown===0&&(this.speed>.5||v.speed>.5))this.hit(6+Math.hypot(this.speed,v.speed)*1.5);if(Math.cos(player.yaw-other.yaw)>.85&&j.layout==='right-branch'&&v.d>35){if(other.s!>=this.s){this.s=Math.max(0,other.s!-(v.length+4.2)/2-.1);this.speed=Math.min(this.speed,v.speed*.68);}else{v.d-=Math.max(0,(v.length+4.2)/2-(this.s-other.s!))+.1;v.speed=Math.min(v.speed,this.speed);}}else this.speed*=.3;}}
    this.distance=Math.max(this.distance,(this.lap-1)*ROUTE_LENGTH+this.s);
    if(this.health<=0){this.health=0;this.phase='ended';this.speed=0;}
    else if(this.s>=ROUTE_LENGTH-0.001){this.phase='looping';this.loopTimer=0;this.loopReset=false;}
  }
  private hit(damage:number){this.health=Math.max(0,this.health-damage);this.collisions++;this.impact=Math.min(1,damage/20);this.cooldown=1.5;}
  private updateTraffic(dt:number){
    const crossingBodies=this.junctions.vehicles.filter(v=>v.active).map(v=>crossingBody(v,this.junctions.state(v.junctionId!).record));
    const decisions=this.traffic.map(v=>{
      const direction=v.opposite?-1:1;
      let gap=Infinity,frontSpeed=v.cruise;
      for(const o of this.traffic){
        if(o===v||o.opposite!==v.opposite||Math.abs(o.x-v.x)>(v.width+o.width)/2+.5)continue;
        const d=(o.s-v.s)*direction-(o.length+v.length)/2;
        if(d>=-1&&d<gap){gap=d;frontSpeed=o.speed;}
      }
      if(!v.opposite&&Math.abs(this.x-v.x)<(1.8+v.width)/2+.4&&this.s>v.s){const d=this.s-v.s-(4.2+v.length)/2;if(d<gap){gap=d;frontSpeed=this.speed;}}
      // Merged junction vehicles participate in the same leader/follower rules.
      if(crossingBodies.length){const body=roadBody(v.s,v.x,v.length,v.width,v.opposite),tx=-Math.sin(body.yaw),tz=-Math.cos(body.yaw);for(const b of crossingBodies){if(Math.abs(body.y-b.y)>2.5||Math.cos(body.yaw-b.yaw)<.85)continue;const dx=b.x-body.x,dz=b.z-body.z,forward=dx*tx+dz*tz,lateral=Math.abs(-dx*tz+dz*tx);if(forward<=0||lateral>(v.width+b.width)/2+.15)continue;const d=forward-(v.length+b.length)/2;if(d<gap){gap=Math.max(0,d);frontSpeed=b.speed??0;}}}
      // Slow waves feel busy, but recover and never permanently seal the three lanes.
      const wave=(Math.sin(this.time*.15+v.s*.014)+1)*.5;
      const cruise=v.cruise*(.65+.35*wave);
      const desired=Math.max(3, v.speed*1.15);
      let target=gap<desired?Math.max(0,frontSpeed+(gap-desired)*.7):cruise;
      if(gap<1.5)target=0;
      let stop=this.junctions.stopFor(v.s,v.speed,v.length,v.opposite,v.id);
      for(const {record:j} of this.junctions.states){const line=v.opposite?j.centre+j.halfConflict+9:j.stopLine,approach=(line-v.s)*direction-v.length/2;if(approach<0||approach>75)continue;const body=roadBody(v.s,v.x,v.length,v.width,v.opposite);if(Math.abs(body.y-j.elevation)>2.5)continue;const exit=j.centre+direction*(j.halfConflict+v.length+5);if(this.traffic.some(o=>o!==v&&o.opposite===v.opposite&&Math.abs(o.x-v.x)<(o.width+v.width)/2+.4&&Math.abs(o.s-exit)<(o.length+v.length)/2+3&&o.speed<2))stop=Math.min(stop,approach);}
      target=Math.min(target,Math.sqrt(2*4*Math.max(0,stop-.4)));
      if(crossingBodies.length){const current=roadBody(v.s,v.x,v.length,v.width,v.opposite),look=4+v.speed*v.speed/8;for(const b of crossingBodies){if(Math.cos(current.yaw-b.yaw)>.85)continue;if((current.x-b.x)**2+(current.z-b.z)**2>(look+15)**2)continue;if(overlaps(roadBody(v.s+direction*look/2,v.x,v.length+look,v.width,v.opposite),b,.15))target=0;}}
      return {v,target,front:gap,stop};
    });
    for(const {v,target,front,stop} of decisions){
      const lanes=laneCentresAt(v.s,v.opposite);v.targetLane=Math.min(v.targetLane,lanes.length-1);v.lane=Math.min(v.lane,lanes.length-1);
      v.braking=target<v.speed-.7;
      v.speed+=Math.max(-7*dt,Math.min(2.2*dt,target-v.speed));v.speed=Math.max(0,v.speed);
      v.changeTimer-=dt;
      if(!v.opposite&&v.changeTimer<=0&&stop>80&&front<23&&Math.abs(v.x-lanes[v.targetLane])<.1){
        const next=v.lane+(this.rng()>.5?1:-1);
        if(next>=0&&next<lanes.length){
          const safe=this.traffic.every(o=>o===v||o.opposite||(Math.abs(o.x-lanes[next])>2.8&&o.targetLane!==next)||Math.abs(o.s-v.s)>Math.max(17,v.speed*2));
          const playerSafe=Math.abs(this.x-lanes[next])>2.7||Math.abs(this.s-v.s)>20;
          const crossSafe=crossingBodies.every(b=>b.s===undefined||Math.abs(b.s-v.s)>30||!overlaps(roadBody(v.s,lanes[next],v.length+16,v.width,v.opposite),b,.2));if(safe&&playerSafe&&crossSafe)v.targetLane=next;
        }
        v.changeTimer=4+this.rng()*9;
      }
      v.x+=(lanes[v.targetLane]-v.x)*Math.min(1,dt*.8)*Math.min(1,Math.max(.22,v.speed));if(Math.abs(v.x-lanes[v.targetLane])<.1)v.lane=v.targetLane;
      if(!v.opposite)v.x=Math.max(driveBounds(v.s,v.width/2+.1).left,Math.min(driveBounds(v.s,v.width/2+.1).right,v.x));
      v.s+=Math.min(v.speed*dt,stop,Math.max(0,front-.5))*(v.opposite?-1:1);
      // Recycle beyond both the forward view and the 150 m rear-view far plane.
      if(v.s<this.s-220)this.recycle(v,this.s+900,false);
      if(v.s>this.s+940)this.recycle(v,this.s-180,true);
    }
  }
  private recycle(v:Traffic,station:number,behind:boolean){
    const lanes=laneCentresAt(station,v.opposite);
    for(let j=0;j<lanes.length;j++){
      const lane=(v.lane+j)%lanes.length,x=lanes[lane];
      const clear=this.traffic.every(o=>o===v||o.opposite!==v.opposite||Math.abs(o.x-x)>2.8||Math.abs(o.s-station)>(o.length+v.length)/2+12);
      if(clear){v.s=station;v.lane=lane;v.targetLane=lane;v.x=x;v.speed=v.cruise*.7;v.passed=behind;return;}
    }
    // Wait out of sight until a safe gap exists; never spawn overlapping a queue.
  }
}
