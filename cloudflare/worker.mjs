import {portalRoute,authenticatedActor} from './portal.mjs';
import {authEnabled} from './auth.mjs';
const MAX_BODY = 14 * 1024 * 1024;
function json(body,status=200) {
  return Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Blueconnect-Api':'2'}});
}
async function readLimited(request) {
  if(Number(request.headers.get('content-length')) > MAX_BODY) throw new Error('SIZE');
  if(!request.body) throw new Error('EMPTY');
  const reader=request.body.getReader(),chunks=[];let total=0;
  try {
    while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>MAX_BODY){await reader.cancel();throw new Error('SIZE');}chunks.push(value);}
  } finally {reader.releaseLock();}
  const data=new Uint8Array(total);let offset=0;
  for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.byteLength;}
  return new TextDecoder().decode(data);
}
export async function signedEnvelope(payload,secret) {
  const timestamp=Date.now(),nonce=crypto.randomUUID();
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signature=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(timestamp+'\n'+nonce+'\n'+payload));
  return {timestamp,nonce,payload,signature:Array.from(new Uint8Array(signature),b=>b.toString(16).padStart(2,'0')).join('')};
}
export async function handle(request,env,fetchUpstream=fetch) {
  const url=new URL(request.url);
  const route=url.pathname.replace(/\/{2,}/g,'/').replace(/\/+$/,'');
  async function bridge(action,input,actor) {
    if (!env.BRIDGE_SECRET || env.BRIDGE_SECRET.length < 32) throw Error('Koneksi server belum dikonfigurasi.');
    const target=new URL(env.APPS_SCRIPT_URL);
    if(target.origin!=='https://script.google.com'||!/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(target.pathname))throw Error('Tujuan server tidak valid.');
    const envelope=await signedEnvelope(JSON.stringify({action,input,actor}),env.BRIDGE_SECRET);
    const response=await fetchUpstream(target.href,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(envelope),redirect:'follow',signal:AbortSignal.timeout(90000)});
    if(!response.ok)throw Error('Server pengajuan belum tersedia.');
    const result=await response.json();if(!result.ok)throw Error(result.error||'Permintaan belum berhasil.');return result.data;
  }
  const portal=await portalRoute(request,env,bridge);if(portal)return portal;
  if(authEnabled(env)&&(route===''||route==='/index.html')) {
    const response=await env.ASSETS.fetch(new Request(new URL('/portal.html',url),request));
    const headers=new Headers(response.headers);headers.set('Cache-Control','no-store');return new Response(response.body,{status:response.status,headers});
  }
  if(authEnabled(env)&&route==='/request-form') {
    const actor=await authenticatedActor(request,env);if(!actor)return json({error:'Silakan masuk.'},401);
    try{const me=await bridge('portal',{action:'me'},actor);if(!me.profile)return json({error:'Lengkapi profil terlebih dahulu.'},403);}catch{return json({error:'Sesi tidak berlaku.'},401);}
    const response=await env.ASSETS.fetch(new Request(new URL('/index.html',url),request));const headers=new Headers(response.headers);
    headers.set('X-Frame-Options','SAMEORIGIN');headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'self'; form-action 'none'; object-src 'none'; base-uri 'none'");headers.set('Cache-Control','no-store');return new Response(response.body,{status:response.status,headers});
  }
  if(!route.startsWith('/api/'))return env.ASSETS.fetch(request);
  if(!['/api/config','/api/evidence','/api/submissions','/api/evidence-folder'].includes(route))return json({error:'Endpoint tidak ditemukan.',code:'API_ROUTE_NOT_FOUND',path:route},404);
  const isConfig=route==='/api/config';
  const actor=await authenticatedActor(request,env);
  if(authEnabled(env)&&!isConfig&&!actor)return json({error:'Silakan masuk terlebih dahulu.'},401);
  if(authEnabled(env)&&!isConfig&&request.headers.get('origin')!==url.origin)return json({error:'Asal permintaan ditolak.'},403);
  if(request.method!==(isConfig?'GET':'POST'))return json({error:'Metode tidak didukung.'},405);
  // Same-origin browser requests only; this is an upload endpoint, not a proxy.
  const origin=request.headers.get('origin');
  if((origin && origin!==url.origin) || request.headers.get('sec-fetch-site')==='cross-site')return json({error:'Asal permintaan tidak diizinkan.'},403);
  if(!env.BRIDGE_SECRET || env.BRIDGE_SECRET.length<32)return json({error:'Koneksi Drive belum dikonfigurasi oleh admin.'},503);
  let target;
  try{target=new URL(env.APPS_SCRIPT_URL);}catch{return json({error:'Tujuan Apps Script belum dikonfigurasi.'},503);}
  if(target.origin!=='https://script.google.com' || !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(target.pathname))return json({error:'Tujuan Apps Script tidak valid.'},503);
  let payload;
  if(isConfig)payload=JSON.stringify({action:'config',actor});
  else {
    if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))return json({error:'Format permintaan harus JSON.'},415);
    try {
      const raw=await readLimited(request);
      // Keep the upload body opaque: Apps Script validates files and sizes.
      JSON.parse(raw);
      if (route === '/api/submissions' && raw.length > 40000) return json({error:'Data catatan terlalu besar.'},413);
      payload=JSON.stringify({action:route === '/api/submissions' ? 'record' : (route === '/api/evidence-folder' ? 'renameEvidence' : 'upload'),input:JSON.parse(raw),actor});
    }catch(error){return json({error:error.message==='SIZE'?'Total lampiran terlalu besar.':'Data unggahan tidak valid.'},error.message==='SIZE'?413:400);}
  }
  try {
    const envelope=await signedEnvelope(payload,env.BRIDGE_SECRET);
    const response=await fetchUpstream(target.href,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(envelope),redirect:'follow',signal:AbortSignal.timeout(90000)});
    if(!response.ok)throw new Error('UPSTREAM');
    const result=await response.json();
    if(!result.ok)return json({error:result.error || 'Penyimpanan Drive belum siap.'},400);
    return json(result.data);
  }catch {return json({error:'Tidak dapat menghubungi penyimpanan Drive. Silakan coba lagi atau hubungi admin.'},502);}
}
export default {fetch(request,env) {return handle(request,env);}};
