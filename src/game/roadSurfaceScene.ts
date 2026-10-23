import * as T from 'three';
import {surfaceDetail,varyRoad} from './presentationMaterials';
import {pose} from './route';
import {crossSectionAt} from '../survey/corridor';
import {roadConditions,potholes,waterPatches,patchRadius,noise,type SurfacePatch} from './roadConditions';

function wornTexture(severe:boolean){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d')!;
 ctx.fillStyle=severe?'#666660':'#777b75';ctx.fillRect(0,0,512,512);
 for(let i=0;i<11000;i++){const x=noise(i*5)*512,y=noise(i*5+1)*512,a=noise(i*5+2);ctx.fillStyle=a>.5?'#b1ada235':'#151e2540';ctx.fillRect(x,y,1+a*2,1+a*2);}
 for(let i=0;i<(severe?35:10);i++){
  const x=noise(i+51)*512,y=noise(i+182)*512;ctx.beginPath();ctx.moveTo(x,y);
  for(let j=1;j<7;j++)ctx.lineTo(x+(noise(i*37+j)-.5)*38,y+j*7);
  ctx.strokeStyle=severe?'#252a29bd':'#303b3580';ctx.lineWidth=severe?2:1;ctx.stroke();
 }
 for(let i=0;i<(severe?10:4);i++){const x=noise(i+400)*480,y=noise(i+580)*480;ctx.fillStyle=i%2?'#353e3970':'#aaa28b40';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+25+noise(i+700)*60,y+5);ctx.lineTo(x+40,y+50);ctx.lineTo(x-10,y+40);ctx.closePath();ctx.fill();}
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.anisotropy=4;return texture;
}
export function makeSurfaceMaterials(){
 const mild=new T.MeshStandardMaterial({map:wornTexture(false),roughness:.97,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 const severe=new T.MeshStandardMaterial({map:wornTexture(true),roughness:1,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 const asphaltDetail=surfaceDetail(1024);
 for(const m of [mild,severe]){m.color.set('#b3b7b9');m.bumpMap=asphaltDetail;m.bumpScale=.03;m.roughnessMap=asphaltDetail;varyRoad(m);}
 const holes=new T.MeshStandardMaterial({vertexColors:true,roughness:1,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
 const mud=new T.MeshStandardMaterial({color:'#77694e',roughness:.96});
 const water=new T.MeshStandardMaterial({color:'#81938c',roughness:.25,metalness:.25,transparent:true,opacity:.91,depthWrite:false});
 const time={value:0},detail={value:1};
 water.onBeforeCompile=shader=>{
  shader.uniforms.surfaceTime=time;shader.uniforms.surfaceDetail=detail;
  shader.vertexShader='varying vec3 surfacePosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nsurfacePosition = position;');
  shader.fragmentShader='uniform float surfaceTime; uniform float surfaceDetail; varying vec3 surfacePosition;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float waves = sin(surfacePosition.x*6.0+surfacePosition.z*3.0+surfaceTime*1.7)*sin(surfacePosition.z*8.0-surfaceTime);
   diffuseColor.rgb += waves*.035*surfaceDetail;`);
 };
 water.customProgramCacheKey=()=> 'orr-shallow-water-v1';
 return {mild,severe,holes,mud,water,time,detail,all:[mild,severe,holes,mud,water]};
}
type Materials=ReturnType<typeof makeSurfaceMaterials>;
function buffer(positions:number[],indices:number[],colors?:number[],uv?:number[]){const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setIndex(indices);if(colors)geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));if(uv)geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.computeVertexNormals();if(geo.getAttribute('normal').getY(0)<0){for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];geo.setIndex(indices);geo.computeVertexNormals();}return geo;}
function patchMesh(p:SurfacePatch,scale:number,y:number,material:T.Material){
 const positions:number[]=[],indices:number[]=[],n=48,centre=pose(p.s,p.x);positions.push(centre.x,centre.y+y,centre.z);
 for(let i=0;i<n;i++){const angle=i/n*Math.PI*2,r=patchRadius(p,angle)*scale,q=pose(p.s+Math.sin(angle)*p.length/2*r,p.x+Math.cos(angle)*p.width/2*r);positions.push(q.x,q.y+y,q.z);indices.push(0,1+(i+1)%n,1+i);}
 const mesh=new T.Mesh(buffer(positions,indices),material);mesh.name=p.id;return mesh;
}
export function addRoadSurfaces(group:T.Group,from:number,to:number,m:Materials){
 // Merge all patches of one material in a chunk: bounded draw calls, no per-hole textures.
 for(const kind of ['mild','severe'] as const){const pos:number[]=[],indices:number[]=[],uv:number[]=[];
  for(const c of roadConditions){if(c.kind!==kind||c.to<=from||c.from>=to)continue;
   const a=Math.max(from,c.from),b=Math.min(to,c.to);
   for(const opposite of [false,true])for(let s=a;s<b;s+=3){const end=Math.min(b,s+3),base=pos.length/3;
    for(const station of [s,end]){const section=crossSectionAt(station),left=opposite?section.oppositeLeft:section.left,right=opposite?section.oppositeRight:section.right;
     for(const x of [left,right]){const p=pose(station,x);pos.push(p.x,(opposite?section.oppositeElevation:p.y)+.048,p.z);uv.push(x/9,station/9);}}
    indices.push(base,base+2,base+1,base+1,base+2,base+3);
   }
  }
  if(pos.length){const mesh=new T.Mesh(buffer(pos,indices,undefined,uv),m[kind]);mesh.receiveShadow=true;group.add(mesh);}
 }
 const positions:number[]=[],indices:number[]=[],colors:number[]=[];
 for(const p of potholes){if(p.s<from||p.s>=to)continue;const base=positions.length/3,n=16,q=pose(p.s,p.x);positions.push(q.x,q.y+.053,q.z);colors.push(.065,.076,.069);
  for(let ring=0;ring<2;ring++)for(let i=0;i<n;i++){const a=i/n*Math.PI*2,r=patchRadius(p,a)*(ring?.99:.72),v=pose(p.s+Math.sin(a)*p.length*.5*r,p.x+Math.cos(a)*p.width*.5*r);positions.push(v.x,v.y+(ring?.057:.082),v.z);const shade=ring?.31+noise(i+p.seed)*.11:.12+noise(i+p.seed)*.08;colors.push(shade,shade*.99,shade*.91);}
  for(let i=0;i<n;i++){const a=base+1+i,b=base+1+(i+1)%n;indices.push(base,b,a,a,b,b+n,a,b+n,a+n);}
 }
 if(positions.length){const mesh=new T.Mesh(buffer(positions,indices,colors),m.holes);mesh.receiveShadow=true;group.add(mesh);}
 // A puddle belongs to its centre chunk and is kept for the entire visible extent.
 for(const p of waterPatches)if(p.s>=from&&p.s<to){group.add(patchMesh(p,1.07,.067,m.mud),patchMesh(p,1,.09,m.water));}
}
/** Fixed eight-wheel spray pool. No particles or resources are created per frame. */
export function makeWheelSpray(scene:T.Scene){
 const geometry=new T.SphereGeometry(1,5,3),material=new T.MeshBasicMaterial({color:'#b9c5b6',transparent:true,opacity:.45,depthWrite:false});
 const mesh=new T.InstancedMesh(geometry,material,32);mesh.frustumCulled=false;scene.add(mesh);const transform=new T.Object3D();
 return {update(time:number,actors:{s:number;x:number;speed:number}[],low:boolean){let count=0;for(const a of actors.slice(0,low?2:8))for(let i=0;i<4;i++){
  const side=i%2?-1:1,t=(time*5+i*.23)%1,p=pose(a.s-1.25-t*Math.min(2,a.speed*.15),a.x+side*(.75+t*.6));transform.position.set(p.x,p.y+.15+Math.sin(t*Math.PI)*.28,p.z);transform.scale.set(.05+t*.07,.1*(1-t)+.02,.12+t*.15);transform.updateMatrix();mesh.setMatrixAt(count++,transform.matrix);}
  mesh.count=count;mesh.visible=count>0;mesh.instanceMatrix.needsUpdate=true;
 },dispose(){scene.remove(mesh);geometry.dispose();material.dispose();}};
}
