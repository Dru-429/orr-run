import {roadsideProps} from './roadside';
import oppositeFlyovers from '../data/opposite-flyovers.json';
import * as T from 'three';
import {Batch,material} from './assets';
import {buildings,landscape,construction,transport} from '../survey/records';
import {contains} from '../survey/geometry';
import {polygonShapes} from './shapes';
import {crossSectionAt,supportOffset} from '../survey/corridor';
import {pose,nearestStation,ROUTE_LENGTH,LEGACY_OFFSET,SILK_LENGTH,manifest} from './route';
import type {Point} from '../survey/types';
export function addSurveyStructures(world:T.Group,batch:Batch,from:number,to:number,makeMaterial=material){
 const material=makeMaterial;const owned=(station:number)=>Math.max(0,Math.min(ROUTE_LENGTH-.001,station))>=from&&Math.max(0,Math.min(ROUTE_LENGTH-.001,station))<to;
 const concrete=material('#b7b5a8'),light=material('#d0cec0');
 for(const f of construction.filter(f=>f.kind==='hoarding'&&owned(f.station))){const points=f.geometry.coordinates,height=Number(f.attributes.height.value);for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]),yaw=Math.atan2(b[0]-a[0],b[1]-a[1]);batch.box(.16,height,length,(a[0]+b[0])/2,height/2,(a[1]+b[1])/2,material(String(f.attributes.color.value)),yaw);for(let t=0;t<length;t+=3)batch.box(.22,height+.12,.15,a[0]+(b[0]-a[0])*t/length,height/2,a[1]+(b[1]-a[1])*t/length,light,yaw);}}
 const pierPosition=(f:{station:number;offset:number;geometry:{coordinates:Point[]}})=>{const p=pose(f.station),delta=supportOffset(f.station,f.offset)-f.offset;return [f.geometry.coordinates[0][0]+p.rx*delta,f.geometry.coordinates[0][1]+p.rz*delta];};
 const piers=transport.filter(f=>f.kind==='metro-pier');
 for(const f of [...piers,...transport.filter(f=>f.kind==='metro-support-estimate')].filter(f=>owned(f.station))){const [x,z]=pierPosition(f),p=pose(f.station),top=Number(f.attributes.height.value);if(f.station<LEGACY_OFFSET+812){const shaft=new T.CylinderGeometry(.95,1.05,top,12);shaft.translate(x,top/2,z);batch.add(shaft,concrete);shaft.dispose();}else batch.box(1.9,top,2.2,x,top/2,z,concrete,p.yaw);batch.box(8.5,.85,2.35,x,top-.2,z,light,p.yaw);}
 const single=piers.filter(f=>/^ORP\d+$/.test(f.name)).sort((a,b)=>a.station-b.station);
 for(let i=1;i<single.length;i++){
  const a=single[i-1],b=single[i];if(b.station-a.station>65||!owned((a.station+b.station)/2))continue;
  const [x,z]=pierPosition(a),[xx,zz]=pierPosition(b),length=Math.hypot(xx-x,zz-z),yaw=Math.atan2(xx-x,zz-z);const nx=(zz-z)/length,nz=-(xx-x)/length;
  const steelSpan=transport.find(f=>f.kind==='metro-span'&&f.attributes.material?.value==='steel'&&(a.station+b.station)/2>=f.from&&(a.station+b.station)/2<=f.to);
  const deckMaterial=steelSpan?material('#59696a'):light;batch.box(8.9,1.05,length+.12,(x+xx)/2,13.3,(z+zz)/2,deckMaterial,yaw);
  if(steelSpan)for(let t=0;t<length;t+=2.3)batch.box(8.8,.4,.2,x+(xx-x)*t/length,12.65,z+(zz-z)*t/length,deckMaterial,yaw);
  for(const side of [-1,1])batch.box(.23,.9,length+.12,(x+xx)/2+nx*4.45*side,14,(z+zz)/2+nz*4.45*side,concrete,yaw);
 }
 // Fill only alignment intervals with no mapped ORP span. Separate tracks retain their geographic curves.
 for(const f of transport.filter(f=>f.kind==='metro-alignment'&&f.attributes.stage.value!=='proposed')){const pts=f.geometry.coordinates;for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],full=Math.hypot(b[0]-a[0],b[1]-a[1]),steps=Math.ceil(full/20);for(let j=0;j<steps;j++){const p:[number,number]=[a[0]+(b[0]-a[0])*j/steps,a[1]+(b[1]-a[1])*j/steps],q:[number,number]=[a[0]+(b[0]-a[0])*(j+1)/steps,a[1]+(b[1]-a[1])*(j+1)/steps],mx=(p[0]+q[0])/2,mz=(p[1]+q[1])/2,n=nearestStation(mx,mz);if(!owned(n.s)||Math.abs(n.offset)>30||single.some(p=>Math.abs(p.station-n.s)<34)||transport.some(t=>t.kind==='metro-station'&&n.s>=t.from&&n.s<=t.to))continue;const len=Math.hypot(q[0]-p[0],q[1]-p[1]),yaw=Math.atan2(q[0]-p[0],q[1]-p[1]);batch.box(4.6,1.05,len+.15,mx,13.3,mz,light,yaw);}}}
 // Licensed side-street alignments remain visible beneath the new flyovers.
 for(const f of transport.filter(f=>f.kind==='road'&&!f.attributes.selectedRoute?.value&&['primary','secondary','tertiary','residential','unclassified','trunk_link','primary_link','footway','path'].includes(String(f.attributes.roadClass?.value)))){const pts=f.geometry.coordinates;for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],mid:[number,number]=[(a[0]+b[0])/2,(a[1]+b[1])/2],near=nearestStation(...mid),length=Math.hypot(b[0]-a[0],b[1]-a[1]);const path=['footway','path'].includes(String(f.attributes.roadClass?.value));if(length<1||near.s>SILK_LENGTH&&near.s<LEGACY_OFFSET+1000||Math.abs(near.offset)>(path?700:180)||!owned(near.s)||path&&(near.s<1700||near.s>2900))continue;const projected=Math.abs(nearestStation(...b).s-nearestStation(...a).s);if(!path&&projected>length*.85)continue;batch.box(Number(f.attributes.sceneryWidth.value),.06,length+.1,mid[0],.025,mid[1],material(path?'#b9b69b':'#656b62'),Math.atan2(b[0]-a[0],b[1]-a[1]));}}
 // Road flyovers use licensed alignments; vertical dimensions and supports remain estimated.
 for(const f of transport.filter(f=>f.kind==='bridge'&&['trunk','primary','secondary','tertiary'].includes(String(f.attributes.roadClass?.value)))){
  const selected=Boolean(f.attributes.selectedRoute?.value);if(selected||oppositeFlyovers.some(p=>p.sources.some(url=>f.id.startsWith('transport:'+url.split('/').at(-1)+':'))))continue;const pts=f.geometry.coordinates;
  for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],mid:[number,number]=[(a[0]+b[0])/2,(a[1]+b[1])/2],near=nearestStation(...mid);if(!owned(near.s))continue;
   const length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<.01)continue;const yaw=Math.atan2(b[0]-a[0],b[1]-a[1]),width=String(f.attributes.roadClass.value)==='trunk'?11:7;
   const level=near.s>=manifest.marathahalliUnderpass.coveredFrom-35&&near.s<=manifest.marathahalliUnderpass.coveredTo+35?.4:selected?pose(near.s).y:near.s<300?6.4:near.s>=LEGACY_OFFSET&&near.s<LEGACY_OFFSET+205?2.55:Math.max(6,pose(near.s).y+6);
   batch.box(width,.8,length+.1,mid[0],level-.45,mid[1],concrete,yaw);
   if(!selected)batch.box(width,.08,length+.1,mid[0],level,mid[1],material('#606460'),yaw);
   for(const side of [-1,1]){const nx=(b[1]-a[1])/length,nz=-(b[0]-a[0])/length;batch.box(.35,.8,length+.1,mid[0]+nx*(width/2)*side,level+.35,mid[1]+nz*(width/2)*side,light,yaw);}
   // Avoid unsupported pier placement in the playable envelope.
   if(length>25&&Math.abs(near.offset)>crossSectionAt(near.s).right+3)batch.box(1.8,Math.max(.1,level-.9),2.5,mid[0],(level-.9)/2,mid[1],concrete,yaw);
  }
 }
 // Mapped pedestrian bridge is distinct from the metro. Vertical dimensions remain estimated.
 for(const f of transport.filter(f=>f.kind==='bridge'&&['footway','pedestrian','steps'].includes(String(f.attributes.roadClass?.value))&&owned(f.station))){
  const pts=f.geometry.coordinates;if(pts.length<2)continue;for(let i=1;i<pts.length;i++){
   const a=pts[i-1],b=pts[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length>180)continue;
   const yaw=Math.atan2(b[0]-a[0],b[1]-a[1]),nx=(b[1]-a[1])/length,nz=-(b[0]-a[0])/length;const steel=material('#697875');
   batch.box(2.6,.35,length,(a[0]+b[0])/2,6,(a[1]+b[1])/2,steel,yaw);batch.box(3,.18,length,(a[0]+b[0])/2,8.1,(a[1]+b[1])/2,steel,yaw);
   for(const side of [-1,1]){batch.box(.10,.12,length,(a[0]+b[0])/2+nx*1.25*side,7.15,(a[1]+b[1])/2+nz*1.25*side,steel,yaw);for(let t=0;t<length;t+=3)batch.box(.10,2.2,.1,a[0]+(b[0]-a[0])*t/length+nx*1.25*side,7,a[1]+(b[1]-a[1])*t/length+nz*1.25*side,steel,yaw);}
  }
 }
}
export function addSurveyLandscape(world:T.Group,from:number,to:number,makeMaterial=material){
 const material=makeMaterial;const owned=(station:number)=>Math.max(0,Math.min(ROUTE_LENGTH-.001,station))>=from&&Math.max(0,Math.min(ROUTE_LENGTH-.001,station))<to;
 const surfaces=new Batch(),trees=new Batch();const bark=material('#77725a'),leaves=[material('#66774b'),material('#758458'),material('#849066')];let treeCount=0;
 const polygons=[...landscape,...construction.filter(f=>f.geometry.type==='polygon')].filter(f=>f.kind==='fence'||f.to-f.from>200?f.to>=from&&f.from<=to:owned(f.station));
 const occupied=(p:Point)=>buildings.some(b=>contains(p,b.geometry.coordinates))||landscape.some(f=>f.kind==='water'&&f.geometry.type==='polygon'&&(f.geometry.polygons??[f.geometry.coordinates]).some(r=>contains(p,r))&&!(f.geometry.holes??[]).some(r=>contains(p,r)));
 function tree(p:Point,seed:number){if(treeCount>=120)return;const near=nearestStation(...p);if(!owned(near.s)||occupied(p))return;const cross=crossSectionAt(near.s);if(near.offset>cross.left-1&&near.offset<cross.oppositeRight+1||cross.serviceLeftActive&&near.offset>cross.serviceLeft[0]-.5&&near.offset<cross.serviceLeft[1]+.5||cross.serviceRightActive&&near.offset>cross.serviceRight[0]-.5&&near.offset<cross.serviceRight[1]+.5)return;treeCount++;const height=4.3+(seed%30)/10;const trunk=new T.CylinderGeometry(.13,.24,height,5);trunk.translate(p[0],height/2,p[1]);trees.add(trunk,bark);trunk.dispose();for(let j=0;j<4;j++){const a=j*2.399,geo=new T.IcosahedronGeometry(2.0+(seed%5)*.12,1);geo.scale(1.1,.85,1);geo.translate(p[0]+Math.cos(a)*1.5,height+Math.sin(j)*.65,p[1]+Math.sin(a)*1.5);trees.add(geo,leaves[(seed+j)%3]);geo.dispose();}}
 for(const f of polygons){
  const points=f.geometry.coordinates;
  if(f.geometry.type==='point'){tree(points[0],treeCount+15);continue;}
  if(f.geometry.type==='polygon'){
   if(f.kind==='water')continue;
   const g=new T.ShapeGeometry(polygonShapes(f.geometry));g.rotateX(-Math.PI/2);g.translate(0,Number(f.attributes.elevation?.value??.01),0);
   if(f.to-f.from<=200)surfaces.add(g,material(f.kind==='water'?'#6c9792':f.kind==='construction'?'#b3a082':String(f.attributes.cover?.value)==='scrub'?'#839273':'#96a477'));g.dispose();
   // Ground-cover boundaries are map-derived; individual canopy positions are estimated.
   if(f.kind==='greenery'&&!['grass','meadow'].includes(String(f.attributes.cover?.value))){
    const xs=points.map(p=>p[0]),zs=points.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);let seed=[...f.id].reduce((n,c)=>n+c.charCodeAt(0),0),placed=0;
    for(let x=minX+4;x<maxX&&placed<35;x+=11)for(let z=minZ+4;z<maxZ&&placed<35;z+=11){seed=(seed*1664525+1013904223)>>>0;const p:Point=[x+(seed%5),z+((seed>>>5)%5)];if(owned(nearestStation(...p).s)&&contains(p,points)){tree(p,seed);placed++;}}
   }
  }else if(f.kind==='fence'){
   let along=0,nextPost=0;const steel=material('#5d756a');
   for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]),yaw=Math.atan2(b[0]-a[0],b[1]-a[1]);if(length<.001)continue;
    while(nextPost<=along+length){const t=(nextPost-along)/length,q:Point=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];if(owned(nearestStation(...q).s))surfaces.box(.08,1.85,.08,q[0],.925,q[1],steel);nextPost+=3;}
    if(owned(nearestStation((a[0]+b[0])/2,(a[1]+b[1])/2).s)){for(const y of [.15,.9,1.75])surfaces.box(.04,.04,length,(a[0]+b[0])/2,y,(a[1]+b[1])/2,steel,yaw);
     for(let d=.15;d<length;d+=.22)surfaces.box(.012,1.6,.012,a[0]+(b[0]-a[0])*d/length,.95,a[1]+(b[1]-a[1])*d/length,steel);
     for(let y=.3;y<1.7;y+=.22)surfaces.box(.012,.012,length,(a[0]+b[0])/2,y,(a[1]+b[1])/2,steel,yaw);
    }along+=length;
   }
  }else if(f.kind==='greenery'){for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let t=0;t<length;t+=13)tree([a[0]+(b[0]-a[0])*t/length,a[1]+(b[1]-a[1])*t/length],i+Math.round(t));}}else if(f.kind==='water'){
   for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);surfaces.box(2,.12,length,(a[0]+b[0])/2,-.01,(a[1]+b[1])/2,material('#6c9792'),Math.atan2(b[0]-a[0],b[1]-a[1]));}
  }
 }
 // Ambient verges are reproducible across loops; they do not add survey claims.
 const skin=material('#976b50'),trousers=material('#414b53'),shirts=[material('#c29d63'),material('#7b9898'),material('#a16760')];
 for(const prop of roadsideProps.filter(p=>p.s>=from&&p.s<to)){
  if(prop.kind==='tree'){tree([prop.x,prop.z],prop.seed);continue;}
  for(let i=0;i<1+prop.seed%2;i++){
   const x=prop.x+Math.sin(prop.yaw)*i*.8,z=prop.z+Math.cos(prop.yaw)*i*.8;
   surfaces.box(.43,.62,.23,x,1.13,z,shirts[(prop.seed+i)%3],prop.yaw);
   for(const side of [-1,1]){surfaces.box(.14,.73,.17,x+side*.12,.4,z,trousers,prop.yaw);surfaces.box(.11,.56,.13,x+side*.28,1.12,z,skin,prop.yaw);}
   const head=new T.IcosahedronGeometry(.17,1);head.translate(x,1.62,z);surfaces.add(head,skin);head.dispose();
  }
  if(prop.seed%4===0){surfaces.box(.5,.8,.5,prop.x+1,.4,prop.z,material('#526d58'));surfaces.box(.56,.08,.56,prop.x+1,.84,prop.z,material('#384b41'));}
 }
 surfaces.finish(world,false);trees.finish(world);
 world.userData.survey={buildings:buildings.length,piers:transport.filter(f=>f.kind==='metro-pier').length,landscape:landscape.length,trees:treeCount};
}
