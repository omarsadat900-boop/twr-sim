import json,math,sys
d=json.load(open(sys.argv[1]));N=d['taxi']['nodes'];E=d['taxi']['edges']
def out_dir(e,n):
    pts=e['pts'] if e['a']==n else e['pts'][::-1]
    for q in pts[1:]:
        v=(q[0]-pts[0][0],q[1]-pts[0][1]); L=math.hypot(*v)
        if L>3: return (v[0]/L,v[1]/L)
    return None
# fix node 37 (A): place it between 32 and 38
a,b=N[32],N[38]; N[37]['x']=round(a['x']+0.3*(b['x']-a['x']),1); N[37]['y']=round(a['y']+0.3*(b['y']-a['y']),1)
for i in (40,45):
    e=E[i]; e['pts']=[[N[e['a']]['x'],N[e['a']]['y']],[N[e['b']]['x'],N[e['b']]['y']]]; e['len']=round(math.dist(e['pts'][0],e['pts'][1]),1)
# report any node where two same-name edges leave in (nearly) the same direction (a fold-back)
bad=0
for n in N:
    inc=[e for e in E if n['id'] in (e['a'],e['b']) and e['kind'] in('taxiway','taxilane')]
    for i in range(len(inc)):
        for j in range(i+1,len(inc)):
            if inc[i]['name']!=inc[j]['name']: continue
            u,v=out_dir(inc[i],n['id']),out_dir(inc[j],n['id'])
            if u and v and u[0]*v[0]+u[1]*v[1]>0.87: print('fold',n['id'],inc[i]['name'],round(n['x']),round(n['y'])); bad+=1
print('folds',bad)
json.dump(d,open(sys.argv[2],'w'),separators=(',',':'))
