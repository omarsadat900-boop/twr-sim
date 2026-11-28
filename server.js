// TWR SİM multiplayer server: serves the pages, relays state, WebRTC signalling,
// half-duplex floor control for PTT (radio) and telephone, and instructor/admin controls.
'use strict';
const http=require('http'), fs=require('fs'), path=require('path'), {WebSocketServer}=require('ws');
const AUTH=require('./auth');
const PORT=process.env.PORT||8080, ADMIN_KEY=process.env.ADMIN_KEY||'';
const PUB=path.join(__dirname,'public');
const TYPES={'.html':'text/html; charset=utf-8','.js':'application/javascript','.json':'application/json','.png':'image/png','.css':'text/css'};

const json=(res,code,o,h)=>{ res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store',...h}); res.end(JSON.stringify(o)); };
const me=s=>s?{email:s.email,name:s.name,owner:s.owner}:null;
const pageRole=u=>/pilot/i.test(u)?'pilot':'atc';
function readBody(req,cb){ let b=''; req.on('data',d=>{ b+=d; if(b.length>1e5) req.destroy(); }); req.on('end',()=>{ try{ cb(JSON.parse(b||'{}')); }catch(e){ cb({}); } }); }

const server=http.createServer((req,res)=>{
  let u; try{ u=decodeURIComponent((req.url||'/').split('?')[0]); }catch(e){ res.writeHead(400); return res.end(); }
  if(u==='/') u='/index.html';
  if(u==='/health'){ res.writeHead(200); return res.end('ok'); }
  const s=AUTH.ENABLED?AUTH.session(req):null;
  // ---- sign-in API ----
  if(u==='/auth/config') return json(res,200,{enabled:AUTH.ENABLED,clientId:AUTH.CLIENT_ID,me:me(s)});
  if(u==='/auth/google'&&req.method==='POST'){
    if(!AUTH.ENABLED) return json(res,404,{error:'off'});
    return readBody(req,async b=>{ try{ const user=await AUTH.verifyGoogle(b.credential);
        json(res,200,{me:{...user,owner:AUTH.isOwner(user.email)}},{'Set-Cookie':AUTH.makeCookie(user,AUTH.isSecure(req))}); }
      catch(e){ console.log('google sign-in refused:',e.message); json(res,401,{error:'signin'}); } }); }
  if(u==='/auth/logout'&&req.method==='POST') return json(res,200,{ok:true},{'Set-Cookie':AUTH.clearCookie(AUTH.isSecure(req))});
  const f=path.join(PUB,path.normalize(u).replace(/^(\.\.[\/\\])+/,''));
  if(!f.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  // ---- game pages: owners go straight in, everyone else needs an approval for this role ----
  const game=AUTH.ENABLED&&path.extname(f)==='.html'&&path.basename(f)!=='index.html';
  if(game){ const role=pageRole(path.basename(f));
    if(!s||!(s.owner||AUTH.grantOk(s.email,role))){ res.writeHead(302,{Location:'/?need='+role,'Cache-Control':'no-store'}); return res.end(); } }
  fs.readFile(f,(e,b)=>{ if(e){ res.writeHead(404); return res.end('not found'); }
    // the approval cards (owners) and the "session ended" notice (guests) come from /gate.js, added to every game page
    if(game) b=Buffer.from(b.toString().replace(/<\/body>(?![\s\S]*<\/body>)/i,'<script src="/gate.js"></script></body>'));
    res.writeHead(200,{'Content-Type':TYPES[path.extname(f)]||'application/octet-stream','Cache-Control':'no-cache'}); res.end(b); });
});

const wss=new WebSocketServer({noServer:true}), gss=new WebSocketServer({noServer:true});
server.on('upgrade',(req,sock,head)=>{
  const p=(req.url||'').split('?')[0], target=p==='/ws'?wss:p==='/gate'&&AUTH.ENABLED?gss:null;
  const s=AUTH.ENABLED?AUTH.session(req):null;
  if(!target||(AUTH.ENABLED&&!s)){ sock.write('HTTP/1.1 '+(target?'401 Unauthorized':'404 Not Found')+'\r\n\r\n'); return sock.destroy(); }
  target.handleUpgrade(req,sock,head,ws=>target.emit('connection',ws,req,s));
});
gss.on('connection',(ws,req,s)=>AUTH.gateConnection(ws,s));
const clients=new Map();            // id -> {ws,id,name,role,admin,canTalk,muted}
const floor={radio:null,phone:null};
let lastState={wx:null,traffic:{}}, nextId=1;
const send=(c,m)=>{ try{ c.ws.readyState===1&&c.ws.send(JSON.stringify(m)); }catch(e){} };
const all=(m,except)=>clients.forEach(c=>{ if(c!==except) send(c,m); });
const peerList=()=>[...clients.values()].map(c=>({id:c.id,name:c.name,role:c.role,admin:c.admin,canTalk:c.canTalk,muted:c.muted}));
const pushPeers=()=>all({t:'peers',peers:peerList(),floor});
function release(c,ch){ for(const k of ch?[ch]:Object.keys(floor)) if(floor[k]===c.id){ floor[k]=null; all({t:'floor',ch:k,holder:null}); } }

wss.on('connection',(ws,req,sess)=>{
  const c={sess,ws,id:String(nextId++),name:'?',role:'atc',admin:false,canTalk:true,muted:false,alive:true};
  ws.on('pong',()=>c.alive=true);
  ws.on('message',raw=>{
    let m; try{ m=JSON.parse(raw); }catch(e){ return; }
    if(m.t!=='hello'&&!clients.has(c.id)) return;      // nothing is relayed before a successful hello
    if(m.t==='hello'&&clients.has(c.id)) return;
    switch(m.t){
      case 'hello': {
        c.name=String(m.name||'Misafir').slice(0,24); c.role=m.role==='pilot'?'pilot':'atc';
        if(AUTH.ENABLED){
          // signed in: the name comes from the Google account; owners are admins, guests need a live approval for this role
          c.name=String(sess.name).slice(0,24);
          if(!sess.owner){ if(c.grant||!AUTH.grantOk(sess.email,c.role)){ send(c,{t:'kicked'}); setTimeout(()=>ws.close(),100); break; }
            c.grant=AUTH.grantUse(sess.email); }
          c.admin=sess.owner;
        } else {
          const firstAdmin=![...clients.values()].some(x=>x.admin);
          c.admin=(ADMIN_KEY&&m.key===ADMIN_KEY)||(!ADMIN_KEY&&firstAdmin);
        }
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
        if(m.op==='kick'){ if(AUTH.ENABLED&&tg.sess&&tg.sess.owner) break;   // an owner can't be kicked
          send(tg,{t:'kicked'}); setTimeout(()=>tg.ws.close(),100); if(AUTH.ENABLED&&tg.sess) AUTH.revoke(tg.sess.email); }
        pushPeers(); break; }
    }
  });
  ws.on('close',()=>{ if(c.grant) AUTH.grantDrop(c.sess.email); if(!clients.has(c.id)) return; release(c); delete lastState.traffic[c.id]; clients.delete(c.id); all({t:'leave',id:c.id}); pushPeers(); });
});
setInterval(()=>clients.forEach(c=>{ if(!c.alive){ c.ws.terminate(); return; } c.alive=false; try{ c.ws.ping(); }catch(e){} }),20000);
AUTH.setOwnerInGame(()=>[...clients.values()].some(c=>c.sess&&c.sess.owner));
server.listen(PORT,()=>console.log('TWR SİM server on :'+PORT+(AUTH.ENABLED?' (Google sign-in on, '+AUTH.OWNERS.size+' owner(s))':' (sign-in off)')));
