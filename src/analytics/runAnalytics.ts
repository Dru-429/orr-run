import type {Snapshot,Input} from '../game/simulation';
export type AnalyticsProperties=Record<string,unknown>;
export interface RoutePoint {id:string;kind:'segment'|'hoarding'|'parked_coaches';station:number;poster?:number}
export type AnalyticsSink=(event:string,properties:AnalyticsProperties,urgent?:boolean)=>void;
const round=(v:number)=>Math.round(v*100)/100;
/** Pure bookkeeping. No SDK, browser identity or simulation mutations. */
export class RunAnalytics {
 private runId:string|null=null;private closed=true;private latest:Snapshot|null=null;private last:Snapshot|null=null;
 private endedAt:number|null=null;
 private started=0;private nowValue=0;private pageLast=0;private visible=true;private pageVisible=0;private pageSent=0;private pageSequence=0;
 private moving=0;private horns=0;private hornSeconds=0;private hornDown=false;private maxSpeed=0;private pauses=0;private pausedSeconds=0;
 private milestone=0;private kilometre=0;private laps=0;private lastImpact=0;private metricSequence=0;
 private sent={distance:0,time:0,moving:0,horns:0,hornSeconds:0,overtakes:0,collisions:0,paused:0};
 private context:AnalyticsProperties={};
 constructor(private sink:AnalyticsSink,private routeId:string,private length:number,private uuid:()=>string,private clock:()=>number,private points:readonly RoutePoint[]=[]){this.pageLast=this.nowValue=clock();}
 private emit(name:string,p:AnalyticsProperties={},urgent=false){try{this.sink(name,{analytics_version:2,route_id:this.routeId,route_length_m:this.length,...this.context,...(this.runId?{run_id:this.runId}:{}),...p},urgent);}catch{/* Analytics must never interrupt driving. */}}
 private wall(visible=this.visible){const now=this.clock(),dt=Math.max(0,(now-this.pageLast)/1000);if(this.visible){this.pageVisible+=dt;if(!this.closed&&this.last?.phase==='paused')this.pausedSeconds+=dt;}this.visible=visible;this.pageLast=this.nowValue=now;}
 begin(s:Snapshot,source:string,context:AnalyticsProperties={}){
  if(!this.closed)return;this.wall();this.context=context;this.runId=this.uuid();this.closed=false;this.endedAt=null;this.latest=this.last={...s};this.started=this.nowValue;
  this.moving=this.horns=this.hornSeconds=this.maxSpeed=this.pauses=this.pausedSeconds=this.milestone=this.kilometre=this.laps=this.lastImpact=this.metricSequence=0;this.hornDown=false;
  this.sent={distance:0,time:0,moving:0,horns:0,hornSeconds:0,overtakes:0,collisions:0,paused:0};this.emit('game_started',{start_source:source,...this.summary()});
 }
 summary():AnalyticsProperties{
  const s=this.latest;return {run_id:this.runId,distance_m:round(s?.distance??0),route_station_m:round(s?.s??0),route_progress_percent:round(Math.min(100,(s?.s??0)/this.length*100)),max_route_completion_percent:round(Math.min(100,(s?.distance??0)/this.length*100)),elapsed_seconds:round(s?.time??0),on_road_seconds:round(s?.time??0),moving_seconds:round(this.moving),waiting_seconds:round(Math.max(0,(s?.time??0)-this.moving)),visible_paused_seconds:round(this.pausedSeconds),run_wall_seconds:round(Math.max(0,((this.endedAt??this.nowValue)-this.started)/1000)),overtakes:s?.overtakes??0,collisions:s?.collisions??0,health:round(s?.health??100),lap:s?.lap??1,completed_laps:this.laps,max_speed_kph:round(this.maxSpeed),average_speed_kph:round((s?.distance??0)/Math.max(.001,s?.time??0)*3.6),horn_presses:this.horns,horn_seconds:round(this.hornSeconds),pause_count:this.pauses};
 }
 observe(s:Snapshot,input:Input,reason='manual'){
  this.wall();
  if(this.pageVisible-this.pageSent>=30)this.pageCheckpoint('heartbeat');
  if(this.closed)return;
  const previous=this.last!,dt=Math.max(0,s.time-previous.time);this.latest={...s};
  if(s.speed>=1/3.6)this.moving+=dt;this.maxSpeed=Math.max(this.maxSpeed,s.speed*3.6);
  if(dt>0&&input.horn){this.hornSeconds+=dt;if(!this.hornDown)this.horns++;}this.hornDown=dt>0&&input.horn;
  if(s.phase==='paused'&&previous.phase!=='paused'){this.pauses++;this.emit('game_paused',{...this.summary(),pause_reason:reason});this.checkpoint('pause');}
  if(previous.phase==='paused'&&(s.phase==='driving'||s.phase==='looping'))this.emit('game_resumed',{...this.summary(),resume_reason:reason});
  for(let lap=Math.floor(previous.distance/this.length);lap<=Math.floor(s.distance/this.length);lap++)for(const point of this.points){const distance=lap*this.length+point.station;if(distance>previous.distance&&distance<=s.distance)this.emit('game_route_point_reached',{...this.summary(),point_id:point.id,point_kind:point.kind,point_station_m:point.station,point_lap:lap+1,...(point.poster?{poster_number:point.poster}:{})});}
  const progress=Math.floor((s.distance+1e-6)/this.length*10);
  while(this.milestone<progress){this.milestone++;this.emit('game_progress',{...this.summary(),milestone_percent:(this.milestone-1)%10*10+10,milestone_lap:Math.floor((this.milestone-1)/10)+1});}
  while(this.kilometre<Math.floor(s.distance/1000)){this.kilometre++;this.emit('game_distance_milestone',{...this.summary(),kilometre:this.kilometre});}
  while(this.laps<Math.floor((s.distance+1e-6)/this.length)){this.laps++;this.emit('route_lap_completed',{...this.summary(),completed_lap:this.laps});}
  if(s.impactEvent&&s.impactEvent.id!==this.lastImpact){this.lastImpact=s.impactEvent.id;const o=s.impactEvent.obstacle;this.emit('game_collision',{...this.summary(),obstacle_type:o.startsWith('tourist-')?'parked_coach':o.startsWith('curb:')?'roadside':o.startsWith('cross:')?'crossing_vehicle':'traffic_vehicle',health_lost:round(Math.max(0,previous.health-s.health)),impact_severity:round(s.impactEvent.severity)});}
  this.last={...s};
  if(s.phase==='ended')this.finish(s,'health_depleted');else if(s.time-this.sent.time>=30)this.checkpoint('heartbeat');
 }
 checkpoint(reason:string,urgent=false){
  if(this.closed||!this.latest)return;const s=this.latest,d=s.distance-this.sent.distance,t=s.time-this.sent.time;
  if(d<=0&&t<=0&&this.pausedSeconds<=this.sent.paused)return;
  this.emit('game_run_metrics',{...this.summary(),checkpoint_reason:reason,metric_sequence:++this.metricSequence,delta_distance_m:Math.max(0,d),delta_on_road_seconds:Math.max(0,t),delta_moving_seconds:Math.max(0,this.moving-this.sent.moving),delta_waiting_seconds:Math.max(0,t-(this.moving-this.sent.moving)),delta_visible_paused_seconds:Math.max(0,this.pausedSeconds-this.sent.paused),delta_overtakes:Math.max(0,s.overtakes-this.sent.overtakes),delta_collisions:Math.max(0,s.collisions-this.sent.collisions),delta_horn_presses:this.horns-this.sent.horns,delta_horn_seconds:this.hornSeconds-this.sent.hornSeconds},urgent);
  this.sent={distance:s.distance,time:s.time,moving:this.moving,horns:this.horns,hornSeconds:this.hornSeconds,overtakes:s.overtakes,collisions:s.collisions,paused:this.pausedSeconds};
 }
 finish(s:Snapshot,reason:string,urgent=false){if(this.closed)return;this.wall();this.latest={...s};this.endedAt=this.nowValue;this.checkpoint(reason,urgent);this.emit('game_run_finished',{...this.summary(),finish_reason:reason},urgent);if(reason==='health_depleted')this.emit('game_ended',this.summary(),urgent);this.closed=true;}
 updateContext(properties:AnalyticsProperties){this.context={...this.context,...properties};}
 event(name:string,p:AnalyticsProperties={},urgent=false){this.emit(name,{...this.summary(),...p},urgent);}
 setVisible(visible:boolean){this.wall(visible);if(!visible){this.checkpoint('hidden',true);this.pageCheckpoint('hidden',true);}}
 pageCheckpoint(reason:string,urgent=false){const delta=this.pageVisible-this.pageSent;if(delta<=0)return;this.emit('game_page_engagement',{page_metric_sequence:++this.pageSequence,delta_visible_seconds:delta,visible_seconds:this.pageVisible,checkpoint_reason:reason},urgent);this.pageSent=this.pageVisible;}
 leave(s:Snapshot,persisted=false){this.wall(false);if(persisted)this.checkpoint('bfcache',true);else this.finish(s,'page_exit',true);this.pageCheckpoint('page_exit',true);}
}
