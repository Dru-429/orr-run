import {makeStreetWearMaterials,addFootpathWear,stainConcrete} from './streetWear';
import {surfaceDetail} from './presentationMaterials';
import {addRoadSurfaces,makeSurfaceMaterials} from './roadSurfaceScene';
import {addHoardings} from './hoardingScene';
import {getPosterArtwork,isPosterTexture,disposePosterArtwork} from './poster-artwork';
import {facadeSignFaces} from './facadeSigns';
import {buildingLandmarks} from './landmarks';
import {junctionRecords} from './junctions';
import * as T from 'three';
import {Batch,asphalt,facadeTexture,material,sign,canvasTexture} from './assets';
import {map,pose,roadHeight,ROUTE_LENGTH,LEGACY_OFFSET,manifest} from './route';
import {APPEARANCE} from '../data/appearance';
import {buildings,transport,landscape,construction} from '../survey/records';
import {ROAD_WORK,crossSectionAt,oldStation,supportOffset} from '../survey/corridor';
import {addSurveyStructures,addSurveyLandscape} from './surveyScene';
import {polygonShapes} from './shapes';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

function makeChunk(from:number,to:number,resources:WorldResources){
 const world=new T.Group();const material=resources.material;
 addHoardings(world,from,to,resources.posters,material);
 addRoadSurfaces(world,from,to,resources.surfaces);
 addFootpathWear(world,from,to,resources.wear);
 const concrete=material('#b7b5a8'),lightConcrete=material('#d0cec0'),dark=material('#505851'),white=material('#deded0'),yellow=material('#d3b459'),green=material('#727b53'),black=material('#444744');
 const wallBlue=material('#93adbf');
 const pavement=material('#acac9c'),soil=material('#9c9176'),asphaltMat=resources.asphalt;
 type Edge=number|((s:number)=>number);
 function strip(start:number,end:number,left:Edge,right:Edge,mat:T.Material,height:(s:number)=>number,uvScale=8){
  start=Math.max(from,start);end=Math.min(to,end);if(end<=start)return;
  const points=[start,...map.centerline.map(p=>p.s).filter(s=>s>start&&s<end),end];
  const samples=[...new Set([...points,...Array.from({length:Math.ceil((end-start)/5)},(_,i)=>Math.min(end,start+i*5))])].sort((a,b)=>a-b);
  const positions:number[]=[],uv:number[]=[],indices:number[]=[];
  samples.forEach((s,i)=>{for(const edge of [left,right]){const o=typeof edge==='number'?edge:edge(s),p=pose(s,o);positions.push(p.x,height(s),p.z);uv.push(o/uvScale,s/uvScale);}if(i){const n=i*2;indices.push(n-2,n-1,n,n-1,n+1,n);}});
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();const mesh=new T.Mesh(g,mat);mesh.receiveShadow=true;world.add(mesh);
 }
 const edge=(key:'left'|'right'|'oppositeLeft'|'oppositeRight',delta=0)=>(s:number)=>crossSectionAt(s)[key]+delta;
 strip(from,to,edge('left'),edge('right'),asphaltMat,s=>roadHeight(s)+.04);
 strip(from,to,edge('oppositeLeft'),edge('oppositeRight'),asphaltMat,s=>crossSectionAt(s).oppositeElevation+.04);
 for(let a=from;a<to;a+=5)if(!junctionRecords.some(j=>a>j.centre-20&&a<j.centre+20))strip(a,a+5,edge('right'),edge('oppositeLeft'),concrete,()=>.25);
 for(let s=from;s<to;s+=5){const c=crossSectionAt(s);if(c.serviceLeftActive){strip(s,s+5,c.serviceLeft[0],c.serviceLeft[1],asphaltMat,()=>.04);strip(s,s+5,c.serviceLeft[0]-1,c.serviceLeft[0],pavement,()=>.08);}if(c.serviceRightActive){strip(s,s+5,c.serviceRight[0],c.serviceRight[1],asphaltMat,()=>.04);strip(s,s+5,c.serviceRight[1],c.serviceRight[1]+1,pavement,()=>.08);}}
 for(const key of ['left','right','oppositeLeft','oppositeRight'] as const){const shift=key==='left'||key==='oppositeLeft'?.25:-.35;strip(from,to,edge(key,shift),edge(key,shift+.09),white,s=>(key.startsWith('opposite')?crossSectionAt(s).oppositeElevation:roadHeight(s))+.055);}
 for(let s=Math.ceil(from/12)*12;s<to;s+=12)for(const opposite of [false,true]){const lanes=opposite?crossSectionAt(s).oppositeCentres:crossSectionAt(s).laneCentres;for(let i=1;i<lanes.length;i++){const at=(t:number)=>{const c=crossSectionAt(t),arr=opposite?c.oppositeCentres:c.laneCentres;return ((arr[Math.min(i-1,arr.length-1)]+arr[Math.min(i,arr.length-1)])/2);};strip(s,s+4,at,t=>at(t)+.11,white,t=>(opposite?crossSectionAt(t).oppositeElevation:roadHeight(t))+.062);}}
 const wearBatch=new Batch();const roadBatch=new Batch(),deckConcrete=material('#b6b4a7');deckConcrete.side=T.DoubleSide;
 // Estimated flyover ramp wall, observed cream panels with purple band in April 2026.
 for(let s=Math.max(oldStation(230),from);s<Math.min(oldStation(380),to);s+=3){const c=crossSectionAt(s),p=pose(s,c.oppositeLeft-.3),h=c.oppositeElevation;if(h>.2){roadBatch.box(.4,h,3.05,p.x,h/2,p.z,lightConcrete,p.yaw);roadBatch.box(.43,.3,3.05,p.x,h*.45,p.z,material('#917394'),p.yaw);}}
 // Black-and-yellow curbs, retaining walls and transverse underpass deck.
 for(let s=Math.ceil(from/3)*3;s<to;s+=3){if(junctionRecords.some(j=>Math.abs(j.centre-s)<20))continue;const c=crossSectionAt(s);for(const o of [c.left-.15,c.right+.15,c.oppositeLeft-.15,c.oppositeRight+.15]){const p=pose(s,o);roadBatch.box(.28,.35,2.97,p.x,(o>=c.oppositeLeft-.2?c.oppositeElevation:p.y)+.17,p.z,(Math.floor(s/3)%2)?black:yellow,p.yaw);}}
 for(let s=Math.max(from,LEGACY_OFFSET-200);s<Math.min(to,LEGACY_OFFSET+435);s+=1.25){const c=crossSectionAt(s);for(const o of [c.left-.5,c.right+.2,c.oppositeLeft-.2,c.oppositeRight+.5]){const p=pose(s,o),height=Math.max(.1,.5-p.y);roadBatch.box(.42,height,1.3,p.x,p.y+height/2,p.z,Math.floor(s/1.25)%2?wallBlue:lightConcrete,p.yaw);if(Math.floor(s/1.25)%5===0)stainConcrete(wearBatch,resources.wear,p.x,p.y,p.z,p.yaw,.42,1.3,height,Math.round(s));}}
 const deck=transport.find(f=>f.kind==='underpass')!.attributes.deck.value as {from:number;to:number;width:number;top:number};const bridge=pose((deck.from+deck.to)/2,7.3);if(deck.from>=from&&deck.from<to){roadBatch.box(deck.width,1,deck.to-deck.from,bridge.x,deck.top-.65,bridge.z,concrete,bridge.yaw);
 roadBatch.box(deck.width,.15,deck.to-deck.from,bridge.x,deck.top-.07,bridge.z,asphaltMat,bridge.yaw);
 }

 // Each carriageway has its own deck and ramp. Ground roads continue underneath.
 for(const opposite of [false,true])for(let s=Math.ceil(from/5)*5;s<to;s+=5){const c=crossSectionAt(s),h=opposite?c.oppositeElevation:c.elevation;if(h<.15)continue;const left=opposite?c.oppositeLeft:c.left,right=opposite?c.oppositeRight:c.right;
  strip(s,s+5,left,right,deckConcrete,t=>(opposite?crossSectionAt(t).oppositeElevation:roadHeight(t))-.75);
  strip(s,s+5,left,right,asphaltMat,()=>.015);
  for(const d of [left-.3,right+.3]){const p=pose(s+2.5,d);const next=opposite?crossSectionAt(s+2.5).oppositeElevation:p.y;roadBatch.box(.36,.8,5.02,p.x,next-.4,p.z,deckConcrete,p.yaw);roadBatch.box(.35,.8,5.02,p.x,next+.4,p.z,Math.floor(s/5)%2?lightConcrete:black,p.yaw);roadBatch.box(.07,.07,5.02,p.x,next+1,p.z,dark,p.yaw);if(h<5.8)roadBatch.box(.4,h,5.02,p.x,h/2,p.z,concrete,p.yaw);}
  if(h>=5.8&&Math.round(s)%30===0){const p=pose(s,(left+right)/2);roadBatch.box(1.6,h-.8,2.3,p.x,(h-.8)/2,p.z,concrete,p.yaw);stainConcrete(wearBatch,resources.wear,p.x,0,p.z,p.yaw,1.6,2.3,h-.8,Math.round(s),true);roadBatch.box(right-left-.8,.5,2.6,p.x,h-1,p.z,lightConcrete,p.yaw);}
 }
 const under=manifest.marathahalliUnderpass;
 for(let s=Math.max(from,under.from);s<Math.min(to,under.to);s+=3){const c=crossSectionAt(s);for(const d of [c.left-.3,c.right+.2,c.oppositeLeft-.2,c.oppositeRight+.3]){const p=pose(s,d),h=.6-p.y;roadBatch.box(.4,h,3.04,p.x,p.y+h/2,p.z,Math.floor(s/3)%2?wallBlue:lightConcrete,p.yaw);if(Math.floor(s/3)%3===0)stainConcrete(wearBatch,resources.wear,p.x,p.y,p.z,p.yaw,.4,3.04,h,Math.round(s));roadBatch.box(.43,.18,3.04,p.x,.6,p.z,lightConcrete,p.yaw);}}
 if(under.coveredFrom>=from&&under.coveredFrom<to){const s=(under.coveredFrom+under.coveredTo)/2,c=crossSectionAt(s),p=pose(s,(c.left+c.oppositeRight)/2);roadBatch.box(c.oppositeRight-c.left+3,.7,under.coveredTo-under.coveredFrom,p.x,-.35,p.z,concrete,p.yaw);roadBatch.box(c.oppositeRight-c.left+3,.08,under.coveredTo-under.coveredFrom,p.x,.05,p.z,asphaltMat,p.yaw);}
 addSurveyStructures(world,roadBatch,from,to,material);
 // Tall LED streetlights on the verges.
 for(let s=Math.ceil(from/46)*46;s<to;s+=46)for(const o of [crossSectionAt(s).left-2.5,crossSectionAt(s).oppositeRight+2.5]){
  const p=pose(s,o);roadBatch.box(.14,9,.14,p.x,4.5,p.z,dark,p.yaw);const q=pose(s,o+(o<0?2:-2));roadBatch.box(4,.09,.1,(p.x+q.x)/2,8.9,(p.z+q.z)/2,dark,p.yaw);roadBatch.box(.75,.12,.25,q.x,8.86,q.z,white,p.yaw);
 }
 // Dated construction treatment: exact individual barrier positions remain approximate.
 for(let s=Math.max(ROAD_WORK.from,from);s<Math.min(ROAD_WORK.to,to);s+=2.8){const p=pose(s,ROAD_WORK.offset);roadBatch.box(ROAD_WORK.barrierWidth,ROAD_WORK.height,2.5,p.x,p.y+ROAD_WORK.height/2,p.z,s%5<2.5?material('#b3c0b8'):concrete,p.yaw);}
 roadBatch.finish(world);wearBatch.finish(world,false);
 if(LEGACY_OFFSET+825>=from&&LEGACY_OFFSET+825<to){const warning=sign('METRO WORK IN PROGRESS',3.3,.85,'#223b38','#e7d6a0','SLOW DOWN');place(warning,LEGACY_OFFSET+825,4.85,1.8);world.add(warning);}
 // Two signs are navigation cues, not assertions of surveyed signboard wording.
 for(const s of [160,LEGACY_OFFSET+35,LEGACY_OFFSET+540].filter(s=>s>=from&&s<to)){const p=pose(s,crossSectionAt(s).left-3);const g=new T.Group();const pole=new T.Mesh(new T.CylinderGeometry(.08,.08,6,8),dark);pole.position.y=3;g.add(pole);const panel=sign('MARATHAHALLI  ↑',5.5,1.45,'#faf8e4','#205242','ಮಾರತಹಳ್ಳಿ  •  OUTER RING ROAD');panel.position.set(1.8,5.6,0);g.add(panel);g.position.set(p.x,0,p.z);g.rotation.y=p.yaw;world.add(g);}

 const facade=resources.facade;
 const roof=material('#bdbdb0');const chunks=new Map<number,Batch>();
 for(const station of transport.filter(f=>f.kind==='metro-station'&&Math.max(0,Math.min(ROUTE_LENGTH-.001,f.station))>=from&&Math.max(0,Math.min(ROUTE_LENGTH-.001,f.station))<to)){
   const batch=new Batch();
   const deckHeight=Number(station.attributes.deckHeight.value),roofHeight=Number(station.attributes.roofHeight.value);
   const footprint=new T.Shape(station.geometry.coordinates.slice(0,-1).map(p=>new T.Vector2(p[0],-p[1])));
   for(const [y,thickness] of (station.station>=LEGACY_OFFSET+1000?[[deckHeight,1.4]]:[[deckHeight,1.4],[roofHeight,.45]])){const slab=new T.ExtrudeGeometry(footprint,{depth:thickness,bevelEnabled:false});slab.rotateX(-Math.PI/2);slab.translate(0,y,0);batch.add(slab,concrete);slab.dispose();}
   for(let a=station.from+8;a<station.to-5;a+=19){const p=pose(a,supportOffset(a,-9.5,.8));batch.box(1.6,deckHeight,1.6,p.x,deckHeight/2,p.z,concrete,p.yaw);const mid=pose(a,2.5);batch.box(29,.65,1,mid.x,deckHeight-.6,mid.z,concrete,mid.yaw);}
   for(const o of [-10,17])for(let a=station.from+6;a<station.to;a+=12){const p=pose(a,o);batch.box(.4,roofHeight-deckHeight,.4,p.x,(deckHeight+roofHeight)/2,p.z,lightConcrete,p.yaw);}
   const meshMat=new T.MeshStandardMaterial({color:'#789e88',transparent:true,opacity:.38,side:T.DoubleSide});
   for(const a of [station.from+12,station.from+42,station.to-20]){const p=pose(a,-10);batch.box(.08,6,9,p.x,deckHeight+2,p.z,meshMat,p.yaw);}
   batch.finish(world);
 }
 for(const building of buildings.map(b=>b.model).filter(b=>Math.max(0,Math.min(ROUTE_LENGTH-.001,b.station))>=from&&Math.max(0,Math.min(ROUTE_LENGTH-.001,b.station))<to)){
  const chunk=Math.floor(building.station/200);if(!chunks.has(chunk))chunks.set(chunk,new Batch());const batch=chunks.get(chunk)!;
  const points=building.polygon.slice(0,-1);const appearance=APPEARANCE[building.id];const height=appearance?.height??building.height;
  if(building.kind==='roof'){const roofGeometry=new T.ExtrudeGeometry(polygonShapes({coordinates:building.polygon as [number,number][],polygons:building.polygons as [number,number][][],holes:building.holes as [number,number][][]}),{depth:.35,bevelEnabled:false});roofGeometry.rotateX(-Math.PI/2);roofGeometry.translate(0,height,0);batch.add(roofGeometry,lightConcrete);roofGeometry.dispose();for(const q of points.filter((_:number[],i:number)=>i%Math.max(1,Math.floor(points.length/4))===0))batch.box(.3,height,.3,q[0],height/2,q[1],concrete);continue;}
  const isAdobe=building.id==='381171222',isJp=building.id==='148325529';
  const office=building.kind==='office';const observedFacade=buildings.find(b=>b.model.id===building.id)?.attributes.facade.value as keyof typeof facade;const facadeMat=observedFacade&&facade[observedFacade]?facade[observedFacade]:appearance?facade[appearance.palette]:isAdobe?facade.adobe:isJp?facade.silver:office?facade.glass:building.height>13?facade.cream:facade.shop;
  const shapes=polygonShapes({coordinates:building.polygon as [number,number][],polygons:building.polygons as [number,number][][],holes:building.holes as [number,number][][]});const geo=new T.ShapeGeometry(shapes);geo.rotateX(-Math.PI/2);geo.translate(0,height,0);batch.add(geo,roof);geo.dispose();
  for(const points of [...building.polygons,...building.holes].map(r=>r.slice(0,-1)))for(let i=0;i<points.length;i++){
   const a=points[i],b=points[(i+1)%points.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<.2)continue;
   const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute([a[0],.05,a[1],b[0],.05,b[1],a[0],height,a[1],b[0],height,b[1]],3));
   geometry.setAttribute('uv',new T.Float32BufferAttribute([0,0,len/12.8,0,0,height/13.6,len/12.8,height/13.6],2));geometry.setIndex([0,1,2,1,3,2,2,1,0,2,3,1]);geometry.computeVertexNormals();batch.add(geometry,facadeMat);geometry.dispose();
   const yaw=Math.atan2(b[0]-a[0],b[1]-a[1]);
   if(Math.abs(building.offset)>155)continue;
   batch.box(.35,.45,len+.3,(a[0]+b[0])/2,height+.1,(a[1]+b[1])/2,lightConcrete,yaw);
   if(isAdobe||isJp){for(let h=3.4;h<height;h+=3.4)batch.box(.32,.23,len,(a[0]+b[0])/2,h,(a[1]+b[1])/2,lightConcrete,yaw);}
   if(isAdobe){for(let j=0;j<len;j+=12){const t=j/len;batch.box(.65,height,.65,a[0]+(b[0]-a[0])*t,height/2,a[1]+(b[1]-a[1])*t,lightConcrete);}}
  }
  if(building.height>15&&Math.abs(building.offset)<155){batch.box(5,2,4,building.center[0],height+1,building.center[1],concrete);batch.box(3,1.3,2,building.center[0]+8,height+.65,building.center[1],dark);}
  const landmark=buildingLandmarks.find(b=>b.id==='building:'+building.id);
  const text=landmark&&(landmark.signName??landmark.name);
  if(text){
   const p=pose(building.station),approach=pose(building.station-65);
   const faces=facadeSignFaces(building.polygon as [number,number][],[p.x,p.z],[approach.x,approach.z]);
   const texture=canvasTexture(1024,192,c=>{c.fillStyle=isAdobe?'#ececdf':'#203a33';c.fillRect(0,0,1024,192);c.fillStyle=isAdobe?'#ef332c':'#f5f4df';c.textAlign='center';c.textBaseline='middle';c.font='600 '+Math.min(104,1700/Math.max(8,text.length))+'px Arial';c.fillText(text,512,96,960);});
   const nameMaterial=new T.MeshBasicMaterial({map:texture,side:T.FrontSide,polygonOffset:true,polygonOffsetFactor:-1});
   for(const face of faces){const w=Math.min(28,face.length*.84),h=Math.min(3.2,Math.max(1.25,w/7));const label=new T.Mesh(new T.PlaneGeometry(w,h),nameMaterial);label.position.set(face.x+face.nx*.08,Math.max(h/2+.4,Math.min(height-h/2-.3,height*.72)),face.z+face.nz*.08);label.rotation.y=Math.atan2(face.nx,face.nz);world.add(label);}
  }
 }
 for(const batch of chunks.values())batch.finish(world);
 // Give mapped businesses real names; unknown buildings stay unsigned.
 const businessBatch=new Batch();
 for(const poi of map.pois){
  const tags=poi.tags as Record<string,string|undefined>;if(!tags.name||Math.abs(poi.offset)>95||poi.station<from||poi.station>=to)continue;
  if(tags.highway==='bus_stop'){
   const cross=crossSectionAt(poi.station),stopOffset=poi.offset>10?cross.oppositeRight+3:cross.left-3;const p=pose(poi.station,stopOffset);businessBatch.box(5,.18,2,p.x,2.6,p.z,dark,p.yaw);for(const d of [-2,2]){const q=pose(poi.station+d,stopOffset);businessBatch.box(.09,2.6,.09,q.x,1.3,q.z,dark);}
   businessBatch.box(4,.13,.65,p.x,.55,p.z,dark,p.yaw);continue;
  }

 }
 businessBatch.finish(world);
 addSurveyLandscape(world,from,to,material);
 return world;
}

interface WorldResources {wear:ReturnType<typeof makeStreetWearMaterials>;surfaces:ReturnType<typeof makeSurfaceMaterials>;posters:T.MeshBasicMaterial[];material:typeof material;asphalt:ReturnType<typeof asphalt>;facade:Record<Parameters<typeof facadeTexture>[0],T.MeshStandardMaterial>}
export function makeWorld(scene:T.Scene){
 const world=new T.Group();scene.add(world);
 const concreteDetail=surfaceDetail(512,true);
 const concreteColors=new Set(['#b7b5a8','#d0cec0','#b6b4a7','#b6b4a8','#c5c3b7','#bdbdb0']);
 const palette=new Map<string,T.MeshStandardMaterial>();const sharedMaterial:typeof material=(color,roughness=.85)=>{const key=String(color)+roughness;if(!palette.has(key)){const m=material(color,roughness);if(concreteColors.has(String(color))){m.bumpMap=concreteDetail;m.bumpScale=.065;m.roughnessMap=concreteDetail;m.roughness=.95;}palette.set(key,m);}return palette.get(key)!;};
 const resources:WorldResources={wear:makeStreetWearMaterials(),surfaces:makeSurfaceMaterials(),posters:getPosterArtwork().map(map=>new T.MeshBasicMaterial({map,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2})),material:sharedMaterial,asphalt:asphalt(),facade:Object.fromEntries((['glass','cream','shop','adobe','silver','sattva','green-glass','blue-glass'] as const).map(k=>[k,facadeTexture(k)])) as WorldResources['facade']};
 const shared=()=>new Set<T.Material>([...resources.wear.all,...resources.surfaces.all,...resources.posters,...palette.values(),resources.asphalt,...Object.values(resources.facade)]);
 const groundShape=new T.Shape([new T.Vector2(-13000,-13000),new T.Vector2(13000,-13000),new T.Vector2(13000,13000),new T.Vector2(-13000,13000)]);
 const trench:number[][]=[];for(let s=LEGACY_OFFSET-265;s<=LEGACY_OFFSET+440;s+=5){const p=pose(s,crossSectionAt(s).left-1);trench.push([p.x,-p.z]);}for(let s=LEGACY_OFFSET+440;s>=LEGACY_OFFSET-265;s-=5){const p=pose(s,crossSectionAt(s).oppositeRight+1);trench.push([p.x,-p.z]);}groundShape.holes.push(new T.Path(trench.map(p=>new T.Vector2(p[0],p[1]))));
 const under=manifest.marathahalliUnderpass,cutout:number[][]=[];
 for(let s=under.from;s<under.to;s+=5){const p=pose(s,crossSectionAt(s).left-1);cutout.push([p.x,-p.z]);}for(let s=under.to;s>under.from;s-=5){const p=pose(s,crossSectionAt(s).oppositeRight+1);cutout.push([p.x,-p.z]);}groundShape.holes.push(new T.Path(cutout.map(p=>new T.Vector2(p[0],p[1]))));
 const ground=new T.Mesh(new T.ShapeGeometry(groundShape),sharedMaterial('#a5aa8e'));ground.rotation.x=-Math.PI/2;ground.position.y=-.09;world.add(ground);
 // Soft atmospheric sky instead of an opaque flat background.
 const skyGeo=new T.SphereGeometry(1600,24,16);const skyMat=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{top:{value:new T.Color('#83afbc')},bottom:{value:new T.Color('#e1dfca')}},vertexShader:'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec3 vP;uniform vec3 top;uniform vec3 bottom;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}void main(){vec3 d=normalize(vP);float h=clamp(d.y*1.6,0.,1.);vec3 c=mix(bottom,top,pow(h,.7));vec2 p=d.xz/max(.18,d.y)*2.;float n=noise(p)*.55+noise(p*2.2)*.25+noise(p*4.8)*.13+noise(p*9.)*.07;float cloud=smoothstep(.47,.73,n)*smoothstep(.02,.3,d.y);c=mix(c,vec3(.89,.91,.88),cloud*.65);gl_FragColor=vec4(c,1.);}'});const sky=new T.Mesh(skyGeo,skyMat);world.add(sky);
 // Large lake footprints are single persistent meshes, never split at chunk seams.
 const lakes=[...landscape,...construction].filter(f=>f.geometry.type==='polygon'&&(f.kind==='water'||f.to-f.from>200)).map(f=>{const geo=new T.ShapeGeometry(polygonShapes(f.geometry));geo.rotateX(-Math.PI/2);const mesh=new T.Mesh(geo,sharedMaterial(f.kind==='water'?'#638c87':f.kind==='construction'?'#b3a082':'#96a477',f.kind==='water'?.3:.9));mesh.position.y=.015;world.add(mesh);return {mesh,from:f.from,to:f.to};});
 const chunks=new Map<number,T.Group>();let current=-1;
 const release=(group:T.Group)=>{const common=shared(),mats=new Set<T.Material>();group.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Sprite){if(o instanceof T.Mesh)o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])if(!common.has(m))mats.add(m);}});mats.forEach(m=>{Object.values(m).forEach(v=>{if(v instanceof T.Texture&&!isPosterTexture(v))v.dispose();});m.dispose();});world.remove(group);};
 function update(station:number){
  for(const l of lakes)l.mesh.visible=station+1000>=l.from&&station-500<=l.to;const p=pose(station);sky.position.set(p.x,0,p.z);const index=Math.floor(station/200);if(index===current)return;current=index;const first=Math.max(0,index-2),last=Math.min(Math.ceil(ROUTE_LENGTH/200)-1,index+4);
  for(const [id,group] of chunks)if(id<first||id>last){release(group);chunks.delete(id);}
  for(let id=first;id<=last;id++)if(!chunks.has(id)){const group=makeChunk(id*200,id===Math.ceil(ROUTE_LENGTH/200)-1?ROUTE_LENGTH+160:(id+1)*200,resources);chunks.set(id,group);world.add(group);}
  world.userData.chunks=chunks.size;
 }
 update(0);
 return {group:world,update,surfaceTime(time:number,low:boolean){resources.surfaces.time.value=time;resources.surfaces.detail.value=low?0:1;},dispose(){for(const g of chunks.values())release(g);chunks.clear();for(const m of shared()){Object.values(m).forEach(v=>{if(v instanceof T.Texture&&!isPosterTexture(v))v.dispose();});m.dispose();}disposePosterArtwork();lakes.forEach(l=>l.mesh.geometry.dispose());ground.geometry.dispose();skyGeo.dispose();skyMat.dispose();scene.remove(world);}};
}
export function place(mesh:T.Object3D,s:number,offset:number,y:number){const p=pose(s,offset);mesh.position.set(p.x,p.y+y,p.z);mesh.rotation.y=p.yaw;}

export function makeCockpit(camera:T.Camera){
 const group=new T.Group();camera.add(group);const b=new Batch();
 const dark=material('#252b2c',.95),dash=material('#43483f'),trim=material('#89938b',.45),leather=material('#383b37');
 const profile=new T.Shape();profile.moveTo(1.8,-.59);profile.quadraticCurveTo(1.2,-.53,.72,-.67);profile.lineTo(.25,-.87);profile.lineTo(.25,-1.25);profile.lineTo(1.8,-1.25);profile.closePath();const dashboard=new T.ExtrudeGeometry(profile,{depth:3.25,bevelEnabled:true,bevelSize:.03,bevelThickness:.03,bevelSegments:3,steps:1});dashboard.rotateY(Math.PI/2);dashboard.translate(-2,0,0);b.add(dashboard,dash);dashboard.dispose();b.box(3.15,.025,.045,-.44,-.72,-.63,trim);
 // Windshield side pillars are in cabin space so they frame the road without covering it.
 for(const x of [-1.9,1.51]){const geo=new T.BoxGeometry(.075,2.3,.10);geo.rotateZ(x<0?-.22:.22);geo.translate(x,-.01,-1.23);b.add(geo,dark);geo.dispose();}
 b.box(.43,.14,.045,-.55,.51,-1.45,dark);
 b.box(.035,.23,.05,-.55,.67,-1.46,dark);
 // Recessed instruments and passenger air vents.
 const binnacle=new RoundedBoxGeometry(.84,.29,.18,3,.065);binnacle.translate(.05,-.28,-1.13);b.add(binnacle,dark);binnacle.dispose();
 for(const x of [-1.15,-.62,.71]){b.box(.28,.10,.06,x,-.72,-.56,dark);for(let i=0;i<3;i++)b.box(.24,.009,.01,x,-.746+i*.03,-.52,trim);}
 b.finish(group,false);
 const wheel=new T.Group();wheel.position.set(.055,-.34,-.92);wheel.rotation.x=-.12;
 // Open-top yoke: flat bottom bar, vertical side grips, rounded horns — no upper rim.
 const yokePath=new T.CatmullRomCurve3([
  new T.Vector3(-.17,.2,0),new T.Vector3(-.22,.12,0),new T.Vector3(-.235,.02,0),
  new T.Vector3(-.23,-.1,0),new T.Vector3(-.16,-.2,0),new T.Vector3(0,-.225,0),
  new T.Vector3(.16,-.2,0),new T.Vector3(.23,-.1,0),new T.Vector3(.235,.02,0),
  new T.Vector3(.22,.12,0),new T.Vector3(.17,.2,0),
 ],false,'catmullrom',.35);
 const rim=new T.Mesh(new T.TubeGeometry(yokePath,56,.03,10,false),leather);wheel.add(rim);
 for(const tip of [yokePath.getPoint(0),yokePath.getPoint(1)]){const cap=new T.Mesh(new T.SphereGeometry(.03,10,8),leather);cap.position.copy(tip);wheel.add(cap);}
 const hub=new T.Mesh(new RoundedBoxGeometry(.2,.18,.055,2,.02),dark);hub.position.z=.01;wheel.add(hub);
 const chrome=material('#c5cbc4',.28);const chromeTrim=new T.Mesh(new T.TorusGeometry(.095,.006,6,28,Math.PI),chrome);
 chromeTrim.rotation.set(Math.PI/2,0,Math.PI);chromeTrim.position.set(0,-.055,.035);wheel.add(chromeTrim);
 for(const side of [-1,1]){
  const wing=new T.Mesh(new RoundedBoxGeometry(.11,.055,.03,1,.01),dark);wing.position.set(side*.145,-.01,.02);wheel.add(wing);
  const dial=new T.Mesh(new T.CylinderGeometry(.012,.012,.018,10),trim);dial.rotation.x=Math.PI/2;dial.position.set(side*.145,-.01,.04);wheel.add(dial);
 }
 const badge=sign('ORR',.11,.034,'#cdd4c4','transparent');badge.position.z=.04;wheel.add(badge);group.add(wheel);
 const c=document.createElement('canvas');c.width=512;c.height=180;const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;
 const screen=new T.Mesh(new T.PlaneGeometry(.66,.20),new T.MeshBasicMaterial({map:texture}));screen.position.set(.05,-.28,-1.027);group.add(screen);
 const nav=sign('ORR',.36,.20,'#dce39f','#182d2a','MARATHAHALLI  ↑');nav.position.set(-.62,-.90,-.225);group.add(nav);
 function update(speed:number,steer:number,health:number){wheel.rotation.z=-steer*1.05;const ctx=c.getContext('2d')!;ctx.fillStyle='#142527';ctx.fillRect(0,0,512,180);ctx.fillStyle='#d9e7da';ctx.textAlign='center';ctx.font='600 68px monospace';ctx.fillText(String(Math.round(speed*3.6)).padStart(2,'0'),256,77);ctx.font='17px monospace';ctx.fillStyle='#829891';ctx.fillText('km/h',256,102);ctx.fillStyle='#cddf9a';ctx.font='24px monospace';ctx.fillText('D',460,93);ctx.font='17px monospace';ctx.fillText(Math.round(health)+'%',60,93);ctx.strokeStyle='#94ab89';ctx.lineWidth=7;ctx.beginPath();ctx.arc(90,100,59,Math.PI,Math.PI*1.85);ctx.stroke();ctx.beginPath();ctx.arc(422,100,59,Math.PI,Math.PI*1.85);ctx.stroke();texture.needsUpdate=true;}
 const mirror=new T.Mesh(new T.PlaneGeometry(.38,.105),new T.MeshBasicMaterial({color:0xffffff}));mirror.position.set(-.55,.51,-1.422);group.add(mirror);
 update(0,0,100);return {group,wheel,update,mirror};
}
