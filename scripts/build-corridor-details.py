"""Build derived profiles and signal inventory from the selected licensed geometry."""
import json,math,pathlib
m=json.load(open('src/data/map.json'));manifest=json.load(open('src/data/route-manifest.json'));route=m['centerline']
def project(p):
 best=(1e30,0,0)
 for a,b in zip(route,route[1:]):
  dx,dz=b['p'][0]-a['p'][0],b['p'][1]-a['p'][1];l=math.hypot(dx,dz);t=max(0,min(1,((p[0]-a['p'][0])*dx+(p[1]-a['p'][1])*dz)/l**2));x,z=a['p'][0]+dx*t,a['p'][1]+dz*t;d=math.hypot(p[0]-x,p[1]-z)
  if d<best[0]:best=(d,a['s']+l*t,((p[0]-x)*-dz+(p[1]-z)*dx)/l)
 return best
profiles=[]
for name,ids in [('HSR westbound',['380980312','380980313']),('Agara westbound',['380980307','377085060']),('Ibbalur westbound',['380929042'])]:
 ways=[w for w in m['infrastructure'] if w['id'] in ids];stations=[project(p)[1] for w in ways for p in w['points']];a,b=min(stations),max(stations)
 profiles.append({'id':'flyover:'+ids[0],'name':name,'from':a,'to':b,'upTo':a+min(125,(b-a)/3),'downFrom':b-min(150,(b-a)/3),'height':6.2,'confidence':'estimated','sources':['https://www.openstreetmap.org/way/'+id for id in ids]})
p=profiles[-1];p.update(from_=p['from']-100);p['from']=p.pop('from_');p['upTo']=p['from']+125;p['downFrom']=manifest['oldRouteShift']+230;p['to']=manifest['oldRouteShift']+380;p['height']=6.4
pathlib.Path('src/data/opposite-flyovers.json').write_text(json.dumps(profiles,indent=2))
active={'650141554':('HSR 5th Main crossing','2025-11','-CYaqdCj3nF-BQjI3Sp4mA'),'650141450':('Agara Lake approach crossing','2026-03','gGosbsL7aqK7YxxShpKDZA'),'1083470977':('Ibbalur · Sarjapur Road crossing','2026-04','usSaAw-epdZ5eSsYzp9rlQ')}
junctions=[];inventory=[]
for p in m['pois']:
 if p['tags'].get('highway')!='traffic_signals' or p['station']>next(s['length'] for s in manifest['segments'] if s['id']=='silk-hsr')+100:continue
 controlled=p['id'] in active
 record={'id':'signal:'+p['id'],'source':p['source'],'position':p['position'],'station':p['station'],'offset':p['offset'],'name':active[p['id']][0] if controlled else p['tags'].get('name','Mapped traffic signal'),'controlsPlayable':controlled,'operationalConfidence':'observed' if controlled and active[p['id']][1] else 'unknown','imageryDate':active[p['id']][1] if controlled else None,'status':'reference-confirmed' if controlled and active[p['id']][1] else 'unresolved','note':'Presence and approach checked in dated reference; actual cycle and stop line estimated.' if controlled else 'Carriageway, facing and current operation require visual reconciliation; does not control the player.'}
 record.update(inspectionDate='2026-09-24' if controlled else None, reference=('https://www.google.com/maps/@?api=1&map_action=pano&pano='+active[p['id']][2]) if controlled else None, facing='selected ORR approach' if controlled else None, controlledLanes='ground-level ORR lanes; opposing deck excluded' if controlled else None, roadLevel=0 if controlled else None, stopLine=p['station']-9 if controlled else None, movementGeometryConfidence='estimated' if controlled else 'unknown', currentOperation='not independently verified after imagery date')
 inventory.append(record)
 if controlled:junctions.append({**record,'stopLine':p['station']-9,'centre':p['station']+8,'halfConflict':15,'elevation':0,'phaseOffset':{'650141554':19,'650141450':0,'1083470977':38}[p['id']],'crossingHalfLength':220,'layout':'crossroad' if p['id']=='650141554' else 'right-branch','timing':[35,3,2,12,3,2],'timingConfidence':'estimated','pathConfidence':'estimated'})
pathlib.Path('src/data/junctions.json').write_text(json.dumps(junctions,indent=2));pathlib.Path('src/data/signal-inventory.json').write_text(json.dumps(inventory,indent=2))
print('junctions',[(j['name'],round(j['station'])) for j in junctions]);print('all signal nodes',len(inventory));print('lake',[(p['id'],len(p['polygons']),len(p['holes'])) for p in m['landscape'] if p['tags'].get('name')=='Agara Lake'])
# Separate mapped parallel service roads from junction branches and private drives.
service=[]
for w in m['infrastructure']:
 t=w['tags']
 if t.get('highway') not in ['service','unclassified','residential'] or t.get('service') in ['parking_aisle','driveway'] or t.get('access')=='private':continue
 for a,b in zip(w['points'],w['points'][1:]):
  pa,pb=project(a),project(b);length=math.dist(a,b)
  if length<2 or abs(pb[1]-pa[1])<length*.85:continue
  offset=(pa[2]+pb[2])/2
  if not (8<abs(offset)<60):continue
  service.append({'from':min(pa[1],pb[1]),'to':max(pa[1],pb[1]),'offset':offset,'width':6,'source':'https://www.openstreetmap.org/way/'+w['id']})
pathlib.Path('src/data/service-roads.json').write_text(json.dumps(service,separators=(',',':')))
