import * as T from 'three';
import {billboards} from '../data/billboards';
let textures:T.Texture[]|undefined;
let sources:(CanvasImageSource|undefined)[]=[];
let pending:Promise<T.Texture[]>|undefined;
let quality:boolean|undefined;
export function loadPosterArtwork():Promise<T.Texture[]>{
 if(textures)return Promise.resolve(textures);if(pending)return pending;
 const loader=new T.TextureLoader();
 pending=Promise.allSettled(billboards.map(billboard=>loader.loadAsync(billboard.image))).then(results=>{
  textures=results.map((result,index)=>{
   if(result.status==='fulfilled')return result.value;
   const billboard=billboards[index];console.warn(`Missing billboard asset: ${billboard.image}`);
   const fallback=new T.DataTexture(new Uint8Array([32,48,45,255,180,190,184,255,180,190,184,255,32,48,45,255]),2,2,T.RGBAFormat);fallback.needsUpdate=true;fallback.name=`missing:${billboard.id}`;return fallback;
  });sources=textures.map((t,index)=>results[index].status==='fulfilled'?t.image as CanvasImageSource:undefined);quality=undefined;
  textures.forEach(t=>{t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;});return textures;
 }).finally(()=>{pending=undefined;});return pending;
}
export function getPosterArtwork(){if(!textures)throw new Error('Load hoarding posters before creating scenery.');return textures;}
export function setPosterQuality(low:boolean){
 if(quality===low||!textures)return;quality=low;
 textures.forEach((t,i)=>{const source=sources[i];if(!source)return;const canvas=document.createElement('canvas');canvas.width=low?1024:2048;canvas.height=canvas.width*3/4;canvas.getContext('2d')!.drawImage(source,0,0,canvas.width,canvas.height);t.image=canvas;t.needsUpdate=true;});
}
export function isPosterTexture(t:T.Texture){return textures?.includes(t)??false;}
export function disposePosterArtwork(){textures?.forEach(t=>t.dispose());textures=undefined;sources=[];quality=undefined;}
