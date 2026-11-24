// ===================== TWR SİM network client (state sync, voice, floor control) =====================
// Idle unless the page is served by the TWR SİM server (it needs /ws on the same host).
const NET = (()=>{
  const api={ server:false, on:false, id:null, admin:false, peers:[], floor:{radio:null,phone:null}, send(){}, sendState(){}, start(){} };
  const isServer=/^https?:$/.test(location.protocol) && !/claude\.ai|claudeusercontent|localhost:8765/.test(location.host);
  if(!isServer) return api; api.server=true;
  let ws=null, opts=null, mic=null, wantTx={radio:false,phone:false};
  const pcs=new Map(), audios=new Map();
  const ICE={iceServers:[{urls:'stun:stun.l.google.com:19302'}]};
  function myName(){ try{ const u=JSON.parse(localStorage.getItem('twrsim.user')||'null'); if(u&&u.name) return u.name; }catch(e){}
    let n=''; try{ n=localStorage.getItem('twrsim.guest')||''; }catch(e){}
    if(!n){ n=(prompt('Adın / çağrı adın:')||'').trim()||('Misafir'+Math.floor(Math.random()*90+10)); try{ localStorage.setItem('twrsim.guest',n); }catch(e){} }
    return n; }
  function key(){ const k=new URLSearchParams(location.search).get('key'); return k||''; }
  function connect(){
    ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws');
    ws.onopen=()=>{ api.on=true; ws.send(JSON.stringify({t:'hello',name:myName(),role:opts.role,key:key()})); ui(); };
    ws.onclose=()=>{ api.on=false; pcs.forEach(pc=>pc.close()); pcs.clear(); ui(); if(!api.kicked) setTimeout(connect,2000); };
    ws.onmessage=e=>{ let m; try{ m=JSON.parse(e.data); }catch(x){ return; } handle(m); };
  }
  api.send=m=>{ try{ ws&&ws.readyState===1&&ws.send(JSON.stringify(m)); }catch(e){} };
  api.sendState=s=>api.send({t:'state',state:s});
  function handle(m){
    switch(m.t){
      case 'welcome': api.id=m.id; api.admin=m.admin; api.peers=m.peers; api.floor=m.floor; if(m.state&&opts.onState) opts.onState(m.state);
        m.peers.forEach(p=>{ if(p.id!==api.id) call(p.id); }); peersChanged(); break;
      case 'peers': api.peers=m.peers; api.floor=m.floor; api.admin=!!(m.peers.find(p=>p.id===api.id)||{}).admin; peersChanged(); break;
      case 'leave': { const pc=pcs.get(m.id); if(pc) pc.close(); pcs.delete(m.id); const a=audios.get(m.id); if(a) a.remove(); audios.delete(m.id); break; }
      case 'state': opts.onState&&opts.onState(m.state,m.from); break;
      case 'cmd': opts.onCmd&&opts.onCmd(m.cmd,m.from); break;
      case 'floor': api.floor[m.ch]=m.holder; txUpdate(); ui(); break;
      case 'deny': wantTx[m.ch]=false; flashMsg(m.why==='busy'?'Frekans meşgul: karşı taraf bırakmadan konuşamazsın.':'Konuşma iznin kapalı (yönetici).'); ui(); break;
      case 'rtc': rtc(m.from,m.data); break;
      case 'kicked': api.kicked=true; alert('Oturumdan çıkarıldın.'); break;
    }
  }
  // ---------- voice ----------
  async function ensureMic(){ if(mic) return mic;
    try{ mic=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1}});
      mic.getAudioTracks().forEach(t=>t.enabled=false);
      pcs.forEach(pc=>pc.getTransceivers().forEach(t=>t.sender.replaceTrack(mic.getAudioTracks()[0])));
    }catch(e){ flashMsg('Mikrofon izni verilmedi. Tarayıcıdan izin ver.'); }
    return mic; }
  function makePC(id,offerer){
    const pc=new RTCPeerConnection(ICE); pcs.set(id,pc);
    if(offerer){ const tr=pc.addTransceiver('audio',{direction:'sendrecv'}); if(mic) tr.sender.replaceTrack(mic.getAudioTracks()[0]); }
    pc.onicecandidate=e=>{ if(e.candidate) api.send({t:'rtc',to:id,data:{ice:e.candidate}}); };
    pc.ontrack=e=>{ let a=audios.get(id); if(!a){ a=document.createElement('audio'); a.autoplay=true; a.playsInline=true; document.body.appendChild(a); audios.set(id,a); }
      a.srcObject=e.streams[0]||new MediaStream([e.track]); a.play().catch(()=>{}); };
    return pc; }
  async function call(id){ const pc=makePC(id,true); const o=await pc.createOffer(); await pc.setLocalDescription(o); api.send({t:'rtc',to:id,data:{sdp:pc.localDescription}}); }
  async function rtc(from,d){
    let pc=pcs.get(from);
    if(d.sdp){ if(d.sdp.type==='offer'){ if(!pc) pc=makePC(from,false); await pc.setRemoteDescription(d.sdp);
        pc.getTransceivers().forEach(t=>{ t.direction='sendrecv'; if(mic) t.sender.replaceTrack(mic.getAudioTracks()[0]); }); const a=await pc.createAnswer(); await pc.setLocalDescription(a); api.send({t:'rtc',to:from,data:{sdp:pc.localDescription}}); }
      else if(pc) await pc.setRemoteDescription(d.sdp); }
    else if(d.ice&&pc){ try{ await pc.addIceCandidate(d.ice); }catch(e){} } }
  function txUpdate(){ const on=api.floor.radio===api.id||api.floor.phone===api.id; if(mic) mic.getAudioTracks().forEach(t=>t.enabled=on); }
  async function press(ch,on){
    if(on===wantTx[ch]) return; wantTx[ch]=on;
    if(on){ audios.forEach(a=>a.play().catch(()=>{})); await ensureMic(); if(!wantTx[ch]) return; }
    api.send({t:'ptt',ch,on}); ui(); }
  // ---------- UI ----------
  function name(id){ const p=api.peers.find(x=>x.id===id); return p?p.name:''; }
  function ui(){ if(!opts||!opts.ui) return; const U=opts.ui;
    const r=api.floor.radio, me=api.id;
    if(U.fstate){ U.fstate.classList.toggle('busy',!!r&&r!==me); U.fstate.classList.toggle('tx',r===me);
      U.fstate.textContent=!api.on?'OFFLINE':r===me?'TX':r?'BUSY':'AVAILABLE'; U.fstate.title=r&&r!==me?name(r)+' konuşuyor':''; }
    if(U.ptt) U.ptt.classList.toggle('on',r===me);
    if(U.tel){ const p=api.floor.phone; U.tel.classList.toggle('on',p===me); U.tel.classList.toggle('busy',!!p&&p!==me); }
    if(U.who) renderPeers(); }
  function peersChanged(){ ui(); opts.onPeers&&opts.onPeers(api.peers); }
  function renderPeers(){ const U=opts.ui; if(!U.who) return;
    U.who.innerHTML=api.peers.map(p=>{ const me=p.id===api.id, talk=api.floor.radio===p.id||api.floor.phone===p.id;
      const ctl=api.admin&&!me?`<span class="adm">
        <button data-op="talk" data-id="${p.id}" data-v="${p.canTalk?0:1}" title="Konuşma izni">${p.canTalk?'🎙 açık':'🎙 kapalı'}</button>
        <button data-op="mute" data-id="${p.id}" data-v="${p.muted?0:1}" title="Sesini kes">${p.muted?'Sesi aç':'Sesi kes'}</button>
        <button data-op="kick" data-id="${p.id}" data-v="1" title="Oturumdan çıkar">Çıkar</button></span>`:'';
      return `<div class="who"><span><span class="dot" style="background:${talk?'#ff3b3b':p.muted||!p.canTalk?'#888':'#2ecc71'}"></span>${p.name}${me?' (sen)':''}${p.admin?' ★':''}</span><span class="tag">${p.role==='pilot'?'PILOT':'ATC'}</span>${ctl}</div>`; }).join('');
    U.who.querySelectorAll('button[data-op]').forEach(b=>b.onclick=()=>api.send({t:'admin',op:b.dataset.op,id:b.dataset.id,v:b.dataset.v==='1'}));
    if(U.count) U.count.textContent=api.peers.length; }
  function flashMsg(t){ if(opts.toast) opts.toast(t); }
  api.start=o=>{ opts=o;
    const isTyping=e=>/INPUT|SELECT|TEXTAREA/.test(e.target.tagName);
    addEventListener('keydown',e=>{ if(isTyping(e)||e.repeat) return; if(e.code==='Space'){ e.preventDefault(); press('radio',true); } if(e.code==='KeyB'){ press('phone',true); } },true);
    addEventListener('keyup',e=>{ if(e.code==='Space') press('radio',false); if(e.code==='KeyB') press('phone',false); },true);
    addEventListener('blur',()=>{ press('radio',false); press('phone',false); });
    const hold=(el,ch)=>{ if(!el) return; el.addEventListener('pointerdown',e=>{ e.preventDefault(); e.stopImmediatePropagation(); press(ch,true); },true);
      ['pointerup','pointerleave','pointercancel'].forEach(ev=>el.addEventListener(ev,()=>press(ch,false))); el.addEventListener('click',e=>e.stopImmediatePropagation(),true); };
    hold(o.ui.ptt,'radio'); hold(o.ui.tel,'phone');
    connect(); };
  return api;
})();
