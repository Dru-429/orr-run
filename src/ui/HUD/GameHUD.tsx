import {Fragment,memo} from 'react';
import {Rocket,Share2,RotateCcw,Maximize,Minimize,Camera,Music2,Pause,Play,VolumeX,Volume1,Volume2,Check,Settings2} from 'lucide-react';
import type {Snapshot} from '../../game/simulation';
import type {CameraView} from '../../game/engine';
import type {VolumeLevel} from '../../game/audio';
import './hud.css';

export const Speedometer=memo(function Speedometer({speed,flight}:{speed:number;flight:Snapshot['flight']}){
 const state=flight.state,mode=state==='GROUNDED'?'THRUSTER MODE':state==='FLYING'?'FLIGHT MODE':state==='TAKEOFF'?'THRUSTER MODE':state;
 const damaged=state==='CRASHED'||state==='RECOVERING';
 return <section className={'hud-glass hud-speed '+(damaged?'hud-damaged':'')} aria-label="Vehicle speed and mode">
  <svg className="hud-gauge" viewBox="0 0 300 108" aria-hidden="true"><path d="M16 85 Q20 40 53 18 M247 18 Q280 40 284 85" className="gauge-track"/><path d="M16 85 Q20 40 53 18 M284 85 Q280 40 247 18" className="gauge-fill" pathLength="100" strokeDasharray={`${Math.min(100,speed*3.6/1.8)} 100`}/><path d="M49 86 L54 73 M246 73 L251 86" className="gauge-track"/></svg>
  <output aria-label={`${Math.round(speed*3.6)} kilometres per hour`}><strong>{Math.round(speed*3.6)}</strong><span>km/h</span></output>
  <div className="hud-mode"><Rocket size={14}/><span>{mode}</span></div>
 </section>;
});

export function VehicleStatus({snapshot,settings}:{snapshot:Snapshot;settings:()=>void}){
 const health=Math.max(0,Math.min(100,Math.ceil(snapshot.health))),fuel=Math.max(0,Math.min(100,Math.round(snapshot.flight.fuel*100)));
 return <section className="hud-status hud-glass" aria-label="Vehicle health and booster gas">
  <header className="hud-status-head"><span className="hud-status-weather"><b>☀</b><span>27°</span><i/>A LITTLE HAZY</span><button onClick={settings} title="Settings" aria-label="Settings"><Settings2/></button></header>
  <div className={'hud-status-metric hud-health '+(health<30?'hud-danger':health<60?'hud-warning':'')}><div>Car health<strong>{health}%</strong></div><progress max="100" value={health} aria-label="Car health"/></div>
  <div className={'hud-status-metric hud-booster '+(fuel<20?'hud-warning':'')}><div>Boosters<strong>{fuel}%</strong></div><progress max="100" value={fuel} aria-label="Booster gas"/></div>
 </section>
}

export function ControlsBar({flight}:{flight:Snapshot['flight']}){
 const flying=flight.state!=='GROUNDED';
 const controls:{keys:string[];label:string;detail:string;join?:string}[]=[{keys:['W'],label:flying?'Thrust':'Drive',detail:flying?'Forward':'Accelerate'},{keys:['S'],label:flying?'Air brake':'Brake',detail:flying?'Reverse':'Slow down'},{keys:['A','D'],label:flying?'Roll':'Steer',detail:'Left / Right'},...(flying?[{keys:['I','K'],label:'Pitch',detail:'Up / Down'}]:[]),{keys:['SPACE'],label:'Lift',detail:'Ascend'},{keys:['SPACE','B'],join:'+',label:'Backflip',detail:'Hold + press'},{keys:['SHIFT'],label:'Horn',detail:'Honk'},{keys:['Q','E'],label:flying?'Yaw':'Look',detail:flying?'Rotate':'Left / Right'},{keys:['C'],label:'View',detail:'Change'}];
 return <aside className="hud-controls hud-glass" aria-label="Keyboard controls">{controls.map(c=><div key={c.keys.join()}><div className="hud-keys">{c.keys.map((k,i)=><Fragment key={k}>{i>0&&c.join?<b className="hud-key-join">{c.join}</b>:null}<kbd>{k}</kbd></Fragment>)}</div><div><span>{c.label}</span><small>{c.detail}</small></div></div>)}</aside>;
}

export function UtilityControls({copy,reset,fullscreen,toggleCamera,toggleMusic,togglePause,toggleSound,copied,paused,full,cameraView,musicEnabled,volume}:{copy:()=>void;reset:()=>void;fullscreen:()=>void;toggleCamera:()=>void;toggleMusic:()=>void;togglePause:()=>void;toggleSound:()=>void;copied:boolean;paused:boolean;full:boolean;cameraView:CameraView;musicEnabled:boolean;volume:VolumeLevel}){
 const SoundIcon=volume===0?VolumeX:volume===.5?Volume1:Volume2,soundPercent=Math.round(volume*100);
 return <nav className="hud-utilities hud-glass" aria-label="Game utilities">
  <button onClick={togglePause} title={paused?'Resume':'Pause'} aria-label={paused?'Resume':'Pause'}>{paused?<Play/>:<Pause/>}<span>{paused?'Resume':'Pause'}</span></button>
  <button onClick={fullscreen} title={full?'Exit fullscreen':'Fullscreen'} aria-label={full?'Exit fullscreen':'Fullscreen'}>{full?<Minimize/>:<Maximize/>}<span>{full?'Exit full':'Full'}</span></button>
  <button onClick={toggleCamera} title="Change camera view" aria-label="Change camera view" aria-pressed={cameraView==='chase'}><Camera/><span>Camera</span></button>
  <button className="hud-music-toggle" onClick={toggleMusic} title={musicEnabled?'Music On':'Music Off'} aria-label={`${musicEnabled?'Pause':'Resume'} background music`} aria-pressed={musicEnabled}><Music2/><span>Music</span></button>
  <button onClick={toggleSound} title={`Sound ${soundPercent}%`} aria-label={`Sound ${soundPercent}%. Click for next level.`}><SoundIcon/><span>{soundPercent}%</span></button>
  <button onClick={reset} title="Reset car" aria-label="Reset car"><RotateCcw/><span>Reset</span></button>
  <button onClick={copy} title={copied?'Link copied':'Share route'} aria-label={copied?'Link copied':'Share route'}>{copied?<Check/>:<Share2/>}<span>{copied?'Copied':'Share'}</span></button>
 </nav>;
}
