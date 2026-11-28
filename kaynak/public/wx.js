// ===================== shared weather model (TWR SİM) =====================
// The pilot/instructor owns the inputs; everything else is computed here.
// Used by pilot.html (authoritative) and tower.html (read-only display).
const WXM = (()=>{
  const pad3=v=>String(Math.round(((v%360)+360)%360)||360).padStart(3,'0');
  const qfe=(qnh,ft)=>qnh*Math.pow(1-0.0065*(ft*0.3048)/288.15,5.255);
  const inHg=h=>h*0.0295300;
  const dewFromRH=(T,RH)=>{ const a=17.625,b=243.04, g=Math.log(Math.max(1,RH)/100)+a*T/(b+T); return b*g/(a-g); };
  const qff=(qfeH,ft,T)=>qfeH*Math.exp(9.80665*(ft*0.3048)/(287.05*(T+273.15+0.0065*(ft*0.3048)/2)));
  // inputs (what the instructor types)
  const defaults={ dirMin:20, dirMax:40, spdMin:6, spdMax:10, QNH:1013, T:15, RH:63, vis:9999, cbase:'NCD', rvr:'P2000',
                   Tmax:18, Tmin:7, rwyT:16, precip:'none', intensity:'mod', storm:false, gust:null };
  // a smooth pseudo-random walk between 0..1
  function walker(seed){ let v=Math.random(), t=Math.random(), s=seed; return dt=>{ t+=dt*(0.15+0.1*Math.sin(s+=dt*0.07)); v=0.5+0.5*Math.sin(t*1.7+Math.sin(t*0.6)*2.1); return v; }; }
  function create(){
    const st={ inp:Object.assign({},defaults), hist:[], cur:{dir:30,spd:8}, wd:walker(1.3), ws:walker(4.1), t:0 };
    // instantaneous wind, called every second by the owner
    st.tick=function(dt){
      const I=st.inp; st.t+=dt;
      // a new wind typed by the instructor takes effect at once: the 2' and 10' figures start over from the new wind
      const wk=[I.dirMin,I.dirMax,I.spdMin,I.spdMax].join(','); if(st.wk!==undefined&&st.wk!==wk) st.hist.length=0; st.wk=wk;
      const span=((I.dirMax-I.dirMin)%360+360)%360;
      let dir=I.dirMin+span*st.wd(dt), spd=I.spdMin+(I.spdMax-I.spdMin)*st.ws(dt);
      if(I.storm){ spd+= (Math.random()<0.15? 8+Math.random()*10 : 0); dir+=(Math.random()-0.5)*40; }
      if(I.gust && I.gust.until>Date.now()){ dir=I.gust.dir+(Math.random()-0.5)*10; spd=I.gust.spd+(Math.random()-0.5)*4; }
      else if(I.gust) I.gust=null;
      st.cur={ dir:((dir%360)+360)%360, spd:Math.max(0,spd) };
      st.hist.push([Date.now(),st.cur.dir,st.cur.spd]);
      const cut=Date.now()-600000; while(st.hist.length&&st.hist[0][0]<cut) st.hist.shift();
    };
    st.snapshot=function(elev){ return { inp:st.inp, cur:st.cur, hist:st.hist.slice(-600) }; };
    return st;
  }
  // statistics over the last n seconds
  function stats(hist,sec){
    const cut=Date.now()-sec*1000, h=hist.filter(r=>r[0]>=cut); if(!h.length) return null;
    let sx=0,sy=0,sm=0,mn=1e9,mx=-1,dmn=null,dmx=null;
    h.forEach(([,d,s])=>{ const r=d*Math.PI/180; sx+=Math.sin(r)*s; sy+=Math.cos(r)*s; sm+=s; if(s<mn){mn=s;dmn=d;} if(s>mx){mx=s;dmx=d;} });
    const ad=(Math.atan2(sx,sy)*180/Math.PI+360)%360;
    return { min:Math.round(mn), ave:Math.round(sm/h.length), max:Math.round(mx), dMin:dmn, dAve:ad, dMax:dmx };
  }
  function derived(inp,elev){
    const Td=dewFromRH(inp.T,inp.RH), qfeA=qfe(inp.QNH,elev);
    return { Td, qfe:qfeA, qff:qff(qfeA,elev,inp.T), inHgQNH:inHg(inp.QNH) };
  }
  function presentWx(inp){
    const p={none:'',RA:'RA',SN:'SN',DZ:'DZ'}[inp.precip]||'', i={light:'-',mod:'',heavy:'+'}[inp.intensity]||'';
    let s=''; if(inp.storm) s=(i)+'TS'+p; else if(p) s=i+p;
    return s||'NSW';
  }
  return { create, stats, derived, presentWx, pad3, qfe, inHg };
})();

// ---------- shared AWOS rendering (same look on ATC and pilot screens) ----------
const AWOS = (()=>{
  const css=`
  .aw{font-family:"Helvetica Neue",Helvetica,Arial,system-ui,sans-serif;color:#111;font-variant-numeric:tabular-nums}
  .aw-card{background:#fff;border:1px solid #c8cbc6;border-radius:3px;padding:4px 5px 5px}
  .aw-rn{font-weight:700;font-size:18px;line-height:1;padding:2px 2px 0;letter-spacing:.01em}
  .aw-dial{display:block;width:100%;max-width:170px;height:auto;margin:0 auto}
  .aw table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:11px;margin-top:5px}
  .aw td{border:1px solid #d3d5d0;padding:2px 4px;height:19px;white-space:nowrap;overflow:hidden}
  .aw td:nth-child(1){width:42%}
  .aw td:nth-child(2){width:33%;text-align:center;font-weight:700}
  .aw td:nth-child(3){text-align:right;color:#333}
  .aw tr.r td{border-top:2px solid #d22}.aw tr.b td{border-top:2px solid #2357c9}.aw tr.y td{border-top:2px solid #e3b300}
  .aw-clock{font:700 30px/1.1 "Helvetica Neue",Helvetica,Arial,sans-serif;text-align:center;letter-spacing:.02em;padding:4px 0 6px}`;
  try{ const st=document.createElement('style'); st.textContent=css; document.head.appendChild(st); }catch(e){}
  const pad3=WXM.pad3;
  function dial(qfu,inp,cur){
    const cx=100,cy=100,r=62,rad=d=>(d-90)*Math.PI/180,P=(d,k)=>[+(cx+k*Math.cos(rad(d))).toFixed(1),+(cy+k*Math.sin(rad(d))).toFixed(1)];
    let s=`<svg class="aw-dial" viewBox="0 0 200 200" role="img" aria-label="wind ${pad3(cur.dir)} ${Math.round(cur.spd)} kt">`;
    s+=`<circle cx="${cx}" cy="${cy}" r="${r}" fill="#d6d8d4" stroke="#555" stroke-width="1.2"/>`;
    for(let d=0;d<360;d+=10){ const big=d%30===0, [x1,y1]=P(d,r), [x2,y2]=P(d,r-(big?8:5)); s+=`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#222" stroke-width="${big?1.6:1}"/>`; }
    for(let d=30;d<=360;d+=30){ const [x,y]=P(d,r+15); s+=`<text x="${x}" y="${y}" font-size="13" font-family="Helvetica Neue,Helvetica,Arial,sans-serif" text-anchor="middle" dominant-baseline="central" fill="#111">${String(d/10).padStart(2,'0')}</text>`; }
    // variability band on the rim
    const span=((inp.dirMax-inp.dirMin)%360+360)%360;
    if(span>0){ const a0=P(inp.dirMin,r+3),a1=P(inp.dirMax,r+3); s+=`<path d="M${a0} A${r+3},${r+3} 0 ${span>180?1:0} 1 ${a1}" fill="none" stroke="#1e9a46" stroke-width="5"/>`; }
    // runway axis
    const [r1x,r1y]=P(qfu,r-10),[r2x,r2y]=P(qfu+180,r-10);
    s+=`<line x1="${r1x}" y1="${r1y}" x2="${r2x}" y2="${r2y}" stroke="#111" stroke-width="4" stroke-linecap="round"/>`;
    // wind arrow: points to the direction the wind comes FROM, head on the rim
    const d=cur.dir, [tx,ty]=P(d,r-1), [bx,by]=P(d,r-34), h1=P(d-8,r-15), h2=P(d+8,r-15);
    const [ex,ey]=P(d,r-14); s+=`<line x1="${bx}" y1="${by}" x2="${ex}" y2="${ey}" stroke="#1e9a46" stroke-width="5"/>`;
    s+=`<polygon points="${tx},${ty} ${h1} ${h2}" fill="#1e9a46"/>`;
    s+=`<rect x="${cx-25}" y="${cy-12}" width="50" height="24" rx="3" fill="#fff" stroke="#444"/>`;
    s+=`<text x="${cx}" y="${cy}" font-size="13" font-weight="700" font-family="Helvetica Neue,Helvetica,Arial,sans-serif" text-anchor="middle" dominant-baseline="central">${Math.round(cur.spd)} kt</text>`;
    return s+'</svg>';
  }
  const row=(a,b,c,cls)=>`<tr${cls?` class="${cls}"`:''}><td>${a}</td><td>${b}</td><td>${c}</td></tr>`;
  const sp=v=>v==null?'---':String(v).padStart(3,'0'), dg=v=>v==null?'---°':pad3(v)+'°';
  const dg10=v=>v==null?'---°':pad3((Math.round(v/10)*10)%360||360)+'°';   // wind direction as given to aircraft: nearest 10°
  function card(end,qfu,elevEnd,w){
    const s2=WXM.stats(w.hist,120)||{}, s10=WXM.stats(w.hist,600)||{}, f=WXM.qfe(w.inp.QNH,elevEnd);
    return `<div class="aw-card"><div class="aw-rn">${end}</div>${dial(qfu,w.inp,w.cur)}
      <table>${row("2' MIN",sp(s2.min),dg10(s2.dMin))}${row("2' AVE",sp(s2.ave),dg10(s2.dAve))}${row("2' MAX",sp(s2.max),dg10(s2.dMax))}</table>
      <table>${row("10' MIN",sp(s10.min),dg10(s10.dMin))}${row("10' AVE",sp(s10.ave),dg10(s10.dAve))}${row("10' MAX",sp(s10.max),dg10(s10.dMax))}</table>
      <table>${row('QFE',f.toFixed(1),'hPa')}${row('QFE',WXM.inHg(f).toFixed(2),'inHg')}</table></div>`;
  }
  function met(w,elev){
    const I=w.inp, D=WXM.derived(I,elev);
    const L=`<table>${row('T',(+I.T).toFixed(1),'°C')}${row('Td',D.Td.toFixed(1),'°C')}${row('RH',(+I.RH).toFixed(1),'%')}${row('QNH',(+I.QNH).toFixed(2),'hPa')}${row('QNH',D.inHgQNH.toFixed(2),'inHg')}${row('QFF',D.qff.toFixed(1),'hPa')}${row('Synop QFE',D.qfe.toFixed(1),'hPa')}</table>`;
    const R=`<table>${row('Tmax',(+I.Tmax).toFixed(1),'°C','r')}${row('Tmin',(+I.Tmin).toFixed(1),'°C','b')}${row('Rwy T',(+I.rwyT).toFixed(1),'°C','y')}${row('VIS',I.vis,'m')}${row('CBase',I.cbase,'')}${row('RVR A/B/C',I.rvr,'')}${row('WX',WXM.presentWx(I),'')}</table>`;
    return [L,R];
  }
  const clock=()=>{ const d=new Date(); return [d.getUTCHours(),d.getUTCMinutes(),d.getUTCSeconds()].map(v=>String(v).padStart(2,'0')).join(':')+' UTC'; };
  return { card, met, clock, dial };
})();
