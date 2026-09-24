import * as T from 'three';

export interface VehicleArtwork { bus:T.Texture; truck:T.Texture }
let artwork:VehicleArtwork|undefined;
let pending:Promise<VehicleArtwork>|undefined;

/** The two images are loaded once, before any cloned vehicle is created. */
export function loadVehicleArtwork():Promise<VehicleArtwork>{
 if(artwork)return Promise.resolve(artwork);
 if(pending)return pending;
 const loader=new T.TextureLoader();
 pending=Promise.allSettled([
  loader.loadAsync((import.meta.env?.BASE_URL??'/')+'branding/antimattr-white.svg'),
  loader.loadAsync((import.meta.env?.BASE_URL??'/')+'branding/antimattr-truck.png'),
 ]).then(results=>{
  if(results.some(r=>r.status==='rejected')){
   for(const r of results)if(r.status==='fulfilled')r.value.dispose();
   throw new Error('The vehicle artwork could not load. Check your connection and reload to try again.');
  }
  const textures=results.map(r=>(r as PromiseFulfilledResult<T.Texture>).value);
  for(const t of textures){t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;}
  artwork={bus:textures[0],truck:textures[1]};return artwork;
 }).finally(()=>{pending=undefined;});
 return pending;
}

export function getVehicleArtwork(){
 if(!artwork)throw new Error('Vehicle artwork must load before building vehicles.');
 return artwork;
}

export function disposeVehicleArtwork(){
 if(artwork){artwork.bus.dispose();artwork.truck.dispose();artwork=undefined;}
}

export function isVehicleArtworkTexture(texture:T.Texture){return texture===artwork?.bus||texture===artwork?.truck;}
