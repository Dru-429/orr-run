import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {readFileSync} from 'node:fs';
import {vehicle,disposeTemplates} from '../src/game/assets';
import {loadVehicleArtwork} from '../src/game/vehicle-artwork';

test('branding assets preserve the supplied SVG path and complete poster dimensions',()=>{
 const original=readFileSync('public/branding/antimattr.svg','utf8');
 assert.equal(readFileSync('public/branding/antimattr-white.svg','utf8'),original.replace('fill="black"','fill="white"'));
 const png=readFileSync('public/branding/antimattr-truck.png');
 assert.equal(png.readUInt32BE(16),1080);assert.equal(png.readUInt32BE(20),1208);
});

test('artwork failure releases partial loads, retries, and shares an in-flight request',async t=>{
 const partial=new T.Texture();let disposed=0;partial.addEventListener('dispose',()=>disposed++);
 let calls=0,fail=true;
 t.mock.method(T.TextureLoader.prototype,'loadAsync',async(url:string)=>{calls++;if(fail&&url.endsWith('.png'))throw new Error('offline');return fail?partial:new T.Texture();});
 const first=loadVehicleArtwork();assert.equal(loadVehicleArtwork(),first);
 await assert.rejects(first,/could not load/);assert.equal(disposed,1);
 fail=false;const loaded=await loadVehicleArtwork();assert.equal(await loadVehicleArtwork(),loaded);assert.equal(calls,4);
 disposeTemplates();
});

test('car envelopes, bus orientation, truck fit and pooled resource ownership',async t=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'document');
 const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}})},{get:(object,key)=>Reflect.get(object,key)??(()=>{})});
 Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({width:0,height:0,getContext:()=>context})}});
 t.after(()=>{disposeTemplates();if(previous)Object.defineProperty(globalThis,'document',previous);else Reflect.deleteProperty(globalThis,'document');});
 t.mock.method(T.TextureLoader.prototype,'loadAsync',async()=>new T.Texture());
 const artwork=await loadVehicleArtwork();
 for(const kind of ['car','cab'] as const){
  const car=vehicle(kind,0);car.updateMatrixWorld(true);const bounds=new T.Box3();
  car.traverse(o=>{if(o instanceof T.Mesh&&o.name!=='contact-shadow'){o.geometry.computeBoundingBox();bounds.union(o.geometry.boundingBox!.clone().applyMatrix4(o.matrixWorld));}});
  assert.ok(bounds.max.x<=(kind==='car'?.925:.9));assert.ok(bounds.min.x>=-(kind==='car'?.925:.9));
  assert.ok(bounds.max.z<=(kind==='car'?2.15:2.1));assert.ok(bounds.min.z>=-(kind==='car'?2.15:2.1));assert.ok(bounds.min.y>=-.001);
  assert.ok(car.getObjectByName('brakes'));
 }
 const bus=vehicle('bus',0),truck=vehicle('truck',0);
 for(const side of [-1,1]){
  const logo=bus.getObjectByName(side<0?'antimattr-left':'antimattr-right') as T.Mesh<T.PlaneGeometry,T.MeshBasicMaterial>;
  assert.equal(logo.material.map,artwork.bus);assert.equal(logo.material.color.getHex(),0xffffff);
  const normal=new T.Vector3(0,0,1).applyQuaternion(logo.quaternion);assert.ok(normal.x*side>.999);
  assert.ok(Math.abs(logo.geometry.parameters.width/logo.geometry.parameters.height-508/93)<1e-9);
  assert.ok(logo.position.y-logo.geometry.parameters.height/2>.725);assert.ok(logo.position.y+logo.geometry.parameters.height/2<1.695);
 }
 const ad=truck.getObjectByName('antimattr-rear') as T.Mesh<T.PlaneGeometry,T.MeshBasicMaterial>;
 assert.equal(ad.material.map,artwork.truck);assert.ok(ad.position.z>3.95);
 assert.ok(ad.position.y-ad.geometry.parameters.height/2>.95);assert.ok(ad.position.y+ad.geometry.parameters.height/2<3.25);
 assert.ok(Math.abs(ad.geometry.parameters.width/ad.geometry.parameters.height-1080/1208)<1e-9);
 const resources=(g:T.Group)=>{const result=new Set<T.BufferGeometry|T.Material|T.Texture>();g.traverse(o=>{if(o instanceof T.Mesh){result.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){result.add(m);Object.values(m).forEach(v=>{if(v instanceof T.Texture)result.add(v);});}}});return result;};
 const originals=resources(bus);
 for(let lap=0;lap<3;lap++)for(let i=0;i<126;i++)assert.deepEqual(resources(vehicle('bus',i%7)),originals);
 const counts=new Map<object,number>();for(const r of new Set([...originals,...resources(truck)])){counts.set(r,0);r.addEventListener('dispose',()=>counts.set(r,counts.get(r)!+1));}
 disposeTemplates();for(const n of counts.values())assert.equal(n,1,'Shared resources must be disposed exactly once');
});
