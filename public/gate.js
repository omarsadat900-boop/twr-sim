// TWR SİM approval gate (client). Loaded on the start page after sign-in and added by the server to every game page.
// Owners: shows an approve/deny card for each guest who wants to join. Guests: sends the join request and,
// if an owner ends their session, takes them back to the start page.
(()=>{
  if(window.TWRGATE) return;
  const subs=new Set(); let ws=null, retry=1000, hi=null;
  const api=window.TWRGATE={ on(fn){ subs.add(fn); if(hi) fn(hi); return ()=>subs.delete(fn); },
    send(m){ try{ ws&&ws.readyState===1&&ws.send(JSON.stringify(m)); return ws&&ws.readyState===1; }catch(e){ return false; } },
    get ready(){ return !!ws&&ws.readyState===1; } };

  // ---------- owner cards ----------
  const css=`#twrgate{position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483000;display:grid;gap:8px;width:min(420px,calc(100vw - 32px));font:14px Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
#twrgate .gc{background:#0f1b2b;color:#e8eef5;border:1px solid #2d4766;border-left:4px solid #f1c12b;border-radius:10px;padding:12px 14px;box-shadow:0 12px 34px rgba(0,0,0,.45);display:grid;gap:10px}
#twrgate .gc p{margin:0;line-height:1.45}#twrgate .gc small{color:#9fb3c8;word-break:break-all}
#twrgate .gc .r{display:inline-block;background:#1f4f7a;border-radius:5px;padding:1px 7px;font-weight:600;font-size:12px;letter-spacing:.04em}
#twrgate .gc .a{display:flex;gap:8px;justify-content:flex-end}
#twrgate button{font:600 14px inherit;font-family:inherit;border-radius:8px;padding:8px 14px;cursor:pointer;border:1px solid #3a5578;background:#16283d;color:#e8eef5}
#twrgate button.ok{background:#1f9d55;border-color:#1f9d55;color:#fff}#twrgate button.no{background:#b3261e;border-color:#b3261e;color:#fff}
#twrgate .gc.done{border-left-color:#5f7891;opacity:.9}
#twrgate-end{position:fixed;inset:0;z-index:2147483001;background:rgba(8,16,24,.8);display:grid;place-items:center;padding:16px;font:16px Inter,system-ui,sans-serif;color:#fff;text-align:center}`;
  let box=null;
  function ensureBox(){ if(box) return box;
    const st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);
    box=document.createElement('div'); box.id='twrgate'; box.setAttribute('role','alert');
    // keep clicks and keys on the cards from reaching the map, the tower view or the PTT key
    ['pointerdown','mousedown','click','wheel','keydown','keyup','touchstart'].forEach(ev=>box.addEventListener(ev,e=>e.stopPropagation()));
    document.body.appendChild(box); return box; }
  const esc=t=>String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function beep(){ try{ const A=window.AudioContext||window.webkitAudioContext, a=new A(), o=a.createOscillator(), g=a.createGain();
    o.frequency.value=880; g.gain.setValueAtTime(.0001,a.currentTime); g.gain.exponentialRampToValueAtTime(.2,a.currentTime+.02); g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+.35);
    o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime+.4); setTimeout(()=>a.close(),600); }catch(e){} }
  const cards=new Map();
  function ask(m){ if(cards.has(m.rid)) return; ensureBox();
    const el=document.createElement('div'); el.className='gc';
    el.innerHTML=`<p><b>${esc(m.name)}</b> <span class="r">${m.role==='pilot'?'PILOT':'ATC'}</span> olarak katılmak istiyor.<br><small>${esc(m.email)}</small></p>
      <div class="a"><button class="no" type="button">Reddet</button><button class="ok" type="button">Onayla</button></div>`;
    el.querySelector('.ok').onclick=()=>api.send({t:'answer',rid:m.rid,ok:true});
    el.querySelector('.no').onclick=()=>api.send({t:'answer',rid:m.rid,ok:false});
    box.appendChild(el); cards.set(m.rid,el); beep(); }
  function done(m){ const el=cards.get(m.rid); if(!el) return; cards.delete(m.rid);
    const txt=m.ok===true?`Onaylandı (${esc(m.by)}).`:m.ok===false?`Reddedildi (${esc(m.by)}).`:m.why==='timeout'?'İstek zaman aşımına uğradı.':'İstek geri çekildi.';
    el.classList.add('done'); el.innerHTML=`<p>${txt}</p>`; setTimeout(()=>el.remove(),3000); }
  function ended(){ const v=document.createElement('div'); v.id='twrgate-end';
    v.innerHTML='<div><p style="font-size:20px;font-weight:600;margin:0 0 8px">Oturumun sona erdi</p><p style="margin:0">Bir sahip seni oturumdan çıkardı. Giriş sayfasına dönülüyor…</p></div>';
    document.body.appendChild(v); setTimeout(()=>location.href='/',3000); }

  function connect(){
    ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/gate');
    ws.onopen=()=>{ retry=1000; };
    ws.onmessage=e=>{ let m; try{ m=JSON.parse(e.data); }catch(x){ return; }
      if(m.t==='hi'){ hi=m; cards.forEach(el=>el.remove()); cards.clear(); }
      if(m.t==='ask') ask(m);
      if(m.t==='askdone') done(m);
      if(m.t==='ended') ended();
      subs.forEach(fn=>{ try{ fn(m); }catch(x){} }); };
    ws.onclose=()=>{ hi=null; subs.forEach(fn=>{ try{ fn({t:'offline'}); }catch(x){} }); setTimeout(connect,retry); retry=Math.min(retry*2,15000); };
  }
  if(document.body) connect(); else addEventListener('DOMContentLoaded',connect);
})();
