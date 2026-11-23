import sys,json,math;sys.path.insert(0,'tx')
from pave import *
from shapely.geometry import Point,LineString,Polygon,mapping
from shapely.prepared import prep
src,dst=sys.argv[1],sys.argv[2]
d,P,RW=load(src)
N=d['taxi']['nodes']; E=d['taxi']['edges']
# ---- 1. pavement for taxiway edges that run over grass (G) ----
A=unary_union([P,RW]); Ap=prep(A)
added=[]
for i,e in enumerate(E):
    if e['kind']!='taxiway': continue
    L=LineString(e['pts']); n=max(2,int(L.length/4)); out=0
    for k in range(n+1):
        p=L.interpolate(k/n,normalized=True)
        if not Ap.contains(p) and A.distance(p)>4: out+=1
    if out>0.5*(n+1) or e['name']=='A': added.append(i)
newpav=[]
if added:
    g=unary_union([LineString(E[i]['pts']).buffer(13 if E[i]['name']=='A' else 11.5,join_style=1,cap_style=1) for i in added])
    g=g.difference(P).buffer(0)
    polys=[g] if g.geom_type=='Polygon' else list(g.geoms)
    for pg in polys:
        pg=pg.simplify(0.5)
        if pg.area>50: newpav.append([[round(x,1),round(y,1)] for x,y in list(pg.exterior.coords)[:-1]])
    d['pavement']+=newpav
print('added pavement for edges',[E[i]['name'] for i in added],'polys',len(newpav))
d2=json.loads(json.dumps(d)); json.dump(d2,open('/tmp/claude-0/-home-user/9b13f70b-ae1a-55ce-8081-b87bd3319045/scratchpad/tx/_t.json','w'))
d,P,RW=load('/tmp/claude-0/-home-user/9b13f70b-ae1a-55ce-8081-b87bd3319045/scratchpad/tx/_t.json')
N=d['taxi']['nodes']; E=d['taxi']['edges']
A=unary_union([P,RW]); Ap=prep(A); RWp=prep(RW)
def inside(x,y): return Ap.contains(Point(x,y))
def ray(x,y,nx,ny,maxd=80,step=1.0):
    t=0
    while t<maxd:
        t+=step
        if not inside(x+nx*t,y+ny*t): return t-step/2
    return maxd
def strip(x,y,nx,ny):
    """returns offset along n to move point to the middle (narrow) or away from edges (wide)"""
    if not inside(x,y):
        best=None
        for sgn in (1,-1):
            t=0
            while t<45:
                t+=1
                if inside(x+sgn*nx*t,y+sgn*ny*t): 
                    if best is None or t<abs(best): best=sgn*t
                    break
        if best is None: return 0
        x2,y2=x+nx*(best+sgn*0.5*0),y+ny*best
        o=strip(x+nx*best,y+ny*best,nx,ny); return best+o
    sp=ray(x,y,nx,ny); sm=ray(x,y,-nx,-ny); w=sp+sm
    if w<=75: return (sp-sm)/2
    M=16
    if sp<M: return -(M-sp)
    if sm<M: return (M-sm)
    return 0
deg={}
for e in E:
    for k in ('a','b'): deg.setdefault(e[k],[]).append(e)
def tangent_at_node(n):
    es=[e for e in deg.get(n['id'],[]) if e['kind']!='runway']
    if len(es)!=2: return None
    pts=[]
    for e in es:
        q=e['pts'][1] if e['a']==n['id'] else e['pts'][-2]; pts.append(q)
    dx,dy=pts[1][0]-pts[0][0],pts[1][1]-pts[0][1]; L=math.hypot(dx,dy)
    if L<1: return None
    # only when nearly straight through
    v1=(pts[0][0]-n['x'],pts[0][1]-n['y']); v2=(pts[1][0]-n['x'],pts[1][1]-n['y'])
    c=(v1[0]*v2[0]+v1[1]*v2[1])/(math.hypot(*v1)*math.hypot(*v2)+1e-9)
    if c>-0.85: return None
    return dx/L,dy/L
moved=0
Afix={e[k] for e in E if e['name']=='A' for k in ('a','b')}
newpos={}
for n in N:
    if n.get('stand') or n.get('thr') or n['id'] in Afix: continue
    if RWp.contains(Point(n['x'],n['y'])): continue
    t=tangent_at_node(n)
    if t:
        o=strip(n['x'],n['y'],-t[1],t[0]); nx,ny=n['x']-t[1]*o,n['y']+t[0]*o
    else:
        # junction: push away from boundary
        p=Point(n['x'],n['y']); b=A.boundary; dd=b.distance(p)
        if inside(n['x'],n['y']) and dd>=12: continue
        q=b.interpolate(b.project(p)); vx,vy=n['x']-q.x,n['y']-q.y; L=math.hypot(vx,vy) or 1
        s=1 if inside(n['x'],n['y']) else -1
        nx,ny=q.x+s*vx/L*12,q.y+s*vy/L*12
        if not inside(nx,ny): continue
    if math.hypot(nx-n['x'],ny-n['y'])>0.5: newpos[n['id']]=(round(nx,1),round(ny,1)); moved+=1
for i,(x,y) in newpos.items(): N[i]['x'],N[i]['y']=x,y
print('nodes moved',moved)
def dp(pts,eps):
    if len(pts)<3: return pts
    a,b=pts[0],pts[-1]; L=math.hypot(b[0]-a[0],b[1]-a[1]) or 1e-9; dm,im=0,0
    for i in range(1,len(pts)-1):
        p=pts[i]; dd=abs((b[0]-a[0])*(a[1]-p[1])-(a[0]-p[0])*(b[1]-a[1]))/L
        if dd>dm: dm,im=dd,i
    if dm>eps: return dp(pts[:im+1],eps)[:-1]+dp(pts[im:],eps)
    return [a,b]
for e in E:
    na,nb=N[e['a']],N[e['b']]
    if e['kind']=='runway' or e['name']=='A':
        e['pts'][0]=[na['x'],na['y']]; e['pts'][-1]=[nb['x'],nb['y']]; continue
    pts=[list(p) for p in e['pts']]; pts[0]=[na['x'],na['y']]; pts[-1]=[nb['x'],nb['y']]
    L=LineString(pts); n=max(2,int(L.length/4))
    S=[L.interpolate(k/n,normalized=True) for k in range(n+1)]
    S=[(p.x,p.y) for p in S]
    offs=[0.0]*(n+1); nrm=[(0,0)]*(n+1); skip=[False]*(n+1)
    for k in range(1,n):
        a=S[max(0,k-2)]; b=S[min(n,k+2)]; dx,dy=b[0]-a[0],b[1]-a[1]; l=math.hypot(dx,dy) or 1
        nrm[k]=(-dy/l,dx/l)
        if RWp.contains(Point(*S[k])): skip[k]=True; continue
        offs[k]=strip(S[k][0],S[k][1],*nrm[k])
    # smooth offsets (window ±4) ignoring skipped
    sm=offs[:]
    for k in range(1,n):
        if skip[k]: continue
        w=[offs[j] for j in range(max(1,k-4),min(n,k+5)) if not skip[j]]
        w.sort(); sm[k]=w[len(w)//2]
    out=[S[0]]
    for k in range(1,n):
        # taper near fixed ends that were not centred (stands / junctions): within 12 m
        dk=min(k,n-k)*L.length/n; tw=1.0
        endnode=N[e['a']] if k<n/2 else N[e['b']]
        if endnode.get('stand') and dk<12: tw=dk/12
        out.append((S[k][0]+nrm[k][0]*sm[k]*tw,S[k][1]+nrm[k][1]*sm[k]*tw))
    out.append(S[-1])
    # laplacian smoothing
    for it in range(3):
        out=[out[0]]+[((out[i-1][0]+2*out[i][0]+out[i+1][0])/4,(out[i-1][1]+2*out[i][1]+out[i+1][1])/4) for i in range(1,len(out)-1)]+[out[-1]]
    out=dp([list(p) for p in out],1.2 if e['kind']=='taxiway' else 6)
    e['pts']=[[round(x,1),round(y,1)] for x,y in out]
    e['len']=round(LineString(e['pts']).length,1)
# stands keep their node xy; update holding points snapping later in JS
json.dump(d,open(dst,'w'),separators=(',',':'))
print('done')
