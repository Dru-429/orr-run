import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {vehicle,disposeTemplates} from '../src/game/assets';
import {loadPosterArtwork,disposePosterArtwork} from '../src/game/poster-artwork';

test('poster failure releases partial loads, retries, and shares an in-flight request',async t=>{
 let disposed=0,calls=0,fail=true;
 t.mock.method(T.TextureLoader.prototype,'loadAsync',async(url:string)=>{calls++;if(fail&&url.endsWith('/7.png'))throw new Error('offline');const texture=new T.Texture();texture.addEventListener('dispose',()=>disposed++);return texture;});
 const first=loadPosterArtwork();assert.equal(loadPosterArtwork(),first);await assert.rejects(first,/could not load/);assert.equal(disposed,6);
 fail=false;const loaded=await loadPosterArtwork();assert.equal(await loadPosterArtwork(),loaded);assert.equal(calls,14);assert.equal(loaded.length,7);disposePosterArtwork();assert.equal(disposed,13);disposePosterArtwork();assert.equal(disposed,13);
});

test('car envelopes, BMTC orientation, plain trucks and pooled resource ownership',async t=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'document');
 const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}})},{get:(object,key)=>Reflect.get(object,key)??(()=>{})});
 Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({width:0,height:0,getContext:()=>context})}});
 t.after(()=>{disposeTemplates();if(previous)Object.defineProperty(globalThis,'document',previous);else Reflect.deleteProperty(globalThis,'document');});
 t.mock.method(T.TextureLoader.prototype,'loadAsync',async()=>new T.Texture());
 for(const kind of ['car','cab'] as const){
  const car=vehicle(kind,0);car.updateMatrixWorld(true);const bounds=new T.Box3();
  car.traverse(o=>{if(o instanceof T.Mesh&&o.name!=='contact-shadow'&&o.parent?.name!=='driver-gesture'){o.geometry.computeBoundingBox();bounds.union(o.geometry.boundingBox!.clone().applyMatrix4(o.matrixWorld));}});
  assert.ok(bounds.max.x<=(kind==='car'?.925:.9));assert.ok(bounds.min.x>=-(kind==='car'?.925:.9));
  assert.ok(bounds.max.z<=(kind==='car'?2.15:2.1));assert.ok(bounds.min.z>=-(kind==='car'?2.15:2.1));assert.ok(bounds.min.y>=-.001);
  assert.ok(car.getObjectByName('brakes'));const hand=car.getObjectByName('driver-gesture')!;assert.ok(hand);assert.equal(hand.visible,false);assert.ok(hand.position.x>0);assert.equal(hand.position.z,-.28);
 }
 const bus=vehicle('bus',0),truck=vehicle('truck',0);
 for(const side of [-1,1]){
  const logo=bus.getObjectByName(side<0?'bmtc-left':'bmtc-right') as T.Mesh<T.PlaneGeometry,T.MeshBasicMaterial>;
  assert.ok(logo.material.map);assert.equal(logo.material.color.getHex(),0xffffff);
  const normal=new T.Vector3(0,0,1).applyQuaternion(logo.quaternion);assert.ok(normal.x*side>.999);
  assert.ok(Math.abs(logo.geometry.parameters.width/logo.geometry.parameters.height-3.8/.8)<1e-9);
  assert.ok(logo.position.y-logo.geometry.parameters.height/2>.725);assert.ok(logo.position.y+logo.geometry.parameters.height/2<1.695);
 }
 assert.ok(truck.getObjectByName('brakes'));
 const resources=(g:T.Group)=>{const result=new Set<T.BufferGeometry|T.Material|T.Texture>();g.traverse(o=>{if(o instanceof T.Mesh){result.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){result.add(m);Object.values(m).forEach(v=>{if(v instanceof T.Texture)result.add(v);});}}});return result;};
 const coach=vehicle('bus',0,'tourist');assert.equal(coach.getObjectByName('bmtc-left'),undefined);assert.equal(coach.getObjectByName('bmtc-right'),undefined);
 for(const [name,direction] of [['volvo-front',-1],['volvo-rear',1]] as const){const label=coach.getObjectByName(name) as T.Mesh;assert.ok(label);assert.ok(new T.Vector3(0,0,1).applyQuaternion(label.quaternion).z*direction>.99);assert.ok(label.position.y>2.8);}
 const coachResources=resources(coach);for(let i=0;i<30;i++)assert.deepEqual(resources(vehicle('bus',i%7,'tourist')),coachResources);
 const originals=resources(bus);
 for(let lap=0;lap<3;lap++)for(let i=0;i<126;i++)assert.deepEqual(resources(vehicle('bus',i%7)),originals);
 const counts=new Map<object,number>();for(const r of new Set([...originals,...resources(truck),...coachResources])){counts.set(r,0);r.addEventListener('dispose',()=>counts.set(r,counts.get(r)!+1));}
 disposeTemplates();for(const n of counts.values())assert.equal(n,1,'Shared resources must be disposed exactly once');
});
