import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {HORN_SAMPLES,RECORDED_HORNS} from '../src/game/hornSamples';
import {DrivingAudio} from '../src/game/audio';
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
function fakeAudio(){
 const prior=Object.getOwnPropertyDescriptor(globalThis,'AudioContext'),fetch=globalThis.fetch;
 let requests=0,decodes=0,created=0,live=0,closed=0,fail=false;const sources:any[]=[];
 const param=()=>({value:0,values:[] as number[],setTargetAtTime(n:number){assert.ok(Number.isFinite(n));this.values.push(n);},setValueAtTime(n:number){assert.ok(Number.isFinite(n));this.values.push(n);}});
 const node=()=>({connect(){},disconnect(){},start(){},gain:param(),frequency:param(),pan:param(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param(),type:''});
 class Context {
  currentTime=0;destination={};createGain=node;createOscillator=node;createBiquadFilter=node;createStereoPanner=node;createDynamicsCompressor=node;
  createBufferSource(){created++;let running=false;const n={...node(),buffer:null,loop:false,loopStart:0,loopEnd:0,playbackRate:param(),onended:null,start(){running=true;live++;},stop(){if(running){running=false;live--;}}};sources.push(n);return n;}
  decodeAudioData(){decodes++;return Promise.resolve({duration:2});}resume(){return Promise.resolve();}close(){closed++;return Promise.resolve();}
 }
 Object.defineProperty(globalThis,'AudioContext',{configurable:true,value:Context});
 globalThis.fetch=(async()=>{requests++;return {ok:!fail,arrayBuffer:async()=>new ArrayBuffer(8)};}) as typeof fetch;
 return {sources,fail:(v:boolean)=>fail=v,stats:()=>({requests,decodes,created,live,closed}),restore(){globalThis.fetch=fetch;if(prior)Object.defineProperty(globalThis,'AudioContext',prior);else Reflect.deleteProperty(globalThis,'AudioContext');}};
}
const events=Array.from({length:4},(_,i)=>({id:i+1,vehicleId:i,preset:i*3,start:0,duration:2,x:i*10,y:0,z:4,priority:false}));
test('all six shipped recordings have provenance, valid PCM and safe sustain bounds for 15 variants',()=>{
 const manifest=JSON.parse(readFileSync('public/audio/horns/sources.json','utf8'));assert.equal(manifest.recordings.length,6);assert.equal(RECORDED_HORNS.length,15);let bytes=0;
 for(const [id,s] of Object.entries(HORN_SAMPLES)){
  const b=readFileSync('public'+s.url),r=manifest.recordings.find((r:any)=>r.id===id);bytes+=b.length;
  assert.equal(r.license,'CC0-1.0');assert.match(r.source,/^https:\/\//);assert.equal(createHash('sha256').update(b).digest('hex'),r.sha256);
  assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.readUInt16LE(20),1);assert.equal(b.readUInt16LE(22),1);assert.equal(b.readUInt32LE(24),22050);assert.equal(b.readUInt16LE(34),16);
  const samples=(b.length-44)/2;assert.ok(s.loopStart>0&&s.loopEnd<samples/22050);
  let peak=0,power=0;for(let i=44;i<b.length;i+=2){const n=b.readInt16LE(i)/32768;peak=Math.max(peak,Math.abs(n));power+=n*n;}assert.ok(peak<.9&&Math.sqrt(power/samples)>.04);
  // Crossfaded wrap should not introduce a large discontinuity.
  const before=b.readInt16LE(44+(Math.floor(s.loopEnd*22050)-1)*2)/32768,next=b.readInt16LE(44+Math.floor(s.loopStart*22050)*2)/32768;assert.ok(Math.abs(next-before)<.35);
 }
 assert.ok(bytes<260000);for(const p of RECORDED_HORNS)assert.ok(HORN_SAMPLES[p.sample]&&p.rate>=.9&&p.rate<=1.2);
});
test('recordings decode once; continuing events keep their sources, bounded at four NPCs plus player',async()=>{
 const f=fakeAudio();try{
  const a=new DrivingAudio();a.start();await flush();assert.equal(a.sampleStatus,'ready');assert.equal(a.sampleCount,6);
  a.update(10,true,true,true,events,undefined,.2);assert.equal(f.stats().live,5);assert.equal(a.activeVoices,4);
  for(let i=0;i<1000;i++)a.update(10,true,true,true,events,undefined,.5);assert.equal(f.stats().created,5);assert.equal(f.stats().requests,6);assert.equal(f.stats().decodes,6);
  const retained=f.sources[2];a.update(0,false,false,true,events.slice(1),undefined,.8);assert.equal(f.stats().live,3);assert.ok(f.sources.includes(retained));assert.equal(f.stats().created,5);
  a.update(0,false,false,false,events,undefined,.8);assert.equal(f.stats().live,0);assert.equal(a.activeVoices,0);
  a.start();await flush();assert.equal(f.stats().requests,6);a.update(0,false,false,true,events,undefined,1);a.trafficHornLevel=0;a.update(0,false,true,true,events,undefined,1.1);assert.equal(f.stats().live,1);
  a.trafficHornLevel=2;for(let lap=0;lap<3;lap++){a.update(0,false,false,true,events,undefined,.2);assert.equal(f.stats().live,4);a.update(0,false,false,false,[],undefined,0);assert.equal(f.stats().live,0);}
  a.dispose();assert.equal(a.sampleCount,0);assert.equal(f.stats().closed,1);
 }finally{f.restore();}
});
test('download failure uses synthesis and retries without switching a held horn mid-event',async()=>{
 const f=fakeAudio();try{f.fail(true);const a=new DrivingAudio();a.start();await flush();assert.equal(a.sampleStatus,'fallback');a.update(0,false,true,true,events,undefined,.2);assert.equal(a.activeVoices,4);assert.equal(f.stats().created,0);
  f.fail(false);a.start();await flush();assert.equal(a.sampleStatus,'ready');a.update(0,false,true,true,events,undefined,.4);assert.equal(f.stats().created,0);
  a.update(0,false,false,false,[],undefined,.5);a.update(0,false,true,true,events,undefined,.6);assert.equal(f.stats().live,5);a.dispose();assert.equal(f.stats().live,0);
 }finally{f.restore();}
});
test('disposing during loading cannot restore buffers or create playback sources',async()=>{
 const f=fakeAudio();try{const a=new DrivingAudio();a.start();a.dispose();await flush();assert.equal(a.sampleCount,0);assert.equal(a.voiceCount,0);assert.equal(f.stats().live,0);}finally{f.restore();}
});
