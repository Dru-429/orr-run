import * as T from 'three';
let textures:T.Texture[]|undefined;
let sources:CanvasImageSource[]=[];
let pending:Promise<T.Texture[]>|undefined;
let quality:boolean|undefined;
export function loadPosterArtwork():Promise<T.Texture[]>{
 if(textures)return Promise.resolve(textures);if(pending)return pending;
 const loader=new T.TextureLoader();
 pending=Promise.allSettled(Array.from({length:7},(_,i)=>loader.loadAsync((import.meta.env?.BASE_URL??'/')+`hoardings/${i+1}.png`))).then(results=>{
  if(results.some(r=>r.status==='rejected')){for(const r of results)if(r.status==='fulfilled')r.value.dispose();throw new Error('A hoarding poster could not load. Check the seven PNG files and retry.');}
  textures=results.map(r=>(r as PromiseFulfilledResult<T.Texture>).value);sources=textures.map(t=>t.image);quality=undefined;
  textures.forEach(t=>{t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;});return textures;
 }).finally(()=>{pending=undefined;});return pending;
}
export function getPosterArtwork(){if(!textures)throw new Error('Load hoarding posters before creating scenery.');return textures;}
export function setPosterQuality(low:boolean){
 if(quality===low||!textures)return;quality=low;
 textures.forEach((t,i)=>{const canvas=document.createElement('canvas');canvas.width=low?1024:2048;canvas.height=canvas.width*3/4;canvas.getContext('2d')!.drawImage(sources[i],0,0,canvas.width,canvas.height);t.image=canvas;t.needsUpdate=true;});
}
export function isPosterTexture(t:T.Texture){return textures?.includes(t)??false;}
export function disposePosterArtwork(){textures?.forEach(t=>t.dispose());textures=undefined;sources=[];quality=undefined;}
