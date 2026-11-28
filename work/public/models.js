// ===================== TWR SİM 3D models (three.js r128) =====================
// Type-specific aircraft and the six ground vehicles. All sizes in metres.
// Frame: nose / front toward -Z, right wing toward +X, up = +Y, origin on the ground under the reference point.
// userData: {gear: Group (retractable gear), props: [Mesh], lights: {name:[x,y,z]}, flashers: [{m,on,off,ph,rate}], spec}
const MODELS = (()=>{
  const mats={};
  const M=(c,basic)=>{ const k=c+(basic?'b':''); if(!mats[k]) mats[k]=basic?new THREE.MeshBasicMaterial({color:c}):new THREE.MeshLambertMaterial({color:c}); return mats[k]; };
  const WHITE='#f3f4f6', GREY='#a9b0b8', DARK='#262c33', GLASS='#1b2633', TYRE='#151515', METAL='#c3c7cc';

  // ---------- geometry helpers ----------
  // hexahedron from 4 planform corners (x,z) with per-corner thickness, centred on y
  function slab(P,T,y0){ // P: 4x[x,z] (root-front, tip-front, tip-back, root-back), T: 4 thicknesses
    const v=[]; P.forEach((p,i)=>v.push([p[0],y0+T[i]/2,p[1]])); P.forEach((p,i)=>v.push([p[0],y0-T[i]/2,p[1]]));
    const f=[[0,1,2],[0,2,3],[4,6,5],[4,7,6],[0,4,5],[0,5,1],[1,5,6],[1,6,2],[2,6,7],[2,7,3],[3,7,4],[3,4,0]];
    const pos=[]; f.forEach(t=>t.forEach(i=>pos.push(...v[i])));
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.computeVertexNormals(); return g; }
  // one wing half: root at x=xr, chord cr, leading edge at z=zr; tip at x=xr+s, swept back by sw (m), chord ct, raised by dh (m)
  function wingHalf(o,side){
    const s=side, xr=o.xr*s, xt=(o.xr+o.s)*s, zr=o.zr, zt=o.zr+o.sw;
    const g=slab([[xr,zr],[xt,zt],[xt,zt+o.ct],[xr,zr+o.cr]],[o.tr,o.tt,o.tt*0.6,o.tr*0.6],0);
    // dihedral: raise the tip
    const p=g.attributes.position; for(let i=0;i<p.count;i++){ const x=Math.abs(p.getX(i)); p.setY(i,p.getY(i)+(x-o.xr)/o.s*o.dh); } g.computeVertexNormals();
    return g; }
  // body of revolution along Z: prof = [[z, r], ...] from nose (negative z) to tail; up = per-point vertical offset of the centre
  function lathe(prof,seg){ const pts=prof.map(([z,r])=>new THREE.Vector2(Math.max(0.001,r),z)); const g=new THREE.LatheGeometry(pts,seg||16); g.rotateX(Math.PI/2); g.scale(1,1,1);
    // after rotateX(+90°) the lathe Y axis becomes +Z; flip so first profile point is most negative z
    return g; }
  function shiftUp(g,fn){ const p=g.attributes.position; for(let i=0;i<p.count;i++){ p.setY(i,p.getY(i)+fn(p.getZ(i))); } g.computeVertexNormals(); return g; }
  function cyl(r1,r2,len,seg,mat){ const g=new THREE.CylinderGeometry(r1,r2,len,seg||14); g.rotateX(Math.PI/2); return new THREE.Mesh(g,mat); }
  function box(w,h,l,mat){ return new THREE.Mesh(new THREE.BoxGeometry(w,h,l),mat); }
  function wheel(r,w){ const g=new THREE.CylinderGeometry(r,r,w,14); g.rotateZ(Math.PI/2); return new THREE.Mesh(g,M(TYRE)); }

  // ---------- aircraft specs ----------
  // L length, R fuselage radius, zw wing LE root position (from nose, m), wing: span, cr, ct, sweep(m), dh, tr; tail: T (T-tail), fin h, ht span
  const S={
    C172:{name:'Cessna 172',L:8.3,R:0.62,hw:'high',wing:{span:11,cr:1.6,ct:1.1,sw:0.1,dh:0.15,tr:0.18,zw:2.2},fin:{h:1.6,cr:1.5,ct:0.8,sw:0.9},ht:{span:3.4,cr:1.1,ct:0.7,sw:0.2},T:false,
      eng:{type:'nose'},gear:{fixed:true,track:2.5,main:3.3,nose:0.9,h:1.1,wr:0.28,mainCount:1},tailUp:0.25,box:true},
    BE40:{name:'Beechcraft 400',L:14.8,R:0.85,hw:'low',wing:{span:13.3,cr:2.6,ct:1.1,sw:1.2,dh:0.4,tr:0.32,zw:6.2},fin:{h:2.9,cr:2.6,ct:1.4,sw:1.9},ht:{span:5.0,cr:1.3,ct:0.7,sw:0.9},T:true,
      eng:{type:'rear',n:2,len:3.0,r:0.48,z:10.3,x:1.45,y:0.55},gear:{track:2.9,main:7.5,nose:2.2,h:1.25,wr:0.3,mainCount:1},tailUp:0.45},
    GLF4:{name:'Gulfstream IV',L:26.9,R:1.25,hw:'low',wing:{span:23.7,cr:4.6,ct:1.5,sw:4.6,dh:0.9,tr:0.5,zw:10.6},fin:{h:4.4,cr:4.0,ct:2.0,sw:3.2},ht:{span:9.8,cr:2.2,ct:1.0,sw:2.3},T:true,
      eng:{type:'rear',n:2,len:5.0,r:0.72,z:18.6,x:2.25,y:0.75},gear:{track:4.2,main:13.3,nose:3.0,h:1.6,wr:0.45,mainCount:2},tailUp:0.6,winglet:{h:1.7,type:'jet'}},
    GLF5:{name:'Gulfstream V',L:29.4,R:1.28,hw:'low',wing:{span:28.5,cr:5.0,ct:1.5,sw:5.6,dh:1.0,tr:0.5,zw:11.4},fin:{h:4.8,cr:4.2,ct:2.0,sw:3.4},ht:{span:10.5,cr:2.3,ct:1.0,sw:2.4},T:true,
      eng:{type:'rear',n:2,len:5.4,r:0.75,z:20.3,x:2.35,y:0.8},gear:{track:4.3,main:14.6,nose:3.1,h:1.7,wr:0.46,mainCount:2},tailUp:0.6,winglet:{h:2.0,type:'jet'}},
    DH8D:{name:'Dash 8 Q400',L:32.8,R:1.35,hw:'high',wing:{span:28.4,cr:3.2,ct:1.5,sw:0.5,dh:-0.2,tr:0.5,zw:13.0},fin:{h:6.2,cr:5.0,ct:2.4,sw:4.0},ht:{span:9.0,cr:2.0,ct:1.2,sw:1.4},T:true,
      eng:{type:'prop',n:2,len:6.2,r:0.65,x:4.2,prop:4.1,blades:6},gear:{track:8.4,main:14.8,nose:2.6,h:2.0,wr:0.5,mainCount:2},tailUp:0.9},
    B738:{name:'Boeing 737-800',L:39.5,R:1.88,hw:'low',wing:{span:35.8,cr:7.3,ct:1.3,sw:7.6,dh:1.6,tr:0.8,zw:14.4},fin:{h:7.6,cr:6.5,ct:2.2,sw:5.5},ht:{span:14.4,cr:3.6,ct:1.2,sw:3.3},T:false,
      eng:{type:'fan',n:2,x:[4.9],len:4.0,r:0.98,z:12.9,y:-1.6},gear:{track:5.7,main:21.2,nose:4.0,h:2.6,wr:0.56,mainCount:2},tailUp:1.4,winglet:{h:2.5,type:'blended'}},
    B763:{name:'Boeing 767',L:54.9,R:2.51,hw:'low',wing:{span:47.6,cr:9.0,ct:2.4,sw:9.4,dh:2.0,tr:1.1,zw:20.2},fin:{h:9.2,cr:8.0,ct:2.8,sw:6.6},ht:{span:18.6,cr:4.6,ct:1.6,sw:4.4},T:false,
      eng:{type:'fan',n:2,x:[7.6],len:5.0,r:1.35,z:17.5,y:-2.1},gear:{track:9.3,main:29.0,nose:5.0,h:3.0,wr:0.65,mainCount:4},tailUp:1.8},
    B744:{name:'Boeing 747',L:70.7,R:3.25,hw:'low',wing:{span:64.4,cr:14.0,ct:3.8,sw:16.0,dh:2.4,tr:1.5,zw:26.0},fin:{h:12.5,cr:11.0,ct:3.6,sw:9.5},ht:{span:22.2,cr:6.6,ct:2.0,sw:6.4},T:false,
      eng:{type:'fan',n:4,x:[11.9,21.0],len:5.5,r:1.35,z:22.0,y:-2.4},gear:{track:11.0,main:37.0,nose:6.0,h:3.4,wr:0.65,mainCount:4,bodyGear:true},tailUp:2.0,hump:true,winglet:{h:1.8,type:'jet'}},
    A320:{name:'Airbus A320',L:37.6,R:1.98,hw:'low',wing:{span:35.8,cr:7.0,ct:1.5,sw:7.2,dh:1.6,tr:0.8,zw:13.8},fin:{h:6.6,cr:6.0,ct:2.4,sw:4.8},ht:{span:12.5,cr:3.4,ct:1.2,sw:3.0},T:false,
      eng:{type:'fan',n:2,x:[5.75],len:4.3,r:1.05,z:11.9,y:-1.9},gear:{track:7.6,main:19.5,nose:5.1,h:2.9,wr:0.58,mainCount:2},tailUp:1.4,winglet:{h:2.4,type:'sharklet'}},
    A310:{name:'Airbus A310',L:46.7,R:2.82,hw:'low',wing:{span:43.9,cr:8.4,ct:2.2,sw:8.6,dh:1.8,tr:1.0,zw:17.0},fin:{h:8.4,cr:7.6,ct:2.6,sw:6.2},ht:{span:16.3,cr:4.2,ct:1.4,sw:4.0},T:false,
      eng:{type:'fan',n:2,x:[7.2],len:5.0,r:1.35,z:14.6,y:-2.4},gear:{track:9.6,main:24.0,nose:4.8,h:3.1,wr:0.62,mainCount:4},tailUp:1.8,winglet:{h:1.3,type:'fence'}},
    A359:{name:'Airbus A350',L:66.8,R:2.98,hw:'low',wing:{span:64.8,cr:13.0,ct:2.6,sw:15.5,dh:3.2,tr:1.5,zw:24.5},fin:{h:11.0,cr:10.0,ct:3.6,sw:8.0},ht:{span:19.5,cr:5.6,ct:1.8,sw:5.2},T:false,
      eng:{type:'fan',n:2,x:[10.5],len:6.2,r:1.6,z:21.5,y:-2.7},gear:{track:10.6,main:35.0,nose:6.0,h:3.4,wr:0.68,mainCount:4},tailUp:2.0,winglet:{h:4.2,type:'curved'}},
  };
  // ---------- liveries, painted after the reference photos the user sent ----------
  // fuselage canvas: x = round the body (0 bottom, .25 right side, .5 top, .75 left side), y = nose (0) -> tail (1)
  // fin canvas: x = front (0) -> rear (1) of the fin, y = root (0) -> tip (1)
  const NAVY='#0b2a5b', BBLUE='#1d4f91', BLT='#4f8fd6';
  const LIV={
    C172:{belly:null, cheat:['#1d3f8f',0.255,0.275], win:'ga', eng:'#ffffff', fin:(c,W,H)=>{ c.fillStyle='#1d3f8f'; c.beginPath(); c.moveTo(0,H*0.75); c.lineTo(W,H*0.45); c.lineTo(W,H*0.62); c.lineTo(0,H*0.9); c.fill(); }},
    BE40:{belly:null, cheat:['#24346b',0.24,0.262], cheat2:['#c9a227',0.264,0.272], win:'bizjet', eng:'#ffffff', fin:(c,W,H)=>{ c.fillStyle='#24346b'; c.fillRect(0,H*0.70,W,H*0.08); c.fillStyle='#c9a227'; c.fillRect(0,H*0.79,W,H*0.025); }},
    GLF4:{belly:null, cheat:['#3a3f47',0.235,0.25], cheat2:['#9b1c24',0.252,0.258], win:'gulf', eng:'#ffffff', fin:(c,W,H)=>{ c.fillStyle='#3a3f47'; c.fillRect(0,H*0.12,W,H*0.05); c.fillStyle='#9b1c24'; c.fillRect(0,H*0.18,W,H*0.02); }},
    GLF5:{belly:null, cheat:['#3a3f47',0.235,0.25], cheat2:['#9b1c24',0.252,0.258], win:'gulf', eng:'#ffffff', fin:(c,W,H)=>{ c.fillStyle='#3a3f47'; c.fillRect(0,H*0.12,W,H*0.05); c.fillStyle='#9b1c24'; c.fillRect(0,H*0.18,W,H*0.02); }},
    DH8D:{belly:null, win:'prop', eng:'#ffffff', titles:'#1f7a3a', fin:(c,W,H)=>{ // white fin, green-yellow-red sweep
      [['#1f8a3b',0.10],['#f5c400',0.24],['#d6202a',0.38]].forEach(([col,o])=>{ c.fillStyle=col; c.beginPath(); c.moveTo(W*(0.05+o),0); c.lineTo(W*(0.2+o),0); c.lineTo(W,H*(0.9-o*1.6)); c.lineTo(W,H*(0.78-o*1.6)); c.fill(); }); }},
    B738:{belly:[BBLUE,0.215], stripe:[BLT,0.215,0.235], win:'jet', eng:BBLUE, fin:(c,W,H)=>{ c.fillStyle=BBLUE; c.fillRect(0,0,W,H); c.fillStyle=BLT; c.beginPath(); c.moveTo(0,H*0.35); c.quadraticCurveTo(W*0.5,H*0.2,W,H*0.55); c.lineTo(W,H*0.65); c.quadraticCurveTo(W*0.5,H*0.3,0,H*0.45); c.fill(); }},
    B744:{belly:[BBLUE,0.215], stripe:[BLT,0.215,0.235], win:'jet', eng:BBLUE, fin:(c,W,H)=>{ c.fillStyle=BBLUE; c.fillRect(0,0,W,H); c.fillStyle=BLT; c.beginPath(); c.moveTo(0,H*0.35); c.quadraticCurveTo(W*0.5,H*0.2,W,H*0.55); c.lineTo(W,H*0.65); c.quadraticCurveTo(W*0.5,H*0.3,0,H*0.45); c.fill(); }},
    B763:{belly:[NAVY,0.2], stripe:['#ffffff',0.2,0.205], win:'jet', eng:NAVY, fin:(c,W,H)=>{ c.fillStyle=NAVY; c.fillRect(0,0,W,H); c.fillStyle='#c8102e'; c.beginPath(); c.moveTo(W*0.35,0); c.lineTo(W,0); c.lineTo(W,H); c.lineTo(W*0.75,H); c.fill(); c.fillStyle='#e03a3e'; c.beginPath(); c.moveTo(W*0.55,0); c.lineTo(W,0); c.lineTo(W,H*0.6); c.fill(); }},
    A320:{belly:null, win:'jet', eng:'#ffffff', fin:(c,W,H)=>{ c.fillStyle='#ffffff'; c.fillRect(0,0,W,H); [['#00205b',0.0],['#2c7cc1',0.1],['#7fb8e6',0.2]].forEach(([col,o])=>{ c.fillStyle=col; c.beginPath(); c.moveTo(0,H*(0.05+o)); c.quadraticCurveTo(W*0.6,H*(0.0+o),W,H*(0.35+o)); c.lineTo(W,H*(0.43+o)); c.quadraticCurveTo(W*0.6,H*(0.08+o),0,H*(0.12+o)); c.fill(); }); }},
    A310:{belly:null, cheat:['#1aa0c8',0.25,0.258], win:'jet', eng:'#ffffff', fin:(c,W,H)=>{ c.fillStyle='#ffffff'; c.fillRect(0,0,W,H); c.fillStyle='#0d3b8c';   // big star on the fin
      const cx=W*0.62, cy=H*0.42, R1=H*0.3, R2=H*0.12; c.beginPath(); for(let i=0;i<10;i++){ const r=i%2?R2:R1, t=-Math.PI/2+i*Math.PI/5; c.lineTo(cx+Math.cos(t)*r*0.9,cy-Math.sin(t)*r); } c.fill(); c.fillStyle='#1aa0c8'; c.fillRect(0,0,W,H*0.08); }},
    A359:{belly:null, carbon:0.55, win:'jet', eng:'#ffffff', fin:(c,W,H)=>{ carbon(c,W,H,0); }},
  };
  function carbon(c,W,H,x0){ c.fillStyle='#262b33'; c.fillRect(x0,0,W-x0,H); c.strokeStyle='rgba(190,200,215,.35)'; c.lineWidth=2; const s=26;
    for(let x=x0-H;x<W;x+=s){ c.beginPath(); c.moveTo(x,0); c.lineTo(x+H,H); c.stroke(); c.beginPath(); c.moveTo(x+H,0); c.lineTo(x,H); c.stroke(); } }
  const texCache={};
  function canvasTex(key,w,h,paint){ if(texCache[key]) return texCache[key]; if(typeof document==='undefined') return null;
    const cv=document.createElement('canvas'); cv.width=w; cv.height=h; const c=cv.getContext('2d'); paint(c,w,h);
    const t=new THREE.CanvasTexture(cv); t.anisotropy=4; texCache[key]=t; return t; }
  // paint the fuselage: belly colour, stripes, passenger windows, cockpit windows, doors
  function paintBody(type,s,nl){ const lv=LIV[type]||LIV.A320, L=s.L;
    return canvasTex('body_'+type,512,2048,(c,W,H)=>{
      const band=(u0,u1,v0,v1,col)=>{ c.fillStyle=col; c.fillRect(u0*W,v0*H,(u1-u0)*W,(v1-v0)*H); c.fillRect((1-u1)*W,v0*H,(u1-u0)*W,(v1-v0)*H); };
      c.fillStyle='#f4f5f7'; c.fillRect(0,0,W,H);
      if(lv.carbon){ c.save(); c.beginPath(); c.rect(0,lv.carbon*H,W,H); c.clip(); carbon(c,W,H,0); c.restore();
        const g=c.createLinearGradient(0,(lv.carbon-0.06)*H,0,lv.carbon*H); g.addColorStop(0,'rgba(38,43,51,0)'); g.addColorStop(1,'rgba(38,43,51,1)'); c.fillStyle=g; c.fillRect(0,(lv.carbon-0.06)*H,W,0.06*H); }
      if(lv.belly){ c.fillStyle=lv.belly[0]; c.fillRect(0,0.02*H,lv.belly[1]*W,0.96*H); c.fillRect((1-lv.belly[1])*W,0.02*H,lv.belly[1]*W,0.96*H); }
      if(lv.stripe) band(lv.stripe[1],lv.stripe[2],0.03,0.97,lv.stripe[0]);
      if(lv.cheat) band(lv.cheat[1],lv.cheat[2],0.04,0.96,lv.cheat[0]);
      if(lv.cheat2) band(lv.cheat2[1],lv.cheat2[2],0.05,0.95,lv.cheat2[0]);
      // passenger windows
      const kind=lv.win, pitch=kind==='gulf'?1.05:kind==='bizjet'?0.9:kind==='prop'?0.82:kind==='ga'?9:0.53, ww=kind==='gulf'?0.55:kind==='bizjet'?0.42:0.26, wh=kind==='gulf'?0.026:kind==='prop'||kind==='bizjet'?0.022:0.018;
      const uw=kind==='ga'?0.33:0.305, v0=(nl*1.15+ (kind==='jet'?2.2:0.6))/L, v1=kind==='ga'?0:(kind==='prop'?0.78:kind==='gulf'||kind==='bizjet'?0.62:0.84);
      c.fillStyle=kind==='ga'?'#25313c':'#28323d';
      if(kind==='ga'){ band(0.29,0.43,1.0/L,3.4/L,'#2a3a48'); }
      else for(let z=v0*L; z<v1*L; z+=pitch){ const v=z/L; if(lv.carbon&&v>lv.carbon) c.fillStyle='#9aa6b5'; else c.fillStyle='#28323d';
        c.fillRect((uw-wh/2)*W,v*H,wh*W,ww/L*H); c.fillRect((1-uw-wh/2)*W,v*H,wh*W,ww/L*H); }
      // cockpit windows: dark band over the nose top
      c.fillStyle='#1c2530'; const cv0=(nl*0.55)/L, cv1=(nl*0.82)/L;
      c.beginPath(); c.moveTo(0.34*W,cv1*H); c.lineTo(0.40*W,cv0*H); c.lineTo(0.60*W,cv0*H); c.lineTo(0.66*W,cv1*H); c.fill();
      // doors (outline) for airliners
      if(kind==='jet'||kind==='prop'){ c.strokeStyle='rgba(90,100,112,.8)'; c.lineWidth=2; for(const vd of [(nl*1.15+0.4)/L,0.93]) for(const u of [0.27,0.73]){ c.strokeRect((u-0.035)*W,vd*H,0.07*W,1.0/L*H); } }
      if(lv.titles){ band(0.33,0.36,0.12,0.30,lv.titles); }
    }); }
  function paintFin(type){ const lv=LIV[type]||LIV.A320; return canvasTex('fin_'+type,512,512,(c,W,H)=>{ c.fillStyle='#f4f5f7'; c.fillRect(0,0,W,H); c.save(); c.translate(0,H); c.scale(1,-1); lv.fin(c,W,H); c.restore(); }); }
  // planar UVs over the bounding box (u along z, v along y) for fins
  function boxUV(g,flipU){ g.computeBoundingBox(); const b=g.boundingBox, p=g.attributes.position, uv=[];
    for(let i=0;i<p.count;i++){ const u=(p.getZ(i)-b.min.z)/((b.max.z-b.min.z)||1), v=(p.getY(i)-b.min.y)/((b.max.y-b.min.y)||1); uv.push(flipU?1-u:u,v); }
    g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); return g; }
  const WINGC='#d9dde2';
  // turbofan nacelle: intake lip, fat body, tapering cowl, exhaust cone; axis along z, intake toward -z
  function nacelle(r,len,col){ const g=new THREE.Group(), body=M(col);
    const prof=[[0,r*0.86],[len*0.04,r*0.97],[len*0.12,r],[len*0.45,r*0.98],[len*0.8,r*0.78],[len*0.92,r*0.66]];
    const geo=lathe(prof.map(([z,rr])=>[z-len/2,rr]),20); const n=new THREE.Mesh(geo,body); g.add(n);
    const lip=new THREE.Mesh(new THREE.TorusGeometry(r*0.9,r*0.07,8,24),M('#c9ced4')); lip.position.z=-len/2+0.02; g.add(lip);
    const fan=new THREE.Mesh(new THREE.CircleGeometry(r*0.86,20),M('#20262c')); fan.rotation.y=Math.PI; fan.position.z=-len/2+len*0.08; g.add(fan);
    const sp=new THREE.Mesh(new THREE.ConeGeometry(r*0.26,r*0.5,14),M('#c3c7cc')); sp.rotation.x=-Math.PI/2; sp.position.z=-len/2+len*0.08-r*0.2; g.add(sp);
    const ex=new THREE.Mesh(new THREE.ConeGeometry(r*0.42,len*0.28,14),M('#6b7178')); ex.rotation.x=Math.PI/2; ex.position.z=len/2-len*0.08+len*0.1; g.add(ex);
    return g; }

  function aircraft(type,airline){
    const s=S[type]||S.A320, g=new THREE.Group(), lv=LIV[type]||LIV.A320;
    const L=s.L, R=s.R, z0=-L/2; // nose at z0
    const nl=Math.min(L*0.13,R*(s.box?2.2:2.4)), tl=L*0.3;
    const bodyTex=paintBody(type,s,nl), finTex=paintFin(type);
    const body=bodyTex?new THREE.MeshLambertMaterial({map:bodyTex}):M(WHITE), finM=finTex?new THREE.MeshLambertMaterial({map:finTex}):M('#2f5d9e'), wingM=M(WINGC);
    // ---- fuselage (rounded nose, cylinder, tail cone with upsweep)
    const prof=[];
    for(let i=0;i<=10;i++){ const t=i/10; prof.push([z0+nl*t, R*Math.pow(1-(1-t)*(1-t),0.62)*(s.box?0.95:1)]); }
    prof.push([z0+L*0.5,R]); prof.push([z0+L-tl,R]);
    for(let i=1;i<=10;i++){ const t=i/10; prof.push([z0+L-tl+tl*t, R*(1-0.84*t*t)]); }
    const fg=lathe(prof,28); shiftUp(fg,z=>{ const t=(z-(z0+L-tl))/tl; return t>0?t*t*s.tailUp*R:0; });
    { const p=fg.attributes.position, uv=[]; for(let i=0;i<p.count;i++){ const a=Math.atan2(p.getX(i),-p.getY(i)); uv.push(((a/(2*Math.PI))+1)%1, 1-(p.getZ(i)-z0)/L); } fg.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); }
    if(bodyTex) bodyTex.flipY=true;
    const fus=new THREE.Mesh(fg,body); const fusY=s.gear.h+R*0.95; fus.position.y=fusY; g.add(fus);
    if(s.hump){ const hp=[]; const hl=L*0.38; for(let i=0;i<=12;i++){ const t=i/12; hp.push([z0+nl*0.45+hl*t, R*0.8*Math.pow(Math.sin(Math.PI*Math.min(1,t*1.6)),0.6)*(t<0.62?1:Math.max(0,1-(t-0.62)/0.38))]); }
      const hg=lathe(hp,18); const h=new THREE.Mesh(hg,M('#f4f5f7')); h.scale.set(0.84,1,1); h.position.y=fusY+R*0.52; g.add(h);
      for(const sd of [-1,1]){ const w=box(0.05,R*0.07,hl*0.55,M('#28323d')); w.position.set(sd*R*0.66,fusY+R*1.05,z0+nl*0.45+hl*0.32); g.add(w); } }
    // ---- wing
    const w=s.wing, half=w.span/2, xr=R*0.75, wo={xr, s:half-xr, cr:w.cr, ct:w.ct, sw:w.sw, dh:w.dh, tr:w.tr, tt:w.tr*0.45, zr:z0+w.zw};
    const wy=s.hw==='high'?fusY+R*0.9:fusY-R*0.62;
    for(const sd of [-1,1]){ const m=new THREE.Mesh(wingHalf(wo,sd),wingM); m.position.y=wy; g.add(m); }
    if(s.hw==='high'&&s.box){ // C172 struts
      for(const sd of [-1,1]){ const st=box(0.08,0.08,1,M(GREY)); const a=new THREE.Vector3(sd*R*0.9,fusY-R*0.6,z0+w.zw+0.5), b=new THREE.Vector3(sd*half*0.55,wy,z0+w.zw+0.5);
        st.position.copy(a.clone().add(b).multiplyScalar(0.5)); st.scale.z=a.distanceTo(b); st.lookAt(b); g.add(st); } }
    if(s.hw==='low'){ const wb=new THREE.Mesh(new THREE.SphereGeometry(1,16,10),M('#eef0f2')); wb.scale.set(R*0.95,R*0.45,w.cr*0.75); wb.position.set(0,fusY-R*0.62,z0+w.zw+w.cr*0.5); g.add(wb); }
    if(s.hw==='high'&&!s.box){ const wb=new THREE.Mesh(new THREE.SphereGeometry(1,16,10),M('#eef0f2')); wb.scale.set(R*0.7,R*0.3,w.cr*0.7); wb.position.set(0,fusY+R*0.85,z0+w.zw+w.cr*0.5); g.add(wb); }
    // winglets
    const tipX=half, tipZ=z0+w.zw+w.sw, tipY=wy+w.dh;
    if(s.winglet){ const wl=s.winglet; for(const sd of [-1,1]){
      const m=new THREE.Mesh(new THREE.BoxGeometry(0.14,wl.h,w.ct*(wl.type==='fence'?0.8:0.6)),type==='A359'?M('#262b33'):type==='A320'?M('#2c7cc1'):lv.eng!=='#ffffff'?M(lv.eng):wingM);
      m.position.set(sd*(tipX+0.05),tipY+wl.h/2*(wl.type==='fence'?0.4:1),tipZ+w.ct*0.55); m.rotation.z=sd*(wl.type==='blended'?-0.2:wl.type==='curved'?-0.35:wl.type==='sharklet'?-0.12:0);
      if(wl.type!=='fence') m.rotation.x=0.25;
      g.add(m); } }
    // ---- tail: fin + horizontal stabiliser
    const f=s.fin, fz=z0+L-f.cr-0.2-(s.T?0.3:0), fy=fusY+R*0.4+s.tailUp*R*0.6;
    const fin=new THREE.Mesh((()=>{ const P=[[0,fz],[f.h,fz+f.sw],[f.h,fz+f.sw+f.ct],[0,fz+f.cr]]; const gg=slab(P,[Math.max(0.12,R*0.18),R*0.1,R*0.07,R*0.12],0); gg.rotateZ(Math.PI/2); return boxUV(gg); })(),finM);
    fin.position.y=fy; g.add(fin);
    // dorsal fillet in front of the fin
    { const df=new THREE.Mesh(slab([[0,fz-f.cr*0.35],[f.h*0.16,fz+f.sw*0.16],[f.h*0.16,fz+f.cr*0.3],[0,fz+f.cr*0.3]],[R*0.2,R*0.1,R*0.1,R*0.2],0),M('#f4f5f7')); df.geometry.rotateZ(Math.PI/2); df.position.y=fy-R*0.05; g.add(df); }
    const h=s.ht, hy=s.T?fy+f.h-0.1:fusY+s.tailUp*R*0.8, hz=s.T?fz+f.sw+f.ct*0.1:z0+L-h.cr-0.6;
    for(const sd of [-1,1]){ const m=new THREE.Mesh(wingHalf({xr:s.T?0:R*0.35,s:h.span/2-(s.T?0:R*0.35),cr:h.cr,ct:h.ct,sw:h.sw,dh:s.T?0:0.4,tr:0.22,tt:0.1,zr:hz},sd),wingM); m.position.y=hy; g.add(m); }
    // ---- engines / props
    const props=[], e=s.eng, lights={}, engC=lv.eng||WHITE;
    if(e.type==='fan'){ for(const ex of e.x) for(const sd of [-1,1]){
      const x=sd*ex, zLe=z0+w.zw+(ex-xr)/(half-xr)*w.sw, ny=wy+(ex-xr)/(half-xr)*w.dh+e.y;
      const n=nacelle(e.r,e.len,engC); n.position.set(x,ny,zLe-e.len*0.42); g.add(n);
      const py=box(0.35,Math.abs(e.y)*0.9,e.len*0.95,M(engC===WHITE?'#e6e9ec':engC)); py.position.set(x,ny+Math.abs(e.y)*0.5,zLe-e.len*0.1); g.add(py); } }
    if(e.type==='rear'){ for(const sd of [-1,1]){ const n=nacelle(e.r,e.len,engC); n.position.set(sd*(R+e.r*0.95),fusY+e.y,z0+e.z); g.add(n);
      const py=box(e.r*1.2,0.22,e.len*0.55,M('#eef0f2')); py.position.set(sd*(R*0.85+e.r*0.3),fusY+e.y,z0+e.z+e.len*0.05); g.add(py); } }
    if(e.type==='prop'){ for(const sd of [-1,1]){ const x=sd*e.x, zLe=z0+w.zw;
      const n=lathe([[-e.len*0.5,e.r*0.35],[-e.len*0.42,e.r*0.85],[-e.len*0.2,e.r],[e.len*0.2,e.r*0.95],[e.len*0.5,e.r*0.35]],16); const nm=new THREE.Mesh(n,M(engC)); nm.scale.y=1.25; nm.position.set(x,wy-e.r*0.5,zLe+e.len*0.18); g.add(nm);
      const sp=cyl(0.01,e.r*0.42,0.9,14,M('#e6e9ec')); sp.position.set(x,wy-e.r*0.45,zLe-e.len*0.32-0.45); g.add(sp);
      const pr=new THREE.Group(); for(let b=0;b<e.blades;b++){ const bl=box(0.26,e.prop/2,0.06,M(DARK)); bl.position.y=e.prop/4; const hb=new THREE.Group(); hb.add(bl); hb.rotation.z=b*Math.PI*2/e.blades; pr.add(hb); }
      pr.position.set(x,wy-e.r*0.45,zLe-e.len*0.32-0.2); g.add(pr); props.push(pr); } }
    if(e.type==='nose'){ const sp=cyl(0.01,0.22,0.5,12,M(GREY)); sp.position.set(0,fusY,z0-0.15); g.add(sp);
      const pr=new THREE.Group(); for(let b=0;b<2;b++){ const bl=box(0.14,0.95,0.04,M(DARK)); bl.position.y=0.47; const hb=new THREE.Group(); hb.add(bl); hb.rotation.z=b*Math.PI; pr.add(hb); }
      pr.position.set(0,fusY,z0-0.05); g.add(pr); props.push(pr); }
    // ---- landing gear (group so it can retract)
    const gr=new THREE.Group(), G=s.gear, legH=G.h;
    const leg=(x,z,n)=>{ const l=box(0.18*Math.max(1,R/1.5),legH,0.18*Math.max(1,R/1.5),M(METAL)); l.position.set(x,legH/2+G.wr*0.5,z); gr.add(l);
      const pairs=n>=2?[-1,1]:[0]; const rows=n>=4?[-0.7,0.7]:[0];
      for(const r of rows) for(const p of pairs){ const wh=wheel(G.wr,G.wr*0.6); wh.position.set(x+p*G.wr*0.75,G.wr,z+r*G.wr*2.4); gr.add(wh); } };
    leg(0,z0+G.nose,G.mainCount>=2?2:1);
    for(const sd of [-1,1]) leg(sd*G.track/2,z0+G.main,G.mainCount);
    if(G.bodyGear) for(const sd of [-1,1]) leg(sd*G.track*0.28,z0+G.main+1.8,4);
    if(G.fixed){ for(const sd of [-1,1]){ const sp=box(0.3,0.5,0.8,M(WHITE)); sp.position.set(sd*G.track/2,G.wr,z0+G.main); gr.add(sp); } }
    g.add(gr);
    // ---- light anchors (used by the lighting phase)
    lights.navL=[-tipX,tipY,tipZ+w.ct*0.3]; lights.navR=[tipX,tipY,tipZ+w.ct*0.3]; lights.tail=[0,fusY+s.tailUp*R,z0+L];
    lights.beaconTop=[0,fusY+R*(s.hump?1.6:1.02),z0+L*0.5]; lights.beaconBot=[0,fusY-R*1.02,z0+L*0.45];
    lights.strobeL=lights.navL.slice(); lights.strobeR=lights.navR.slice(); lights.landing=[0,G.wr*2+legH*0.6,z0+G.nose-0.2]; lights.taxi=lights.landing.slice();
    g.userData={gear:gr,gearFixed:!!G.fixed,props,lights,spec:s,flashers:[]};
    // real-type 3D model (glTF) when one is loaded: hide the hand-built airframe, keep the retractable gear and light anchors
    if(GLB[type]){ const T=GLB[type], own=T.userData.hasGear;
      for(const c of g.children) if(own||c!==gr) c.visible=false;
      const m=T.clone(); m.position.set(0,own?0:fusY-R,z0); g.add(m); g.userData.glb=true;
      if(own){ g.userData.gear=m.getObjectByName('gear'); g.userData.glbGear=true; }
      g.userData.wheels=(T.userData.wheels||[]).map(w=>({n:m.getObjectByName(w.name),r:w.r})).filter(w=>w.n); }
    return g;
  }
  // ---------- glTF models of the real types ----------
  // GLB[type] = template group: nose at z=0 pointing -Z, belly (lowest fuselage point) at y=0, centred on x, length = spec L.
  const GLB={};
  function useGLB(type,root,noseAxis,recolor){
    const s=S[type]; if(!s) return;
    const piv=new THREE.Group(); piv.add(root); piv.rotation.y=noseAxis==='+x'?Math.PI/2:noseAxis==='-x'?-Math.PI/2:0; piv.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(piv), len=box.max.z-box.min.z, cx=(box.min.x+box.max.x)/2, v=new THREE.Vector3();
    let belly=Infinity; const z1=box.min.z+len*0.3, z2=box.min.z+len*0.6;
    root.traverse(o=>{ if(!o.isMesh) return; const P=o.geometry.attributes.position;
      for(let i=0;i<P.count;i++){ v.fromBufferAttribute(P,i).applyMatrix4(o.matrixWorld); if(Math.abs(v.x-cx)<0.6&&v.z>z1&&v.z<z2&&v.y<belly) belly=v.y; } });
    if(!isFinite(belly)) belly=box.min.y;
    const gearN=root.getObjectByName('gear'), hasGear=!!gearN; if(hasGear) belly=box.min.y;   // model brings its own landing gear: wheels on the ground
    // wheels (nodes 'wheel_N', geometry centred on the axle): kept under the gear so they retract with it, spun while rolling
    const wheels=[]; const wl=[]; root.traverse(o=>{ if(/^wheel_\d+$/.test(o.name)) wl.push(o); });
    for(const w of wl){ const b=new THREE.Box3().setFromObject(w); wheels.push({name:w.name,r:Math.max(0.2,(b.max.y-b.min.y)/2)}); if(gearN) gearN.attach(w); }
    const k=s.L/len; piv.scale.setScalar(k); piv.position.set(-cx*k,-belly*k,-box.min.z*k);
    root.traverse(o=>{ if(!o.isMesh) return; const old=Array.isArray(o.material)?o.material[0]:o.material;
      if(old.map&&recolor&&old.map.image&&!old.map.__rc){ old.map.__rc=1;   // pixel recolour of the model's own paint (e.g. green -> Boeing blue)
        const im=old.map.image, c=document.createElement('canvas'); c.width=im.width; c.height=im.height; const x=c.getContext('2d'); x.drawImage(im,0,0);
        const d=x.getImageData(0,0,c.width,c.height), a=d.data; for(let i=0;i<a.length;i+=4) recolor(a,i); x.putImageData(d,0,0); old.map.image=c; old.map.needsUpdate=true; }
      if(old.map) old.map.encoding=THREE.LinearEncoding;   // same colour handling as the canvas-painted textures
      o.material=new THREE.MeshLambertMaterial({map:old.map||null,color:old.map?'#ffffff':old.color,side:THREE.DoubleSide,alphaTest:old.alphaTest||0,transparent:!!old.transparent,opacity:old.opacity}); });
    const t=new THREE.Group(); t.add(piv); t.userData.hasGear=hasGear; t.userData.wheels=wheels.map(w=>({name:w.name,r:w.r*k})); GLB[type]=t; }

  // ---------- vehicles ----------
  // beacon glow: additive sprite with a fixed on-screen size, so the flash reads from the tower at any zoom
  let GLOWTEX=null; function glowTex(){ if(GLOWTEX) return GLOWTEX; const c=document.createElement('canvas'); c.width=c.height=64; const x=c.getContext('2d'), gr=x.createRadialGradient(32,32,0,32,32,32);
    gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(0.25,'rgba(255,255,255,0.85)'); gr.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=gr; x.fillRect(0,0,64,64); GLOWTEX=new THREE.CanvasTexture(c); return GLOWTEX; }
  function glow(c){ const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex(),color:c,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,depthTest:false,sizeAttenuation:false})); s.renderOrder=10; s.scale.set(0.016,0.016,1); s.visible=false; return s; }
  function lightBar(g,y,z,w,colors,fl,rate){ colors.forEach((c,i)=>{ const on=M(c,true), off=M(new THREE.Color(c).multiplyScalar(0.18).getStyle(),true);
      const m=box(w/colors.length*0.9,0.3,0.4,on); m.position.set(-w/2+(i+0.5)*w/colors.length,y,z); g.add(m);
      const sp=glow(c); sp.position.copy(m.position); sp.position.y+=0.2; g.add(sp); fl.push({m,on,off,sp,ph:i%2?0.5:0,rate:rate||2.2}); }); }
  function wheelsOn(g,xs,zs,r,w){ for(const z of zs) for(const x of xs){ const wh=wheel(r,w); wh.position.set(x,r,z); g.add(wh); } }
  const V={
    fire(){ // ARFF 6x6, red, roof turret, white stripes
      const g=new THREE.Group(), fl=[], red=M('#c8161d');
      const cab=box(2.9,2.4,2.6,red); cab.position.set(0,2.0,-4.6); g.add(cab);
      const ws=box(2.7,1.0,0.1,M(GLASS)); ws.position.set(0,2.6,-5.92); g.add(ws);
      const bd=box(3.0,2.8,7.6,red); bd.position.set(0,2.3,0.6); g.add(bd);
      const st=box(3.02,0.18,7.6,M(WHITE)); st.position.set(0,1.6,0.6); g.add(st);
      const tur=cyl(0.12,0.18,2.2,8,M(GREY)); tur.position.set(0,3.6,-5.0); g.add(tur);
      wheelsOn(g,[-1.3,1.3],[-4.3,1.2,3.4],0.7,0.6); lightBar(g,3.3,-4.2,2.4,['#0a3cff','#ff0010','#0a3cff','#ff0010'],fl,2.5);
      g.userData={flashers:fl,lights:{}}; return g; },
    police(){ // electric SUV, white/blue, blue-red bar
      const g=new THREE.Group(), fl=[];
      const b=box(1.9,0.9,4.6,M(WHITE)); b.position.y=0.85; g.add(b);
      const up=box(1.75,0.65,2.6,M(WHITE)); up.position.set(0,1.6,0.2); g.add(up);
      const gl=box(1.77,0.45,2.62,M(GLASS)); gl.position.set(0,1.62,0.2); g.add(gl);
      const bl=box(1.92,0.32,3.0,M('#1f4fc2')); bl.position.set(0,0.85,0.3); g.add(bl);
      wheelsOn(g,[-0.85,0.85],[-1.45,1.45],0.38,0.3); lightBar(g,2.0,0.1,1.2,['#0a3cff','#ff0010'],fl,3);
      g.userData={flashers:fl,lights:{}}; return g; },
    ambulance(){ // high-roof van, white with red band
      const g=new THREE.Group(), fl=[];
      const b=box(2.0,2.4,5.6,M(WHITE)); b.position.set(0,1.55,0.3); g.add(b);
      const hood=box(1.9,0.9,0.9,M(WHITE)); hood.position.set(0,0.85,-2.85); g.add(hood);
      const ws=box(1.8,0.7,0.1,M(GLASS)); ws.position.set(0,1.75,-2.48); g.add(ws);
      const rb=box(2.02,0.3,5.6,M('#d81f26')); rb.position.set(0,1.2,0.3); g.add(rb);
      wheelsOn(g,[-0.9,0.9],[-2.0,1.9],0.38,0.3); lightBar(g,2.85,-2.1,1.4,['#0a3cff','#ff0010','#0a3cff'],fl,3);
      g.userData={flashers:fl,lights:{}}; return g; },
    follow(){ // yellow pickup with FOLLOW ME board and amber beacons
      const g=new THREE.Group(), fl=[], y=M('#f2c230');
      const b=box(1.9,0.9,5.2,y); b.position.y=0.8; g.add(b);
      const cab=box(1.8,0.8,2.0,y); cab.position.set(0,1.6,-0.9); g.add(cab);
      const gl=box(1.82,0.5,2.02,M(GLASS)); gl.position.set(0,1.65,-0.9); g.add(gl);
      const board=box(1.6,0.7,0.12,M('#111')); board.position.set(0,2.4,0.4); g.add(board);
      for(let i=0;i<4;i++){ const c=box(0.4,0.35,0.13,M('#f2c230')); c.position.set(-0.6+i*0.4,2.4+(i%2?0.17:-0.17),0.4); g.add(c); }
      wheelsOn(g,[-0.85,0.85],[-1.7,1.7],0.4,0.3); lightBar(g,2.05,-0.9,1.4,['#ff9a00','#ff9a00'],fl,1.8);
      g.userData={flashers:fl,lights:{}}; return g; },
    bus(){ // low-floor apron bus, white with black glass band
      const g=new THREE.Group();
      const b=box(3.0,2.8,13.8,M(WHITE)); b.position.y=1.7; g.add(b);
      for(const sd of [-1,1]){ const gl=box(0.05,1.6,12.6,M(GLASS)); gl.position.set(sd*1.51,1.9,0); g.add(gl); }
      const fr=box(2.8,1.8,0.06,M(GLASS)); fr.position.set(0,2.0,-6.92); g.add(fr);
      const roof=box(2.6,0.25,8,M('#d8dbe0')); roof.position.set(0,3.2,0); g.add(roof);
      wheelsOn(g,[-1.3,1.3],[-4.4,4.2],0.5,0.4);
      g.userData={flashers:[],lights:{}}; return g; },
    catering(){ // truck: white cab, white box on scissor lift, yellow platform
      const g=new THREE.Group();
      const cab=box(2.4,2.3,2.2,M(WHITE)); cab.position.set(0,1.7,-3.6); g.add(cab);
      const ws=box(2.2,0.9,0.1,M(GLASS)); ws.position.set(0,2.2,-4.72); g.add(ws);
      const ch=box(2.3,0.5,7,M(DARK)); ch.position.set(0,0.9,0.2); g.add(ch);
      const sc=box(1.8,1.0,5,M(DARK)); sc.position.set(0,1.6,0.8); sc.rotation.x=0.08; g.add(sc);
      const bx=box(2.5,2.6,6.2,M(WHITE)); bx.position.set(0,3.4,0.9); g.add(bx);
      const pf=box(2.5,0.15,1.8,M('#f2b705')); pf.position.set(0,4.8,-2.9); g.add(pf);
      const rl=box(2.5,0.9,0.06,M('#f2b705')); rl.position.set(0,5.3,-3.8); g.add(rl);
      wheelsOn(g,[-1.1,1.1],[-3.4,2.6],0.5,0.4);
      const fl=[]; lightBar(g,2.95,-3.6,0.5,['#ff9a00'],fl,1.5);
      g.userData={flashers:fl,lights:{}}; return g; },
  };
  // towbarless pushback tug (TLD/Goldhofer style): low yellow chassis, side cab, nose-wheel cradle at the front.
  // Origin = cradle centre (where the aircraft nose wheel sits); the tug body extends toward +z behind it.
  function tug(){ const g=new THREE.Group(), fl=[], y=M('#f2b705'), blk=M(DARK);
    const ch=box(3.6,1.0,7.2,y); ch.position.set(0,0.95,3.9); g.add(ch);
    for(const sd of [-1,1]){ const arm=box(0.55,0.7,2.6,y); arm.position.set(sd*1.35,0.75,-0.1); g.add(arm); }
    const cr=box(2.1,0.25,1.6,blk); cr.position.set(0,0.35,0); g.add(cr);                      // cradle plate under the nose wheel
    const bump=box(3.7,0.35,0.3,blk); bump.position.set(0,0.75,7.55); g.add(bump);
    const cab=box(1.5,1.3,2.0,y); cab.position.set(1.0,2.1,4.6); g.add(cab);
    const gl=box(1.52,0.75,2.02,M(GLASS)); gl.position.set(1.0,2.35,4.6); g.add(gl);
    const roof=box(1.6,0.12,2.1,y); roof.position.set(1.0,2.8,4.6); g.add(roof);
    const st=box(3.62,0.16,7.2,blk); st.position.set(0,1.25,3.9); g.add(st);                    // black band
    const W=[]; for(const z of [2.0,6.2]) for(const sd of [-1,1]){ const wh=wheel(0.62,0.55); wh.position.set(sd*1.55,0.62,z); g.add(wh); W.push({n:wh,r:0.62}); }
    lightBar(g,1.62,6.6,0.5,['#ff9a00'],fl,1.6);
    g.userData={flashers:fl,lights:{},tugWheels:W}; return g; }
  const VTYPE={'Fire truck':'fire','Police':'police','Ambulance':'ambulance','Follow-me':'follow','Passenger bus':'bus','Catering truck':'catering'};
  // real vehicle models (glTF): the file's front axis is turned to -z, the model is scaled to the vehicle's real length,
  // centred and set on the ground; the beacons of the hand-made model are kept on top of it
  const VGLB={}, VLEN={'Fire truck':12,'Police':4.6,'Ambulance':6.5,'Follow-me':4.4,'Passenger bus':13.8,'Catering truck':9};
  function useVehGLB(type,root,axis){
    const piv=new THREE.Group(); piv.add(root); piv.rotation.y={'+x':Math.PI/2,'-x':-Math.PI/2,'+z':Math.PI,'-z':0}[axis]||0; piv.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(piv), k=(VLEN[type]||6)/(box.max.z-box.min.z);
    piv.scale.setScalar(k); piv.position.set(-(box.min.x+box.max.x)/2*k,-box.min.y*k,-(box.min.z+box.max.z)/2*k);
    root.traverse(o=>{ if(!o.isMesh) return; const old=Array.isArray(o.material)?o.material[0]:o.material; if(old.map) old.map.encoding=THREE.LinearEncoding;
      o.material=new THREE.MeshLambertMaterial({map:old.map||null,color:old.map?'#ffffff':old.color,side:THREE.DoubleSide,alphaTest:old.alphaTest||0,transparent:!!old.transparent,opacity:old.opacity}); });
    const t=new THREE.Group(); t.add(piv); t.userData.h=(box.max.y-box.min.y)*k; VGLB[type]=t; }
  function vehicle(type){ const f=V[VTYPE[type]]||V.follow, g=f(); const T=VGLB[type]; if(!T) return g;
    // keep only the beacons (and their glow) of the hand-made vehicle, lifted to the roof of the real model
    const keep=new Set(); for(const fl of g.userData.flashers||[]){ keep.add(fl.m); if(fl.sp) keep.add(fl.sp); }
    const top=Math.max(...[...keep].map(o=>o.position.y)); const dy=T.userData.h+0.15-top+0.2;
    for(const c of [...g.children]) if(!keep.has(c)) g.remove(c); else { c.position.y+=dy; c.position.z*=0.6; }
    g.add(T.clone()); return g; }
  // flasher animation: call every frame with time in seconds
  function animate(g,t,state){
    const u=g.userData; if(!u) return;
    (u.flashers||[]).forEach(f=>{ const on=((t*f.rate+f.ph)%1)<0.45; f.m.material=on?f.on:f.off; if(f.sp) f.sp.visible=on; });
    if(u.props&&u.props.length){ const sp=state&&state.eng?(state.ias>5?40:25):0; u.props.forEach(p=>p.rotation.z+=sp*0.016); }
  }
  return { aircraft, vehicle, tug, animate, useGLB, useVehGLB, hasVehGLB:t=>!!VGLB[t], hasGLB:t=>!!GLB[t], SPEC:S, VTYPE };
})();
// ---------- fire effect for a crash (GND-05) ----------
MODELS.fire=function(size){ const g=new THREE.Group(), k=size||1, parts=[];
  const fm=[new THREE.MeshBasicMaterial({color:'#ff7a00',transparent:true,opacity:0.85,depthWrite:false}),new THREE.MeshBasicMaterial({color:'#ffd23a',transparent:true,opacity:0.8,depthWrite:false}),new THREE.MeshBasicMaterial({color:'#ff3b00',transparent:true,opacity:0.75,depthWrite:false})];
  const sm=new THREE.MeshLambertMaterial({color:'#2d2d2d',transparent:true,opacity:0.55,depthWrite:false});
  for(let i=0;i<14;i++){ const c=new THREE.Mesh(new THREE.ConeGeometry(2.2*k,7*k,7),fm[i%3]); c.position.set((Math.random()-0.5)*14*k,3.5*k,(Math.random()-0.5)*14*k); c.userData={ph:Math.random()*6,s:0.7+Math.random()*0.8}; g.add(c); parts.push(c); }
  const smoke=[]; for(let i=0;i<10;i++){ const m=new THREE.Mesh(new THREE.SphereGeometry(4*k,8,6),sm); m.userData={ph:Math.random(),x:(Math.random()-0.5)*8*k,z:(Math.random()-0.5)*8*k}; g.add(m); smoke.push(m); }
  g.userData={flashers:[],fire:{parts,smoke,k}}; return g; };
MODELS.animateFire=function(g,t){ const F=g.userData.fire; if(!F) return;
  F.parts.forEach(c=>{ const u=c.userData, f=0.75+0.35*Math.sin(t*9+u.ph)+0.15*Math.sin(t*23+u.ph*2); c.scale.set(u.s*f,u.s*(0.8+0.5*f),u.s*f); c.position.y=3.5*F.k*u.s*(0.8+0.5*f); });
  F.smoke.forEach(m=>{ const u=m.userData, ph=((t*0.12+u.ph)%1); m.position.set(u.x+ph*12*F.k,10*F.k+ph*60*F.k,u.z); m.scale.setScalar(0.6+ph*2.2); }); };
