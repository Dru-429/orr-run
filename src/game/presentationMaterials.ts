import * as T from 'three';

export function daylightEnvironment(){
 const width=256,height=128,data=new Uint8Array(width*height*4);
 const sky=new T.Color('#9ebacb'),haze=new T.Color('#e9e0cd'),ground=new T.Color('#615f55'),color=new T.Color();
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const h=y/(height-1),i=(y*width+x)*4;
  color.copy(h<.5?sky:haze).lerp(h<.5?haze:ground,h<.5?h*2:(h-.5)*2);
  const skyline=.49+Math.sin(Math.floor(x/13)*4.3)*.025;
  if(h>skyline&&h<.57)color.multiplyScalar(.65);
  data[i]=color.r*255;data[i+1]=color.g*255;data[i+2]=color.b*255;data[i+3]=255;
 }
 const texture=new T.DataTexture(data,width,height);texture.mapping=T.EquirectangularReflectionMapping;texture.needsUpdate=true;return texture;
}

/** Shared, seeded surface detail. Generated once per world, never in the frame loop. */
export function surfaceDetail(size=512,concrete=false){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
 const c=canvas.getContext('2d')!,pixels=c.createImageData(size,size);let seed=7463;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const noise=random(),v=concrete?170+noise*26:130+noise*95;
  const i=(y*size+x)*4;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=v;pixels.data[i+3]=255;
 }
 c.putImageData(pixels,0,0);
 if(concrete){for(let y=0;y<size;y+=128){c.fillStyle='#707070';c.fillRect(0,y,size,2);c.fillStyle='#c4c4c4';c.fillRect(0,y+2,size,2);for(let x=32;x<size;x+=128){c.fillStyle='#888';c.beginPath();c.arc(x,y+35,2,0,Math.PI*2);c.fill();}}}
 else{for(let i=0;i<18;i++){let x=random()*size,y=random()*size;c.beginPath();c.moveTo(x,y);for(let j=0;j<6;j++){x+=(random()-.5)*25;y+=random()*14;c.lineTo(x,y);}c.lineWidth=.5+random();c.strokeStyle='#444';c.stroke();}}
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.NoColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.anisotropy=4;return texture;
}

/** Broad material variation is world anchored, so repeated road tiles do not form a grid. */
export function varyRoad(material:T.MeshStandardMaterial){
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 roadWorld;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nroadWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
  shader.fragmentShader='varying vec3 roadWorld;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float wear=sin(roadWorld.x*.43+sin(roadWorld.z*.11))*sin(roadWorld.z*.19);
   float patches=sin(roadWorld.x*.13+roadWorld.z*.07)*sin(roadWorld.z*.31);
   diffuseColor.rgb*=.92+wear*.05+patches*.055;`);
 };
 material.customProgramCacheKey=()=> 'orr-road-wear-v1';
}
