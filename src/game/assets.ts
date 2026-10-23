import * as T from 'three';
import {surfaceDetail,varyRoad} from './presentationMaterials';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import type {VehicleKind} from './simulation';

export function canvasTexture(w:number,h:number,draw:(c:CanvasRenderingContext2D)=>void){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d')!);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;}
export function labelTexture(text:string,color='#eee9d9',bg='transparent',sub=''){
 return canvasTexture(1024,256,c=>{if(bg!=='transparent'){c.fillStyle=bg;c.fillRect(0,0,1024,256);}c.fillStyle=color;c.textAlign='center';c.textBaseline='middle';c.font='600 '+Math.min(100,1300/text.length)+'px Arial, sans-serif';c.fillText(text,512,sub?100:128,975);if(sub){c.font='26px Arial';c.fillText(sub,512,192,940);}});
}
export function sign(text:string,w:number,h:number,color='#f6f3dd',bg='#174935',sub=''){
 const material=new T.MeshBasicMaterial({map:labelTexture(text,color,bg,sub),transparent:bg==='transparent',side:T.DoubleSide});
 return new T.Mesh(new T.PlaneGeometry(w,h),material);
}
export const material=(color:T.ColorRepresentation,roughness=.85)=>new T.MeshStandardMaterial({color,roughness});
export class Batch {
 groups=new Map<T.Material,T.BufferGeometry[]>();
 add(geometry:T.BufferGeometry,mat:T.Material,matrix?:T.Matrix4){const g=geometry.clone();if(matrix)g.applyMatrix4(matrix);if(g.index) {const ng=g.toNonIndexed();g.dispose();return this.addDirect(ng,mat);}this.addDirect(g,mat);}
 private addDirect(g:T.BufferGeometry,mat:T.Material){g.deleteAttribute('uv1');g.deleteAttribute('tangent');if(!g.getAttribute('uv'))g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count*2),2));if(!this.groups.has(mat))this.groups.set(mat,[]);this.groups.get(mat)!.push(g);}
 box(w:number,h:number,d:number,x:number,y:number,z:number,mat:T.Material,yaw=0){const g=new T.BoxGeometry(w,h,d);this.add(g,mat,new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),yaw),new T.Vector3(1,1,1)));g.dispose();}
 finish(parent:T.Object3D,shadows=true){for(const [mat,geos] of this.groups){const geom=mergeGeometries(geos,false);geos.forEach(g=>g.dispose());if(!geom)continue;geom.computeBoundingSphere();const mesh=new T.Mesh(geom,mat);mesh.receiveShadow=true;mesh.castShadow=shadows;parent.add(mesh);}this.groups.clear();}
}
export function asphalt(){
 let r=321;const rnd=()=>{r=(r*1664525+1013904223)>>>0;return r/4294967296;};
 const t=canvasTexture(512,512,c=>{c.fillStyle='#606460';c.fillRect(0,0,512,512);for(let i=0;i<33000;i++){const v=60+Math.floor(rnd()*70);c.fillStyle='rgba('+v+','+v+','+v+',.3)';c.fillRect(rnd()*512,rnd()*512,1.4,1.4);}c.strokeStyle='rgba(30,35,34,.15)';c.lineWidth=2;for(let i=0;i<14;i++){c.beginPath();const x=rnd()*512,y=rnd()*512;c.moveTo(x,y);c.lineTo(x+25,y+12);c.lineTo(x+40,y+40);c.stroke();}});t.wrapS=t.wrapT=T.RepeatWrapping;const detail=surfaceDetail(1024);const road=new T.MeshStandardMaterial({map:t,color:'#b1b6ba',bumpMap:detail,bumpScale:.025,roughnessMap:detail,roughness:.98});varyRoad(road);return road;
}
export function facadeTexture(kind:'glass'|'cream'|'shop'|'adobe'|'silver'|'sattva'|'green-glass'|'blue-glass'){
 const texture=canvasTexture(512,512,c=>{
  c.fillStyle=kind==='cream'?'#ddd4c3':kind==='shop'?'#cecbc0':'#718a93';c.fillRect(0,0,512,512);
  for(let row=0;row<4;row++)for(let col=0;col<4;col++){
   const x=col*128,y=row*128;const glass=!['cream','shop'].includes(kind);
   const grad=c.createLinearGradient(x,y,x,y+128);grad.addColorStop(0,glass?'#8da6ad':'#86999d');grad.addColorStop(.5,glass?'#728f98':'#354b50');grad.addColorStop(1,glass?'#a6b9bb':'#62777a');
   c.fillStyle=kind==='blue-glass'?'#38647e':kind==='green-glass'?'#527365':grad;c.fillRect(x+(glass?3:24),y+(glass?3:20),glass?122:76,glass?108:74);
   c.fillStyle='rgba(36,50,53,.22)';c.fillRect(x+4,y+80,120,25);
   // Per-window blinds, reflected skyline and interior depth, baked into the atlas.
   c.fillStyle=(row*7+col*3)%5===0?'rgba(214,202,151,.22)':'rgba(12,27,37,.20)';c.fillRect(x+8,y+7,110,68);
   for(let j=0;j<4;j++){c.fillStyle='rgba(190,218,230,.10)';c.fillRect(x+12+j*26,y+12,9,38+(col*13+j*17)%44);}
   if((row+col)%3===0){c.fillStyle='rgba(215,216,200,.22)';for(let y0=18;y0<60;y0+=5)c.fillRect(x+8,y+y0,110,2);}
   c.fillStyle='rgba(15,29,36,.5)';c.fillRect(x+62,y+3,3,105);
   c.fillStyle=kind==='adobe'?'#e4dfd3':kind==='silver'?'#ccd1ce':'#acb9b9';if(glass)c.fillRect(x,y+113,128,8);
   if(kind==='sattva'){c.fillStyle=(row+col)%3===0?'#b65d53':(row+col)%3===1?'#527ea4':'#e1ded0';c.fillRect(x,y+95,128,18);c.fillStyle='#e7e2d5';c.fillRect(x,y,6,128);}
   if(kind==='adobe'){c.fillStyle='#eeeadf';c.fillRect(x+((row+col)%2?105:0),y,8,128);}
   if(!glass){c.fillStyle='#a9a79c';c.fillRect(x+20,y+94,84,5);c.fillStyle='rgba(0,0,0,.1)';c.fillRect(x+20,y+99,84,5);}
  }
 });texture.wrapS=texture.wrapT=T.RepeatWrapping;return new T.MeshStandardMaterial({map:texture,roughness:['cream','shop'].includes(kind)?.85:.32,metalness:['cream','shop'].includes(kind)?0:.28});
}
const vehicleTemplates=new Map<string,T.Group>();
let vehicleGlass:T.Texture|undefined;
export function vehicle(kind:VehicleKind,colorIndex:number,variant:'city'|'tourist'='city'){
 const tourist=kind==='bus'&&variant==='tourist';
 const key=tourist?'tourist-coach':kind==='car'||kind==='bike'?kind+colorIndex:kind;if(vehicleTemplates.has(key))return vehicleTemplates.get(key)!.clone();
 const group=new T.Group(),b=new Batch();
 const colors=['#efeee3','#354a50','#adbbb8','#afa698','#8d3f36','#536c7d','#d5d5ce'];
 const paint=material(kind==='auto'?'#37694b':kind==='cab'?'#efede3':kind==='bus'?(tourist?'#e8e2ce':'#328a9c'):kind==='truck'?'#b68b57':colors[colorIndex%7],.45);
 paint.metalness=.3;paint.roughness=.3;
 const trim=material('#20292b',.65),glass=material('#253d49',.17),chrome=material('#a7b3b9',.28),rubber=material('#171c20',.95),cream=material(tourist?'#53777b':'#e5bd41');
 glass.metalness=.25;chrome.metalness=.65;
 vehicleGlass??=canvasTexture(32,128,c=>{const g=c.createLinearGradient(0,0,0,128);g.addColorStop(0,'#b2c9d0');g.addColorStop(.45,'#657f90');g.addColorStop(.5,'#455e6c');g.addColorStop(1,'#243947');c.fillStyle=g;c.fillRect(0,0,32,128);});glass.map=vehicleGlass;glass.color.set(tourist?'#40545c':'#b7cbd2');
 const box=(w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material)=>b.box(w,h,d,x,y,z,m);
 const wheel=(x:number,z:number,r=.32)=>{const g=new T.CylinderGeometry(r,r,.22,20);g.rotateZ(Math.PI/2);g.translate(x,r,z);b.add(g,rubber);g.dispose();const hub=new T.CylinderGeometry(r*.5,r*.5,.235,8);hub.rotateZ(Math.PI/2);hub.translate(x,r,z);b.add(hub,chrome);hub.dispose();};
 if(kind==='car'||kind==='cab'){
  const rounded=(w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material,r=.06)=>{const g=new RoundedBoxGeometry(w,h,d,1,r);g.translate(x,y,z);b.add(g,m);g.dispose();};
  const quad=(points:number[][],normal:number[],m:T.Material)=>{
   const verts=points.map(p=>new T.Vector3(...p as [number,number,number]));
   const n=new T.Vector3().subVectors(verts[1],verts[0]).cross(new T.Vector3().subVectors(verts[2],verts[0]));
   if(n.dot(new T.Vector3(...normal as [number,number,number]))<0)verts.reverse();
   const g=new T.BufferGeometry().setFromPoints(verts);const minY=Math.min(...verts.map(v=>v.y)),maxY=Math.max(...verts.map(v=>v.y));g.setAttribute('uv',new T.Float32BufferAttribute(verts.flatMap((v,i)=>[i===1||i===2?1:0,(v.y-minY)/Math.max(.001,maxY-minY)]),2));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();b.add(g,m);g.dispose();
  };
  // A closed side profile with real wheel openings, extruded across the body.
  const shape=new T.Shape();shape.moveTo(2.0,.34);
  for(const [z,y] of [[-2.03,.65],[-1.97,.86],[-1.18,1.03],[.95,1.04],[1.94,.93],[2.03,.72],[2.0,.34]])shape.lineTo(-z,y);
  for(const centre of [1.32,-1.32]){
   shape.lineTo(-(centre+.455),.34);
   for(let i=0;i<=12;i++){const a=i/12*Math.PI;shape.lineTo(-(centre+Math.cos(a)*.455),.34+Math.sin(a)*.455);}
  }
  shape.closePath();
  const body=new T.ExtrudeGeometry(shape,{depth:1.54,steps:1,bevelEnabled:true,bevelSegments:3,bevelSize:.07,bevelThickness:.07,curveSegments:8});
  body.rotateY(Math.PI/2);body.translate(-.77,0,0);b.add(body,paint);body.dispose();
  // Painted cabin shell; inset windows leave substantial A/B/C pillars.
  quad([[-.815,1,-1.17],[.815,1,-1.17],[.675,1.56,-.52],[-.675,1.56,-.52]],[0,1,-1],paint);
  quad([[-.675,1.56,.51],[.675,1.56,.51],[.815,1,1.19],[-.815,1,1.19]],[0,1,1],paint);
  for(const side of [-1,1]){
   quad([[side*.815,1,-1.17],[side*.675,1.56,-.52],[side*.675,1.56,.51],[side*.815,1,1.19]],[side,0,0],paint);
   const panel=(points:number[][])=>quad(points.map(([z,y])=>[side*(.815-(y-1)*.25+.007),y,z]),[side,0,0],glass);
   panel([[-1.02,1.08],[-.48,1.505],[-.10,1.505],[-.10,1.08]]);
   panel([[.01,1.08],[.01,1.505],[.46,1.505],[1.02,1.08]]);
   box(.025,.035,2.23,side*.823,1.035,0,chrome);
   box(.028,.018,1.66,side*.864,.79,.02,chrome);
   box(.02,.55,.014,side*.867,.72,-.055,trim);
   for(const z of [-.2,.79])rounded(.028,.043,.17,side*.879,.94,z,chrome,.012);
   rounded(.07,.13,.25,side*.858,1.10,-.92,paint,.025);
   for(const z of [-1.32,1.32])wheel(side*.775,z,.34);
   box(.03,.07,1.7,side*.86,.34,0,trim);
  }
  quad([[-.72,1.08,-1.087],[.72,1.08,-1.087],[.615,1.50,-.599],[-.615,1.50,-.599]],[0,1,-1],glass);
  quad([[-.615,1.50,.591],[.615,1.50,.591],[.72,1.08,1.102],[-.72,1.08,1.102]],[0,1,1],glass);
  rounded(1.38,.06,1.12,0,1.565,0,paint,.03);
  rounded(1.66,.18,.19,0,.48,-1.995,paint,.05);rounded(1.66,.19,.17,0,.48,2.005,paint,.05);
  rounded(.92,.19,.035,0,.62,-2.097,trim,.013);
  for(const y of [.56,.61,.66])box(.84,.014,.016,0,y,-2.119,chrome);
  box(1.45,.04,.025,0,.38,2.11,trim);
  for(const x of [-.60,.60]){rounded(.42,.17,.065,x,.815,-2.029,trim,.025);rounded(.36,.105,.025,x,.835,-2.067,chrome,.018);box(.34,.027,.025,x,.79,-2.083,cream);rounded(.38,.18,.14,x,.84,2.075,trim,.025);}
  if(kind==='cab')rounded(.44,.14,.27,0,1.69,0,cream,.025);
 } else if(kind==='auto'){
  box(1.43,.67,2.5,0,.67,0,paint);box(1.52,.25,1.9,0,1.76,.2,cream);box(1.42,.8,.5,0,1.15,1.0,paint);box(1.34,.55,.08,0,1.32,-.97,glass);
  for(const x of [-.68,.68]){box(.08,.85,.1,x,1.2,-.9,trim);box(.08,.85,.1,x,1.2,.8,trim);wheel(x,.8,.27);}wheel(0,-.85,.27);box(1.32,.2,.1,0,.79,-1.3,cream);
 } else if(kind==='bike'){
  wheel(0,-.72,.33);wheel(0,.72,.33);box(.42,.4,1.3,0,.66,0,paint);box(.48,.15,.72,0,.95,.3,trim);box(.8,.08,.08,0,1.11,-.62,chrome);
  box(.46,.55,.34,0,1.35,.15,material('#727e85'));const head=new T.SphereGeometry(.23,10,8);head.translate(0,1.86,.06);b.add(head,trim);head.dispose();box(.32,.08,.05,0,.84,.98,chrome);
 } else {
  const bus=kind==='bus',length=bus?10.8:8,width=bus?2.55:2.45;
  box(width,bus?2.35:2.3,bus?length:5.7,0,bus?1.9:2.1,bus?0:1.1,bus?paint:material('#aca38c'));
  if(bus){box(width+.02,.95,length-.4,0,2.35,0,glass);box(width+.06,.13,length,0,1.76,0,cream);box(width,.19,length,0,3.15,0,chrome);for(let z=-4.7;!tourist&&z<5;z+=1.05){box(width+.03,1,.075,0,2.36,z,paint);}box(width-.12,.9,.04,0,2.26,5.42,glass);}
  else{box(width,1.75,2.25,0,1.45,-2.83,paint);box(width-.15,.7,.04,0,1.94,-3.98,glass);for(let z=-1.4;z<4;z+=.4)box(width+.03,2.2,.04,0,2.1,z,chrome);}
  box(width-.25,.23,length-.3,0,.69,0,trim);
  for(const x of [-width/2,width/2])for(const z of [-(length/2-1.4),length/2-1.4])wheel(x,z,.5);
 }
 if(kind==='car'&&colorIndex%3===1){
  // Compact hatch profile, inside the existing car bounds and collision height.
  box(1.22,.035,.32,0,1.60,.57,paint);box(.045,.035,1.12,-.53,1.61,0,trim);box(.045,.035,1.12,.53,1.61,0,trim);
 }
 if(kind==='bus'){for(const side of [-1,1]){for(let z=-4;z<4;z+=1.4)box(.025,.035,.95,side*1.285,1.13,z,chrome);box(.025,.42,1.15,side*1.29,.96,3.5,trim);for(let y=.8;y<1.14;y+=.07)box(.03,.018,1.1,side*1.31,y,3.5,chrome);}}
 b.finish(group,true);
 if(kind==='bus'&&!tourist){
  const logoMaterial=new T.MeshBasicMaterial({map:labelTexture('BMTC','#ffffff'),transparent:true,depthWrite:false,toneMapped:false});
  const geometry=new T.PlaneGeometry(3.8,.8);
  for(const side of [-1,1]){const logo=new T.Mesh(geometry,logoMaterial);logo.name=side<0?'bmtc-left':'bmtc-right';logo.position.set(side*1.286,1.25,0);logo.rotation.y=side*Math.PI/2;group.add(logo);}
 }
 const shadowTexture=canvasTexture(64,128,c=>{const gradient=c.createRadialGradient(32,64,3,32,64,62);gradient.addColorStop(0,'rgba(12,19,18,.6)');gradient.addColorStop(.55,'rgba(12,19,18,.24)');gradient.addColorStop(1,'rgba(12,19,18,0)');c.fillStyle=gradient;c.fillRect(0,0,64,128);});
 const shadow=new T.Mesh(new T.PlaneGeometry(kind==='bike'?1.2:kind==='bus'||kind==='truck'?3.8:2.7,kind==='bus'?12:kind==='truck'?9.5:5.4),new T.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));shadow.name='contact-shadow';shadow.rotation.x=-Math.PI/2;shadow.position.y=.025;group.add(shadow);
 const rear=kind==='bus'?5.42:kind==='truck'?4.02:kind==='auto'?1.28:kind==='bike'?1.04:2.145;
 const passenger=kind==='car'||kind==='cab';
 const lamps=new T.Group();lamps.name='brakes';const light=new T.MeshBasicMaterial({color:'#fb3a27'});
 for(const x of kind==='bike'?[0]:[-(kind==='bus'||kind==='truck'?1:passenger?.60:.65),kind==='bus'||kind==='truck'?1:passenger?.60:.65]){const m=new T.Mesh(new T.BoxGeometry(kind==='bike'?.18:passenger?.30:.28,passenger?.095:.16,passenger?.006:.03),light);m.position.set(x,passenger?.84:.8,rear);lamps.add(m);}group.add(lamps);
 const plate=sign(kind==='bus'?'KA 01 F 5029':'KA 03 MP 4921',.5,.13,'#202522',kind==='cab'||kind==='auto'||kind==='bus'?'#dbc647':'#e6e4d7');plate.position.set(0,.51,passenger?2.12:rear+.025);group.add(plate);
 if(tourist){
  const rearLabel=sign('VOLVO',2.2,.42,'#ffffff','#20363b');rearLabel.name='volvo-rear';rearLabel.position.set(0,2.96,5.455);group.add(rearLabel);
  const frontLabel=rearLabel.clone();frontLabel.name='volvo-front';frontLabel.position.z=-5.455;frontLabel.rotation.y=Math.PI;group.add(frontLabel);
 }else if(kind==='bus'){const route=sign('500D  ·  MARATHAHALLI',2,.3,'#f5d756','#192b24');route.position.set(0,2.96,rear+.025);group.add(route);}
 if(kind==='cab')group.scale.z=4.2/4.3;
 if(kind==='car'||kind==='cab'){
  const gesture=new T.Group();gesture.name='driver-gesture';gesture.visible=false;gesture.position.set(.73,1.19,-.28);const hand=new Batch(),skin=material('#ba8765'),sleeve=material('#617b80');
  hand.box(.25,.14,.17,.1,0,0,sleeve);hand.box(.3,.11,.12,.34,.025,0,skin);hand.box(.12,.25,.11,.49,.14,0,skin);
  // Palm faces the following driver; folded fingers surround the raised middle finger.
  hand.box(.19,.18,.10,.49,.32,.015,skin);hand.box(.048,.24,.075,.49,.52,.025,skin);
  for(const x of [.423,.457,.527,.561])hand.box(.035,.075,.09,x,.36,.075,skin);
  hand.box(.06,.10,.09,.385,.27,.055,skin);hand.finish(gesture);group.add(gesture);
 }
 vehicleTemplates.set(key,group);return group.clone();
}
export function disposeTemplates(){const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();for(const group of vehicleTemplates.values())group.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);Object.values(m).forEach(v=>{if(v instanceof T.Texture)textures.add(v);});}}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());vehicleTemplates.clear();vehicleGlass=undefined;}
