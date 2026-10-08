const html = String.raw`<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="referrer" content="no-referrer">
  <title>Digital Observer — בדיקת צפייה מרוחקת</title>
  <style>
    body{font-family:system-ui,sans-serif;margin:0;background:#07111f;color:#f4f7fb}main{max-width:780px;margin:auto;padding:24px}
    button{font:inherit;font-weight:700;padding:14px 18px;border:0;border-radius:12px;background:#5ee0b3;color:#062016;width:100%}
    .status{margin:16px 0;padding:12px;border-radius:10px;background:#122236}.ok{color:#68edbd}.bad{color:#ff8f8f}
    .grid{display:grid;gap:14px}.card{background:#122236;border-radius:14px;padding:12px}video{width:100%;background:#000;border-radius:10px;min-height:180px}
    small{color:#a8b6c8}code{direction:ltr;unicode-bidi:embed}
  </style>
</head>
<body><main>
  <h1>בדיקת צפייה מרוחקת</h1>
  <p>הטלפון הוא לקוח צפייה בלבד. לא מותקנים עליו Gateway או Connector.</p>
  <button id="run">הפעל בדיקה מאובטחת</button>
  <div id="summary" class="status">ממתין להפעלה</div>
  <div id="videos" class="grid"></div>
  <p><small>ההרשאות והקישורים קצרים בזמן ואינם כוללים פרטי DVR, ‏RTSP או מצלמה.</small></p>
</main><script src="/push38/remote-playback/hls.js"></script><script>
const summary=document.getElementById("summary"),videos=document.getElementById("videos"),run=document.getElementById("run");
const embeddedConfig=__PUSH38_REMOTE_CONFIG__;
const decodeFragment=()=>{if(embeddedConfig)return embeddedConfig;const raw=location.hash.slice(1).replace(/-/g,"+").replace(/_/g,"/");return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(raw+"=".repeat((4-raw.length%4)%4)),c=>c.charCodeAt(0))))};
const wait=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
const bounded=(promise,ms,label)=>Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error(label)),ms))]);
const safeRemote=url=>{const value=new URL(url);return value.protocol==="https:"&&!(["localhost","127.0.0.1","::1"].includes(value.hostname)||value.hostname.endsWith(".local"))};
async function authorize(config,source){
  const response=await fetch("/push38/remote-playback/authorize",{method:"POST",headers:{"content-type":"application/json","authorization":"Bearer "+config.accessToken,"x-push38-session-id":config.sessionId},body:JSON.stringify({observer_site_id:config.siteId,camera_source_id:source.id,mode:"live"}),cache:"no-store"});
  const body=await response.json().catch(()=>({}));
  return {status:response.status,body};
}
async function claim(source,playback){
  if(!safeRemote(playback.claim_url))throw new Error("REMOTE_CLAIM_URL_INVALID");
  const response=await fetch(playback.claim_url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({grant:playback.grant}),cache:"no-store",signal:AbortSignal.timeout(20000)});
  const body=await response.json().catch(()=>({}));
  if(!response.ok||!safeRemote(body.playback?.hls_url))throw new Error("REMOTE_MEDIA_CLAIM_FAILED");
  const card=document.createElement("section");card.className="card";const title=document.createElement("strong");title.textContent=source.label;card.append(title);
  const video=document.createElement("video");video.controls=true;video.muted=true;video.autoplay=true;video.playsInline=true;card.append(video);videos.append(card);
  let hls=null;
  if(video.canPlayType("application/vnd.apple.mpegurl")){video.src=body.playback.hls_url}
  else if(globalThis.Hls?.isSupported()){hls=new globalThis.Hls({enableWorker:true});hls.loadSource(body.playback.hls_url);hls.attachMedia(video);
    await bounded(new Promise((resolve,reject)=>{hls.once(globalThis.Hls.Events.MANIFEST_PARSED,resolve);hls.once(globalThis.Hls.Events.ERROR,(_,data)=>{if(data?.fatal)reject(new Error("REMOTE_HLS_FATAL"))})}),20000,"REMOTE_HLS_MANIFEST_TIMEOUT")}
  else throw new Error("REMOTE_HLS_UNSUPPORTED");
  await bounded(video.play(),10000,"REMOTE_MEDIA_PLAY_TIMEOUT");const before=video.currentTime;await wait(12000);const advanced=video.currentTime>before+1&&video.videoWidth>0;hls?.destroy();
  return {hls_https:true,localhost_absent:true,moving:advanced,width:video.videoWidth,height:video.videoHeight};
}
async function report(config,result){
  await fetch("/push38/remote-playback/result",{method:"POST",headers:{"content-type":"application/json","x-push38-result-token":config.resultToken},body:JSON.stringify(result),cache:"no-store"}).catch(()=>null);
}
run.addEventListener("click",async()=>{
  run.disabled=true;summary.textContent="הבדיקה פועלת…";const startedAt=new Date().toISOString();let config;
  try{const raw=decodeFragment();config={accessToken:raw.accessToken||raw.t,resultToken:raw.resultToken||raw.r,siteId:raw.siteId||raw.s,sessionId:raw.sessionId||raw.sid,
    sources:(raw.sources||raw.c||[]).map(source=>({id:source.id||source.i,label:source.label||source.l,kind:source.kind||source.k,
      expect:source.expect||source.e,play:source.play===true||source.p===true}))};history.replaceState(null,"",location.pathname);
    const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if(config.accessToken.split(".").length!==3||!/^[A-Za-z0-9_-]{43}$/.test(config.resultToken)||!uuid.test(config.siteId)||!/^[A-Za-z0-9_-]{22}$/.test(config.sessionId)||
      !Array.isArray(config.sources)||config.sources.length!==11||new Set(config.sources.map(source=>source.id)).size!==11||
      config.sources.some(source=>!uuid.test(source.id)||!["DVR","TAPO"].includes(source.kind)||!["ALLOW","DENY"].includes(source.expect)))
      throw new Error("QUALIFICATION_INPUT_INVALID");
    const results=[];
    for(const source of config.sources){
      const auth=await authorize(config,source);const allowed=auth.status===200&&auth.body?.data?.playback;
      const expected=source.expect==="ALLOW"?Boolean(allowed):!allowed;
      const item={label:source.label,kind:source.kind,authorization_status:auth.status,authorization_expected:expected};
      if(allowed){item.remote_url_https=safeRemote(auth.body.data.playback.claim_url);item.localhost_absent=item.remote_url_https;if(source.play)item.media=await claim(source,auth.body.data.playback)}
      results.push(item);
    }
    const pass=results.every(item=>item.authorization_expected&&item.localhost_absent!==false&&(!item.media||item.media.moving));
    const result={protocol:"observer-push38-remote-client-proof-v1",started_at:startedAt,completed_at:new Date().toISOString(),client_class:"OWNER_PHONE_BROWSER",edge_software_installed:false,results,pass};
    await report(config,result);summary.className="status "+(pass?"ok":"bad");summary.textContent=pass?"PASS — הצפייה המרוחקת מתקדמת":"FAIL — אחת מבדיקות ההרשאה או הווידאו נכשלה";
  }catch(error){const result={protocol:"observer-push38-remote-client-proof-v1",started_at:startedAt,completed_at:new Date().toISOString(),client_class:"OWNER_PHONE_BROWSER",edge_software_installed:false,pass:false,error:String(error?.message||"REMOTE_CLIENT_FAILED").slice(0,120),results:[]};if(config)await report(config,result);summary.className="status bad";summary.textContent="FAIL — הבדיקה לא הושלמה"}
});
</script></body></html>`;

export function push38RemotePlaybackPage(config = null) {
  const embedded = config === null ? "null" : JSON.stringify(config).replace(/</g, "\\u003c");
  return html.replace("__PUSH38_REMOTE_CONFIG__", embedded);
}

export function sanitizePush38RemotePlaybackResult(value) {
  if (!value || value.protocol !== "observer-push38-remote-client-proof-v1" ||
    value.client_class !== "OWNER_PHONE_BROWSER" || value.edge_software_installed !== false ||
    typeof value.pass !== "boolean" || !Array.isArray(value.results) || value.results.length > 16)
    throw new Error("PUSH38_REMOTE_RESULT_INVALID");
  return {
    protocol: value.protocol,
    started_at: String(value.started_at || "").slice(0, 40),
    completed_at: String(value.completed_at || "").slice(0, 40),
    client_class: value.client_class,
    edge_software_installed: false,
    pass: value.pass,
    error: typeof value.error === "string" ? value.error.slice(0, 120) : null,
    results: value.results.map(item => ({
      label: String(item?.label || "").replace(/[^A-Za-z0-9 _-]/g, "").slice(0, 40),
      kind: ["DVR", "TAPO"].includes(item?.kind) ? item.kind : "UNKNOWN",
      authorization_status: Number.isInteger(item?.authorization_status) ? item.authorization_status : null,
      authorization_expected: item?.authorization_expected === true,
      remote_url_https: item?.remote_url_https === true,
      localhost_absent: item?.localhost_absent === true,
      media: item?.media && typeof item.media === "object" ? {
        hls_https: item.media.hls_https === true,
        localhost_absent: item.media.localhost_absent === true,
        moving: item.media.moving === true,
        width: Number.isInteger(item.media.width) ? item.media.width : null,
        height: Number.isInteger(item.media.height) ? item.media.height : null
      } : null
    }))
  };
}
