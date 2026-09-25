import {useMemo,useRef} from 'react';
import {map,pose,ROUTE_LENGTH,locationName} from '../game/route';
import {buildingLandmarks} from '../game/landmarks';
import {junctionRecords} from '../game/junctions';
import type {TrafficSection} from '../game/trafficMap';
const colors={red:'#df524c',yellow:'#edbb3f',blue:'#4285eb',unknown:'#a5b1b5'};
export function NavigationMap({s,x=0,traffic=[]}:{s:number;x?:number;traffic?:TrafficSection[]}){
 const tile=Math.floor(s/100),player=pose(s,x),heading=useRef({s,yaw:player.yaw});
 const delta=Math.atan2(Math.sin(player.yaw-heading.current.yaw),Math.cos(player.yaw-heading.current.yaw));
 heading.current={s,yaw:Math.abs(s-heading.current.s)>80?player.yaw:heading.current.yaw+delta*.3};
 const yaw=heading.current.yaw,tx=-Math.sin(yaw),tz=-Math.cos(yaw),rx=-tz,rz=tx,scale=.5;
 const data=useMemo(()=>{
  const anchor=pose(tile*100+180),near=(px:number,pz:number)=>Math.abs(px-anchor.x)<700&&Math.abs(pz-anchor.z)<700;
  return {roads:map.infrastructure.filter(r=>r.tags.highway&&r.points.some((p:number[])=>near(p[0],p[1]))),buildings:map.buildings.filter(b=>near(b.center[0],b.center[1])),areas:map.landscape.filter(f=>f.points.some((p:number[])=>near(p[0],p[1]))),names:buildingLandmarks.filter(b=>b.station>tile*100-100&&b.station<tile*100+650)};
 },[tile]);
 const project=(px:number,pz:number)=>{const dx=px-player.x,dz=pz-player.z;return [120+(dx*rx+dz*rz)*scale,255-(dx*tx+dz*tz)*scale];};
 const path=(points:number[][])=>points.map((p,i)=>(i?'L':'M')+project(p[0],p[1]).join(',')).join(' ');
 const routePath=(from:number,to:number)=>path([from,...map.centerline.filter(p=>p.s>from&&p.s<to).map(p=>p.s),to].map(s=>{const p=pose(s);return [p.x,p.z];}));
 const next=junctionRecords.find(j=>j.stopLine>s+10),distance=next?next.stopLine-s:ROUTE_LENGTH-s;
 const boxes:{x:number;y:number}[]=[];
 const names=[...data.names].sort((a,b)=>Math.abs(a.station-s)-Math.abs(b.station-s)).flatMap(b=>{const [x,y]=project(b.x,b.z);if(x<52||x>188||y<22||y>297||Math.hypot(x-120,y-255)<27||boxes.some(p=>Math.abs(p.x-x)<108&&Math.abs(p.y-y)<28))return [];boxes.push({x,y});return [{...b,x,y}];}).slice(0,5);
 return <section className="navigation-map" aria-label="Live navigation map" data-station={s.toFixed(1)}>
  <div className="nav-instruction"><span className="nav-turn">↑</span><div><strong>Stay on Outer Ring Road</strong><span>{distance<1000?`${Math.round(distance/10)*10} m`:`${(distance/1000).toFixed(1)} km`} · {next?'next signal':'Marathahalli finish'}</span></div></div>
  <svg viewBox="0 0 240 320" role="img" aria-label={`Car at ${Math.round(s)} metres, ${locationName(s)}; heading-up game traffic`}>
   <rect width="240" height="320" fill="#edf0e6"/>
   {data.areas.map(f=><path key={f.id} d={[...f.polygons,...f.holes].map(r=>path(r)+'Z').join(' ')} fillRule="evenodd" fill={f.kind==='water'?'#a9d8e6':'#d4e3c2'}/>)}
   {data.buildings.map(b=><path key={b.id} d={path(b.polygon)+'Z'} fill="#deded5" stroke="#d0d1c7" strokeWidth=".5"/>)}
   {data.roads.map((r,i)=><path key={i} d={path(r.points)} fill="none" stroke="#fff" strokeWidth={r.tags.highway==='residential'?3:6} strokeLinejoin="round"/>)}
   <path d={routePath(Math.max(0,s-150),Math.min(ROUTE_LENGTH,s+650))} fill="none" stroke="#fff" strokeWidth="13" strokeLinejoin="round"/>
   <path d={routePath(Math.max(0,s-150),Math.min(ROUTE_LENGTH,s+650))} fill="none" stroke={colors.unknown} strokeWidth="7"/>
   {traffic.map(t=><path key={t.from} data-traffic={t.color} d={routePath(t.from,t.to)} fill="none" stroke={colors[t.color]} strokeWidth="7" strokeLinejoin="round"/>)}
   {data.areas.filter(f=>['relation/8469370','relation/3120373'].includes(f.id)).map(f=>{const p=f.points[Math.floor(f.points.length/2)],[x,y]=project(p[0],p[1]);return <text key={f.id} x={x} y={y} className="nav-water">{f.tags.name}</text>;})}
   {names.map(b=><g key={b.id}><circle cx={b.x} cy={b.y+5} r="2.5" fill="#697b68"/><text x={b.x} y={b.y} className="nav-place">{b.name.length>25?b.name.slice(0,23)+'…':b.name}</text></g>)}
   <g transform={`translate(120,255) rotate(${-(player.yaw-yaw)*180/Math.PI})`} data-player-arrow="true"><circle r="20" fill="#4285eb" opacity=".13"/><path d="M0 -14 L10 10 L0 6 L-10 10 Z" fill="#2976e5" stroke="white" strokeWidth="2.5" strokeLinejoin="round"/></g>
   <g transform={`translate(220 21) rotate(${yaw*180/Math.PI})`}><circle r="12" fill="white"/><path d="M0 -8 L4 5 L0 2 L-4 5Z" fill="#678375"/></g>
  </svg>
  <footer><strong>{((ROUTE_LENGTH-s)/1000).toFixed(1)} km left</strong><span>Marathahalli</span></footer>
 </section>;
}
