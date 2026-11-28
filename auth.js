// TWR SİM sign-in: Google ID token check, signed session cookie, owner list and per-join approval.
// Turned on by GOOGLE_CLIENT_ID. Without it the server behaves as before (no sign-in, first joiner = admin).
'use strict';
const crypto=require('crypto');

const CLIENT_ID=process.env.GOOGLE_CLIENT_ID||'';
const ENABLED=!!CLIENT_ID;
const OWNERS=new Set((process.env.OWNER_EMAILS||'').split(/[,;\s]+/).map(s=>s.trim().toLowerCase()).filter(Boolean));
// Without SESSION_SECRET a new key is made at every start, so people sign in again after the server restarts or wakes.
const SECRET=process.env.SESSION_SECRET||crypto.randomBytes(32).toString('hex');
const COOKIE='twr_s', SESSION_DAYS=30;
const GRANT_LOAD_MS=2*60*1000;    // time an approved guest has to open the page
const GRANT_GRACE_MS=60*1000;     // a dropped connection may come back within this time without a new approval
const REQUEST_MS=3*60*1000;       // an unanswered request is dropped after this

const isOwner=email=>!!email&&OWNERS.has(String(email).toLowerCase());
const b64u=b=>Buffer.from(b).toString('base64url');

// ---------- session cookie ----------
function sign(s){ return crypto.createHmac('sha256',SECRET).update(s).digest('base64url'); }
function makeCookie(user,secure){
  const body=b64u(JSON.stringify({e:user.email,n:user.name,x:Date.now()+SESSION_DAYS*864e5}));
  return `${COOKIE}=${body}.${sign(body)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS*86400}${secure?'; Secure':''}`;
}
const clearCookie=secure=>`${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure?'; Secure':''}`;
function session(req){
  const raw=(req.headers.cookie||'').split(/;\s*/).find(p=>p.startsWith(COOKIE+'='));
  if(!raw) return null;
  const [body,sig]=raw.slice(COOKIE.length+1).split('.');
  if(!body||!sig) return null;
  const want=sign(body);
  if(want.length!==sig.length||!crypto.timingSafeEqual(Buffer.from(want),Buffer.from(sig))) return null;
  try{ const s=JSON.parse(Buffer.from(body,'base64url').toString()); if(!s.e||s.x<Date.now()) return null;
    return {email:s.e,name:s.n||s.e,owner:isOwner(s.e)}; }catch(e){ return null; }
}
const isSecure=req=>!!req.socket.encrypted||String(req.headers['x-forwarded-proto']||'').split(',')[0]==='https';

// ---------- Google ID token check (RS256 against Google's published keys) ----------
let keys={}, keysExp=0;
async function googleKeys(){
  if(Date.now()<keysExp) return keys;
  const r=await fetch('https://www.googleapis.com/oauth2/v3/certs');
  if(!r.ok) throw new Error('google keys '+r.status);
  const j=await r.json(), m=/max-age=(\d+)/.exec(r.headers.get('cache-control')||'');
  keys={}; j.keys.forEach(k=>keys[k.kid]=k);
  keysExp=Date.now()+(m?+m[1]:3600)*1000;
  return keys;
}
async function verifyGoogle(token){
  const [h,p,s]=String(token||'').split('.');
  if(!h||!p||!s) throw new Error('bad token');
  const head=JSON.parse(Buffer.from(h,'base64url')), pay=JSON.parse(Buffer.from(p,'base64url'));
  if(head.alg!=='RS256') throw new Error('alg');
  let jwk=(await googleKeys())[head.kid];
  if(!jwk){ keysExp=0; jwk=(await googleKeys())[head.kid]; }
  if(!jwk) throw new Error('unknown key');
  const ok=crypto.verify('RSA-SHA256',Buffer.from(h+'.'+p),crypto.createPublicKey({key:jwk,format:'jwk'}),Buffer.from(s,'base64url'));
  if(!ok) throw new Error('signature');
  if(pay.aud!==CLIENT_ID) throw new Error('audience');
  if(pay.iss!=='accounts.google.com'&&pay.iss!=='https://accounts.google.com') throw new Error('issuer');
  if(!pay.exp||pay.exp*1000<Date.now()) throw new Error('expired');
  if(!pay.email||pay.email_verified===false) throw new Error('email not verified');
  return {email:String(pay.email).toLowerCase(),name:String(pay.name||pay.email).slice(0,40)};
}

// ---------- approvals ----------
// grants: email -> {role, conns, exp}. A guest's grant lasts while they are connected, plus a short grace after.
const grants=new Map();
function grantOk(email,role){
  const g=grants.get(email);
  if(!g) return false;
  if(g.role!==role||(g.conns<=0&&Date.now()>g.exp)){ if(g.conns<=0&&Date.now()>g.exp) grants.delete(email); return false; }
  return true;
}
function grantUse(email){ const g=grants.get(email); if(g) g.conns++; return g; }
function grantDrop(email){ const g=grants.get(email); if(!g) return; g.conns=Math.max(0,g.conns-1); if(!g.conns) g.exp=Date.now()+GRANT_GRACE_MS; }

// gates: the /gate socket on every signed-in page. Owners get the approve/deny cards there; guests ask and wait there.
const gates=new Set(), requests=new Map(); let nextReq=1, ownerInGame=()=>false;
const gsend=(g,m)=>{ try{ g.ws.readyState===1&&g.ws.send(JSON.stringify(m)); }catch(e){} };
const ownerGates=()=>[...gates].filter(g=>g.s.owner);
const ownerOnline=()=>ownerGates().length>0||ownerInGame();
const toOwners=m=>ownerGates().forEach(g=>gsend(g,m));
function closeRequest(r,guestMsg,ownerMsg){
  if(!requests.has(r.id)) return;
  requests.delete(r.id); clearTimeout(r.timer);
  if(guestMsg) gsend(r.gate,guestMsg);
  toOwners({t:'askdone',rid:r.id,...ownerMsg});
}
function gateConnection(ws,s){
  const g={ws,s}; gates.add(g);
  gsend(g,{t:'hi',owner:s.owner,name:s.name});
  if(s.owner) requests.forEach(r=>gsend(g,{t:'ask',rid:r.id,name:r.name,email:r.email,role:r.role}));
  ws.on('message',raw=>{
    let m; try{ m=JSON.parse(raw); }catch(e){ return; }
    if(m.t==='request'&&!s.owner){
      const role=m.role==='pilot'?'pilot':'atc';
      requests.forEach(r=>{ if(r.gate===g) closeRequest(r,null,{why:'cancel'}); });
      if(!ownerOnline()){ gsend(g,{t:'noowner'}); return; }
      const r={id:String(nextReq++),gate:g,email:s.email,name:s.name,role};
      r.timer=setTimeout(()=>closeRequest(r,{t:'timeout'},{why:'timeout'}),REQUEST_MS);
      requests.set(r.id,r);
      toOwners({t:'ask',rid:r.id,name:r.name,email:r.email,role});
      gsend(g,{t:'waiting'});
    }
    if(m.t==='cancel') requests.forEach(r=>{ if(r.gate===g) closeRequest(r,null,{why:'cancel'}); });
    if(m.t==='answer'&&s.owner){
      const r=requests.get(String(m.rid)); if(!r) return;
      if(m.ok){ grants.set(r.email,{role:r.role,conns:0,exp:Date.now()+GRANT_LOAD_MS}); closeRequest(r,{t:'granted',role:r.role,by:s.name},{ok:true,by:s.name}); }
      else closeRequest(r,{t:'denied',by:s.name},{ok:false,by:s.name});
    }
  });
  ws.on('close',()=>{ gates.delete(g);
    requests.forEach(r=>{ if(r.gate===g) closeRequest(r,null,{why:'cancel'}); });
    setTimeout(()=>{ if(!ownerOnline()) requests.forEach(r=>closeRequest(r,{t:'noowner'},{why:'noowner'})); },500); });
}
// End a guest's access (owner kicked them): drop the grant and send their pages back to the start page.
function revoke(email){ grants.delete(email); gates.forEach(g=>{ if(g.s.email===email&&!g.s.owner) gsend(g,{t:'ended'}); }); }

module.exports={ENABLED,CLIENT_ID,OWNERS,isOwner,session,makeCookie,clearCookie,isSecure,verifyGoogle,
  grantOk,grantUse,grantDrop,gateConnection,revoke,setOwnerInGame:f=>ownerInGame=f};
