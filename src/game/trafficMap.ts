import {ROUTE_LENGTH} from './route';
export type TrafficColor='red'|'yellow'|'blue'|'unknown';
export interface TrafficSection {from:number;to:number;color:TrafficColor;speed:number|null}
export class TrafficOverview {
 sections:TrafficSection[]=[];private previous=new Map<number,number>();private elapsed=.5;
 reset(){this.sections=[];this.previous.clear();this.elapsed=.5;}
 update(dt:number,s:number,vehicles:{s:number;speed:number}[]){
  this.elapsed+=dt;if(this.elapsed<.5)return;const alpha=1-Math.exp(-this.elapsed/2);this.elapsed=0;
  const first=Math.max(0,Math.floor((s-150)/50)),last=Math.min(Math.ceil(ROUTE_LENGTH/50)-1,Math.ceil((s+600)/50));
  const buckets=new Map<number,number[]>();for(const v of vehicles){const k=Math.floor(v.s/50);if(k<first||k>last)continue;const b=buckets.get(k)??[];b.push(v.speed*3.6);buckets.set(k,b);}
  const next=new Map<number,number>();this.sections=[];
  for(let k=first;k<=last;k++){const speeds=buckets.get(k),raw=speeds?.length?speeds.reduce((a,b)=>a+b,0)/speeds.length:35;const old=this.previous.get(k),speed=old===undefined?raw:old+(raw-old)*alpha;next.set(k,speed);this.sections.push({from:k*50,to:Math.min(ROUTE_LENGTH,(k+1)*50),speed,color:speed<8?'red':speed<=25?'yellow':'blue'});}
  this.previous=next;
 }
}
