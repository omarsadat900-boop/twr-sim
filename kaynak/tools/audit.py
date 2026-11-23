import sys;sys.path.insert(0,'tx')
from pave import *
d,P,RW=load(sys.argv[1] if len(sys.argv)>1 else 'work/data/ltac.json')
A=unary_union([P,RW]); bnd=A.boundary
N=d['taxi']['nodes']; bad=[]
for i,e in enumerate(d['taxi']['edges']):
    if e['kind']=='runway': continue
    L=LineString(e['pts']); n=max(2,int(L.length/3)); out=0; mind=1e9
    for k in range(n+1):
        p=L.interpolate(k/n,normalized=True)
        if RW.contains(p): continue
        if not A.contains(p): out+=1; mind=min(mind,-bnd.distance(p))
        else: mind=min(mind,bnd.distance(p))
    if out or mind<4: bad.append((i,e['name'],e['kind'],round(L.length),out,n+1,round(mind,1)))
print(len(bad),'bad edges')
for b in bad: print(b)
