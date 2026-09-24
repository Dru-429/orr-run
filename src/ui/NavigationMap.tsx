import {useMemo} from 'react';
import {map,pose,ROUTE_LENGTH,locationName} from '../game/route';
import {buildingLandmarks} from '../game/landmarks';
import {junctionRecords} from '../game/junctions';

export function NavigationMap({s,x=0}:{s:number;x?:number}){
 const tile=Math.floor(s/100);
 const data=useMemo(()=>{
  const anchor=pose(tile*100+90),near=(px:number,pz:number)=>Math.abs(px-anchor.x)<500&&Math.abs(pz-anchor.z)<500;
  return {roads:map.infrastructure.filter(r=>r.tags.highway&&r.points.some(p=>near(p[0],p[1]))),buildings:map.buildings.filter(b=>near(b.center[0],b.center[1])),areas:map.landscape.filter(f=>f.points.some(p=>near(p[0],p[1]))),names:buildingLandmarks.filter(b=>Math.abs(b.station-tile*100)<400)};
 },[tile]);
 const centre=pose(Math.min(ROUTE_LENGTH,s+85)),player=pose(s,x),scale=.46;
 const project=(px:number,pz:number)=>[150+(px-centre.x)*scale,102+(pz-centre.z)*scale];
 const path=(points:number[][])=>points.map((p,i)=>(i?'L':'M')+project(p[0],p[1]).join(',')).join(' ');
 const [px,py]=project(player.x,player.z),next=junctionRecords.find(j=>j.stopLine>s+10),distance=next?next.stopLine-s:ROUTE_LENGTH-s;
 const labelBoxes:{x:number;y:number}[]=[];
 const names=data.names.sort((a,b)=>Math.abs(a.station-s)-Math.abs(b.station-s)).flatMap(b=>{const [x,y]=project(b.x,b.z);if(x<62||x>238||y<22||y>170||Math.hypot(x-px,y-py)<28||labelBoxes.some(p=>Math.abs(p.x-x)<110&&Math.abs(p.y-y)<25))return [];labelBoxes.push({x,y});return [{...b,x,y}];}).slice(0,4);
 return <section className="navigation-map" aria-label="Live navigation map" data-station={s.toFixed(1)}>
  <div className="nav-instruction"><span className="nav-turn">↑</span><div><strong>Stay on Outer Ring Road</strong><span>{distance<1000?`${Math.round(distance/10)*10} m`:`${(distance/1000).toFixed(1)} km`} · {next?'next signal':'segment finish'}</span></div></div>
  <svg viewBox="0 0 300 200" role="img" aria-label={`Car at ${Math.round(s)} metres, ${locationName(s)}`}>
   <rect width="300" height="200" fill="#edf0e6"/>
   {data.areas.map(f=><path key={f.id} d={[...f.polygons,...f.holes].map(r=>path(r)+'Z').join(' ')} fillRule="evenodd" fill={f.kind==='water'?'#a9d8e6':'#d4e3c2'}/>)}
   {data.buildings.map(b=><path key={b.id} d={path(b.polygon)+'Z'} fill="#deded5" stroke="#d0d1c7" strokeWidth=".5"/>)}
   {data.roads.map((r,i)=><path key={i} d={path(r.points)} fill="none" stroke="#fff" strokeWidth={r.tags.highway==='residential'?3:6} strokeLinejoin="round"/>)}
   <path d={path(map.centerline.map(p=>p.p))} fill="none" stroke="#fff" strokeWidth="13" strokeLinejoin="round"/>
   <path d={path(map.centerline.map(p=>p.p))} fill="none" stroke="#4285eb" strokeWidth="7" strokeLinejoin="round"/>
   {data.areas.filter(f=>f.kind==='water'&&['relation/8469370','relation/3120373'].includes(f.id)).map(f=>{const p=f.points[Math.floor(f.points.length/2)],[x,y]=project(p[0],p[1]);return <text key={f.id} x={x} y={y} className="nav-water">{f.tags.name}</text>;})}
   {names.map(b=><g key={b.id}><circle cx={b.x} cy={b.y+5} r="2.5" fill="#697b68"/><text x={b.x} y={b.y} className="nav-place">{b.name.length>28?b.name.slice(0,26)+'…':b.name}</text></g>)}
   <g transform={`translate(${px},${py}) rotate(${-player.yaw*180/Math.PI})`} data-player-arrow="true"><circle r="20" fill="#4285eb" opacity=".13"/><path d="M0 -14 L10 10 L0 6 L-10 10 Z" fill="#2976e5" stroke="white" strokeWidth="2.5" strokeLinejoin="round"/></g>
   <g transform="translate(280 20)"><circle r="12" fill="white"/><text textAnchor="middle" y="4" fill="#526351" fontSize="10" fontWeight="700">N ↑</text></g>
  </svg>
  <footer><strong>{((ROUTE_LENGTH-s)/1000).toFixed(1)} km left</strong><span>Toward Marathahalli</span></footer>
 </section>;
}
