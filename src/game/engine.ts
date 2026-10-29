import {isWeaver,trafficBody} from './weaving';
import {makeWheelSpray} from './roadSurfaceScene';
import {surfaceMotion,sampleSurface} from './roadConditions';
import {hoardings} from './hoardings';
import {RunAnalytics} from '../analytics/runAnalytics';
import {parkedBuses,parkedBusGroups,parkedClear} from './parkedBuses';
import {setPosterQuality} from './poster-artwork';
import {impactMotion} from './impact';
import {makeJunctionScene} from './junctionScene';
import {crossingBody} from './junctions';
import * as T from 'three';
import {Simulation,emptyInput,type Input,type Snapshot} from './simulation';
import {pose,ROUTE_LENGTH,ROUTE_ID,manifest} from './route';
import {crossSectionAt,driveBounds,laneCentresAt} from '../survey/corridor';
import {makeWorld,makeCockpit} from './world';
import {vehicle,disposeTemplates} from './assets';
import {DrivingAudio,type TrafficHornLevel,type VolumeLevel} from './audio';
import {capture,captureException,captureLog} from '../posthog';
import {makeRoadster,type RoadsterModel} from './roadster';
import {ThrusterGroundEffect} from './thrusterGroundEffect';
import {daylightEnvironment} from './presentationMaterials';
export type Quality='auto'|'high'|'low';
export type CameraView='cockpit'|'chase';
export interface Settings {trafficHornLevel:TrafficHornLevel;volume:VolumeLevel;reducedMotion:boolean;quality:Quality}
export class GameEngine {
 sim=new Simulation();input=emptyInput();settings:Settings;renderer:T.WebGLRenderer;scene=new T.Scene();camera=new T.PerspectiveCamera(64,1,.05,1000);audio=new DrivingAudio();uiBlocked=false;
 cameraView:CameraView='chase';
 private daylight=daylightEnvironment();
 private analyticsEnabled=!new URLSearchParams(location.search).has('inspect');
 private analytics=new RunAnalytics((event,properties,urgent)=>{if(this.analyticsEnabled)capture(event,properties,urgent);},ROUTE_ID,ROUTE_LENGTH,()=>crypto.randomUUID(),()=>performance.now(),[...manifest.segments.map(s=>({id:s.id,kind:'segment' as const,station:s.offset})),...hoardings.map(h=>({id:h.id,kind:'hoarding' as const,station:h.station,poster:h.poster})),...parkedBusGroups.map(b=>({id:b.id,kind:'parked_coaches' as const,station:b.start}))]);
 private hornFrustum=new T.Frustum();private hornMatrix=new T.Matrix4();private hornSphere=new T.Sphere();
 private nextPerformanceSample=30;
 private inputMethods=new Set<string>();
 track(name:string,properties:Record<string,unknown>={},urgent=false){this.analytics.event(name,properties,urgent);}
 private observeAnalytics(reason='manual'){if(this.analyticsEnabled)this.analytics.observe(this.sim.snapshot(),this.input,reason);}
 private runContext(){return {graphics_setting:this.settings.quality,actual_graphics_quality:this.activeQuality,graphics_quality:this.activeQuality,reduced_motion:this.settings.reducedMotion,traffic_horn_level:this.settings.trafficHornLevel,viewport_width:this.canvas.clientWidth,viewport_height:this.canvas.clientHeight};}
 private recordInput(method:string){if(!this.inputMethods.has(method)){this.inputMethods.add(method);this.track('game_control_used',{input_method:method});}}
 private thrusterGround:ThrusterGroundEffect;
 private chaseCar=new T.Vector3();
 private spray:ReturnType<typeof makeWheelSpray>;private junctionScene:ReturnType<typeof makeJunctionScene>;private crossingVehicles:T.Group[]=[];private world:ReturnType<typeof makeWorld>;private sweep:{stations:number[];index:number;frames:number;returns:unknown[];peakGeometry:number;peakTextures:number}|null=null;private lookYaw=0;private lookTarget=0;private lookStart=0;private dragging=false;private mirrorTarget=new T.WebGLRenderTarget(256,96);private mirrorCamera=new T.PerspectiveCamera(48,256/96,.3,150);private raf=0;private previous=0;private accumulator=0;private frames=0;private lastUi=0;private cockpit:ReturnType<typeof makeCockpit>;private playerVehicle:RoadsterModel;private chasePosition=new T.Vector3();private chaseTarget=new T.Vector3();private chaseDesired=new T.Vector3();private chaseAim=new T.Vector3();private chaseReady=false;private vehicles:T.Group[]=[];private parkedVehicles:T.Group[]=[];private resizeObserver:ResizeObserver;private disposed=false;private pressed=new Set<string>();private touches=new Set<keyof Input>();private backflipQueued=false;private directional:T.DirectionalLight;private onState:(s:Snapshot)=>void;private errors:(s:string)=>void;private activeQuality:'high'|'low'='high';private performanceSamples:number[]=[];private frameSamples=0;private frameTotal=0;
 constructor(private canvas:HTMLCanvasElement,settings:Settings,onState:(s:Snapshot)=>void,onError:(s:string)=>void,private onCameraView:(view:CameraView)=>void=()=>{}){
  this.settings=settings;this.onState=onState;this.errors=onError;
  this.scene.environment=this.daylight;this.scene.environmentIntensity=.45;
  this.renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});this.renderer.setClearColor('#ccd3c4');this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.02;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
  this.scene.fog=new T.FogExp2('#bdcbd0',.0021);this.scene.add(new T.HemisphereLight('#c8e0f0','#756b55',1.65));this.scene.add(new T.AmbientLight('#e2e5e0',.18));
  this.directional=new T.DirectionalLight('#ffe4bb',3.2);this.directional.castShadow=true;this.directional.shadow.mapSize.set(2048,2048);this.directional.shadow.camera.left=-48;this.directional.shadow.camera.right=48;this.directional.shadow.camera.top=70;this.directional.shadow.camera.bottom=-48;this.directional.shadow.camera.near=1;this.directional.shadow.camera.far=220;this.directional.shadow.bias=-.0009;this.directional.shadow.normalBias=.06;this.scene.add(this.directional,this.directional.target);
  this.world=makeWorld(this.scene);this.spray=makeWheelSpray(this.scene);this.thrusterGround=new ThrusterGroundEffect(this.scene);this.scene.add(this.camera);this.cockpit=makeCockpit(this.camera);this.playerVehicle=makeRoadster();this.playerVehicle.group.name='player-roadster';this.playerVehicle.group.visible=false;this.scene.add(this.playerVehicle.group);this.mirrorTarget.texture.colorSpace=T.SRGBColorSpace;this.mirrorTarget.texture.repeat.x=-1;this.mirrorTarget.texture.offset.x=1;(this.cockpit.mirror.material as T.MeshBasicMaterial).map=this.mirrorTarget.texture;
  this.vehicles=this.sim.traffic.map(v=>{const g=vehicle(v.kind,v.color);this.scene.add(g);return g;});
  this.parkedVehicles=parkedBuses.map(v=>{const g=vehicle('bus',0,'tourist');g.name=v.id;g.position.set(v.body.x,v.body.y+.03,v.body.z);g.rotation.y=v.body.yaw;this.scene.add(g);return g;});
  this.junctionScene=makeJunctionScene(this.scene);this.crossingVehicles=this.sim.junctions.vehicles.map(v=>{const g=vehicle(v.kind,v.color);this.scene.add(g);return g;});
  this.applySettings(settings);this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas);this.resize();
  window.addEventListener('keydown',this.keydown);window.addEventListener('keyup',this.keyup);window.addEventListener('blur',this.blur);window.addEventListener('pagehide',this.pagehide);document.addEventListener('visibilitychange',this.visibility);canvas.addEventListener('webglcontextlost',this.contextLost);canvas.addEventListener('pointerdown',this.lookDown);canvas.addEventListener('pointermove',this.lookMove);canvas.addEventListener('pointerup',this.lookUp);canvas.addEventListener('pointercancel',this.lookUp);this.raf=requestAnimationFrame(this.frame);captureLog('game engine initialized','info',{graphics_quality:this.activeQuality,reduced_motion:this.settings.reducedMotion,route_length_m:Math.round(ROUTE_LENGTH)});
 }
 applySettings(settings:Settings){this.settings=settings;this.audio.trafficHornLevel=settings.trafficHornLevel;this.audio.volume=settings.volume;const low=settings.quality==='low'||settings.quality==='auto'&&(matchMedia('(pointer:coarse)').matches||devicePixelRatio>2);this.activeQuality=low?'low':'high';this.analytics.updateContext({graphics_setting:settings.quality,actual_graphics_quality:this.activeQuality,traffic_horn_level:settings.trafficHornLevel,reduced_motion:settings.reducedMotion});setPosterQuality(low);this.renderer.setPixelRatio(Math.min(devicePixelRatio,low?1.25:1.75));this.renderer.shadowMap.enabled=!low;this.resize();}
 resetCar(){
  if(this.uiBlocked||this.sim.phase!=='driving'||this.sim.flight.state==='CRASHED'||this.sim.flight.state==='RECOVERING')return;
  this.clearInput();
  // Manual reset uses the established recovery lifecycle without damage or refuelling.
  this.sim.flight.state='CRASHED';this.sim.flight.active=false;this.sim.flight.thrust=0;
  this.sim.flight.velocity=[0,0,0];this.sim.flight.angularVelocity=[0,0,0];this.sim.speed=0;
  this.chaseReady=false;this.onState(this.sim.snapshot());
 }
 private resize(){const {width,height}=this.canvas.getBoundingClientRect();this.renderer.setSize(width,height,false);this.camera.aspect=width/Math.max(1,height);this.camera.fov=width<height?78:64;this.camera.updateProjectionMatrix();if(this.cockpit)this.cockpit.group.scale.setScalar(width<height?.85:1);}
 private lookDown=(e:PointerEvent)=>{if(this.uiBlocked)return;this.dragging=true;this.lookStart=e.clientX;this.canvas.setPointerCapture(e.pointerId);};
 private lookMove=(e:PointerEvent)=>{if(this.dragging)this.lookTarget=Math.max(-1.1,Math.min(1.1,-(e.clientX-this.lookStart)*.005));};
 private lookUp=()=>{this.dragging=false;this.lookTarget=0;};
 private contextLost=(e:Event)=>{e.preventDefault();this.pause('webgl_context_lost');captureLog('webgl context lost','error',{game_phase:this.sim.phase,distance_m:Math.round(this.sim.distance)});captureException(new Error('WebGL context lost'),{game_phase:this.sim.phase,distance_m:Math.round(this.sim.distance)});this.errors('The graphics connection was interrupted. Reload to get back on the road.');};
 private blur=()=>this.pause('window_blur');
 private visibility=()=>{if(document.hidden)this.pause('tab_hidden');this.analytics.setVisible(!document.hidden);};
 private pagehide=(event:PageTransitionEvent)=>{this.observeAnalytics('page_exit');this.analytics.leave(this.sim.snapshot(),event.persisted);};
 private keydown=(e:KeyboardEvent)=>{
  if(this.uiBlocked)return;
  if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement||e.target instanceof HTMLTextAreaElement)return;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
  if(e.code==='Escape'){if(this.sim.phase==='driving')this.pause();else if(this.sim.phase==='paused')this.resume();return;}
  if(e.code==='KeyC'&&!e.repeat&&this.sim.phase!=='ready'&&this.sim.phase!=='ended'){this.toggleCameraView();return;}
  if(e.code==='KeyR'&&this.sim.phase==='ended'){this.restart();return;}
  if(e.code==='Enter'&&this.sim.phase==='ready'){this.start();return;}
  if(e.code==='KeyB'&&!e.repeat&&!this.pressed.has('KeyB')&&this.pressed.has('Space')&&this.sim.phase==='driving')this.backflipQueued=true;
  if(['KeyW','KeyS','KeyA','KeyD','KeyI','KeyK','KeyB','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight'].includes(e.code)&&this.sim.phase==='driving')this.recordInput('keyboard');
  this.pressed.add(e.code);this.syncInput();
 };
 private keyup=(e:KeyboardEvent)=>{this.pressed.delete(e.code);this.syncInput();};
 private syncInput(){this.input={throttle:this.pressed.has('KeyW')||this.pressed.has('ArrowUp')||this.touches.has('throttle'),brake:this.pressed.has('KeyS')||this.pressed.has('ArrowDown')||this.touches.has('brake'),left:this.pressed.has('KeyA')||this.pressed.has('ArrowLeft')||this.touches.has('left'),right:this.pressed.has('KeyD')||this.pressed.has('ArrowRight')||this.touches.has('right'),horn:this.pressed.has('ShiftLeft')||this.pressed.has('ShiftRight')||this.touches.has('horn'),ascend:this.pressed.has('Space')||this.touches.has('ascend'),descend:this.touches.has('descend'),pitchUp:this.pressed.has('KeyI'),pitchDown:this.pressed.has('KeyK'),yawLeft:this.pressed.has('KeyQ'),yawRight:this.pressed.has('KeyE'),backflipPressed:this.backflipQueued};}
 private clearInput(){this.lookUp();this.pressed.clear();this.touches.clear();this.backflipQueued=false;this.input=emptyInput();}
 touch(action:keyof Input,down:boolean){if(down&&this.sim.phase==='driving')this.recordInput('touch');if(down)this.touches.add(action);else this.touches.delete(action);this.syncInput();}
 toggleCameraView(){this.cameraView=this.cameraView==='cockpit'?'chase':'cockpit';this.chaseReady=false;this.lookYaw=0;this.lookTarget=0;this.onCameraView(this.cameraView);this.canvas.dataset.cameraView=this.cameraView;this.track('game_camera_view_changed',{camera_view:this.cameraView});return this.cameraView;}
 start(){if(this.sim.phase!=='ready')return;this.clearInput();this.audio.start();this.sim.start();if(this.analyticsEnabled)this.analytics.begin(this.sim.snapshot(),'home',this.runContext());this.onState(this.sim.snapshot());}
 pause(reason='manual'){this.sim.pause();this.observeAnalytics(reason);this.clearInput();this.onState(this.sim.snapshot());}
 resume(){this.clearInput();this.audio.start();this.sim.resume();this.observeAnalytics();this.onState(this.sim.snapshot());}
 restart(){this.observeAnalytics();this.analytics.finish(this.sim.snapshot(),'restart');this.track('game_restarted');this.clearInput();this.audio.start();this.sim.restart();this.inputMethods.clear();this.nextPerformanceSample=30;if(this.analyticsEnabled)this.analytics.begin(this.sim.snapshot(),'restart',this.runContext());this.refreshVehicles();this.onState(this.sim.snapshot());}
 inspectEnd(){if(!import.meta.env.DEV||this.analyticsEnabled)return;this.sim.health=0;this.sim.speed=0;this.sim.phase='ended';this.onState(this.sim.snapshot());}
 inspectStation(s:number){this.restart();this.sim.pause();this.sim.s=Math.max(0,Math.min(ROUTE_LENGTH,s));this.sim.distance=this.sim.s;this.sim.x=laneCentresAt(this.sim.s)[0];this.sim.traffic.forEach(v=>{v.s+=s;const lanes=laneCentresAt(v.s,v.opposite);v.lane=Math.min(v.lane,lanes.length-1);v.targetLane=v.lane;v.x=lanes[v.lane];});this.sim.clearParkedSpawns();this.sim.resetWeaving();if(!parkedClear(this.sim.s,this.sim.x,4.2,1.8))this.sim.x=laneCentresAt(this.sim.s)[1];this.onState(this.sim.snapshot());}
 inspectReaction(kind:'gesture'|'impact'){
  if(!import.meta.env.DEV)return;this.inspectStation(4100);const base=this.sim.s;
  this.sim.traffic.forEach((v,i)=>{v.s=base+450+i*15;});
  for(let i=0;i<6;i++){const v=this.sim.traffic[i],lane=Math.floor(i/2);Object.assign(v,{kind:'car',width:1.85,length:4.3,s:base+8+(i%2)*9,x:laneCentresAt(base)[lane],lane,targetLane:lane,speed:0,cruise:0});}
  this.refreshVehicles();
  if(kind==='gesture')this.sim.traffic[0].gestureUntil=this.sim.time+1;
  else{this.sim.speed=20;this.sim.resume();this.touch('throttle',true);}
  this.onState(this.sim.snapshot());
 }
 inspectHorns(){
  if(!import.meta.env.DEV)return;this.inspectStation(4100);const lanes=laneCentresAt(4100);
  this.sim.traffic.forEach((v,i)=>{v.s=4700+i*16;});
  for(let i=0;i<12;i++){const v=this.sim.traffic[i],lane=i<2?0:1+i%2,kind=(['car','cab','auto','bike','bus','truck'] as const)[i%6],length=kind==='bus'?10.8:kind==='truck'?8:4.3;Object.assign(v,{kind,length,width:kind==='bus'||kind==='truck'?2.6:1.85,s:i<2?4090-i*10:4110+Math.floor((i-2)/2)*16,x:lanes[lane],lane,targetLane:lane,speed:0,cruise:0});}
  this.refreshVehicles();this.sim.resume();this.onState(this.sim.snapshot());
 }
 runScenerySweep(){if(!import.meta.env.DEV)return;this.inspectStation(0);const stations=Array.from({length:Math.ceil(ROUTE_LENGTH/200)},(_,i)=>i*200);this.sweep={stations:[...stations,0,...stations,0,...stations,0],index:0,frames:0,returns:[],peakGeometry:0,peakTextures:0};}
 inspectWeaving(){
  if(!import.meta.env.DEV)return;this.inspectStation(5250);const lanes=laneCentresAt(5280);
  this.sim.x=lanes[2];this.sim.speed=4;
  this.sim.traffic.forEach((v,i)=>{v.s=5900+i*18;});
  const layout=[
   ['car',5277,0,1],['car',5290,0,1],['cab',5301,1,2],['bus',5323,1,3],['car',5342,2,3],
   ['bike',5268,0,3],['auto',5281,1,3],['bike',5280,2,3],['auto',5263,0,2],['bike',5310,2,3],
  ] as const;
  layout.forEach(([kind,s,lane,speed],i)=>{const v=this.sim.traffic[i],dims=kind==='bike'?[2.05,.7]:kind==='auto'?[2.7,1.5]:kind==='bus'?[10.8,2.6]:[4.3,1.85];Object.assign(v,{kind,s,x:lanes[lane],lane,targetLane:lane,speed,cruise:i<5?speed:10,length:dims[0],width:dims[1],opposite:false,changeTimer:1000});});
  this.sim.clearParkedSpawns();this.sim.resetWeaving();this.refreshVehicles();this.sim.resume();this.onState(this.sim.snapshot());
 }
 private refreshVehicles(){this.vehicles.forEach(g=>this.scene.remove(g));this.vehicles=this.sim.traffic.map(v=>{const g=vehicle(v.kind,v.color);this.scene.add(g);return g;});}
 private frame=(now:number)=>{
  if(this.disposed)return;const elapsed=this.previous?(now-this.previous)/1000:1/60,dt=Math.min(.1,elapsed);this.previous=now;this.performanceSamples.push(elapsed);if(this.performanceSamples.length>180)this.performanceSamples.shift();
  this.accumulator+=dt;const oldLap=this.sim.lap;
  let stepped=false;while(this.accumulator>=1/60){this.sim.update(1/60,this.input);this.accumulator-=1/60;stepped=true;}
  if(stepped&&this.backflipQueued){this.backflipQueued=false;this.syncInput();}
  this.observeAnalytics();
  if(oldLap!==this.sim.lap)this.refreshVehicles();
  const ready=this.sim.phase==='ready',s=ready?250:this.sim.s;const p=pose(s,this.sim.x+.4);const look=pose(s+28,this.sim.x+.4);const carPose=pose(s,this.sim.x),flight=this.sim.flight.snapshot(),airborne=flight.state!=='GROUNDED';
  this.world.update(s);this.world.surfaceTime(this.sim.time,this.activeQuality==='low');
  this.spray.update(this.sim.time,ready||this.sim.phase==='looping'?[]:[...(this.sim.roadResponse.state.wet&&this.sim.speed>.5?[{s:this.sim.s,x:this.sim.x,speed:this.sim.speed}]:[]),...this.sim.traffic.filter(v=>!v.opposite&&Math.abs(v.s-s)<60&&v.speed>.5&&sampleSurface(v.s,v.x,v.width,v.length).wet)],this.activeQuality==='low');this.junctionScene.update(this.sim.junctions,s);
  this.crossingVehicles.forEach((g,i)=>{const v=this.sim.junctions.vehicles[i];g.visible=v.active&&!ready;if(!g.visible)return;const b=crossingBody(v,this.sim.junctions.state(v.junctionId!).record);g.position.set(b.x,b.y+.04,b.z);g.rotation.y=b.yaw;const brakes=g.getObjectByName('brakes');brakes?.children.forEach(l=>l.scale.set(v.braking?1.2:1,v.braking?1.2:1,1));});
  const effect=impactMotion(this.sim.impactEvent,this.sim.time,this.settings.reducedMotion||ready);
  const surface=surfaceMotion(this.sim.roadResponse.state,this.settings.reducedMotion||ready);
  const cap=(v:number,limit:number)=>Math.max(-limit,Math.min(limit,v));
  const shake=cap(effect.y+surface.y,.045),chase=this.cameraView==='chase';
  const lateralSpeed=this.sim.steer*Math.min(4.7,this.sim.speed*.38),headingX=carPose.tx*this.sim.speed+carPose.rx*lateralSpeed,headingZ=carPose.tz*this.sim.speed+carPose.rz*lateralSpeed,headingLength=Math.hypot(headingX,headingZ),forwardX=headingLength>.01?headingX/headingLength:carPose.tx,forwardZ=headingLength>.01?headingZ/headingLength:carPose.tz;
  this.cockpit.group.visible=!chase;this.playerVehicle.group.visible=chase;if(airborne){this.playerVehicle.group.position.fromArray(flight.position);this.playerVehicle.group.quaternion.fromArray(flight.orientation);}else{this.playerVehicle.group.position.set(carPose.x,carPose.y+.46,carPose.z);this.playerVehicle.group.rotation.set(0,Math.atan2(-forwardX,-forwardZ)+Math.PI,0);}const landingBoost=Math.max(airborne&&flight.active?flight.thrust:0,flight.touchdownBoost);this.playerVehicle.update(this.sim.speed,this.sim.steer,landingBoost,airborne&&flight.active?Math.max(0,flight.forwardThrust):0,dt);
  const flightRoadBounds=driveBounds(this.sim.s,.05),overRoad=this.sim.x>=flightRoadBounds.left&&this.sim.x<=flightRoadBounds.right;
  this.thrusterGround.update(flight.position,carPose.y,flight.altitude,overRoad?landingBoost:0,dt,this.activeQuality==='low');
  if(chase){
   this.camera.up.set(0,1,0);
   // Keep chase framing independent of the car quaternion. The route tangent
   // moves the camera through bends, while yaw/roll/spins cannot orbit it.
   if(airborne)this.chaseCar.copy(this.playerVehicle.group.position);else this.chaseCar.set(carPose.x,carPose.y+.46,carPose.z);
   this.chaseDesired.set(this.chaseCar.x-carPose.tx*8.6,this.chaseCar.y+(airborne?3.5:3.69),this.chaseCar.z-carPose.tz*8.6);
   this.chaseAim.set(this.chaseCar.x,this.chaseCar.y+.59,this.chaseCar.z);
   if(!this.chaseReady){this.chasePosition.copy(this.chaseDesired);this.chaseTarget.copy(this.chaseAim);this.chaseReady=true;}else{const follow=1-Math.exp(-dt*5.5),aim=1-Math.exp(-dt*8);this.chasePosition.lerp(this.chaseDesired,follow);this.chaseTarget.lerp(this.chaseAim,aim);}
   this.camera.position.copy(this.chasePosition);this.camera.lookAt(this.chaseTarget);const fov=this.camera.aspect<1?70:58;if(Math.abs(this.camera.fov-fov)>.001){this.camera.fov=fov;this.camera.updateProjectionMatrix();}
  }else{
   this.chaseReady=false;if(airborne){const q=this.playerVehicle.group.quaternion,forward=new T.Vector3(0,0,1).applyQuaternion(q),up=new T.Vector3(0,1,0).applyQuaternion(q);this.camera.up.copy(up);this.camera.position.copy(this.playerVehicle.group.position).addScaledVector(up,.45);this.camera.lookAt(this.camera.position.clone().add(forward));}else{this.camera.up.set(0,1,0);this.camera.position.set(p.x,p.y+1.48+shake,p.z);this.camera.lookAt(look.x,look.y+1.5,look.z);const lookTarget=this.pressed.has('KeyQ')?.95:this.pressed.has('KeyE')?-.95:this.lookTarget;this.lookYaw+=(lookTarget-this.lookYaw)*Math.min(1,dt*9);this.camera.rotateY(this.lookYaw);this.cockpit.group.rotation.y=-this.lookYaw;this.camera.translateX(effect.x);this.camera.translateZ(effect.z);this.camera.rotateX(cap(effect.pitch+surface.pitch,Math.PI/100));this.camera.rotateZ(cap(effect.roll+surface.roll+(this.settings.reducedMotion?0:-this.sim.steer*this.sim.speed*.00065),Math.PI/225));this.cockpit.group.position.set(-effect.x*.3,cap(-effect.lag*.5-surface.lag,.02),cap(effect.lag+surface.lag,.04));}const fov=(this.camera.aspect<1?78:64)+effect.fov;if(Math.abs(this.camera.fov-fov)>.001){this.camera.fov=fov;this.camera.updateProjectionMatrix();}
  }
  this.parkedVehicles.forEach((g,i)=>{const chunk=Math.floor(parkedBuses[i].s/200),current=Math.floor(s/200);g.visible=chunk>=current-2&&chunk<=current+4;});
  this.vehicles.forEach((g,i)=>{const v=this.sim.traffic[i];const vs=ready?((v.s+now*.0001*v.speed*(v.opposite?-1:1)+ROUTE_LENGTH*2)%ROUTE_LENGTH):v.s;g.visible=Math.abs(vs-s)<310&&vs>-130&&vs<ROUTE_LENGTH+100;if(!g.visible)return;const vp=pose(vs,v.x);g.position.set(vp.x,(v.opposite?crossSectionAt(vs).oppositeElevation:vp.y)+.03,vp.z);g.rotation.y=vp.yaw+(v.opposite?Math.PI:0)+(isWeaver(v)?v.weave?.heading??0:0);g.rotation.z=v.kind==='bike'?Math.max(-.09,Math.min(.09,-(v.weave?.velocity??0)*(v.opposite?-1:1)*.065)):0;const gesture=g.getObjectByName('driver-gesture');if(gesture){const remain=v.gestureUntil-this.sim.time;gesture.visible=remain>0&&remain<=2;gesture.scale.setScalar(Math.min(1,Math.max(0,(2-remain)/.18),Math.max(0,remain/.22)));}const brakes=g.getObjectByName('brakes');if(brakes)brakes.children.forEach(lamp=>lamp.scale.set(v.braking?1.2:1,v.braking?1.2:1,1));});
  if(this.frames%6===0){
   this.camera.updateMatrixWorld();this.hornMatrix.multiplyMatrices(this.camera.projectionMatrix,this.camera.matrixWorldInverse);this.hornFrustum.setFromProjectionMatrix(this.hornMatrix);
   const visible:number[]=[];
   const inView=(g:T.Group,radius:number)=>{this.hornSphere.center.copy(g.position);this.hornSphere.center.y+=1;this.hornSphere.radius=radius;return g.visible&&g.position.distanceTo(this.camera.position)<140&&this.hornFrustum.intersectsSphere(this.hornSphere);};
   this.vehicles.forEach((g,i)=>{if(this.sim.traffic[i].s>this.sim.s&&inView(g,this.sim.traffic[i].width/2))visible.push(this.sim.traffic[i].id);});
   this.crossingVehicles.forEach((g,i)=>{if(inView(g,1.3))visible.push(1000+this.sim.junctions.vehicles[i].id);});
   this.sim.visibleHornActors=visible;this.canvas.dataset.visibleHornActors=String(visible.length);
  }
  this.directional.position.set(p.x-55,p.y+90,p.z-38);this.directional.target.position.set(p.x,p.y,p.z-20);
  // Steer the yoke every frame; dash canvas redraw stays throttled.
  this.cockpit.wheel.rotation.z=-this.sim.steer*1.05;
  if(this.frames++%4===0)this.cockpit.update(this.sim.speed,this.sim.steer,this.sim.health);
  this.audio.update(this.sim.speed,this.input.throttle,this.input.horn,this.sim.phase==='driving',this.sim.npcHorns.events,pose(this.sim.s,this.sim.x),this.sim.time);this.canvas.dataset.npcHorns=String(this.sim.npcHorns.events.length);this.canvas.dataset.audioVoices=String(this.audio.activeVoices);this.canvas.dataset.audioPool=String(this.audio.voiceCount);this.canvas.dataset.hornSamples=String(this.audio.sampleCount);this.canvas.dataset.hornSampleStatus=this.audio.sampleStatus;
  if(!chase&&this.frames%12===1){this.cockpit.group.visible=false;this.mirrorCamera.position.copy(this.camera.position);const behind=pose(s-20,this.sim.x+.4);this.mirrorCamera.lookAt(behind.x,behind.y+1.4,behind.z);this.renderer.shadowMap.autoUpdate=false;this.renderer.setRenderTarget(this.mirrorTarget);this.renderer.render(this.scene,this.mirrorCamera);this.renderer.setRenderTarget(null);this.renderer.shadowMap.autoUpdate=true;this.cockpit.group.visible=true;}
  this.renderer.render(this.scene,this.camera);
  if(this.sweep){const sweep=this.sweep,info=this.renderer.info.memory;sweep.peakGeometry=Math.max(sweep.peakGeometry,info.geometries);sweep.peakTextures=Math.max(sweep.peakTextures,info.textures);if(++sweep.frames>=18){sweep.frames=0;if(sweep.stations[sweep.index]===0)sweep.returns.push({index:sweep.index,geometries:info.geometries,textures:info.textures,chunks:this.world.group.userData.chunks});sweep.index++;this.canvas.dataset.sweep=JSON.stringify({progress:sweep.index,total:sweep.stations.length,returns:sweep.returns,peakGeometry:sweep.peakGeometry,peakTextures:sweep.peakTextures});if(sweep.index>=sweep.stations.length)this.sweep=null;else this.inspectStation(sweep.stations[sweep.index]);}}
  if(import.meta.env.DEV&&this.frames%90===0){this.canvas.dataset.weaving=JSON.stringify(this.sim.traffic.filter(v=>isWeaver(v)&&Math.abs(v.s-this.sim.s)<100).map(v=>({id:v.id,kind:v.kind,s:Math.round(v.s),x:+v.x.toFixed(2),target:+(v.weave?.targetX??v.x).toFixed(2),speed:+v.speed.toFixed(2),heading:+(trafficBody(v).yaw-pose(v.s).yaw-(v.opposite?Math.PI:0)).toFixed(3)})));this.canvas.dataset.surface=JSON.stringify(this.sim.roadResponse.state);this.canvas.dataset.gestures=String(this.sim.traffic.filter(v=>v.gestureUntil>this.sim.time).length);this.canvas.dataset.chunks=String(this.world.group.userData.chunks);this.canvas.dataset.fps=String(Math.round(this.performanceSamples.length/this.performanceSamples.reduce((a,b)=>a+b,0)));this.canvas.dataset.frameMsP95=String(Math.round([...this.performanceSamples].sort((a,b)=>a-b)[Math.floor(this.performanceSamples.length*.95)]*1000));this.canvas.dataset.drawCalls=String(this.renderer.info.render.calls);this.canvas.dataset.triangles=String(this.renderer.info.render.triangles);this.canvas.dataset.geometries=String(this.renderer.info.memory.geometries);this.canvas.dataset.textures=String(this.renderer.info.memory.textures);}
  if(this.sim.phase==='driving'&&this.sim.time>=this.nextPerformanceSample){this.nextPerformanceSample=this.sim.time+30;const times=[...this.performanceSamples].sort((a,b)=>a-b);this.track('game_performance_sample',{fps:Math.round(times.length/times.reduce((a,b)=>a+b,0)),frame_ms_p95:Math.round(times[Math.floor(times.length*.95)]*1000),actual_graphics_quality:this.activeQuality,viewport_width:this.canvas.clientWidth,viewport_height:this.canvas.clientHeight});}
  if(now-this.lastUi>85){this.onState(this.sim.snapshot());this.lastUi=now;}
  if(this.settings.quality==='auto'&&this.activeQuality==='high'&&this.frames>90){this.frameTotal+=dt;this.frameSamples++;if(this.frameSamples>=120){if(this.frameTotal/this.frameSamples>.03){this.activeQuality='low';this.analytics.updateContext({actual_graphics_quality:'low'});this.track('game_quality_adjusted',{reason:'slow_frames',actual_graphics_quality:'low'});this.renderer.setPixelRatio(1);this.renderer.shadowMap.enabled=false;this.resize();}this.frameSamples=0;this.frameTotal=0;}}
  this.raf=requestAnimationFrame(this.frame);
 };
 dispose(){this.observeAnalytics();this.analytics.finish(this.sim.snapshot(),'engine_closed',true);this.analytics.setVisible(false);this.disposed=true;cancelAnimationFrame(this.raf);this.resizeObserver.disconnect();window.removeEventListener('keydown',this.keydown);window.removeEventListener('keyup',this.keyup);window.removeEventListener('blur',this.blur);window.removeEventListener('pagehide',this.pagehide);document.removeEventListener('visibilitychange',this.visibility);this.canvas.removeEventListener('webglcontextlost',this.contextLost);this.canvas.removeEventListener('pointerdown',this.lookDown);this.canvas.removeEventListener('pointermove',this.lookMove);this.canvas.removeEventListener('pointerup',this.lookUp);this.canvas.removeEventListener('pointercancel',this.lookUp);this.audio.dispose();this.spray.dispose();this.world.dispose();this.junctionScene.dispose();this.crossingVehicles.forEach(g=>this.scene.remove(g));this.crossingVehicles=[];this.vehicles.forEach(g=>this.scene.remove(g));this.vehicles=[];this.parkedVehicles.forEach(g=>this.scene.remove(g));this.parkedVehicles=[];this.playerVehicle.dispose();this.scene.remove(this.playerVehicle.group);(this.cockpit.mirror.material as T.MeshBasicMaterial).map=null;const geos=new Set<T.BufferGeometry>(),mats=new Set<T.Material>(),textures=new Set<T.Texture>();this.scene.traverse(o=>{if(o instanceof T.Mesh){geos.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach((m:T.Material)=>{mats.add(m);Object.values(m).forEach(v=>{if(v instanceof T.Texture)textures.add(v);});});}});geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());disposeTemplates();this.mirrorTarget.dispose();this.daylight.dispose();this.scene.environment=null;this.renderer.dispose();}
}
