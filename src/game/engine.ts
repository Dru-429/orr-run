import {makeJunctionScene} from './junctionScene';
import {crossingBody} from './junctions';
import * as T from 'three';
import {Simulation,emptyInput,type Input,type Snapshot} from './simulation';
import {pose,ROUTE_LENGTH} from './route';
import {crossSectionAt,laneCentresAt} from '../survey/corridor';
import {makeWorld,makeCockpit} from './world';
import {vehicle,disposeTemplates} from './assets';
import {DrivingAudio} from './audio';
export type Quality='auto'|'high'|'low';
export interface Settings {muted:boolean;reducedMotion:boolean;quality:Quality}
export class GameEngine {
 sim=new Simulation();input=emptyInput();settings:Settings;renderer:T.WebGLRenderer;scene=new T.Scene();camera=new T.PerspectiveCamera(64,1,.05,1000);audio=new DrivingAudio();uiBlocked=false;
 private junctionScene:ReturnType<typeof makeJunctionScene>;private crossingVehicles:T.Group[]=[];private world:ReturnType<typeof makeWorld>;private sweep:{stations:number[];index:number;frames:number;returns:unknown[];peakGeometry:number;peakTextures:number}|null=null;private lookYaw=0;private lookTarget=0;private lookStart=0;private dragging=false;private mirrorTarget=new T.WebGLRenderTarget(256,96);private mirrorCamera=new T.PerspectiveCamera(48,256/96,.3,150);private raf=0;private previous=0;private accumulator=0;private frames=0;private lastUi=0;private cockpit:ReturnType<typeof makeCockpit>;private vehicles:T.Group[]=[];private resizeObserver:ResizeObserver;private disposed=false;private pressed=new Set<string>();private touches=new Set<keyof Input>();private directional:T.DirectionalLight;private onState:(s:Snapshot)=>void;private errors:(s:string)=>void;private activeQuality:'high'|'low'='high';private performanceSamples:number[]=[];private frameSamples=0;private frameTotal=0;
 constructor(private canvas:HTMLCanvasElement,settings:Settings,onState:(s:Snapshot)=>void,onError:(s:string)=>void){
  this.settings=settings;this.onState=onState;this.errors=onError;
  this.renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});this.renderer.setClearColor('#ccd3c4');this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.15;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
  this.scene.fog=new T.FogExp2('#d1d8ce',.0030);this.scene.add(new T.HemisphereLight('#d9edf5','#8d9473',2.6));this.scene.add(new T.AmbientLight('#f0ebdc',.25));
  this.directional=new T.DirectionalLight('#fff2cf',3.0);this.directional.castShadow=true;this.directional.shadow.mapSize.set(1024,1024);this.directional.shadow.camera.left=-70;this.directional.shadow.camera.right=70;this.directional.shadow.camera.top=95;this.directional.shadow.camera.bottom=-70;this.directional.shadow.camera.near=1;this.directional.shadow.camera.far=220;this.directional.shadow.bias=-.0009;this.directional.shadow.normalBias=.25;this.scene.add(this.directional,this.directional.target);
  this.world=makeWorld(this.scene);this.scene.add(this.camera);this.cockpit=makeCockpit(this.camera);this.mirrorTarget.texture.colorSpace=T.SRGBColorSpace;this.mirrorTarget.texture.repeat.x=-1;this.mirrorTarget.texture.offset.x=1;(this.cockpit.mirror.material as T.MeshBasicMaterial).map=this.mirrorTarget.texture;
  this.vehicles=this.sim.traffic.map(v=>{const g=vehicle(v.kind,v.color);this.scene.add(g);return g;});
  this.junctionScene=makeJunctionScene(this.scene);this.crossingVehicles=this.sim.junctions.vehicles.map(v=>{const g=vehicle(v.kind,v.color);this.scene.add(g);return g;});
  this.applySettings(settings);this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas);this.resize();
  window.addEventListener('keydown',this.keydown);window.addEventListener('keyup',this.keyup);window.addEventListener('blur',this.blur);document.addEventListener('visibilitychange',this.visibility);canvas.addEventListener('webglcontextlost',this.contextLost);canvas.addEventListener('pointerdown',this.lookDown);canvas.addEventListener('pointermove',this.lookMove);canvas.addEventListener('pointerup',this.lookUp);canvas.addEventListener('pointercancel',this.lookUp);this.raf=requestAnimationFrame(this.frame);
 }
 applySettings(settings:Settings){this.settings=settings;this.audio.muted=settings.muted;const low=settings.quality==='low'||settings.quality==='auto'&&(matchMedia('(pointer:coarse)').matches||devicePixelRatio>2);this.activeQuality=low?'low':'high';this.renderer.setPixelRatio(Math.min(devicePixelRatio,low?1.25:1.75));this.renderer.shadowMap.enabled=!low;this.resize();}
 private resize(){const {width,height}=this.canvas.getBoundingClientRect();this.renderer.setSize(width,height,false);this.camera.aspect=width/Math.max(1,height);this.camera.fov=width<height?78:64;this.camera.updateProjectionMatrix();if(this.cockpit)this.cockpit.group.scale.setScalar(width<height?.85:1);}
 private lookDown=(e:PointerEvent)=>{if(this.uiBlocked)return;this.dragging=true;this.lookStart=e.clientX;this.canvas.setPointerCapture(e.pointerId);};
 private lookMove=(e:PointerEvent)=>{if(this.dragging)this.lookTarget=Math.max(-1.1,Math.min(1.1,-(e.clientX-this.lookStart)*.005));};
 private lookUp=()=>{this.dragging=false;this.lookTarget=0;};
 private contextLost=(e:Event)=>{e.preventDefault();this.sim.pause();this.clearInput();this.errors('The graphics connection was interrupted. Reload to get back on the road.');};
 private blur=()=>{this.sim.pause();this.clearInput();this.onState(this.sim.snapshot());};
 private visibility=()=>{if(document.hidden)this.blur();};
 private keydown=(e:KeyboardEvent)=>{
  if(this.uiBlocked)return;
  if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement||e.target instanceof HTMLTextAreaElement)return;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
  if(e.code==='Escape'){if(this.sim.phase==='driving')this.pause();else if(this.sim.phase==='paused')this.resume();return;}
  if(e.code==='KeyR'&&this.sim.phase==='ended'){this.restart();return;}
  if(e.code==='Enter'&&this.sim.phase==='ready'){this.start();return;}
  this.pressed.add(e.code);this.syncInput();
 };
 private keyup=(e:KeyboardEvent)=>{this.pressed.delete(e.code);this.syncInput();};
 private syncInput(){this.input={throttle:this.pressed.has('KeyW')||this.pressed.has('ArrowUp')||this.touches.has('throttle'),brake:this.pressed.has('KeyS')||this.pressed.has('ArrowDown')||this.touches.has('brake'),left:this.pressed.has('KeyA')||this.pressed.has('ArrowLeft')||this.touches.has('left'),right:this.pressed.has('KeyD')||this.pressed.has('ArrowRight')||this.touches.has('right'),horn:this.pressed.has('Space')||this.touches.has('horn')};}
 private clearInput(){this.lookUp();this.pressed.clear();this.touches.clear();this.input=emptyInput();}
 touch(action:keyof Input,down:boolean){if(down)this.touches.add(action);else this.touches.delete(action);this.syncInput();}
 start(){this.clearInput();this.audio.start();this.sim.start();this.onState(this.sim.snapshot());}
 pause(){this.sim.pause();this.clearInput();this.onState(this.sim.snapshot());}
 resume(){this.clearInput();this.audio.start();this.sim.resume();this.onState(this.sim.snapshot());}
 restart(){this.clearInput();this.audio.start();this.sim.restart();this.refreshVehicles();this.onState(this.sim.snapshot());}
 inspectStation(s:number){this.restart();this.sim.pause();this.sim.s=Math.max(0,Math.min(ROUTE_LENGTH,s));this.sim.distance=this.sim.s;this.sim.x=laneCentresAt(this.sim.s)[0];this.sim.traffic.forEach(v=>{v.s+=s;const lanes=laneCentresAt(v.s,v.opposite);v.lane=Math.min(v.lane,lanes.length-1);v.targetLane=v.lane;v.x=lanes[v.lane];});this.onState(this.sim.snapshot());}
 runScenerySweep(){if(!import.meta.env.DEV)return;this.inspectStation(0);const stations=Array.from({length:Math.ceil(ROUTE_LENGTH/200)},(_,i)=>i*200);this.sweep={stations:[...stations,0,...stations,0,...stations,0],index:0,frames:0,returns:[],peakGeometry:0,peakTextures:0};}
 private refreshVehicles(){this.vehicles.forEach(g=>this.scene.remove(g));this.vehicles=this.sim.traffic.map(v=>{const g=vehicle(v.kind,v.color);this.scene.add(g);return g;});}
 private frame=(now:number)=>{
  if(this.disposed)return;const elapsed=this.previous?(now-this.previous)/1000:1/60,dt=Math.min(.1,elapsed);this.previous=now;this.performanceSamples.push(elapsed);if(this.performanceSamples.length>180)this.performanceSamples.shift();
  this.accumulator+=dt;const oldLap=this.sim.lap;
  while(this.accumulator>=1/60){this.sim.update(1/60,this.input);this.accumulator-=1/60;}
  if(oldLap!==this.sim.lap)this.refreshVehicles();
  const ready=this.sim.phase==='ready',s=ready?250:this.sim.s;const p=pose(s,this.sim.x+.4);const look=pose(s+28,this.sim.x+.4);
  this.world.update(s);this.junctionScene.update(this.sim.junctions,s);
  this.crossingVehicles.forEach((g,i)=>{const v=this.sim.junctions.vehicles[i];g.visible=v.active&&!ready;if(!g.visible)return;const b=crossingBody(v,this.sim.junctions.state(v.junctionId!).record);g.position.set(b.x,b.y+.04,b.z);g.rotation.y=b.yaw;const brakes=g.getObjectByName('brakes');brakes?.children.forEach(l=>l.scale.set(v.braking?1.2:1,v.braking?1.2:1,1));});
  const shake=this.settings.reducedMotion||ready?0:Math.sin(this.sim.time*25)*Math.min(.014,this.sim.speed*.001)+Math.sin(this.sim.time*57)*this.sim.impact*.05;
  this.camera.position.set(p.x,p.y+1.48+shake,p.z);
  this.camera.lookAt(look.x,look.y+1.5,look.z);const lookTarget=this.pressed.has('KeyQ')?.95:this.pressed.has('KeyE')?-.95:this.lookTarget;this.lookYaw+=(lookTarget-this.lookYaw)*Math.min(1,dt*9);this.camera.rotateY(this.lookYaw);this.cockpit.group.rotation.y=-this.lookYaw;if(!this.settings.reducedMotion)this.camera.rotateZ(-this.sim.steer*this.sim.speed*.00065);
  this.vehicles.forEach((g,i)=>{const v=this.sim.traffic[i];const vs=ready?((v.s+now*.0001*v.speed*(v.opposite?-1:1)+ROUTE_LENGTH*2)%ROUTE_LENGTH):v.s;g.visible=Math.abs(vs-s)<310&&vs>-130&&vs<ROUTE_LENGTH+100;if(!g.visible)return;const vp=pose(vs,v.x);g.position.set(vp.x,(v.opposite?crossSectionAt(vs).oppositeElevation:vp.y)+.03,vp.z);g.rotation.y=vp.yaw+(v.opposite?Math.PI:0);const brakes=g.getObjectByName('brakes');if(brakes)brakes.children.forEach(lamp=>lamp.scale.set(v.braking?1.2:1,v.braking?1.2:1,1));});
  this.directional.position.set(p.x-55,p.y+90,p.z-38);this.directional.target.position.set(p.x,p.y,p.z-20);
  if(this.frames++%4===0)this.cockpit.update(this.sim.speed,this.sim.steer,this.sim.health);
  this.audio.update(this.sim.speed,this.input.throttle,this.input.horn,this.sim.phase==='driving');
  if(this.frames%12===1){this.cockpit.group.visible=false;this.mirrorCamera.position.copy(this.camera.position);const behind=pose(s-20,this.sim.x+.4);this.mirrorCamera.lookAt(behind.x,behind.y+1.4,behind.z);this.renderer.shadowMap.autoUpdate=false;this.renderer.setRenderTarget(this.mirrorTarget);this.renderer.render(this.scene,this.mirrorCamera);this.renderer.setRenderTarget(null);this.renderer.shadowMap.autoUpdate=true;this.cockpit.group.visible=true;}
  this.renderer.render(this.scene,this.camera);
  if(this.sweep){const sweep=this.sweep,info=this.renderer.info.memory;sweep.peakGeometry=Math.max(sweep.peakGeometry,info.geometries);sweep.peakTextures=Math.max(sweep.peakTextures,info.textures);if(++sweep.frames>=18){sweep.frames=0;if(sweep.stations[sweep.index]===0)sweep.returns.push({index:sweep.index,geometries:info.geometries,textures:info.textures,chunks:this.world.group.userData.chunks});sweep.index++;this.canvas.dataset.sweep=JSON.stringify({progress:sweep.index,total:sweep.stations.length,returns:sweep.returns,peakGeometry:sweep.peakGeometry,peakTextures:sweep.peakTextures});if(sweep.index>=sweep.stations.length)this.sweep=null;else this.inspectStation(sweep.stations[sweep.index]);}}
  if(import.meta.env.DEV&&this.frames%90===0){this.canvas.dataset.chunks=String(this.world.group.userData.chunks);this.canvas.dataset.fps=String(Math.round(this.performanceSamples.length/this.performanceSamples.reduce((a,b)=>a+b,0)));this.canvas.dataset.frameMsP95=String(Math.round([...this.performanceSamples].sort((a,b)=>a-b)[Math.floor(this.performanceSamples.length*.95)]*1000));this.canvas.dataset.drawCalls=String(this.renderer.info.render.calls);this.canvas.dataset.triangles=String(this.renderer.info.render.triangles);this.canvas.dataset.geometries=String(this.renderer.info.memory.geometries);this.canvas.dataset.textures=String(this.renderer.info.memory.textures);}
  if(now-this.lastUi>85){this.onState(this.sim.snapshot());this.lastUi=now;}
  if(this.settings.quality==='auto'&&this.activeQuality==='high'&&this.frames>90){this.frameTotal+=dt;this.frameSamples++;if(this.frameSamples>=120){if(this.frameTotal/this.frameSamples>.03){this.activeQuality='low';this.renderer.setPixelRatio(1);this.renderer.shadowMap.enabled=false;this.resize();}this.frameSamples=0;this.frameTotal=0;}}
  this.raf=requestAnimationFrame(this.frame);
 };
 dispose(){this.disposed=true;cancelAnimationFrame(this.raf);this.resizeObserver.disconnect();window.removeEventListener('keydown',this.keydown);window.removeEventListener('keyup',this.keyup);window.removeEventListener('blur',this.blur);document.removeEventListener('visibilitychange',this.visibility);this.canvas.removeEventListener('webglcontextlost',this.contextLost);this.canvas.removeEventListener('pointerdown',this.lookDown);this.canvas.removeEventListener('pointermove',this.lookMove);this.canvas.removeEventListener('pointerup',this.lookUp);this.canvas.removeEventListener('pointercancel',this.lookUp);this.audio.dispose();this.world.dispose();this.junctionScene.dispose();this.crossingVehicles.forEach(g=>this.scene.remove(g));this.crossingVehicles=[];this.vehicles.forEach(g=>this.scene.remove(g));this.vehicles=[];(this.cockpit.mirror.material as T.MeshBasicMaterial).map=null;const geos=new Set<T.BufferGeometry>(),mats=new Set<T.Material>(),textures=new Set<T.Texture>();this.scene.traverse(o=>{if(o instanceof T.Mesh){geos.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach((m:T.Material)=>{mats.add(m);Object.values(m).forEach(v=>{if(v instanceof T.Texture)textures.add(v);});});}});geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());disposeTemplates();this.mirrorTarget.dispose();this.renderer.dispose();}
}
