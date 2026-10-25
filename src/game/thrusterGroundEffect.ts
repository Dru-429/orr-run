import * as T from 'three';

const POOL_SIZE=24;

function vaporTexture(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
 const context=canvas.getContext('2d')!,gradient=context.createRadialGradient(32,32,2,32,32,31);
 gradient.addColorStop(0,'rgba(225,245,255,.7)');gradient.addColorStop(.35,'rgba(205,232,242,.36)');gradient.addColorStop(1,'rgba(190,214,220,0)');
 context.fillStyle=gradient;context.fillRect(0,0,64,64);
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;return texture;
}

/** Fixed-size, render-only vapor pool. It never feeds values back into simulation. */
export class ThrusterGroundEffect{
 readonly group=new T.Group();
 private readonly geometry=new T.PlaneGeometry(1,1);
 private readonly texture=vaporTexture();
 private readonly material=new T.MeshBasicMaterial({map:this.texture,color:'#d9f1f5',transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide});
 private readonly vapor=new T.InstancedMesh(this.geometry,this.material,POOL_SIZE);
 private readonly light=new T.PointLight('#bdeaff',0,5.5,2);
 private readonly dummy=new T.Object3D();
 private elapsed=0;

 constructor(scene:T.Scene){
  this.geometry.rotateX(-Math.PI/2);this.vapor.instanceMatrix.setUsage(T.DynamicDrawUsage);this.vapor.count=0;this.vapor.frustumCulled=false;
  this.light.castShadow=false;this.group.add(this.vapor,this.light);this.group.visible=false;scene.add(this.group);
 }

 update(position:readonly number[],groundY:number,altitude:number,thrust:number,dt:number,lowQuality=false){
  this.elapsed+=Math.min(.05,Math.max(0,dt));
  const proximity=1-Math.max(0,Math.min(1,altitude/3.2)),strength=Math.max(0,Math.min(1,thrust))*proximity;
  if(strength<.015){this.group.visible=false;this.vapor.count=0;this.light.intensity=0;return;}
  this.group.visible=true;this.group.position.set(0,0,0);
  const count=Math.max(2,Math.round(strength*(lowQuality?10:POOL_SIZE)));this.vapor.count=count;
  for(let i=0;i<count;i++){
   const phase=(this.elapsed*(.42+strength*.55)+i*.61803398875)%1;
   const angle=i*2.3999632297+this.elapsed*.13,radius=(.18+phase*2.5)*(.55+strength*.7);
   const size=(.45+phase*2.25)*(.65+strength*.72),stretch=1.15+phase*.8;
   this.dummy.position.set(position[0]+Math.cos(angle)*radius,groundY+.055+phase*.035,position[2]+Math.sin(angle)*radius);
   this.dummy.rotation.set(0,angle,0);this.dummy.scale.set(size*stretch,1,size);this.dummy.updateMatrix();this.vapor.setMatrixAt(i,this.dummy.matrix);
  }
  this.vapor.instanceMatrix.needsUpdate=true;this.material.opacity=.08+strength*.32;
  this.light.position.set(position[0],groundY+.3,position[2]);this.light.intensity=strength*.85;
 }

 dispose(){this.group.removeFromParent();this.geometry.dispose();this.material.dispose();this.texture.dispose();this.light.dispose();}
}
