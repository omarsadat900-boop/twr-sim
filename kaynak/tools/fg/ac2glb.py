"""AC3D (.ac, FlightGear) -> GLB. Usage: ac2glb.py out.glb texdir maxtex file1.ac[:dx,dy,dz] file2.ac ...
Objects whose name matches the gear regex go into a node named 'gear'; the rest into 'body'.
Coordinates are kept as in the .ac files (FlightGear: x aft, y up?, checked by rendering)."""
import sys, re, json, struct, io, os
import numpy as np
from PIL import Image
GEAR=re.compile(r'(^mg|^ng|nose.?gear|gear|tyre|tire|wheel|strut|axle|link|^rim|ngrim|steercyl|dragstrut|collar|torque|brake|bogie)',re.I)
SKIP=re.compile(r'(shadow|light|cone|beam|flare|pushback|cockpit|pilot|panel|seat|yoke)',re.I)
def parse(path):
    L=open(path,encoding='latin-1').read().split('\n'); i=0; mats=[]
    while i<len(L) and not L[i].startswith('OBJECT'):
        if L[i].startswith('MATERIAL'):
            t=L[i].split(); k=t.index('rgb'); r=[float(x) for x in t[k+1:k+4]]
            tr=float(t[t.index('trans')+1]) if 'trans' in t else 0
            mats.append((r,tr))
        i+=1
    out=[]
    def obj(i,M,parentname):
        assert L[i].startswith('OBJECT'),L[i]; i+=1
        o={'name':'','tex':None,'rep':(1,1),'off':(0,0),'rot':np.eye(3),'loc':np.zeros(3),'crease':61,'v':None,'s':[]}
        kids=0
        while True:
            t=L[i].split()
            if not t: i+=1; continue
            k=t[0]
            if k=='name': o['name']=L[i][5:].strip().strip('"'); i+=1
            elif k=='data': n=int(t[1]); i+=1; s=0
            # data may span lines; skip characters
            elif k=='texture': o['tex']=L[i].split('"')[1]; i+=1
            elif k=='texrep': o['rep']=(float(t[1]),float(t[2])); i+=1
            elif k=='texoff': o['off']=(float(t[1]),float(t[2])); i+=1
            elif k=='rot': o['rot']=np.array([float(x) for x in t[1:10]]).reshape(3,3); i+=1
            elif k=='loc': o['loc']=np.array([float(x) for x in t[1:4]]); i+=1
            elif k=='crease': o['crease']=float(t[1]); i+=1
            elif k=='numvert':
                n=int(t[1]); o['v']=np.array([[float(x) for x in L[i+1+j].split()[:3]] for j in range(n)]).reshape(-1,3); i+=1+n
            elif k=='numsurf':
                n=int(t[1]); i+=1
                for _ in range(n):
                    fl=int(L[i].split()[1],16); i+=1; mat=0
                    while not L[i].startswith('refs'):
                        if L[i].startswith('mat'): mat=int(L[i].split()[1])
                        i+=1
                    r=int(L[i].split()[1]); refs=[L[i+1+j].split() for j in range(r)]; i+=1+r
                    o['s'].append((fl,mat,[(int(a[0]),float(a[1]),float(a[2])) for a in refs]))
            elif k=='kids': kids=int(t[1]); i+=1; break
            elif k=='url' or k=='hidden' or k=='locked' or k=='folded' or k=='subdiv': i+=1
            else: i+=1
        # world transform: p_parent = rot^T? AC3D: p' = p*rot + loc (row vector). Use p@rot + loc.
        W=(o['rot'],o['loc'])
        Mrot=M[0]@np.eye(3); 
        R=o['rot']@M[0]; T=o['loc']@M[0]+M[1]
        o['R']=R; o['T']=T; o['parent']=parentname
        if o['v'] is not None: out.append(o)
        nm=o['name'] or parentname
        for _ in range(kids): i=obj(i,(R,T),nm)
        return i
    while i<len(L) and L[i].startswith('OBJECT'): i=obj(i,(np.eye(3),np.zeros(3)),'')
    return mats,out
def tri(o,mats,dx,M4=None):
    """returns dict key=(color,tex,trans)->(pos,nrm,uv)"""
    V=o['v']@o['R']+o['T']+dx; groups={}
    if M4 is not None: V=V@M4[:3,:3].T+M4[:3,3]
    cosc=np.cos(np.radians(o['crease']))
    faces=[]
    for fl,mat,refs in o['s']:
        if fl&0xF!=0 or len(refs)<3: continue   # lines
        p=V[[r[0] for r in refs]]
        n=np.zeros(3)
        for k in range(1,len(refs)-1): n+=np.cross(p[k]-p[0],p[k+1]-p[0])
        ln=np.linalg.norm(n)
        if ln<1e-12: continue
        faces.append((fl,mat,refs,n/ln))
    # smooth normals: per vertex list of face normals
    vf={}
    for fi,(fl,mat,refs,n) in enumerate(faces):
        for r in refs: vf.setdefault(r[0],[]).append(n)
    for fl,mat,refs,n in faces:
        col,tr=mats[mat] if mat<len(mats) else ([.8,.8,.8],0)
        key=(tuple(round(c,3) for c in col),o['tex'],round(tr,2))
        g=groups.setdefault(key,([],[],[]))
        corner=[]
        for vi,u,v in refs:
            if fl&0x10:
                ns=[m for m in vf[vi] if np.dot(m,n)>=cosc]; nn=np.sum(ns,axis=0); nn/=np.linalg.norm(nn) or 1
            else: nn=n
            uu=u*o['rep'][0]+o['off'][0]; vv=v*o['rep'][1]+o['off'][1]
            corner.append((V[vi],nn,(uu,1-vv)))
        for k in range(1,len(corner)-1):
            for c in (corner[0],corner[k],corner[k+1]):
                g[0].append(c[0]); g[1].append(c[1]); g[2].append(c[2])
    return groups
def write(out,parts,maxtex):
    # build glTF
    bin=bytearray(); bviews=[]; acc=[]; meshes=[]; materials=[]; matidx={}; images=[]; textures=[]; teximg={}
    def addbuf(arr,target=None):
        while len(bin)%4: bin.append(0)
        off=len(bin); b=arr.tobytes(); bin.extend(b); bv={'buffer':0,'byteOffset':off,'byteLength':len(b)}
        if target: bv['target']=target
        bviews.append(bv); return len(bviews)-1
    def addacc(arr,typ,target=34962):
        bv=addbuf(arr,target); a={'bufferView':bv,'componentType':5126 if arr.dtype==np.float32 else 5125,'count':len(arr),'type':typ}
        if typ=='VEC3': a['min']=arr.min(0).tolist(); a['max']=arr.max(0).tolist()
        acc.append(a); return len(acc)-1
    def texture(name):
        if name in teximg: return teximg[name]
        im=Image.open(name).convert('RGBA'); im.thumbnail((maxtex,maxtex))
        hasA=im.getextrema()[3][0]<250
        buf=io.BytesIO()
        if hasA: im.save(buf,'PNG',optimize=True); mime='image/png'
        else: im.convert('RGB').save(buf,'JPEG',quality=88); mime='image/jpeg'
        bv=addbuf(np.frombuffer(buf.getvalue(),np.uint8)); images.append({'bufferView':bv,'mimeType':mime})
        textures.append({'source':len(images)-1}); teximg[name]=len(textures)-1; texalpha[teximg[name]]=hasA; return teximg[name]
    nodes=[]; tris=0; texalpha={}
    wc={}
    for part,G in parts.items():
        if part.startswith('wheel_'):   # centre the wheel's geometry so it can spin about its own axle
            allp=np.array([q for g in G.values() for q in g[0]]) if G else np.zeros((1,3))
            c=((allp.min(0)+allp.max(0))/2); wc[part]=c.tolist()
            for g in G.values(): g[0][:]=[list(np.array(q)-c) for q in g[0]]
    for part,G in parts.items():
        prims=[]
        for (col,tex,tr),(p,n,u) in G.items():
            if not p: continue
            P=np.array(p,np.float32); N=np.array(n,np.float32); U=np.array(u,np.float32); tris+=len(P)//3
            attrs={'POSITION':addacc(P,'VEC3'),'NORMAL':addacc(N,'VEC3')}
            mk=(col,tex,tr)
            if mk not in matidx:
                m={'pbrMetallicRoughness':{'baseColorFactor':[*col,1-tr],'metallicFactor':0,'roughnessFactor':0.6},'doubleSided':True}
                if tex:
                    ti=texture(tex); m['pbrMetallicRoughness']['baseColorTexture']={'index':ti}; m['pbrMetallicRoughness']['baseColorFactor']=[1,1,1,1-tr]
                    if texalpha.get(ti): m['alphaMode']='MASK'; m['alphaCutoff']=0.5
                if tr>0.05: m['alphaMode']='BLEND'
                materials.append(m); matidx[mk]=len(materials)-1
            if tex: attrs['TEXCOORD_0']=addacc(U,'VEC2')
            prims.append({'attributes':attrs,'material':matidx[mk]})
        if prims:
            meshes.append({'primitives':prims}); nd={'name':part,'mesh':len(meshes)-1}
            if part.startswith('wheel_'): nd['translation']=wc[part]
            nodes.append(nd)
    gl={'asset':{'version':'2.0','generator':'ac2glb'},'scene':0,'scenes':[{'nodes':list(range(len(nodes)))}],'nodes':nodes,'meshes':meshes,
        'materials':materials,'accessors':acc,'bufferViews':bviews,'buffers':[{'byteLength':len(bin)}]}
    if images: gl['images']=images; gl['textures']=textures; gl['samplers']=[{}]
    for t in textures: t['sampler']=0
    js=json.dumps(gl,separators=(',',':')).encode(); js+=b' '*((4-len(js)%4)%4)
    while len(bin)%4: bin.append(0)
    with open(out,'wb') as f:
        f.write(struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(bin))); f.write(struct.pack('<II',len(js),0x4E4F534A)); f.write(js)
        f.write(struct.pack('<II',len(bin),0x004E4942)); f.write(bin)
    print(out,'tris',tris,'bytes',os.path.getsize(out),'parts',[n['name'] for n in nodes])
def main():
    out,texdir,maxtex=sys.argv[1],sys.argv[2],int(sys.argv[3]); texover={}
    parts={'body':{},'gear':{}}
    for spec in sys.argv[4:]:
        if spec.startswith('tex='): a,b=spec[4:].split('>'); texover[a]=b; continue
        f,_,d=spec.partition(':'); dx=np.array([float(x) for x in d.split(',')]) if d else np.zeros(3)
        mats,objs=parse(f)
        for o in objs:
            full=o['name']+' '+o['parent']
            if SKIP.search(o['name']): continue
            part='gear' if GEAR.search(o['name']) else 'body'
            if o['tex']: o['tex']=os.path.join(texdir,texover.get(o['tex'],o['tex']))
            for k,(p,n,u) in tri(o,mats,dx).items():
                G=parts[part].setdefault(k,([],[],[])); G[0].extend(p); G[1].extend(n); G[2].extend(u)
    write(out,parts,maxtex)
if __name__=='__main__': main()
