"""Guarded Auth-only HOME_QA repair. No image pull, database command or JWT minting."""
import argparse, copy, hashlib, http.client, json, os, pathlib, socket, subprocess, tempfile, time, urllib.parse, urllib.request
PROJECT='gan-batuach-push38t'
NAME='supabase_auth_'+PROJECT
NETWORK='supabase_network_'+PROJECT
IMAGE='sha256:c0c25187a6b835e65a6f6e6c6b39d090e832d40e6de5186f2c038e0411944232'
class UnixHTTP(http.client.HTTPConnection):
 def __init__(self,path):super().__init__('localhost',timeout=45);self.path=path
 def connect(self):self.sock=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM);self.sock.settimeout(45);self.sock.connect(self.path)
class Docker:
 def __init__(self):
  ctx=json.loads(subprocess.check_output(['docker','context','inspect','colima-push38t'],text=True,stderr=subprocess.DEVNULL,timeout=10))[0]
  endpoint=ctx['Endpoints']['docker']['Host'];assert endpoint=='unix://'+str(pathlib.Path.home()/'.colima/push38t/docker.sock'),'WRONG_CONTEXT_SOCKET'
  self.path=endpoint[7:]
 def request(self,method,path,body=None):
  c=UnixHTTP(self.path);data=None if body is None else json.dumps(body).encode()
  try:
   c.request(method,path,data,{'Content-Type':'application/json'});r=c.getresponse();raw=r.read()
   if r.status>=300:raise RuntimeError('DOCKER_REQUEST_REJECTED_'+str(r.status))
   return json.loads(raw) if raw else None
  finally:c.close()
 def inspect(self,name):return self.request('GET','/containers/'+name+'/json')
def envmap(a):return dict(x.split('=',1) for x in a['Config']['Env'] if '=' in x)
def plan(a):
 assert a['Name']=='/'+NAME and a['State']['Running'],'AUTH_NOT_EXPECTED_RUNNING_CONTAINER'
 assert a['Config']['Labels'].get('com.supabase.cli.project')==PROJECT,'WRONG_PROJECT'
 assert a['Image']==IMAGE,'AUTH_IMAGE_CHANGED'
 assert not a['Mounts'] and not a['HostConfig']['PortBindings'],'AUTH_MOUNT_OR_PUBLIC_BIND_REJECTED'
 assert set(a['NetworkSettings']['Networks'])=={NETWORK} and a['HostConfig']['NetworkMode']==NETWORK,'WRONG_NETWORK'
 e=envmap(a);assert e.get('GOTRUE_EXTERNAL_EMAIL_ENABLED')=='false','AUTH_EMAIL_NOT_DISABLED'
 assert e.get('GOTRUE_DISABLE_SIGNUP')=='true' and e.get('GOTRUE_MAILER_AUTOCONFIRM')=='false','PROTECTIONS_NOT_PINNED'
 new=copy.deepcopy(a['Config']);new['Image']=IMAGE
 new['Env']=['GOTRUE_EXTERNAL_EMAIL_ENABLED=true' if x.startswith('GOTRUE_EXTERNAL_EMAIL_ENABLED=') else x for x in new['Env']]
 assert len([x for x in new['Env'] if x.startswith('GOTRUE_EXTERNAL_EMAIL_ENABLED=')])==1
 new['HostConfig']=copy.deepcopy(a['HostConfig'])
 endpoint=a['NetworkSettings']['Networks'][NETWORK]
 new['NetworkingConfig']={'EndpointsConfig':{NETWORK:{'Aliases':endpoint.get('Aliases') or ['auth']}}}
 return new

def live(port):
 try:
  with urllib.request.urlopen('http://127.0.0.1:'+str(port)+'/health/live',timeout=4) as r:
   d=json.load(r);return {'reachable':r.status==200,'uptimeMs':d.get('uptime_ms')}
 except Exception:return {'reachable':False}
def main():
 p=argparse.ArgumentParser();p.add_argument('--apply',action='store_true');p.add_argument('--evidence',required=True);args=p.parse_args()
 docker=Docker();original=docker.inspect(NAME);new=plan(original)
 db=docker.inspect('supabase_db_'+PROJECT);assert db['Config']['Labels'].get('com.supabase.cli.project')==PROJECT
 before={str(port):live(port) for port in (18082,18083)}
 receipt={'scope':'HOME_QA_AUTH_ONLY','imagePinned':True,'onlyEnvironmentChange':'GOTRUE_EXTERNAL_EMAIL_ENABLED:false->true','signupDisabled':True,'emailConfirmationRetained':True,'applied':False}
 if not args.apply:
  pathlib.Path(args.evidence).write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt));return
 backup=pathlib.Path(tempfile.mkdtemp(prefix='observer-qa-auth-rollback-',dir='/private/tmp'));backup.chmod(0o700)
 snapshot=backup/'container.json';fd=os.open(snapshot,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(fd,'w') as f:json.dump(original,f)
 receipt['backupSnapshotSha256']=hashlib.sha256(snapshot.read_bytes()).hexdigest()
 rollback=NAME+'_rollback_'+str(int(time.time()));receipt['rollbackContainer']=rollback;receipt['protectedBackupDirectory']=str(backup)
 stopped=False;renamed=False;created=None
 try:
  # Re-inspect immediately before the only stop. No other container is mutated.
  assert docker.inspect(NAME)['Id']==original['Id'],'AUTH_OWNER_CHANGED'
  stopped=True
  docker.request('POST','/containers/'+original['Id']+'/stop?t=10')
  docker.request('POST','/containers/'+original['Id']+'/rename?name='+rollback);renamed=True
  docker.request('POST','/containers/'+original['Id']+'/update',{'RestartPolicy':{'Name':'no','MaximumRetryCount':0}})
  created=docker.request('POST','/containers/create?name='+NAME,new)['Id']
  docker.request('POST','/containers/'+created+'/start')
  healthy=False
  for _ in range(45):
   current=docker.inspect(created)
   if not current['State']['Running']:raise RuntimeError('NEW_AUTH_EXITED')
   try:
    with urllib.request.urlopen('http://127.0.0.1:56421/auth/v1/health',timeout=2) as r:healthy=r.status==200
   except Exception:pass
   if healthy:break
   time.sleep(1)
  assert healthy,'AUTH_HEALTH_TIMEOUT'
  current=docker.inspect(NAME);e=envmap(current)
  olde=envmap(original);assert {k for k in set(e)|set(olde) if e.get(k)!=olde.get(k)}=={'GOTRUE_EXTERNAL_EMAIL_ENABLED'},'UNEXPECTED_ENV_DELTA'
  assert e['GOTRUE_EXTERNAL_EMAIL_ENABLED']=='true' and e['GOTRUE_DISABLE_SIGNUP']=='true' and e['GOTRUE_MAILER_AUTOCONFIRM']=='false'
  assert current['Image']==original['Image'] and not current['HostConfig']['PortBindings'] and not current['Mounts']
  afterdb=docker.inspect('supabase_db_'+PROJECT);after={str(port):live(port) for port in (18082,18083)}
  receipt.update({'applied':True,'authHealthy':True,'databaseSameContainerAndStart':(afterdb['Id'],afterdb['State']['StartedAt'])==(db['Id'],db['State']['StartedAt']),'edgeBefore':before,'edgeAfter':after,'rollbackPreservedStopped':not docker.inspect(original['Id'])['State']['Running']})
 except Exception as error:
  receipt['failure']=str(error) if str(error).isupper() else type(error).__name__
  if created:
   try:docker.request('POST','/containers/'+created+'/stop?t=10')
   except Exception:pass
   docker.request('POST','/containers/'+created+'/rename?name='+NAME+'_failed_'+str(int(time.time())))
  if renamed:docker.request('POST','/containers/'+original['Id']+'/rename?name='+NAME)
  if stopped:
   docker.request('POST','/containers/'+original['Id']+'/update',{'RestartPolicy':original['HostConfig']['RestartPolicy']})
   if not docker.inspect(original['Id'])['State']['Running']:docker.request('POST','/containers/'+original['Id']+'/start')
  receipt['rolledBack']=True
  raise
 finally:pathlib.Path(args.evidence).write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps(receipt))
if __name__=='__main__':main()
