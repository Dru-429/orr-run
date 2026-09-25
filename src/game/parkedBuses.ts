import {manifest} from './route';
import {laneCentresAt} from '../survey/corridor';
import {roadBody,overlaps} from './junctions';

/** Game-added obstacles, not surveyed parking locations. Start is the first rear bumper. */
export const parkedBusGroups=[
 {id:'tourist-ibbalur',name:'Ibbalur Lake',start:5300,count:3,lane:0,gap:2},
 {id:'tourist-bellandur',name:'Bellandur',start:6000,count:3,lane:0,gap:2},
 {id:'tourist-marathahalli',name:'Marathahalli approach',start:manifest.marathahalliUnderpass.from-500,count:4,lane:0,gap:2},
] as const;
export const parkedBuses=parkedBusGroups.flatMap(g=>Array.from({length:g.count},(_,index)=>{
 const length=10.8,width=2.55,s=g.start+length/2+index*(length+g.gap),x=laneCentresAt(s)[g.lane];
 return Object.freeze({id:`${g.id}-${index+1}`,groupId:g.id,s,x,length,width,speed:0,body:roadBody(s,x,length,width)});
}));
export function parkedClear(s:number,x:number,length:number,width:number,opposite=false,margin=.2){
 return !parkedBuses.some(b=>Math.abs(b.s-s)<(b.length+length)/2+margin+2&&overlaps(roadBody(s,x,length,width,opposite),b.body,margin));
}
export function parkedGap(s:number,x:number,length:number,width:number,opposite=false){
 if(opposite)return Infinity;
 return Math.min(Infinity,...parkedBuses.filter(b=>b.s>s&&Math.abs(b.x-x)<(b.width+width)/2+.5).map(b=>Math.max(0,b.s-s-(b.length+length)/2)));
}
