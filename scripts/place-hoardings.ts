import {writeFileSync} from 'node:fs';
import {selectHoarding} from '../src/game/hoardings';
const records=Array.from({length:14},(_,i)=>selectHoarding(i));
writeFileSync('src/data/hoardings.json',JSON.stringify(records,null,2)+'\n');
console.log(records.map(r=>`${r.id}: ${r.station} m, ${r.side}, poster ${r.poster}, offset ${r.offset.toFixed(1)} m`).join('\n'));
