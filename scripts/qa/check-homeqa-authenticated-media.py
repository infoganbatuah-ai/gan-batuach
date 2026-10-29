"""Normal grants + cached relay media decode. Never logs bearer URLs or media bytes."""
import concurrent.futures,hashlib,json,pathlib,re,subprocess,sys,time,urllib.request,urllib.error,urllib.parse
p=pathlib.Path(sys.argv[1]);session=json.loads(p.read_text());assert p.stat().st_mode & 0o077==0 and not p.is_symlink()
assert session['authBase']=='http://127.0.0.1:56421' and session['siteId']=='cc1673b8-3eb0-4785-a12c-1fb88f425a41' and len(session['sources'])==11
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*a,**k):return None
opener=urllib.request.build_opener(NoRedirect)
def call(url,data=None,auth=False,binary=False):
 assert session['expiresAt']>time.time()*1000,'LOCAL_SESSION_WINDOW_EXPIRED'
 h={'content-type':'application/json'}
 if auth:h['authorization']='Bearer '+session['accessToken']
 q=urllib.request.Request(url,data=json.dumps(data).encode() if data is not None else None,headers=h)
 try:
  with opener.open(q,timeout=12) as r:
   raw=r.read(8*1024*1024+1);assert len(raw)<=8*1024*1024,'RESPONSE_LIMIT'
   return r.status,raw if binary else json.loads(raw)
 except urllib.error.HTTPError as e:return e.code,b'' if binary else {}
def valid(source,url):
 u=urllib.parse.urlsplit(url);return u.scheme=='http' and u.hostname=='127.0.0.1' and u.port==source['port'] and not u.username and not u.password and not u.fragment and bool(re.fullmatch('/hls/'+re.escape(source['streamId'])+'/(index\\.m3u8|segment-[0-9]+\\.ts)',u.path))
def inspect(source):
 result={'kind':source['kind'],'channel':source['channel'],'pass':False}
 try:
  result['stage']='authorization'
  expected=18083 if source['kind']=='TAPO' else 18082;assert source['port']==expected
  st,data=call('http://127.0.0.1:3100/api/digital-observer/dvr-gateway',{'observer_site_id':session['siteId'],'camera_source_id':source['id'],'mode':'live'},auth=True);result['authorizationStatus']=st
  grant=data.get('data',{}).get('playback',{}).get('grant');assert st==200 and grant,'SOURCE_AUTH_FAILED'
  result['stage']='claim'
  st,claim=call(f'http://127.0.0.1:{expected}/playback/claim',{'grant':grant});result['claimStatus']=st;assert st==200,'MEDIA_CLAIM_FAILED'
  url=claim.get('playback',{}).get('hls_url','');assert valid(source,url),'MEDIA_URL_SCOPE'
  result['stage']='playlist'
  st,text=call(url,binary=True);assert st==200,'PLAYLIST_FAILED';lines=text.decode().splitlines();names=[x for x in lines if x and not x.startswith('#')];assert names,'NO_SEGMENTS'
  segment=urllib.parse.urljoin(url,names[-1]);assert valid(source,segment),'SEGMENT_SCOPE'
  result['stage']='segment'
  st,content=call(segment,binary=True);assert st==200 and len(content)>1024,'SEGMENT_FAILED'
  result['stage']='decode'
  decoded=subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-threads','1','-protocol_whitelist','pipe','-f','mpegts','-i','pipe:0','-map','0:v:0','-an','-frames:v','2','-threads','1','-f','framemd5','pipe:1'],input=content,capture_output=True,timeout=8)
  frames=[x for x in decoded.stdout.decode(errors='replace').splitlines() if x and not x.startswith('#')];result['decodedFrames']=len(frames);result['segmentBytes']=len(content);result['segmentSha256']=hashlib.sha256(content).hexdigest()
  result['stage']='playlist-advance'
  time.sleep(3);st,new=call(url,binary=True);assert st==200,'SECOND_PLAYLIST_FAILED'
  newer=[x for x in new.decode().splitlines() if x and not x.startswith('#')];result['playlistAdvanced']=bool(newer and newer[-1]!=names[-1]);result['pass']=decoded.returncode==0 and len(frames)==2 and result['playlistAdvanced']
 except Exception as e:
  message=str(e);result['error']=message if re.fullmatch('[A-Z0-9_]{1,70}',message) else type(e).__name__
 return result
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(inspect,session['sources']))
report={'scope':'NORMAL_AUTH_GRANTED_HTTP_MEDIA_NOT_BROWSER_PLAYBACK','results':results,'passed':sum(x['pass'] for x in results),'expected':11,'noPrivateUrlsLogged':True}
pathlib.Path(sys.argv[2]).write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'passed':report['passed'],'expected':11,'failures':[x for x in results if not x['pass']]}))
