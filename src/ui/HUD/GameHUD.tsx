import {memo} from 'react';
import {Rocket, Heart, MapPin, Flag, Share2, RotateCcw, Maximize, Map, Check} from 'lucide-react';
import type {Snapshot} from '../../game/simulation';
import {ROUTE_LENGTH} from '../../game/route';
import {junctionRecords} from '../../game/junctions';
import './hud.css';

export const Speedometer=memo(function Speedometer({speed,flight}:{speed:number;flight:Snapshot['flight']}){
 const state=flight.state,mode=state==='GROUNDED'?'THRUSTER MODE':state==='FLYING'?'FLIGHT MODE':state==='TAKEOFF'?'THRUSTER MODE':state;
 const damaged=state==='CRASHED'||state==='RECOVERING';
 return <div className="hud-speed-stack"><section className={'hud-glass hud-speed '+(damaged?'hud-damaged':'')} aria-label="Vehicle speed and mode">
  <svg className="hud-gauge" viewBox="0 0 300 108" aria-hidden="true"><path d="M16 85 Q20 40 53 18 M247 18 Q280 40 284 85" className="gauge-track"/><path d="M16 85 Q20 40 53 18 M284 85 Q280 40 247 18" className="gauge-fill" pathLength="100" strokeDasharray={`${Math.min(100,speed*3.6/1.8)} 100`}/><path d="M49 86 L54 73 M246 73 L251 86" className="gauge-track"/></svg>
  <output aria-label={`${Math.round(speed*3.6)} kilometres per hour`}><strong>{Math.round(speed*3.6)}</strong><span>km/h</span></output>
  <div className="hud-mode"><Rocket size={16}/><span>{mode}</span></div>
 </section><ThrusterFuel fuel={flight.fuel}/></div>;
});

export function ThrusterFuel({fuel}:{fuel:number}){
 const percent=Math.max(0,Math.min(100,Math.round(fuel*100)));
 return <div className={'hud-fuel hud-glass '+(percent<20?'hud-warning':'')}><div><span>{percent<20?'LOW THRUSTER FUEL':'THRUSTER FUEL'}</span><b>{percent}%</b></div><progress max="100" value={percent} aria-label="Thruster fuel"/></div>;
}

export function VehicleStatus({snapshot}:{snapshot:Snapshot}){
 const next=junctionRecords.find(j=>j.stopLine>snapshot.s+10),distance=Math.max(0,(next?.stopLine??ROUTE_LENGTH)-snapshot.s);
 return <section className="hud-status hud-glass" aria-label="Navigation distance and vehicle health"><div><MapPin/><section><small>DISTANCE</small><strong>{Math.round(distance).toLocaleString()} <em>m</em></strong><span>{next?'to next signal':'to destination'}</span></section></div><div className={snapshot.health<30?'hud-danger':snapshot.health<60?'hud-warning':''}><Heart/><section><small>CAR HEALTH</small><strong>{Math.ceil(snapshot.health)}<em>%</em></strong><progress max="100" value={snapshot.health} aria-label="Car health"/></section></div></section>;
}

export function RouteProgress({s}:{s:number}){
 const progress=Math.max(0,Math.min(100,s/ROUTE_LENGTH*100));
 return <section className="hud-route hud-glass" aria-label="Route progress"><div><MapPin size={18}/><span>Outer Ring Road</span><small>{Math.floor(s).toLocaleString()} / {Math.round(ROUTE_LENGTH).toLocaleString()} m</small></div><div><progress max="100" value={progress} aria-label="Route completed"/><Flag size={16}/></div></section>;
}

export function ControlsBar({flight}:{flight:Snapshot['flight']}){
 const flying=flight.state!=='GROUNDED';
 const controls=[{keys:['W'],label:flying?'Pitch':'Drive',detail:flying?'Forward':'Accelerate'},{keys:['S'],label:flying?'Pitch':'Brake',detail:flying?'Back':'Slow down'},{keys:['A','D'],label:flying?'Roll':'Steer',detail:'Left / Right'},{keys:['SPACE'],label:'Lift',detail:'Ascend'},{keys:['SHIFT'],label:'Horn',detail:'Honk'},{keys:['Q','E'],label:flying?'Yaw':'Look',detail:flying?'Rotate':'Left / Right'},{keys:['C'],label:'View',detail:'Change'}];
 return <aside className="hud-controls hud-glass" aria-label="Keyboard controls">{controls.map(c=><div key={c.keys.join()}><div className="hud-keys">{c.keys.map(k=><kbd key={k}>{k}</kbd>)}</div><div><span>{c.label}</span><small>{c.detail}</small></div></div>)}</aside>;
}

export function UtilityControls({copy,reset,fullscreen,notes,copied}:{copy:()=>void;reset:()=>void;fullscreen:()=>void;notes:()=>void;copied:boolean}){
 return <nav className="hud-utilities" aria-label="Game utilities">{[{label:copied?'Copied':'Share Route',Icon:copied?Check:Share2,action:copy},{label:'Reset Car',Icon:RotateCcw,action:reset},{label:'Fullscreen',Icon:Maximize,action:fullscreen},{label:'Map Notes',Icon:Map,action:notes}].map(({label,Icon,action})=><button className="hud-glass" key={label} onClick={action}><Icon size={21}/><span>{label}</span></button>)}</nav>;
}
