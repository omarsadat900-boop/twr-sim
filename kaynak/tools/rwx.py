import sys,json,math;sys.path.insert(0,'tx')
from pave import *
from shapely.geometry import Point,LineString
from shapely.prepared import prep
d,P,RW=load(sys.argv[1]); N=d['taxi']['nodes']; E=d['taxi']['edges']
rws=[]
for r in d['runways']:
    a=r['thr'][r['ends'][0]]['xy']; b=r['thr'][r['ends'][1]]['xy']; L=math.hypot(b[0]-a[0],b[1]-a[1])
    rws.append((a,((b[0]-a[0])/L,(b[1]-a[1])/L),L,prep(LineString([a,b]).buffer(r['width']/2+1,cap_style=2))))
def which(x,y):
    for R in rws:
        if R[3].contains(Point(x,y)):
            a,u,L,_=R; v=(x-a[0],y-a[1]); off=v[0]*u[1]-v[1]*u[0]
            if abs(off)<3: return R
    return None
moved=0
orig={n['id']:(n['x'],n['y']) for n in N}
def nbr_s(n,a,u):
    ss=[]
    for e in E:
        if e['kind']!='runway': continue
        o=e['b'] if e['a']==n['id'] else e['a'] if e['b']==n['id'] else None
        if o is None: continue
        x,y=orig[o]; ss.append((x-a[0])*u[0]+(y-a[1])*u[1])
    return ss
for n in N:
    if n.get('thr') or n.get('stand'): continue
    R=which(n['x'],n['y'])
    if not R: continue
    a,u,L,pr=R
    inc=[e for e in E if e['kind']!='runway' and (e['a']==n['id'] or e['b']==n['id'])]
    if not inc: continue
    xs=[];plan=[]
    for e in inc:
        pts=e['pts'] if e['a']==n['id'] else e['pts'][::-1]
        k=1
        while k<len(pts)-1 and pr.contains(Point(*pts[k])): k+=1
        po=pts[k]; p2=pts[k+1] if k+1<len(pts) else None
        if p2 is None or math.hypot(p2[0]-po[0],p2[1]-po[1])<5:
            dx,dy=po[0]-n['x'],po[1]-n['y']; dx,dy=-dx,-dy
        else: dx,dy=po[0]-p2[0],po[1]-p2[1]
        # intersect po + t*(dx,dy) with centreline a + s*u
        den=dx*u[1]-dy*u[0]
        if abs(den)<1e-6: continue
        t=((a[0]-po[0])*u[1]-(a[1]-po[1])*u[0])/den
        X=(po[0]+t*dx,po[1]+t*dy); s=(X[0]-a[0])*u[0]+(X[1]-a[1])*u[1]
        xs.append(s); plan.append((e,k))
    if not xs: continue
    s=sum(xs)/len(xs); s0=(n['x']-a[0])*u[0]+(n['y']-a[1])*u[1]
    if abs(s-s0)>120: s=s0
    for sn in nbr_s(n,a,u):
        mid=(sn+s0)/2
        if sn<s0: s=max(s,mid+2)
        else: s=min(s,mid-2)
    nx,ny=round(a[0]+u[0]*s,1),round(a[1]+u[1]*s,1)
    n['x'],n['y']=nx,ny; moved+=1
    for e,k in plan:
        rev=e['a']!=n['id']; pts=e['pts'] if not rev else e['pts'][::-1]
        pts=[[nx,ny]]+pts[k:]
        e['pts']=pts if not rev else pts[::-1]
        e['len']=round(LineString(e['pts']).length,1)
for e in E:
    if e['kind']=='runway':
        e['pts']=[[N[e['a']]['x'],N[e['a']]['y']],[N[e['b']]['x'],N[e['b']]['y']]]; e['len']=round(LineString(e['pts']).length,1)
print('runway nodes realigned',moved)
json.dump(d,open(sys.argv[2],'w'),separators=(',',':'))
# ---- pair crossings: two close runway nodes, one taxiway each on opposite sides -> one straight crossing
def side_edge(nid):
    inc=[e for e in E if e['kind']!='runway' and nid in (e['a'],e['b'])]
    return inc[0] if len(inc)==1 else None
done=0
for R in rws:
    a,u,L,pr=R
    for e in E:
        if e['kind']!='runway': continue
        na,nb=N[e['a']],N[e['b']]
        if not (which(na['x'],na['y']) is R and which(nb['x'],nb['y']) is R): continue
        if e['len']>45: continue
        ea,eb=side_edge(na['id']),side_edge(nb['id'])
        if not ea or not eb: continue
        pa=(ea['pts'][1] if ea['a']==na['id'] else ea['pts'][-2]); pb=(eb['pts'][1] if eb['a']==nb['id'] else eb['pts'][-2])
        oa=(pa[0]-a[0])*u[1]-(pa[1]-a[1])*u[0]; ob=(pb[0]-a[0])*u[1]-(pb[1]-a[1])*u[0]
        if oa*ob>=0: continue
        t=oa/(oa-ob); X=(pa[0]+t*(pb[0]-pa[0]),pa[1]+t*(pb[1]-pa[1])); s=(X[0]-a[0])*u[0]+(X[1]-a[1])*u[1]
        sa=(na['x']-a[0])*u[0]+(na['y']-a[1])*u[1]; sb=(nb['x']-a[0])*u[0]+(nb['y']-a[1])*u[1]
        sg=1 if sb>sa else -1
        for n,ss,ee in ((na,s-sg*1.5,ea),(nb,s+sg*1.5,eb)):
            n['x'],n['y']=round(a[0]+u[0]*ss,1),round(a[1]+u[1]*ss,1)
            if ee['a']==n['id']: ee['pts'][0]=[n['x'],n['y']]
            else: ee['pts'][-1]=[n['x'],n['y']]
            ee['len']=round(LineString(ee['pts']).length,1)
        done+=1
for e in E:
    if e['kind']=='runway':
        e['pts']=[[N[e['a']]['x'],N[e['a']]['y']],[N[e['b']]['x'],N[e['b']]['y']]]; e['len']=round(LineString(e['pts']).length,1)
print('paired crossings',done)
json.dump(d,open(sys.argv[2],'w'),separators=(',',':'))
