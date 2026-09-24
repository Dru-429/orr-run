"""Import the connected public carriageway and original kilometre. OSM/ODbL only.
Usage: python3 scripts/import-extension.py hospital.osm bellandur.osm middle.osm north.osm
Geometry uses the original local projection. No Google imagery is copied.
"""
import json,sys,math,pathlib,xml.etree.ElementTree as ET
config=json.load(open('src/data/route-config.json'));legacy=json.load(open('src/data/segments/adobe-electra.json'))
nodes={};ways={};relations={}
for filename in sys.argv[1:]:
 root=ET.parse(filename).getroot()
 for target,kind in [(nodes,'node'),(ways,'way'),(relations,'relation')]:
  for e in root.findall(kind):
   if e.get('id') not in target or int(e.get('version','0'))>=int(target[e.get('id')].get('version','0')):target[e.get('id')]=e
K=6371008.8*math.pi/180;origin=legacy['origin'];kx=K*math.cos(origin[0]*math.pi/180)
tags=lambda e:{t.get('k'):t.get('v') for t in e.findall('tag')}
refs=lambda w:[n.get('ref') for n in w.findall('nd')]
ll=lambda n:[float(nodes[n].get('lat')),float(nodes[n].get('lon'))]
xy=lambda p:[(p[1]-origin[1])*kx,-(p[0]-origin[0])*K]
geo=lambda p:[origin[0]-p[1]/K,origin[1]+p[0]/kx]
nodexy=lambda n:xy(ll(n))
# Explicit directed public-road sequence, verified against OSM connectivity.
route=[];roadRanges=[];last=config['startNode'];s=0
for wid in config['extensionWays']:
 w=ways[wid];ids=refs(w)
 if last not in ids:raise ValueError('Disconnected selected road '+wid)
 if tags(w).get('oneway')=='-1':ids.reverse()
 ids=ids[ids.index(last):];begin=s
 for n in ids:
  p=nodexy(n)
  if route:s+=math.dist(route[-1]['p'],p)
  if not route or math.dist(route[-1]['p'],p)>.001:route.append({'s':s,'p':p})
 last=ids[-1];roadRanges.append({'from':begin,'to':s,'source':'https://www.openstreetmap.org/way/'+wid,'tags':tags(w)})
join=legacy['centerline'][0]['p'];s+=math.dist(route[-1]['p'],join);roadRanges.append({'from':route[-1]['s'],'to':s,'source':'https://www.openstreetmap.org/way/378720749','tags':tags(ways['378720749'])})
extension=s
route.extend({'s':extension+p['s'],'p':p['p']} for p in legacy['centerline'])
length=extension+1000
segments=[{'id':'manipal-approach','name':'Manipal Hospital → Kadubeesanahalli','offset':0,'length':extension,'start':geo(route[0]['p']),'end':legacy['start']},{'id':'adobe-electra','name':'Original Adobe–Electra kilometre','offset':extension,'length':1000,'start':legacy['start'],'end':legacy['end']}]
def project(p):
 best=(1e30,0,0)
 for i,(a,b) in enumerate(zip(route,route[1:])):
  dx,dz=b['p'][0]-a['p'][0],b['p'][1]-a['p'][1];l=math.hypot(dx,dz)
  t=((p[0]-a['p'][0])*dx+(p[1]-a['p'][1])*dz)/(l*l)
  t=max(-100/l if i==0 else 0,min(1+100/l if i==len(route)-2 else 1,t))
  foot=[a['p'][0]+dx*t,a['p'][1]+dz*t];d=math.dist(p,foot)
  if d<best[0]:best=(d,a['s']+l*t,((p[0]-foot[0])*-dz+(p[1]-foot[1])*dx)/l)
 return best
cache={}
def pr(p):
 key=tuple(p)
 if key not in cache:cache[key]=project(p)
 return cache[key]
def polygon(w):return [nodexy(n) for n in refs(w) if n in nodes]
def inrange(ps,radius=260):return any(-100<=pr(p)[1]<=length+100 and pr(p)[0]<radius for p in ps)
def assemble(members):
 chains=[refs(ways[m.get('ref')])[:] for m in members if m.get('ref') in ways]
 if len(chains)!=len(members):return None
 result=[]
 while chains:
  ring=chains.pop(0)
  while ring[-1]!=ring[0]:
   for i,c in enumerate(chains):
    if c[0]==ring[-1]:ring+=c[1:];chains.pop(i);break
    if c[-1]==ring[-1]:ring+=list(reversed(c))[1:];chains.pop(i);break
   else:return None
  if any(n not in nodes for n in ring):return None
  result.append([nodexy(n) for n in ring])
 return result
complexes={};members=set();missing=[]
for rid,r in relations.items():
 t=tags(r)
 if t.get('type')!='multipolygon' or not ('building'in t or t.get('natural') in ['water','wood','scrub'] or t.get('landuse') in ['grass','forest','construction'] or t.get('leisure') in ['park','garden']):continue
 outer=assemble([m for m in r.findall('member') if m.get('type')=='way' and m.get('role') in ['outer','']]);inner=assemble([m for m in r.findall('member') if m.get('type')=='way' and m.get('role')=='inner'])
 if not outer or inner is None:missing.append({'id':'relation/'+rid,'name':t.get('name'),'reason':'Incomplete multipolygon in source extracts'});continue
 if not any(inrange(p,470 if 'building'in t else 450) for p in outer):continue
 complexes['relation/'+rid]=(t,outer,inner);members.update(m.get('ref') for m in r.findall('member') if m.get('type')=='way')
def metadata(ps):
 c=[sum(p[i] for p in ps[:-1])/max(1,len(ps)-1) for i in range(2)];d,s,o=pr(c);return c,s,o
buildings=[]
def add_building(id,t,outer,inner):
 ps=max(outer,key=len);c,s,o=metadata(ps);near=min(pr(p)[0] for ring in outer for p in ring);office=t.get('building') in ['office','hotel']
 if not -100<s<length+100 or near>(470 if office else 260):return
 levels=t.get('building:levels');explicit=t.get('height','').replace('.','',1).isdigit();height=float(t['height']) if explicit else float(levels)*3.4 if levels and levels.isdigit() else 38 if office else 12 if t.get('building') in ['commercial','apartments'] else 7
 buildings.append({'id':id,'name':t.get('name','Unnamed roadside building'),'kind':t['building'],'polygon':ps,'polygons':outer,'holes':inner,'center':c,'station':s,'offset':o,'height':height,'heightSource':'OSM height' if explicit else 'OSM levels × 3.4 m' if levels and levels.isdigit() else 'approximation — not surveyed','levels':levels,'tags':t,'source':'https://www.openstreetmap.org/'+(id if id.startswith('relation/') else 'way/'+id),'facadeConfidence':'unverified','immediateRoadside':near<85})
for id,w in ways.items():
 t=tags(w)
 if 'building'in t and id not in members:
  ps=polygon(w)
  if len(ps)>=4:add_building(id,t,[ps],[])
for id,(t,outer,inner) in complexes.items():
 if 'building'in t:add_building(id,t,outer,inner)
# Original footprints and IDs win when data overlaps the existing audited kilometre.
byId={b['id']:b for b in buildings}
for b in legacy['buildings']:byId[b['id']]={**b,'station':b['station']+extension,'polygons':[b['polygon']],'holes':[]}
buildings=list(byId.values());buildings.sort(key=lambda b:b['station'])
infra=[];supports=[];landscape=[];pois=[]
for id,w in ways.items():
 t=tags(w);ps=polygon(w)
 if len(ps)<2:continue
 if t.get('highway') or t.get('railway') or t.get('man_made')=='bridge':
  chunk=[];part=0
  for p in ps:
   d,s,o=pr(p)
   if -160<s<length+160 and d<260:chunk.append(p)
   else:
    if len(chunk)>1:infra.append({'id':id,'part':part,'tags':t,'points':chunk});part+=1
    chunk=[]
  if len(chunk)>1:infra.append({'id':id,'part':part,'tags':t,'points':chunk})
for id,n in nodes.items():
 t=tags(n);p=nodexy(id);d,s,o=pr(p)
 if -130<s<length+130 and d<300:
  if t.get('bridge:support')=='pier':supports.append({'id':id,'position':p,'station':s,'offset':o,'tags':{**t,'ref':t.get('ref','Unidentified mapped support')},'source':'https://www.openstreetmap.org/node/'+id})
  if t.get('natural')=='tree':landscape.append({'id':'node/'+id,'kind':'tree','geometry':'point','points':[p],'polygons':[],'holes':[],'tags':t,'source':'https://www.openstreetmap.org/node/'+id})
 if -100<s<length+100 and d<130 and(t.get('name') or t.get('highway')=='bus_stop'):pois.append({'id':id,'position':p,'station':s,'offset':o,'tags':t,'source':'https://www.openstreetmap.org/node/'+id})
def add_land(id,t,ps,outer,inner):
 kind='water' if t.get('natural')=='water' or t.get('waterway') in ['drain','stream','canal','ditch'] else 'greenery' if t.get('natural') in ['wood','scrub','grassland','tree_row'] or t.get('landuse') in ['grass','forest','meadow'] or t.get('leisure') in ['park','garden'] else 'construction' if t.get('landuse')=='construction' else None
 if not kind or not ps or not inrange(ps,450 if t.get('water')=='lake' else 300):return
 landscape.append({'id':id,'kind':kind,'geometry':'polygon' if outer else 'line','points':ps,'polygons':outer,'holes':inner,'tags':t,'source':'https://www.openstreetmap.org/'+id})
for id,w in ways.items():
 if id in members:continue
 ps=polygon(w);closed=len(ps)>3 and math.dist(ps[0],ps[-1])<.01
 add_land('way/'+id,tags(w),ps,[ps] if closed else [],[])
for id,(t,outer,inner) in complexes.items():add_land(id,t,[p for ring in outer for p in ring],outer,inner)
manifest={'version':2,'id':config['id'],'origin':origin,'length':length,'segments':segments,'roadRanges':roadRanges,'sourceDate':config['sourceDate'],'missingGeometry':missing}
data={**legacy,'version':2,'length':length,'start':geo(route[0]['p']),'centerline':route,'buildings':buildings,'infrastructure':infra,'supports':supports,'landscape':landscape,'pois':pois,'sourceUrl':'https://www.openstreetmap.org/copyright','notes':['Licensed OSM geometry; source extracts documented in route manifest.','Preserved original kilometre plus measured hospital-frontage approach.','Survey gaps and approximate vertical dimensions remain explicit.']}
pathlib.Path('src/data/map.json').write_text(json.dumps(data,separators=(',',':')))
pathlib.Path('src/data/route-manifest.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps({'extension':extension,'total':length,'buildings':len(buildings),'supports':len(supports),'landscape':len(landscape),'multipolygons':len(complexes),'missingRelations':missing},indent=2))
