import {HORN_PRESETS,hornEnvelope,type NPCHornEvent} from './npcHorns';
interface Voice {osc:OscillatorNode[];filter:BiquadFilterNode;gain:GainNode;pan:StereoPannerNode;id:number;active:boolean}
export class DrivingAudio {
 private ctx:AudioContext|null=null;private gain:GainNode|null=null;private engine:OscillatorNode|null=null;private harmonic:OscillatorNode|null=null;private hornOsc:OscillatorNode|null=null;private hornGain:GainNode|null=null;private voices:Voice[]=[];muted=false;
 get activeVoices(){return this.voices.filter(v=>v.active).length;}
 get voiceCount(){return this.voices.length;}
 start(){try{if(!this.ctx){
  const c=new AudioContext();this.ctx=c;this.gain=c.createGain();this.gain.gain.value=0;this.gain.connect(c.destination);
  const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=210;filter.connect(this.gain);
  this.engine=c.createOscillator();this.engine.type='sawtooth';this.engine.frequency.value=35;this.engine.connect(filter);this.engine.start();
  this.harmonic=c.createOscillator();this.harmonic.type='triangle';this.harmonic.frequency.value=70;this.harmonic.connect(filter);this.harmonic.start();
  this.hornGain=c.createGain();this.hornGain.gain.value=0;this.hornGain.connect(c.destination);this.hornOsc=c.createOscillator();this.hornOsc.type='sawtooth';this.hornOsc.frequency.value=350;this.hornOsc.connect(this.hornGain);this.hornOsc.start();
  const limiter=c.createDynamicsCompressor();limiter.threshold.value=-15;limiter.knee.value=12;limiter.ratio.value=5;limiter.attack.value=.005;limiter.release.value=.12;limiter.connect(c.destination);
  this.voices=Array.from({length:4},()=>{const gain=c.createGain(),pan=c.createStereoPanner(),filter=c.createBiquadFilter();gain.gain.value=0;filter.type='lowpass';filter.connect(gain);gain.connect(pan);pan.connect(limiter);const osc=[c.createOscillator(),c.createOscillator()];osc.forEach(o=>{o.connect(filter);o.start();});return {osc,filter,gain,pan,id:-1,active:false};});
 }void this.ctx.resume().catch(()=>{});}catch{/* Audio remains optional if blocked by the browser. */}}
 update(speed:number,throttle:boolean,horn:boolean,playing:boolean,events:NPCHornEvent[]=[],listener={x:0,y:0,z:0,rx:1,rz:0},simulationTime=0){
  if(!this.ctx||!this.gain)return;const time=this.ctx.currentTime,audible=!this.muted&&playing;
  this.gain.gain.setTargetAtTime(audible?.014+speed*.0009:0,time,.1);this.engine?.frequency.setTargetAtTime(32+speed*3+(throttle?8:0),time,.15);this.harmonic?.frequency.setTargetAtTime(65+speed*6,time,.15);this.hornGain?.gain.setTargetAtTime(audible&&horn?.065:0,time,.035);
  const selected=audible?events.filter(e=>simulationTime>=e.start&&simulationTime<e.start+e.duration).slice(0,4):[];
  // Fixed oscillators are reassigned; no new AudioNodes are allocated while driving.
  for(let i=0;i<this.voices.length;i++){
   const v=this.voices[i],e=selected[i];v.active=!!e;
   if(!e){v.id=-1;v.gain.gain.setTargetAtTime(0,time,.012);continue;}
   const preset=HORN_PRESETS[e.preset],age=simulationTime-e.start,dx=e.x-listener.x,dz=e.z-listener.z,distance=Math.hypot(dx,dz,e.y-listener.y),attenuation=1/(1+(distance/24)**2);
   if(v.id!==e.id){v.id=e.id;v.osc.forEach(o=>o.type=preset.wave);v.filter.frequency.setValueAtTime(preset.filter,time);}
   v.osc.forEach((o,j)=>o.frequency.setTargetAtTime(preset.frequencies[j]+Math.sin(age*18)*preset.wobble,time,.015));
   v.pan.pan.setTargetAtTime(Math.max(-.85,Math.min(.85,(dx*listener.rx+dz*listener.rz)/Math.max(8,distance))),time,.04);
   v.gain.gain.setTargetAtTime(hornEnvelope(preset,age,e.duration,e.priority)*attenuation*(e.priority?.024:.016),time,.012);
  }
 }
 dispose(){this.voices=[];void this.ctx?.close();this.ctx=null;}
}
