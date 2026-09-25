import type {VehicleKind} from './simulation';
export interface HornPreset {family:VehicleKind;frequencies:[number,number];wave:OscillatorType;filter:number;pattern:'steady'|'double'|'triple';wobble:number}
export const HORN_PRESETS:HornPreset[]=[
 {family:'car',frequencies:[350,440],wave:'sawtooth',filter:1700,pattern:'steady',wobble:3},
 {family:'car',frequencies:[390,490],wave:'square',filter:1450,pattern:'double',wobble:0},
 {family:'car',frequencies:[315,420],wave:'sawtooth',filter:2100,pattern:'triple',wobble:5},
 {family:'auto',frequencies:[510,640],wave:'square',filter:2300,pattern:'double',wobble:7},
 {family:'auto',frequencies:[570,720],wave:'sawtooth',filter:2600,pattern:'triple',wobble:12},
 {family:'auto',frequencies:[465,590],wave:'square',filter:1950,pattern:'steady',wobble:6},
 {family:'bike',frequencies:[780,980],wave:'square',filter:2500,pattern:'double',wobble:0},
 {family:'bike',frequencies:[690,870],wave:'sawtooth',filter:2800,pattern:'triple',wobble:9},
 {family:'bike',frequencies:[860,1050],wave:'triangle',filter:3400,pattern:'steady',wobble:4},
 {family:'bus',frequencies:[190,250],wave:'sawtooth',filter:1100,pattern:'steady',wobble:2},
 {family:'bus',frequencies:[220,290],wave:'square',filter:1250,pattern:'double',wobble:3},
 {family:'bus',frequencies:[165,225],wave:'sawtooth',filter:900,pattern:'triple',wobble:4},
 {family:'truck',frequencies:[125,170],wave:'sawtooth',filter:850,pattern:'steady',wobble:2},
 {family:'truck',frequencies:[145,195],wave:'square',filter:1000,pattern:'double',wobble:5},
 {family:'truck',frequencies:[105,155],wave:'sawtooth',filter:700,pattern:'triple',wobble:3},
];
export interface HornActor {silent?:boolean;id:number;kind:VehicleKind;s:number;lateral:number;x:number;y:number;z:number;speed:number;length:number;width:number;opposite:boolean}
export interface NPCHornEvent {id:number;vehicleId:number;preset:number;start:number;duration:number;x:number;y:number;z:number;priority:boolean}
export interface HornPlayer {s:number;lateral:number;x:number;y:number;z:number;speed:number}
export interface HornSignal {s:number;y:number;red:boolean}
const noise=(seed:number,id:number,n:number)=>{let x=Math.imul(seed^id*374761393^n*668265263,1274126177);x=(x^(x>>>13))>>>0;return x/4294967296;};
export class NPCHornSystem {
 events:NPCHornEvent[]=[];private stopped=0;private serial=0;private states=new Map<number,{next:number;queued:number;count:number;station:number;priority:boolean}>();
 constructor(private seed=92926){}
 reset(){this.events=[];this.states.clear();this.stopped=0;}
 recycle(id:number){this.states.delete(id);this.events=this.events.filter(e=>e.vehicleId!==id);}
 update(dt:number,time:number,player:HornPlayer,actors:HornActor[],signals:HornSignal[]){
  this.stopped=player.speed<1/3.6?this.stopped+dt:0;
  const redQueue=(s:number,y:number)=>signals.some(j=>j.red&&j.s>=s-3&&j.s-s<150&&Math.abs(j.y-y)<2.5);
  const close=actors.filter(v=>!v.silent&&Math.hypot(v.x-player.x,v.z-player.z)<140),activeIds=new Set(close.map(v=>v.id));
  for(const id of this.states.keys())if(!activeIds.has(id))this.states.delete(id);
  const followers=this.stopped>=2&&!redQueue(player.s,player.y)?close.filter(v=>!v.opposite&&v.s<player.s&&player.s-v.s-(v.length+4.2)/2<=25&&Math.abs(v.lateral-player.lateral)<(v.width+1.8)/2+.25&&Math.abs(v.y-player.y)<2.5&&v.speed<2).sort((a,b)=>b.s-a.s).slice(0,2):[];
  const priorityIds=new Set(followers.map(v=>v.id));
  this.events=this.events.filter(e=>time<e.start+e.duration&&activeIds.has(e.vehicleId)&&(!e.priority||priorityIds.has(e.vehicleId)));
  for(const e of this.events){const v=close.find(v=>v.id===e.vehicleId)!;e.x=v.x;e.y=v.y;e.z=v.z;}
  const candidates:{v:HornActor;priority:boolean}[]=[];
  for(const v of close){
   let state=this.states.get(v.id);if(!state){state={next:time+2+noise(this.seed,v.id,0)*4,queued:0,count:0,station:v.s,priority:false};this.states.set(v.id,state);}
   if(Math.abs(v.s-state.station)>80){this.recycle(v.id);continue;}state.station=v.s;
   const priority=priorityIds.has(v.id),direction=v.opposite?-1:1;
   if(priority&&!state.priority)state.next=time;state.priority=priority;
   const queued=v.speed<3.5&&(actors.some(o=>o.id!==v.id&&o.opposite===v.opposite&&(o.s-v.s)*direction>0&&(o.s-v.s)*direction-(v.length+o.length)/2<16&&Math.abs(o.lateral-v.lateral)<(o.width+v.width)/2+.4&&Math.abs(o.y-v.y)<2.5)||(!v.opposite&&player.s>v.s&&player.s-v.s<25&&Math.abs(v.lateral-player.lateral)<2));
   state.queued=queued?state.queued+dt:0;
   if(this.events.some(e=>e.vehicleId===v.id))continue;
   if(priority&&time>=state.next||priority&&state.count===0||!priority&&state.queued>2&&time>=state.next&&noise(this.seed,v.id,1)<.48)candidates.push({v,priority});
  }
  candidates.sort((a,b)=>Number(b.priority)-Number(a.priority)||Math.abs(a.v.s-player.s)-Math.abs(b.v.s-player.s)||a.v.id-b.v.id);
  for(const {v,priority} of candidates){
   if(this.events.length>=4){if(!priority)break;const other=this.events.findIndex(e=>!e.priority);if(other<0)break;this.events.splice(other,1);}
   const state=this.states.get(v.id)!,n=state.count++,r=noise(this.seed,v.id,n+2),family=v.kind==='cab'?'car':v.kind,first=HORN_PRESETS.findIndex(p=>p.family===family),duration=priority?1.15+r*.8:.28+r*.7;
   this.events.push({id:++this.serial,vehicleId:v.id,preset:first+Math.floor(noise(this.seed,v.id,n+50)*3),start:time,duration,x:v.x,y:v.y,z:v.z,priority});
   state.next=time+duration+(priority?.16+noise(this.seed,v.id,n+20)*.18:3+noise(this.seed,v.id,n+30)*5);
  }
 }
}
export function hornEnvelope(preset:HornPreset,age:number,duration:number,priority=false){
 if(age<0||age>=duration)return 0;const attack=Math.min(1,age/.025),release=Math.min(1,(duration-age)/.07);
 const pulses=priority?1:preset.pattern==='double'?2:preset.pattern==='triple'?3:1,phase=age/duration*pulses;
 return attack*release*(pulses>1&&phase%1>.68?0:1);
}
