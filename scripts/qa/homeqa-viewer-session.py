"""Normal local Auth login/logout. Credentials and tokens never enter stdout or Git."""
import argparse,json,os,pathlib,subprocess,tempfile,time,urllib.request,urllib.error,uuid
PROJECT='gan-batuach-push38t';AUTH='http://127.0.0.1:56421'
SECRET=pathlib.Path('/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-remote-client-secret-20261003.json')
def run(args):return subprocess.check_output(args,text=True,stderr=subprocess.DEVNULL,timeout=25).strip()
def request(path,key,token='',body=None):
 headers={'apikey':key,'content-type':'application/json'}
 if token:headers['Authorization']='Bearer '+token
 req=urllib.request.Request(AUTH+'/auth/v1'+path,data=json.dumps(body).encode() if body is not None else None,headers=headers,method='POST' if body is not None else 'GET')
 try:
  with urllib.request.urlopen(req,timeout=20) as r:
   raw=r.read();return r.status,json.loads(raw) if raw else {}
 except urllib.error.HTTPError as e:
  try:d=json.load(e)
  except Exception:d={}
  return e.code,{'error_code':d.get('error_code') or d.get('error') or 'AUTH_REJECTED'}
def load(path):
 p=pathlib.Path(path);assert not p.is_symlink() and p.stat().st_mode & 0o077==0,'PRIVATE_SESSION_REQUIRED'
 s=json.loads(p.read_text());assert s['authBase']==AUTH and s['protocol']=='observer-local-qa-viewer-session-v1'
 return p,s
def main():
 p=argparse.ArgumentParser();p.add_argument('action',choices=['login','logout']);p.add_argument('--session');p.add_argument('--evidence',required=True);p.add_argument('--window-seconds',type=int,default=1200);args=p.parse_args();assert 30<=args.window_seconds<=1200,'WINDOW_OUT_OF_RANGE'
 if args.action=='logout':
  path,s=load(args.session);status,_=request('/logout?scope=local',s['apiKey'],s['accessToken'],{})
  assert status in (200,204),'LOCAL_SIGNOUT_FAILED'
  path.unlink();proof=path.parent/'unlock.txt'
  if proof.exists() and not proof.is_symlink():proof.unlink()
  path.parent.rmdir();r={'localSignOutPassed':True,'sessionFileRemoved':True,'otherSessionsSignOutRequested':False}
 else:
  context=json.loads(run(['docker','context','inspect','colima-push38t']))[0];assert context['Endpoints']['docker']['Host']=='unix://'+str(pathlib.Path.home()/'.colima/push38t/docker.sock')
  labels=json.loads(run(['docker','--context','colima-push38t','inspect','--format','{{json .Config.Labels}}','supabase_db_'+PROJECT]));assert labels.get('com.supabase.cli.project')==PROJECT
  assert SECRET.is_file() and not SECRET.is_symlink() and SECRET.stat().st_mode & 0o077==0
  qa=json.loads(SECRET.read_text());expected=str(uuid.UUID(qa['user_id']));assert qa['protocol']=='observer-push38-remote-client-secret-v1'
  envraw=run(['supabase','status','--workdir',str(pathlib.Path(__file__).resolve().parents[2]),'--output','env'])
  variables={}
  for line in envraw.splitlines():
   if '=' not in line:continue
   k,v=line.split('=',1)
   if k in ('API_URL','PUBLISHABLE_KEY','ANON_KEY'):variables[k]=json.loads(v) if v.startswith('"') else v
  envraw='';assert variables['API_URL']==AUTH.removesuffix('/auth/v1')
  key=variables.get('PUBLISHABLE_KEY') or variables.get('ANON_KEY');assert key
  status,session=request('/token?grant_type=password',key,body={'email':qa['email'],'password':qa['password']})
  if status!=200:
   r={'loginPassed':False,'status':status,'code':session['error_code'],'sessionCreated':False};pathlib.Path(args.evidence).write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r));raise SystemExit(2)
  token=session.get('access_token');folder=None;path=None
  try:
   token=session.get('access_token');assert token and session['user']['id']==expected
   verify,user=request('/user',key,token);assert verify==200 and user['id']==expected,'AUTH_USER_NOT_VERIFIED'
   folder=pathlib.Path(tempfile.mkdtemp(prefix='observer-qa-viewer-',dir='/private/tmp'));folder.chmod(0o700)
   path=folder/'session.json';data={'protocol':'observer-local-qa-viewer-session-v1','expiresAt':int(time.time()*1000)+args.window_seconds*1000,'authBase':AUTH,'apiKey':key,'accessToken':token,'userId':expected}
   site='cc1673b8-3eb0-4785-a12c-1fb88f425a41'
   req=urllib.request.Request(AUTH+'/rest/v1/digital_observer_camera_sources?select=id,connector_type,status,metadata&observer_site_id=eq.'+site,headers={'apikey':key,'Authorization':'Bearer '+token})
   with urllib.request.urlopen(req,timeout=15) as response:rows=json.load(response)
   assert len(rows)==17,'QA_SOURCE_INVENTORY_MISMATCH'
   sources=[]
   for row in rows:
    if row['metadata'].get('channel_assignment')!='ASSIGNED':continue
    kind='TAPO' if row['connector_type']=='rtsp' else 'DVR'
    gateway='db267b52-6282-4944-bcee-5d4857698fb0' if kind=='TAPO' else '62df97e2-3c0b-427f-9108-bde029bc10e7'
    assert row['metadata']['gateway_id']==gateway,'QA_SOURCE_DEVICE_MISMATCH'
    sources.append({'id':row['id'],'kind':kind,'channel':int(row['metadata'].get('dvr_channel') or 1),'gatewayId':gateway,'streamId':row['metadata']['gateway_stream_id'],'port':18083 if kind=='TAPO' else 18082})
   assert len(sources)==11,'QA_ASSIGNED_COUNT_MISMATCH'
   data['siteId']=site;data['sources']=sources
   fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
   with os.fdopen(fd,'w') as f:json.dump(data,f)
  except Exception:
   if token:request('/logout?scope=local',key,token,{})
   if path and path.exists():path.unlink()
   if folder and folder.exists() and not any(folder.iterdir()):folder.rmdir()
   raise
  r={'loginPassed':True,'normalAuth':True,'manualJwt':False,'authUserVerified':True,'localWindowSeconds':args.window_seconds,'authTokenExpiresInSeconds':session.get('expires_in'),'sessionFileMode':'0600','productDataChanged':False,'logoutRequired':True}
  print(json.dumps({'sessionFile':str(path)}))
 pathlib.Path(args.evidence).write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r))
if __name__=='__main__':main()
