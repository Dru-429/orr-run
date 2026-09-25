import {useEffect,useRef,useState} from 'react';
import * as T from 'three';
import {vehicle,disposeTemplates} from './assets';
import type {VehicleKind} from './simulation';

/** Development-only turntable for checking artwork orientation and model silhouettes. */
export default function VehiclePreview(){
 const canvas=useRef<HTMLCanvasElement>(null),[kind,setKind]=useState<VehicleKind>('car'),[view,setView]=useState('rear-quarter'),[low,setLow]=useState(false),[status,setStatus]=useState('Opening vehicle preview…');
 const select=useRef({kind,view,low});select.current={kind,view,low};
 useEffect(()=>{
  let cancelled=false,cleanup=()=>{};
  Promise.resolve().then(()=>{
   if(cancelled){disposeTemplates();return;}
   const renderer=new T.WebGLRenderer({canvas:canvas.current!,antialias:true});renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
   const scene=new T.Scene();scene.background=new T.Color('#c9d3d5');
   scene.add(new T.HemisphereLight('#d9edf5','#8d9473',2.6),new T.AmbientLight('#f0ebdc',.25));
   const sun=new T.DirectionalLight('#fff2cf',3);sun.position.set(-8,12,-6);scene.add(sun);
   const ground=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:'#687373',roughness:1}));ground.rotation.x=-Math.PI/2;scene.add(ground);
   const camera=new T.PerspectiveCamera(38,1,.05,250);let model:T.Group|undefined,lastKind='',raf=0,frames=0,start=performance.now();
   const frame=()=>{
    const {kind,view,low}=select.current;
    if(lastKind!==kind){if(model)scene.remove(model);model=vehicle(kind,kind==='car'?4:0);scene.add(model);lastKind=kind;}
    const rect=canvas.current!.getBoundingClientRect();renderer.setPixelRatio(Math.min(devicePixelRatio,low?1:1.75));renderer.setSize(rect.width,rect.height,false);camera.aspect=rect.width/rect.height;
    const large=kind==='bus'||kind==='truck',distance=large?18:8,centre=large?1.6:.8;
    const angles:Record<string,number>={'rear-quarter':.65,rear:0,front:Math.PI,left:-Math.PI/2,right:Math.PI/2,'front-quarter':2.5};
    const angle=angles[view];camera.position.set(Math.sin(angle)*distance,centre+(view.includes('quarter')?distance*.2:.5),Math.cos(angle)*distance);camera.lookAt(0,centre,0);camera.updateProjectionMatrix();renderer.render(scene,camera);
    if(++frames%60===0){const elapsed=performance.now()-start;setStatus(`${kind} · ${Math.round(60000/elapsed)} FPS · ${renderer.info.render.calls} draws · ${renderer.info.render.triangles.toLocaleString()} triangles · ${renderer.info.memory.geometries} geometries · ${renderer.info.memory.textures} textures`);start=performance.now();}
    raf=requestAnimationFrame(frame);
   };frame();
   cleanup=()=>{cancelAnimationFrame(raf);ground.geometry.dispose();ground.material.dispose();disposeTemplates();renderer.dispose();};
  }).catch(e=>setStatus(String(e)));
  return()=>{cancelled=true;cleanup();};
 },[]);
 return <main style={{height:'100dvh',background:'#243437'}}><canvas ref={canvas} style={{display:'block',width:'100%',height:'calc(100% - 120px)'}} aria-label="Vehicle inspection"/><div style={{padding:16,color:'white',display:'flex',gap:14,flexWrap:'wrap',alignItems:'center'}}><label>Vehicle <select value={kind} onChange={e=>setKind(e.target.value as VehicleKind)}>{['car','cab','bus','truck','auto','bike'].map(k=><option key={k}>{k}</option>)}</select></label><label>View <select value={view} onChange={e=>setView(e.target.value)}>{['rear-quarter','rear','front','left','right','front-quarter'].map(v=><option key={v}>{v}</option>)}</select></label><label><input type="checkbox" checked={low} onChange={e=>setLow(e.target.checked)}/> Reduced graphics</label><a href="/" style={{color:'white'}}>Back to game</a><output style={{width:'100%'}}>{status}</output></div></main>;
}
