/** CC0 recordings; source credits and processing details ship beside the WAV files. */
export const HORN_SAMPLES={
 car:{url:'/audio/horns/car.wav',loopStart:.065,loopEnd:.18},
 car2:{url:'/audio/horns/car2.wav',loopStart:.23,loopEnd:1.13},
 compact:{url:'/audio/horns/compact.wav',loopStart:.095,loopEnd:.24},
 bike:{url:'/audio/horns/bike.wav',loopStart:.135,loopEnd:.28},
 bus:{url:'/audio/horns/bus.wav',loopStart:.18,loopEnd:.49},
 truck:{url:'/audio/horns/truck.wav',loopStart:.12,loopEnd:.32},
} as const;
export type HornSampleId=keyof typeof HORN_SAMPLES;
export const RECORDED_HORNS:{sample:HornSampleId;rate:number;gain:number}[]=[
 {sample:'car',rate:1,gain:1},{sample:'car2',rate:1,gain:1},{sample:'compact',rate:.95,gain:.95},
 // Auto voices are adaptations of electric car horns, not verified rickshaw recordings.
 {sample:'compact',rate:1.08,gain:.95},{sample:'car2',rate:1.2,gain:.9},{sample:'compact',rate:1.16,gain:.95},
 {sample:'bike',rate:1,gain:.85},{sample:'bike',rate:.94,gain:.85},{sample:'bike',rate:1.09,gain:.85},
 {sample:'bus',rate:1,gain:1.05},{sample:'bus',rate:.94,gain:1.05},{sample:'bus',rate:1.06,gain:1},
 {sample:'truck',rate:1,gain:1.1},{sample:'truck',rate:.92,gain:1.1},{sample:'truck',rate:1.07,gain:1.05},
];
export async function loadHornSamples(ctx:AudioContext,signal:AbortSignal,existing=new Map<HornSampleId,AudioBuffer>()){
 const buffers=new Map(existing);
 await Promise.all(Object.entries(HORN_SAMPLES).map(async([id,record])=>{
  if(buffers.has(id as HornSampleId))return;
  try{const response=await fetch(record.url,{signal});if(!response.ok)throw new Error('Horn asset unavailable');const buffer=await ctx.decodeAudioData(await response.arrayBuffer());if(!signal.aborted&&buffer.duration>record.loopEnd)buffers.set(id as HornSampleId,buffer);}catch{/* Each missing recording keeps its synthesized fallback; retry on the next user start/resume. */}
 }));return buffers;
}
