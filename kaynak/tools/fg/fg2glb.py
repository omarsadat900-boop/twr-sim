"""FlightGear model XML -> GLB (exterior only). Usage: fg2glb.py out.glb repo_root model.xml maxtex [tex=a.png>b.png ...] [skip=regex]"""
import sys, os, re, math, json, struct, io
import xml.etree.ElementTree as ET
import numpy as np
sys.path.insert(0,os.path.dirname(__file__))
import ac2glb as A
SKIP=re.compile(r'(flight.?deck|interior|cockpit|instrument|panel|light|pushback|marker|tutorial|effect|shadow|sound|pilot|crew|cabin|jetway|wiper|refuel|tanker|ground.?equip|chocks|cone|vc|3d.?cockpit|yoke|seat|dual|glass|reflect)',re.I)
WHEEL=re.compile(r'(tyre|tire|wheel|^rim|rim$|ngrim|hub)',re.I)
C=np.array([[1,0,0],[0,0,-1],[0,1,0]],float)   # AC(x,y,z) -> FG(x,-z,y)
def rot(h,p,r):
    h,p,r=[math.radians(v) for v in (h,p,r)]
    Rz=np.array([[math.cos(h),-math.sin(h),0],[math.sin(h),math.cos(h),0],[0,0,1]])
    Ry=np.array([[math.cos(p),0,math.sin(p)],[0,1,0],[-math.sin(p),0,math.cos(p)]])
    Rx=np.array([[1,0,0],[0,math.cos(r),-math.sin(r)],[0,math.sin(r),math.cos(r)]])
    return Rz@Ry@Rx
def offs(el):
    M=np.eye(4)
    if el is None: return M
    g=lambda k:float(el.findtext(k) or 0)
    M[:3,:3]=rot(g('heading-deg'),g('pitch-deg'),g('roll-deg')); M[:3,3]=[g('x-m'),g('y-m'),g('z-m')]
    return M
def resolve(p,base,root):
    p=p.replace('\\','/')
    m=re.match(r'Aircraft/[^/]+/(.*)',p)
    if m: return os.path.join(root,m.group(1))
    q=os.path.normpath(os.path.join(base,p))
    return q
def walk(xmlpath,M,root,out,skip,depth=0,over=None):
    if depth>8 or not os.path.exists(xmlpath): print('  missing',xmlpath); return
    try: t=ET.parse(xmlpath).getroot()
    except Exception as e: print('  bad xml',xmlpath,e); return
    base=os.path.dirname(xmlpath)
    params={c.tag:(c.text or '').strip() for c in (t.find('params') if t.find('params') is not None else [])}
    params.update(over or {})
    if t.get('include'): walk(resolve(t.get('include'),base,root),M,root,out,skip,depth+1,params)
    M=M@offs(t.find('offsets'))
    p=t.findtext('path')
    if p and p.strip().endswith('.ac'): out.append((resolve(p.strip(),base,root),M))
    for m in t.findall('model'):
        nm=(m.findtext('name') or '')+' '+(m.findtext('path') or '')
        if SKIP.search(nm) or (skip and re.search(skip,nm,re.I)): continue
        pe=m.find('path'); mp=((pe.text if pe is not None else '') or '').strip()
        if pe is not None and pe.get('alias'): mp=params.get(pe.get('alias').split('/')[-1],'')
        ov={c.tag:(c.text or '').strip() for c in m.findall('overlay/params/*')}
        if not mp: continue
        f=resolve(mp,base,root); Mm=M@offs(m.find('offsets'))
        if f.endswith('.ac'): out.append((f,Mm))
        else: walk(f,Mm,root,out,skip,depth+1,ov)
def main():
    out,root,xml,maxtex=sys.argv[1],sys.argv[2],sys.argv[3],int(sys.argv[4]); tex={}; skip=None; dropobj=None
    for a in sys.argv[5:]:
        if a.startswith('tex='): x,y=a[4:].split('>'); tex[x]=y
        if a.startswith('skip='): skip=a[5:]
        if a.startswith('drop='): dropobj=re.compile(a[5:],re.I)
    L=[]; walk(xml,np.eye(4),root,L,skip)
    for f,M in L: print('  ac',os.path.relpath(f,root),np.round(M[:3,3],2).tolist())
    parts={'body':{},'gear':{}}
    for f,M in L:
        if not os.path.exists(f): print('  missing ac',f); continue
        if SKIP.search(os.path.basename(f)): continue
        mats,objs=A.parse(f)
        # FG transform in AC frame: p_ac' = C^T (R (C p) + t)
        M4=np.eye(4); M4[:3,:3]=C.T@M[:3,:3]@C; M4[:3,3]=C.T@M[:3,3]
        for o in objs:
            if A.SKIP.search(o['name']) or (dropobj and dropobj.search(o['name'])): continue
            part='gear' if (A.GEAR.search(o['name']) or re.search(r'gear|mlg|nlg',os.path.basename(f),re.I)) else 'body'
            if WHEEL.search(o['name']) and not re.search(r'door|well|bay|strut|axle',o['name'],re.I): part='wheel_%d'%len([k for k in parts if k.startswith('wheel_')]); parts[part]={}
            if o['tex']:
                tn=o['tex']; full=os.path.normpath(os.path.join(os.path.dirname(f),tn))
                b=os.path.basename(tn); o['tex']=tex.get(b,full) if b in tex else full
            for k,(p,n,u) in A.tri(o,mats,np.zeros(3),M4).items():
                G=parts[part].setdefault(k,([],[],[])); G[0].extend(p); G[1].extend(n); G[2].extend(u)
    A.write(out,parts,maxtex)
main()
