import copy,importlib.util,pathlib,unittest
s=importlib.util.spec_from_file_location('repair',pathlib.Path(__file__).with_name('apply-homeqa-auth-email.py'));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
def fixture():return {'Name':'/'+m.NAME,'State':{'Running':True},'Image':m.IMAGE,'Mounts':[],'Config':{'Image':'pinned-tag','Labels':{'com.supabase.cli.project':m.PROJECT},'Env':['GOTRUE_EXTERNAL_EMAIL_ENABLED=false','GOTRUE_DISABLE_SIGNUP=true','GOTRUE_MAILER_AUTOCONFIRM=false','GOTRUE_EXTERNAL_PHONE_ENABLED=false','TEST_SECRET=unchanged']},'HostConfig':{'PortBindings':{},'NetworkMode':m.NETWORK,'RestartPolicy':{'Name':'unless-stopped'}},'NetworkSettings':{'Networks':{m.NETWORK:{'Aliases':['auth']}}}}
class Plan(unittest.TestCase):
 def test_exact_repair_keeps_secret_signup_and_source(self):
  a=fixture();old=copy.deepcopy(a);r=m.plan(a);self.assertEqual(a,old)
  self.assertIn('TEST_SECRET=unchanged',r['Env']);self.assertIn('GOTRUE_DISABLE_SIGNUP=true',r['Env']);self.assertIn('GOTRUE_MAILER_AUTOCONFIRM=false',r['Env']);self.assertEqual(set(r['Env'])^set(a['Config']['Env']),{'GOTRUE_EXTERNAL_EMAIL_ENABLED=false','GOTRUE_EXTERNAL_EMAIL_ENABLED=true'});self.assertEqual(r['Image'],m.IMAGE)
 def test_wrong_project_image_and_name_rejected(self):
  for key in ('project','image','name'):
   a=fixture()
   if key=='project':a['Config']['Labels']['com.supabase.cli.project']='production'
   if key=='image':a['Image']='other'
   if key=='name':a['Name']='/other'
   with self.assertRaises(AssertionError):m.plan(a)
 def test_mount_and_public_binding_rejected(self):
  for key in ('mount','port'):
   a=fixture()
   if key=='mount':a['Mounts']=[{'Source':'/home'}]
   else:a['HostConfig']['PortBindings']={'9999/tcp':[{'HostIp':'0.0.0.0','HostPort':'9999'}]}
   with self.assertRaises(AssertionError):m.plan(a)
 def test_extra_network_rejected(self):
  a=fixture();a['NetworkSettings']['Networks']['other']={}
  with self.assertRaises(AssertionError):m.plan(a)
 def test_weak_signup_or_confirmation_rejected(self):
  for field in ('GOTRUE_DISABLE_SIGNUP','GOTRUE_MAILER_AUTOCONFIRM'):
   a=fixture();a['Config']['Env']=[x.replace(field+'=true',field+'=false') if field=='GOTRUE_DISABLE_SIGNUP' else x.replace(field+'=false',field+'=true') for x in a['Config']['Env']]
   with self.assertRaises(AssertionError):m.plan(a)
 def test_already_changed_or_stopped_rejected(self):
  for mode in ('email','stopped'):
   a=fixture()
   if mode=='email':a['Config']['Env'][0]='GOTRUE_EXTERNAL_EMAIL_ENABLED=true'
   else:a['State']['Running']=False
   with self.assertRaises(AssertionError):m.plan(a)
if __name__=='__main__':unittest.main()
