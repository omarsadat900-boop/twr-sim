// TWR SİM multiplayer server: serves the pages, relays state, WebRTC signalling,
// half-duplex floor control for PTT (radio) and telephone, and instructor/admin controls.
'use strict';
const http=require('http'), fs=require('fs'), path=require('path'), {WebSocketServer}=require('ws');
const PORT=process.env.PORT||8080, ADMIN_KEY=process.env.ADMIN_KEY||'';
const PUB=path.join(__dirname,'public');
const TYPES={'.html':'text/html; charset=utf-8','.js':'application/javascript','.json':'application/json','.png':'image/png','.glb':'model/gltf-binary','.txt':'text/plain; charset=utf-8','.css':'text/css'};

const server=http.createServer((req,res)=>{
  let u=decodeURIComponent((req.url||'/').split('?')[0]);
  if(u==='/') u='/index.html';
  if(u==='/health'){ res.writeHead(200); return res.end('ok'); }
  const f=path.join(PUB,path.normalize(u).replace(/^(\.\.[\/\\])+/,''));
  if(!f.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  fs.readFile(f,(e,b)=>{ if(e){ res.writeHead(404); return res.end('not found'); }
    res.writeHead(200,{'Content-Type':TYPES[path.extname(f)]||'application/octet-stream','Cache-Control':'no-cache'}); res.end(b); });
});

const wss=new WebSocketServer({server,path:'/ws'});
const clients=new Map();            // id -> {ws,id,name,role,admin,canTalk,muted}
const floor={radio:null,phone:null};
let lastState={wx:null,traffic:{}}, nextId=1;
const send=(c,m)=>{ try{ c.ws.readyState===1&&c.ws.send(JSON.stringify(m)); }catch(e){} };
const all=(m,except)=>clients.forEach(c=>{ if(c!==except) send(c,m); });
const peerList=()=>[...clients.values()].map(c=>({id:c.id,name:c.name,role:c.role,admin:c.admin,canTalk:c.canTalk,muted:c.muted}));
const pushPeers=()=>all({t:'peers',peers:peerList(),floor});
function release(c,ch){ for(const k of ch?[ch]:Object.keys(floor)) if(floor[k]===c.id){ floor[k]=null; all({t:'floor',ch:k,holder:null}); } }

wss.on('connection',(ws,req)=>{
  const c={ws,id:String(nextId++),name:'?',role:'atc',admin:false,canTalk:true,muted:false,alive:true};
  ws.on('pong',()=>c.alive=true);
  ws.on('message',raw=>{
    let m; try{ m=JSON.parse(raw); }catch(e){ return; }
    switch(m.t){
      case 'hello': {
        c.name=String(m.name||'Misafir').slice(0,24); c.role=m.role==='pilot'?'pilot':'atc';
        const firstAdmin=![...clients.values()].some(x=>x.admin);
        c.admin=(ADMIN_KEY&&m.key===ADMIN_KEY)||(!ADMIN_KEY&&firstAdmin);
        clients.set(c.id,c);
        send(c,{t:'welcome',id:c.id,admin:c.admin,peers:peerList(),floor,state:lastState});
        all({t:'join',peer:{id:c.id,name:c.name,role:c.role}},c); pushPeers(); break; }
      case 'state': if(c.role==='pilot'&&m.state){ if(m.state.wx) lastState.wx=m.state.wx; if(m.state.traffic) lastState.traffic[c.id]=m.state.traffic; all({t:'state',from:c.id,state:m.state},c); } break;
      case 'cmd': all({t:'cmd',from:c.id,cmd:m.cmd},c); break;            // pilot-to-pilot aircraft commands
      case 'ptt': {
        const ch=m.ch==='phone'?'phone':'radio';
        if(m.on){ if(floor[ch]&&floor[ch]!==c.id){ send(c,{t:'deny',ch,why:'busy'}); break; }
          if(!c.canTalk||c.muted){ send(c,{t:'deny',ch,why:'perm'}); break; }
          floor[ch]=c.id; all({t:'floor',ch,holder:c.id}); }
        else release(c,ch);
        break; }
      case 'rtc': { const to=clients.get(String(m.to)); if(to) send(to,{t:'rtc',from:c.id,data:m.data}); break; }
      case 'admin': {
        if(!c.admin) break; const tg=clients.get(String(m.id)); if(!tg) break;
        if(m.op==='talk'){ tg.canTalk=!!m.v; if(!tg.canTalk) release(tg); }
        if(m.op==='mute'){ tg.muted=!!m.v; if(tg.muted) release(tg); }
        if(m.op==='admin'){ tg.admin=!!m.v; }
        if(m.op==='kick'){ send(tg,{t:'kicked'}); setTimeout(()=>tg.ws.close(),100); }
        pushPeers(); break; }
    }
  });
  ws.on('close',()=>{ release(c); delete lastState.traffic[c.id]; clients.delete(c.id); all({t:'leave',id:c.id}); pushPeers(); });
});
setInterval(()=>clients.forEach(c=>{ if(!c.alive){ c.ws.terminate(); return; } c.alive=false; try{ c.ws.ping(); }catch(e){} }),20000);
server.listen(PORT,()=>console.log('TWR SİM server on :'+PORT));
