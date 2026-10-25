import {HORN_PRESETS,hornEnvelope,type NPCHornEvent} from './npcHorns';
import {HORN_SAMPLES,RECORDED_HORNS,loadHornSamples,type HornSampleId} from './hornSamples';
interface Voice {osc:OscillatorNode[];fallback:GainNode;filter:BiquadFilterNode;gain:GainNode;pan:StereoPannerNode;id:number;active:boolean;source:AudioBufferSourceNode|null;sampled:boolean}
export class DrivingAudio {
 private ctx:AudioContext|null=null;private gain:GainNode|null=null;private engine:OscillatorNode|null=null;private harmonic:OscillatorNode|null=null;private player:Voice|null=null;private voices:Voice[]=[];muted=false;private noiseReduced=false;
 private buffers=new Map<HornSampleId,AudioBuffer>();private loading:Promise<void>|null=null;private abort:AbortController|null=null;
 get activeVoices(){return this.voices.filter(v=>v.active).length;}
 get voiceCount(){return this.voices.length;}
 get sampleCount(){return this.buffers.size;}
 get sampleStatus(){return this.loading?'loading':this.buffers.size===Object.keys(HORN_SAMPLES).length?'ready':'fallback';}
 get reducedNoise(){return this.noiseReduced;}
 set reducedNoise(value:boolean){this.noiseReduced=value;}
 private makeVoice(c:AudioContext,out:AudioNode):Voice {
  const gain=c.createGain(),pan=c.createStereoPanner(),filter=c.createBiquadFilter(),fallback=c.createGain();gain.gain.value=0;fallback.gain.value=0;filter.type='lowpass';fallback.connect(filter);filter.connect(gain);gain.connect(pan);pan.connect(out);
  const osc=[c.createOscillator(),c.createOscillator()];osc.forEach(o=>{o.connect(fallback);o.start();});return {osc,fallback,filter,gain,pan,id:-1,active:false,source:null,sampled:false};
 }
 start(){try{if(!this.ctx){
  const c=new AudioContext();this.ctx=c;this.gain=c.createGain();this.gain.gain.value=0;this.gain.connect(c.destination);
  const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=210;filter.connect(this.gain);
  this.engine=c.createOscillator();this.engine.type='sawtooth';this.engine.frequency.value=35;this.engine.connect(filter);this.engine.start();
  this.harmonic=c.createOscillator();this.harmonic.type='triangle';this.harmonic.frequency.value=70;this.harmonic.connect(filter);this.harmonic.start();
  const limiter=c.createDynamicsCompressor();limiter.threshold.value=-15;limiter.knee.value=12;limiter.ratio.value=5;limiter.attack.value=.005;limiter.release.value=.12;limiter.connect(c.destination);
  this.voices=Array.from({length:4},()=>this.makeVoice(c,limiter));this.player=this.makeVoice(c,limiter);
 }void this.ctx.resume().catch(()=>{});this.load();}catch{/* Audio remains optional if blocked by the browser. */}}
 private load(){
  if(!this.ctx||this.loading||this.sampleCount===Object.keys(HORN_SAMPLES).length)return;
  const context=this.ctx,controller=new AbortController();this.abort=controller;
  this.loading=loadHornSamples(context,controller.signal,this.buffers).then(buffers=>{if(this.ctx===context&&!controller.signal.aborted)this.buffers=buffers;}).finally(()=>{if(this.abort===controller){this.loading=null;this.abort=null;}});
 }
 private stop(v:Voice,time:number){
  if(v.source){v.source.onended=null;v.source.stop();v.source.disconnect();v.source=null;}
  v.gain.gain.setTargetAtTime(0,time,.012);v.fallback.gain.setValueAtTime(0,time);v.id=-1;v.active=false;v.sampled=false;
 }
 private begin(v:Voice,id:number,presetIndex:number,time:number){
  const c=this.ctx!,preset=HORN_PRESETS[presetIndex],record=RECORDED_HORNS[presetIndex],buffer=this.buffers.get(record.sample);
  this.stop(v,time);v.id=id;v.active=true;v.sampled=!!buffer;
  v.gain.gain.setValueAtTime(0,time);v.fallback.gain.setValueAtTime(buffer?0:1,time);
  if(buffer){const source=c.createBufferSource(),sample=HORN_SAMPLES[record.sample];source.buffer=buffer;source.loop=true;source.loopStart=sample.loopStart;source.loopEnd=sample.loopEnd;source.playbackRate.value=record.rate;source.connect(v.filter);source.onended=()=>{source.disconnect();if(v.source===source)v.source=null;};v.source=source;source.start();}
  else v.osc.forEach((o,j)=>{o.type=preset.wave;o.frequency.setValueAtTime(preset.frequencies[j],time);});
 }
 update(speed:number,throttle:boolean,horn:boolean,playing:boolean,events:NPCHornEvent[]=[],listener={x:0,y:0,z:0,rx:1,rz:0},simulationTime=0){
  if(!this.ctx||!this.gain)return;const time=this.ctx.currentTime,audible=!this.muted&&playing;
  this.gain.gain.setTargetAtTime(audible?.014+speed*.0009:0,time,.1);this.engine?.frequency.setTargetAtTime(32+speed*3+(throttle?8:0),time,.15);this.harmonic?.frequency.setTargetAtTime(65+speed*6,time,.15);
  if(this.player){const v=this.player;if(audible&&horn){if(!v.active)this.begin(v,-2,1,time);v.filter.frequency.setTargetAtTime(v.sampled?5500:1700,time,.03);v.gain.gain.setTargetAtTime(v.sampled?.24:.045,time,.015);}else if(v.active)this.stop(v,time);}
  const selected=audible?events.filter(e=>simulationTime>=e.start&&simulationTime<e.start+e.duration&&!!RECORDED_HORNS[e.preset]&&(!this.noiseReduced||e.id%4===0)).slice(0,4):[];
  // Stable voice assignment prevents a continuing honk restarting when another event ends.
  for(const v of this.voices)if(v.active&&!selected.some(e=>e.id===v.id))this.stop(v,time);
  for(const e of selected){
   const v=this.voices.find(v=>v.active&&v.id===e.id)??this.voices.find(v=>!v.active);if(!v)continue;
   if(!v.active)this.begin(v,e.id,e.preset,time);
   const preset=HORN_PRESETS[e.preset],record=RECORDED_HORNS[e.preset],age=simulationTime-e.start,dx=e.x-listener.x,dz=e.z-listener.z,distance=Math.hypot(dx,dz,e.y-listener.y),attenuation=1/(1+(distance/24)**2);
   // Distant recordings lose upper harmonics; the nearby player horn stays crisp.
   v.filter.frequency.setTargetAtTime(v.sampled?Math.max(1300,6500-distance*35):preset.filter,time,.08);
   if(!v.sampled)v.osc.forEach((o,j)=>o.frequency.setTargetAtTime(preset.frequencies[j]+Math.sin(age*18)*preset.wobble,time,.015));
   v.pan.pan.setTargetAtTime(Math.max(-.85,Math.min(.85,(dx*listener.rx+dz*listener.rz)/Math.max(8,distance))),time,.04);
   v.gain.gain.setTargetAtTime(hornEnvelope(preset,age,e.duration,e.priority)*attenuation*(v.sampled?(e.priority?.22:.16)*record.gain:e.priority?.024:.016),time,.012);
  }
 }
 dispose(){this.abort?.abort();this.abort=null;this.loading=null;if(this.ctx){for(const v of [...this.voices,...(this.player?[this.player]:[])])this.stop(v,this.ctx.currentTime);void this.ctx.close();}this.voices=[];this.player=null;this.buffers.clear();this.gain=null;this.ctx=null;}
}
