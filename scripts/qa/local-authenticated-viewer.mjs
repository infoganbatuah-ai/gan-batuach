// Ephemeral HOME_QA playback smoke. Tokens remain server-side; normal grants/audit remain mandatory.
import http from 'node:http';
import {readFileSync,writeFileSync,lstatSync,unlinkSync,rmdirSync} from 'node:fs';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {dirname,join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
export function validateViewerSession(s,now=Date.now()){
 if(s?.protocol!=='observer-local-qa-viewer-session-v1'||s.authBase!=='http://127.0.0.1:56421'||!Number.isFinite(s.expiresAt)||s.expiresAt<=now||s.expiresAt>now+1200000||!s.accessToken||!s.apiKey||s.siteId!=='cc1673b8-3eb0-4785-a12c-1fb88f425a41'||s.sources?.length!==11)throw Error('VIEWER_SESSION_SCOPE_REJECTED');
 const dvr=s.sources.filter(x=>x.kind==='DVR').map(x=>x.channel).sort((a,b)=>a-b);
 if(JSON.stringify(dvr)!=='[1,2,3,4,5,6,7,8,10,11]'||s.sources.filter(x=>x.kind==='TAPO'&&x.channel===1).length!==1||new Set(s.sources.map(x=>x.id)).size!==11)throw Error('VIEWER_INVENTORY_REJECTED');
 for(const x of s.sources)if(x.port!==(x.kind==='TAPO'?18083:18082)||x.gatewayId!==(x.kind==='TAPO'?'db267b52-6282-4944-bcee-5d4857698fb0':'62df97e2-3c0b-427f-9108-bde029bc10e7')||!/^dvr_[a-f0-9]{18}_\d+$/.test(x.streamId))throw Error('VIEWER_SOURCE_BINDING_REJECTED');
 return true;
}
export function mediaTargetAllowed(source,raw){try{const u=new URL(raw);return u.origin===`http://127.0.0.1:${source.port}`&&!u.username&&!u.password&&!u.hash&&u.pathname.startsWith(`/hls/${source.streamId}/`)&&/^\/(?:hls)\/dvr_[a-f0-9]{18}_\d+\/(?:index\.m3u8|segment-\d+\.ts)$/.test(u.pathname);}catch{return false;}}
const equal=(a,b)=>{const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length===y.length&&timingSafeEqual(x,y)};
async function body(req,max=8192){let n=0,a=[];for await(const c of req){n+=c.length;if(n>max)throw Error('BODY_LIMIT');a.push(c);}return Buffer.concat(a);}
const page=`<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><title>HOME_QA · בדיקת צפייה</title><style>body{font:17px system-ui;max-width:900px;margin:30px auto;background:#101a29;color:#edf4ff}button{padding:12px 25px;font:inherit}video{width:600px;max-width:100%;background:#000}td,th{padding:8px 18px;border-bottom:1px solid #456}table{border-collapse:collapse}#status{padding:15px}</style><h1>HOME_QA · בדיקת צפייה מקומית</h1><p>אימות זמני של מסלול הווידאו. זו אינה פריסת Production.</p><button id="run">בדוק את 11 המקורות</button><div id="status">מוכן לבדיקה</div><video id="video" muted playsinline controls></video><table><thead><tr><th>מקור</th><th>תוצאה</th><th>תמונות</th><th>התקדמות</th></tr></thead><tbody id="rows"></tbody></table><script src="/hls.js"></script><script>
const status=document.querySelector('#status'),video=document.querySelector('#video'),rows=document.querySelector('#rows');
const wait=ms=>new Promise(r=>setTimeout(r,ms));const bounded=(p,ms)=>Promise.race([p,new Promise((_,r)=>setTimeout(()=>r(Error('PLAYER_TIMEOUT')),ms))]);
document.querySelector('#run').onclick=async()=>{document.querySelector('#run').disabled=true;const results=[];
for(let i=0;i<11;i++){let hls;const tr=document.createElement('tr');rows.append(tr);let item={index:i,pass:false};try{status.textContent='בודק מקור '+(i+1)+' מתוך 11';const r=await fetch('/start/'+i,{method:'POST'});const d=await r.json();item.label=d.label||('מקור '+(i+1));if(!r.ok)throw Error(d.error||'PLAYBACK_START_FAILED');
if(video.canPlayType('application/vnd.apple.mpegurl'))video.src=d.url;else if(Hls.isSupported()){hls=new Hls({enableWorker:true,backBufferLength:0,maxBufferLength:8,liveSyncDurationCount:2});const ready=new Promise((ok,bad)=>{hls.on(Hls.Events.MANIFEST_PARSED,ok);hls.on(Hls.Events.ERROR,(_,d)=>{if(d.fatal)bad(Error('HLS_FATAL'));});});hls.loadSource(d.url);hls.attachMedia(video);await bounded(ready,20000);}else throw Error('HLS_UNSUPPORTED');
await bounded(video.play(),15000);const before=video.currentTime;const framesBefore=video.getVideoPlaybackQuality?.().totalVideoFrames||0;await wait(8000);item.width=video.videoWidth;item.height=video.videoHeight;item.advancedSeconds=+(video.currentTime-before).toFixed(3);item.decodedFrames=(video.getVideoPlaybackQuality?.().totalVideoFrames||0)-framesBefore;item.pass=item.width>0&&item.height>0&&item.advancedSeconds>1&&item.decodedFrames>0;
}catch(e){item.error=/^[A-Z0-9_]+$/.test(e.message)?e.message:'PLAYBACK_FAILED';}finally{video.pause();hls?.destroy();video.removeAttribute('src');video.load();}
tr.replaceChildren(...[item.label||('מקור '+(i+1)),item.pass?'עבר':(item.error||'לא התקדם'),item.decodedFrames||0,item.advancedSeconds||0].map(t=>{const td=document.createElement('td');td.textContent=t;return td;}));results.push(item);await fetch('/result',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(item)});}
status.textContent='הבדיקה הסתיימה: '+results.filter(x=>x.pass).length+' מתוך 11 עברו';document.body.dataset.complete='true';document.body.dataset.passed=results.filter(x=>x.pass).length;
};</script></html>`;
export async function startViewer({sessionPath,evidencePath}){
 const info=lstatSync(sessionPath);if(!info.isFile()||info.isSymbolicLink()||(info.mode&0o077))throw Error('PRIVATE_SESSION_FILE_REQUIRED');
 const session=JSON.parse(readFileSync(sessionPath,'utf8'));validateViewerSession(session);const sources=[...session.sources].sort((a,b)=>a.kind.localeCompare(b.kind)||a.channel-b.channel);
 const unlock=randomBytes(32).toString('base64url'),cookie=randomBytes(32).toString('base64url'),proofPath=join(dirname(sessionPath),'unlock.txt');writeFileSync(proofPath,unlock,{mode:0o600,flag:'wx'});
 const playlists=new Map(),media=new Map(),results=[];let origin,closing=false,logoutPassed=null;
 const safeFetch=(u,init={})=>fetch(u,{...init,redirect:'error',signal:AbortSignal.timeout(20000)});
 const save=()=>writeFileSync(evidencePath,JSON.stringify({scope:'NORMAL_AUTH_HOME_QA_LOCAL_PLAYER',results,allElevenPassed:results.length===11&&results.every(x=>x.pass),completed:results.length===11,logoutPassed},null,2)+'\n');
 const headers={'cache-control':'private, no-store','referrer-policy':'same-origin','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; media-src 'self' blob:; worker-src blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"};
 const server=http.createServer(async(req,res)=>{try{
  if(closing||Date.now()>=session.expiresAt){res.writeHead(410,headers).end();return;}
  if(req.headers.host!==new URL(origin).host){res.writeHead(404,headers).end();return;}
  const u=new URL(req.url,origin);if(u.search){res.writeHead(404,headers).end();return;}
  if(req.method==='POST'&&req.headers.origin!==origin){res.writeHead(403,headers).end();return;}
  if(req.method==='POST'&&u.pathname==='/unlock'){
   const b=(await body(req,4096)).toString();const boundary=String(req.headers['content-type']||'').match(/boundary=(.+)$/)?.[1];const value=boundary?b.split('--'+boundary).find(x=>x.includes('name="proof"'))?.split('\r\n\r\n')[1]?.replace(/\r\n$/,''):'';
   if(!equal(value,unlock)){res.writeHead(401,headers).end();return;}
   res.writeHead(303,{...headers,'set-cookie':`qa_viewer=${cookie}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.max(0,Math.floor((session.expiresAt-Date.now())/1000))}`,'location':'/'}).end();return;
  }
  const authenticated=equal(String(req.headers.cookie||'').match(/(?:^|;\s*)qa_viewer=([^;]+)/)?.[1],cookie);
  if(!authenticated){if(req.method==='GET'&&u.pathname==='/'){res.writeHead(200,{...headers,'content-type':'text/html;charset=utf-8'}).end('<html lang="he" dir="rtl"><meta charset="utf-8"><title>HOME_QA · כניסה זמנית</title><h1>HOME_QA · כניסה לסשן בדיקה מקומי</h1><p>טענו את קובץ הגישה הזמני שהוכן לבדיקה.</p><form method="post" action="/unlock" enctype="multipart/form-data"><input type="file" name="proof" required><button>פתח נגן QA</button></form></html>');return;}res.writeHead(401,headers).end();return;}
  if(req.method==='GET'&&u.pathname==='/'){res.writeHead(200,{...headers,'content-type':'text/html;charset=utf-8'}).end(page);return;}
  if(req.method==='GET'&&u.pathname==='/hls.js'){res.writeHead(200,{...headers,'content-type':'text/javascript'}).end(readFileSync('/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/node_modules/hls.js/dist/hls.min.js'));return;}
  const start=/^\/start\/(\d+)$/.exec(u.pathname);
  if(req.method==='POST'&&start){const index=Number(start[1]),source=sources[index];if(!source)throw Error('SOURCE_SCOPE');const label=source.kind==='DVR'?`DVR CH${source.channel}`:'Tapo';
   const ar=await safeFetch('http://127.0.0.1:3100/api/digital-observer/dvr-gateway',{method:'POST',headers:{authorization:'Bearer '+session.accessToken,'content-type':'application/json'},body:JSON.stringify({observer_site_id:session.siteId,camera_source_id:source.id,mode:'live'})});const auth=await ar.json();if(!ar.ok||!auth.data?.playback?.grant){res.writeHead(ar.status,{...headers,'content-type':'application/json'}).end(JSON.stringify({label,error:'SOURCE_AUTHORIZATION_FAILED'}));return;}
   const cr=await safeFetch(`http://127.0.0.1:${source.port}/playback/claim`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({grant:auth.data.playback.grant})});const claim=await cr.json();if(!cr.ok||!mediaTargetAllowed(source,claim.playback?.hls_url)){res.writeHead(503,{...headers,'content-type':'application/json'}).end(JSON.stringify({label,error:'MEDIA_CLAIM_FAILED'}));return;}
   playlists.set(index,claim.playback.hls_url);res.writeHead(200,{...headers,'content-type':'application/json'}).end(JSON.stringify({label,url:`/media/${index}/index.m3u8`}));return;
  }
  const mp=/^\/media\/(\d+)\/(index\.m3u8|segment-\d+\.ts)$/.exec(u.pathname);
  if(req.method==='GET'&&mp){const index=Number(mp[1]),source=sources[index],target=mp[2]==='index.m3u8'?playlists.get(index):media.get(u.pathname);if(!source||!target||!mediaTargetAllowed(source,target))throw Error('MEDIA_SCOPE');const upstream=await safeFetch(target);if(!upstream.ok){res.writeHead(upstream.status,headers).end();return;}
   if(mp[2]==='index.m3u8'){let text=await upstream.text();if(text.length>32768)throw Error('PLAYLIST_LIMIT');const rewritten=text.split('\n').map(line=>{if(!line||line.startsWith('#'))return line;const actual=new URL(line,target).href;if(!mediaTargetAllowed(source,actual))throw Error('SEGMENT_SCOPE');const name=new URL(actual).pathname.split('/').pop(),local=`/media/${index}/${name}`;media.set(local,actual);return local;}).join('\n');while(media.size>256)media.delete(media.keys().next().value);res.writeHead(200,{...headers,'content-type':'application/vnd.apple.mpegurl'}).end(rewritten);
   }else{const bytes=Buffer.from(await upstream.arrayBuffer());if(bytes.length>8*1024*1024)throw Error('SEGMENT_LIMIT');res.writeHead(200,{...headers,'content-type':'video/mp2t'}).end(bytes);}return;
  }
  if(req.method==='POST'&&u.pathname==='/result'){const x=JSON.parse((await body(req)).toString());const index=x.index,source=sources[index];if(!source||results.some(r=>r.index===index))throw Error('RESULT_SCOPE');const r={index,label:source.kind==='DVR'?`DVR CH${source.channel}`:'Tapo',pass:x.pass===true,width:Number(x.width)||0,height:Number(x.height)||0,advancedSeconds:Number(x.advancedSeconds)||0,decodedFrames:Number(x.decodedFrames)||0,error:/^[A-Z0-9_]{1,60}$/.test(x.error||'')?x.error:null};r.pass=r.pass&&r.width>0&&r.height>0&&r.advancedSeconds>1&&r.decodedFrames>0;results.push(r);save();res.writeHead(204,headers).end();return;}
  res.writeHead(404,headers).end();
 }catch{if(!res.headersSent)res.writeHead(503,{...headers,'content-type':'application/json'}).end('{"error":"QA_VIEWER_REQUEST_FAILED"}');else res.destroy();}});
 await new Promise((ok,bad)=>{server.once('error',bad);server.listen(0,'127.0.0.1',ok)});origin=`http://127.0.0.1:${server.address().port}`;
 const shutdown=async()=>{if(closing)return;closing=true;clearTimeout(expiry);server.closeAllConnections();await new Promise(r=>server.close(r));try{unlinkSync(proofPath)}catch{}try{const response=await safeFetch(session.authBase+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:session.apiKey,authorization:'Bearer '+session.accessToken,'content-type':'application/json'},body:'{}'});logoutPassed=response.ok;if(logoutPassed){unlinkSync(sessionPath);rmdirSync(dirname(sessionPath));}}catch{logoutPassed=false;}save();};
 const expiry=setTimeout(()=>shutdown(),Math.max(1,session.expiresAt-Date.now()));for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>shutdown().finally(()=>process.exit(0)));
 return {origin,proofPath,shutdown};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const [sessionPath,evidencePath]=process.argv.slice(2);const viewer=await startViewer({sessionPath,evidencePath});console.log(JSON.stringify({url:viewer.origin,proofFile:viewer.proofPath,scope:'HOME_QA_LOOPBACK_ONLY',expiresAutomatically:true}));}
