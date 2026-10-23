// Procedural proportions, nozzle layout and cold-gas plume treatment adapted from
// eduardmur/tesla-roadster-simulator (MIT). This original model has no Tesla logos.
import * as T from 'three';

export const ROADSTER_LENGTH=4.34,ROADSTER_WIDTH=2,ROADSTER_COM_HEIGHT=.46;

const stations:[number,number,number,number][]=[
 [2.17,.66,.05,.50],[1.9,.86,.21,.68],[1.6,.96,.30,.76],[1.36,.99,.35,.80],
 [1.08,.98,.41,.80],[.5,.97,.57,.76],[0,.97,.62,.72],[-.5,.98,.63,.64],
 [-1,.99,.59,.56],[-1.4,1.01,.53,.51],[-1.85,1,.46,.47],[-2.17,.9,.43,.8],
];

function bodyGeometry(){
 const pos:number[]=[],idx:number[]=[],ring=10;
 for(const [z,w,top,roof] of stations){
  const shoulder=Math.max(.12,top-.27),bottom=-.3;
  const points=[[0,bottom],[w*.84,bottom],[w,bottom+.12],[w,shoulder],[roof,top-.04],[0,top],[-roof,top-.04],[-w,shoulder],[-w,bottom+.12],[-w*.84,bottom]];
  points.forEach(([x,y])=>pos.push(x,y,z));
 }
 for(let i=0;i<stations.length-1;i++)for(let j=0;j<ring;j++){
  const next=(j+1)%ring,a=i*ring+j,b=(i+1)*ring+j,c=i*ring+next,d=(i+1)*ring+next;
  idx.push(a,b,c,c,b,d);
 }
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute(pos,3));
 geometry.setIndex(idx);geometry.computeVertexNormals();return geometry;
}

function wheel(){
 const group=new T.Group();
 const tire=new T.Mesh(new T.TorusGeometry(.35,.095,12,32),new T.MeshStandardMaterial({color:'#0a0b0c',roughness:.9}));
 tire.rotation.y=Math.PI/2;
 const rim=new T.Mesh(new T.CylinderGeometry(.255,.255,.12,24),new T.MeshStandardMaterial({color:'#c7ccd0',metalness:.7,roughness:.25}));
 rim.rotation.z=Math.PI/2;group.add(tire,rim);return group;
}

const plumeVertex=/* glsl */`
 varying vec2 vUv;
 void main(){
  vUv=uv;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
 }
`;

// Bright pressure cells emulate the reference simulator's cold-gas shock diamonds.
const plumeFragment=/* glsl */`
 uniform float uIntensity;
 uniform float uTime;
 uniform float uCells;
 varying vec2 vUv;
 void main(){
  float distanceFromNozzle=1.0-vUv.y;
  float core=pow(1.0-distanceFromNozzle,1.55);
  float diamonds=0.5+0.5*cos(6.28318*distanceFromNozzle*uCells);
  float diamondFade=exp(-distanceFromNozzle*4.6);
  float edgeWave=sin(vUv.x*18.84954+uTime*31.0)*0.07;
  float flicker=0.84+0.16*sin(uTime*88.0+distanceFromNozzle*21.0);
  float alpha=uIntensity*(core*.72+diamonds*diamondFade*.82+edgeWave*core)*flicker;
  alpha=max(alpha,0.0);
  vec3 colour=mix(vec3(.96,.98,1.0),vec3(.42,.76,1.0),diamondFade*diamonds*.72);
  gl_FragColor=vec4(colour*alpha,alpha);
 }
`;

interface PlumeSlot {mesh:T.Mesh<T.CylinderGeometry,T.ShaderMaterial>;smooth:number}

function plumeMaterial(){
 return new T.ShaderMaterial({
  vertexShader:plumeVertex,fragmentShader:plumeFragment,
  uniforms:{uIntensity:{value:0},uTime:{value:0},uCells:{value:7}},
  transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,toneMapped:false,
 });
}

export interface RoadsterModel {
 group:T.Group;
 wheels:T.Group[];
 plumes:T.Mesh[];
 update(speed:number,steer:number,lift:number,forward:number,dt?:number):void;
}

export function makeRoadster():RoadsterModel{
 const group=new T.Group();
 const paint=new T.MeshPhysicalMaterial({color:'#f4f5f2',roughness:.2,metalness:.08,clearcoat:1,clearcoatRoughness:.045});
 const dark=new T.MeshStandardMaterial({color:'#090b0d',roughness:.3,metalness:.4});
 const fasciaMaterial=new T.MeshStandardMaterial({color:'#111214',roughness:.4,metalness:.22});
 const glass=new T.MeshPhysicalMaterial({color:'#171512',roughness:.08,metalness:.42,transparent:true,opacity:.94});
 const frontLampMaterial=new T.MeshStandardMaterial({color:'#fff',emissive:'#eaf3ff',emissiveIntensity:2});
 const rearLampMaterial=new T.MeshStandardMaterial({color:'#5c0505',emissive:'#ff201c',emissiveIntensity:3});

 const body=new T.Mesh(bodyGeometry(),paint);body.castShadow=true;body.receiveShadow=true;group.add(body);
 const canopy=new T.Mesh(new T.BoxGeometry(1.38,.12,1.7),glass);canopy.position.set(0,.47,-.05);canopy.rotation.x=-.07;group.add(canopy);
 const frontLight=new T.Mesh(new T.BoxGeometry(1.15,.025,.02),frontLampMaterial);frontLight.position.set(0,.02,2.16);group.add(frontLight);

 // Wide black rear fascia, uninterrupted red light bar and lower diffuser mirror the supplied rear view.
 const fascia=new T.Mesh(new T.BoxGeometry(1.78,.42,.055),fasciaMaterial);fascia.position.set(0,.08,-2.19);group.add(fascia);
 const rearLight=new T.Mesh(new T.BoxGeometry(1.82,.032,.025),rearLampMaterial);rearLight.position.set(0,.32,-2.226);group.add(rearLight);
 const plateSurround=new T.Mesh(new T.BoxGeometry(.54,.16,.022),dark);plateSurround.position.set(0,.05,-2.232);group.add(plateSurround);
 const plateInset=new T.Mesh(new T.BoxGeometry(.46,.1,.012),new T.MeshStandardMaterial({color:'#343638',roughness:.72}));plateInset.position.set(0,.05,-2.248);group.add(plateInset);
 const diffuser=new T.Mesh(new T.BoxGeometry(1.72,.1,.12),dark);diffuser.position.set(0,-.22,-2.17);group.add(diffuser);

 const wheels:T.Group[]=[];
 for(const [x,z,front] of [[.86,1.36,1],[-.86,1.36,1],[.86,-1.4,0],[-.86,-1.4,0]] as const){
  const item=wheel();item.position.set(x,-.11,z);item.userData.front=front;group.add(item);wheels.push(item);
 }

 const nozzleMetal=new T.MeshStandardMaterial({color:'#93999e',metalness:1,roughness:.22});
 const nozzleInner=new T.MeshBasicMaterial({color:'#050607'});
 const plumeGeometry=new T.CylinderGeometry(.026,.19,1,20,10,true);plumeGeometry.translate(0,-.5,0);
 const slots:PlumeSlot[]=[],plumes:T.Mesh[]=[];
 const exhaustDirection=new T.Vector3(),downAxis=new T.Vector3(0,-1,0);
 const addNozzle=(x:number,y:number,z:number,direction:'down'|'rear')=>{
  const holder=new T.Group();holder.position.set(x,y,z);
  exhaustDirection.set(0,direction==='down'?-1:0,direction==='rear'?-1:0);
  holder.quaternion.setFromUnitVectors(downAxis,exhaustDirection);
  const shell=new T.Mesh(new T.CylinderGeometry(.078,.058,.14,20,1,true),nozzleMetal);shell.rotation.x=direction==='rear'?Math.PI/2:0;shell.position.set(x,y,z);group.add(shell);
  const inner=new T.Mesh(new T.CircleGeometry(.052,20),nozzleInner);
  if(direction==='rear'){
   inner.position.set(x,y,z-.072);inner.rotation.y=Math.PI;
   const ring=new T.Mesh(new T.TorusGeometry(.064,.011,8,20),nozzleMetal);ring.position.set(x,y,z-.078);group.add(ring);
  }else{inner.position.set(x,y-.072,z);inner.rotation.x=Math.PI/2;}
  group.add(inner);
  const material=plumeMaterial(),mesh=new T.Mesh(plumeGeometry,material);mesh.visible=false;mesh.frustumCulled=false;holder.add(mesh);group.add(holder);
  slots.push({mesh,smooth:0});plumes.push(mesh);
 };
 [-.63,-.21,.21,.63].forEach(x=>addNozzle(x,-.16,-2.255,'rear'));
 for(const x of [-.78,.78])for(const z of [-1.55,1.55])addNozzle(x,-.31,z,'down');

 let elapsed=0;
 return {group,wheels,plumes,update(speed,steer,lift,forward,dt=1/60){
  elapsed+=Math.min(.05,Math.max(0,dt));
  wheels.forEach(item=>{item.rotation.x-=speed*.008;if(item.userData.front)item.rotation.y=-steer*.35;});
  slots.forEach((slot,index)=>{
   const requested=Math.max(0,Math.min(1,index<4?forward:lift));
   slot.smooth+=(requested-slot.smooth)*Math.min(1,dt*25);
   const power=slot.smooth,length=.3+2.6*Math.sqrt(power);
   slot.mesh.visible=power>.01;
   slot.mesh.scale.set(.5+.8*power,length,.5+.8*power);
   slot.mesh.material.uniforms.uIntensity.value=Math.min(1,power*1.4);
   slot.mesh.material.uniforms.uTime.value=elapsed;
   slot.mesh.material.uniforms.uCells.value=6.5*length;
  });
 }};
}
