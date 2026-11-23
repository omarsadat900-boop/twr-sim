import json,math
from shapely.geometry import Polygon,LineString,Point
from shapely.ops import unary_union
def load(p='work/data/ltac.json'):
    d=json.load(open(p))
    pv=unary_union([Polygon(p).buffer(0) for p in d['pavement']])
    hl=unary_union([Polygon(p).buffer(0) for p in d['holes']])
    rws=[]
    for r in d['runways']:
        a=r['thr'][r['ends'][0]]['xy']; b=r['thr'][r['ends'][1]]['xy']
        rws.append(LineString([a,b]).buffer(r['width']/2,cap_style=2))
    rw=unary_union(rws)
    return d,pv.difference(hl),rw
