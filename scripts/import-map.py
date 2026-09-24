"""Rebuild the distributable OSM extract. Usage: python3 scripts/import-map.py /tmp/orr-north.osm
Source: https://www.openstreetmap.org/api/0.6/map?bbox=77.687,12.938,77.704,12.951
OpenStreetMap contributors, ODbL 1.0. Google imagery is not redistributed.
"""
import xml.etree.ElementTree as ET
import sys, json, math, pathlib

root = ET.parse(sys.argv[1]).getroot()
nodes = {n.get('id'): n for n in root.findall('node')}
ways = {w.get('id'): w for w in root.findall('way')}
tags = lambda e: {t.get('k'):t.get('v') for t in e.findall('tag')}
ll = lambda n: [float(n.get('lat')),float(n.get('lon'))]
R = 6371008.8
origin = [12.942,77.696]
def xy(p):
    return [(p[1]-origin[1])*math.pi/180*R*math.cos(origin[0]*math.pi/180),-(p[0]-origin[0])*math.pi/180*R]
def geo(p):
    return [origin[0]-p[1]/R*180/math.pi,origin[1]+p[0]/R*180/math.pi/math.cos(origin[0]*math.pi/180)]
def dist(a,b): return math.hypot(a[0]-b[0],a[1]-b[1])
ids = ['378720749','377096333','377096329','1302220814','1203530534','1203530535','377096332']
path=[]
for wid in ids:
    w=ways[wid]
    for nd in w.findall('nd'):
        p=xy(ll(nodes[nd.get('ref')]))
        if not path or dist(path[-1]['p'],p)>0.01:
            path.append({'p':p,'d':0 if not path else path[-1]['d']+dist(path[-1]['p'],p),'way':wid,'tags':tags(w)})
def project(p):
    best=(1e12,None,None)
    for a,b in zip(path,path[1:]):
        dx,dz=b['p'][0]-a['p'][0],b['p'][1]-a['p'][1]
        t=max(0,min(1,((p[0]-a['p'][0])*dx+(p[1]-a['p'][1])*dz)/(dx*dx+dz*dz)))
        foot=[a['p'][0]+dx*t,a['p'][1]+dz*t]
        length=math.hypot(dx,dz)
        off=((p[0]-foot[0])*(-dz)+(p[1]-foot[1])*dx)/length
        if dist(p,foot)<best[0]: best=(dist(p,foot),a['d']+t*length,off)
    return best
def at(d):
    for a,b in zip(path,path[1:]):
        if d<=b['d']:
            t=(d-a['d'])/(b['d']-a['d'])
            return [a['p'][i]+t*(b['p'][i]-a['p'][i]) for i in range(2)]
    return path[-1]['p']
# Midpoint of road-projected Adobe and Electra campuses; do not shorten geographic distances.
mid=(project(xy([12.9437968,77.6969405]))[1]+project(xy([12.9424869,77.6918282]))[1])/2
start=mid-500
finish=start+1000
route=[{'s':0,'p':at(start)}]+[{'s':p['d']-start,'p':p['p']} for p in path if start<p['d']<finish]+[{'s':1000,'p':at(finish)}]
buildings=[]
for wid,w in ways.items():
    t=tags(w)
    if 'building' not in t: continue
    pts=[xy(ll(nodes[n.get('ref')])) for n in w.findall('nd') if n.get('ref') in nodes]
    if len(pts)<4: continue
    c=[sum(p[i] for p in pts[:-1])/(len(pts)-1) for i in range(2)]
    distance,station,offset=project(c)
    near=min(project(p)[0] for p in pts)
    office=t.get('building') in ['office','hotel']
    if not (-100<station-start<1100 and (near<260 or office and near<470)): continue
    levels=t.get('building:levels')
    name=t.get('name','Unnamed roadside building')
    inferred_height=38 if office else 12 if t.get('building') in ['commercial','apartments'] else 7
    height=float(t['height']) if t.get('height','').replace('.','',1).isdigit() else float(levels)*3.4 if levels and levels.isdigit() else inferred_height
    buildings.append({'id':wid,'name':name,'kind':t['building'],'polygon':[[round(v,3) for v in p] for p in pts], 'center':[round(v,3) for v in c], 'station':round(station-start,2),'offset':round(offset,2),'height':height,'heightSource':'OSM height' if 'height' in t else 'OSM levels × 3.4 m' if levels else 'approximation — not surveyed','levels':levels,'tags':t,'source':f'https://www.openstreetmap.org/way/{wid}','facadeConfidence':'unverified','immediateRoadside':near<85})
buildings.sort(key=lambda b:b['station'])
infrastructure=[]
for wid,w in ways.items():
    t=tags(w)
    if not (t.get('highway') or t.get('railway') or t.get('waterway') or t.get('man_made')=='bridge'): continue
    pts=[xy(ll(nodes[n.get('ref')])) for n in w.findall('nd') if n.get('ref') in nodes]
    # Keep bounded fragments; never load distant metro nodes.
    chunks=[]; chunk=[]
    for p in pts:
        d,s,o=project(p)
        if -130<s-start<1130 and d<260: chunk.append(p)
        else:
            if len(chunk)>1: chunks.append(chunk)
            chunk=[]
    if len(chunk)>1: chunks.append(chunk)
    for ps in chunks: infrastructure.append({'id':wid,'tags':t,'points':[[round(v,3) for v in p] for p in ps]})
pois=[]
for nid,n in nodes.items():
    t=tags(n)
    if not(t.get('name') or t.get('highway')=='bus_stop'): continue
    p=xy(ll(n)); d,s,o=project(p)
    if -20<s-start<1020 and d<130:
        pois.append({'id':nid,'position':p,'station':s-start,'offset':o,'tags':t,'source':f'https://www.openstreetmap.org/node/{nid}'})
# Geographic landscape geometry and individually mapped structural supports.
landscape=[]; supports=[]
for nid,n in nodes.items():
    t=tags(n); p=xy(ll(n)); d,s,o=project(p)
    if -130<s-start<1130 and d<300:
        if t.get('bridge:support')=='pier': supports.append({'id':nid,'position':p,'station':s-start,'offset':o,'tags':t,'source':f'https://www.openstreetmap.org/node/{nid}'})
        if t.get('natural')=='tree': landscape.append({'id':'node/'+nid,'kind':'tree','geometry':'point','points':[p],'tags':t,'source':f'https://www.openstreetmap.org/node/{nid}'})
for wid,w in ways.items():
    t=tags(w)
    kind='water' if t.get('natural')=='water' or t.get('waterway') in ['drain','stream','canal','ditch'] else 'greenery' if t.get('natural') in ['wood','scrub','grassland','tree_row'] or t.get('landuse') in ['grass','forest','meadow'] or t.get('leisure') in ['park','garden'] else 'construction' if t.get('landuse')=='construction' else None
    if not kind: continue
    pts=[xy(ll(nodes[n.get('ref')])) for n in w.findall('nd') if n.get('ref') in nodes]
    if not pts or not any(-100<project(p)[1]-start<1100 and project(p)[0]<300 for p in pts): continue
    landscape.append({'id':'way/'+wid,'kind':kind,'geometry':'polygon' if len(pts)>3 and dist(pts[0],pts[-1])<.1 else 'line','points':pts,'tags':t,'source':f'https://www.openstreetmap.org/way/{wid}'})
data={'supports':supports,'landscape':landscape,'license':'© OpenStreetMap contributors · ODbL 1.0','sourceDate':'2026-09-24','sourceUrl':'https://www.openstreetmap.org/api/0.6/map?bbox=77.687,12.938,77.704,12.951','origin':origin,'length':1000,'start':geo(route[0]['p']),'end':geo(route[-1]['p']),'centerline':route,'buildings':buildings,'infrastructure':infrastructure,'pois':pois,'notes':['Building footprints and road alignment from OpenStreetMap, not extracted from Google Maps.','Unspecified heights and facades are approximations. Complete current storefront verification is pending.','Electra is set back inside Prestige Tech Park; its Google Maps listing says temporarily closed.']}
out=pathlib.Path('src/data/map.json');out.write_text(json.dumps(data,separators=(',',':')))
pathlib.Path('public/data/route-survey.json').write_text(json.dumps(data,indent=2))
print(json.dumps({'buildings':len(buildings),'supports':len(supports),'landscape':len(landscape)}))
