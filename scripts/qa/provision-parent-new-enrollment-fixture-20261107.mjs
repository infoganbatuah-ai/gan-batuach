// One synthetic Child file for a fresh Parent enrollment submission in isolated Development.
// This is administrative fixture setup, never a Product child-creation or authorization test.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chmodSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {config,sql} from '../development/local-database.mjs';

const child='00000000-0000-4000-8000-000000004905';
const parent='00000000-0000-4000-8000-000000000101';
const garden='00000000-0000-4000-8000-000000000601';
const name='QA Enrollment Test Child';
const birth='2023-03-12';
const task='GB-PRODUCT-PARENT-NEW-ENROLLMENT-SUBMISSION-20261107';

export function evaluateSnapshot(s) {
  assert.equal(s.parent_ready,true,'Only the allowlisted local synthetic Parent is eligible');
  assert.equal(s.identity_nullable,true,'Child identity must permit NULL');
  assert.equal(s.canonical_trigger,true,'Canonical guardian-link trigger must be enabled');
  assert.equal(s.garden_ready,true,'QA Garden A must be public and accepting');
  assert.ok(s.matching_rooms>0,'QA Garden A needs an age-matching active Classroom');
  assert.equal(s.requests,0,'Fixture must not have a prior enrollment request');
  assert.equal(s.enrollments,0,'Fixture must not have an active enrollment');
  if (s.file===null) {
    assert.equal(s.link_count,0,'Unexpected guardian link without Child file');
    return 'CREATE_ONE_FILE';
  }
  assert.deepEqual(s.file,{id:child,full_name:name,primary_parent_profile_id:parent,
    birth_date:birth,identity_number:null,source:'qa_parent_enrollment',owner_status:'active',is_demo:true,
    demo_batch_id:'parent-new-enrollment-20261107'},'Existing Child file is not the exact QA fixture');
  assert.equal(s.link_count,1,'Existing fixture must have exactly one guardian link');
  assert.equal(s.exact_link,true,'Guardian link must be active, scoped and primary');
  return 'EXISTING_EXACT';
}

function snapshot() {
  return JSON.parse(sql(`select json_build_object(
    'parent_ready',exists(select 1 from public.profiles p join auth.users u on u.id=p.id
      where p.id='${parent}'::uuid and p.role='parent' and u.email='parent-a@integration.qa.invalid'),
    'identity_nullable',exists(select 1 from information_schema.columns where table_schema='public'
      and table_name='permanent_child_files' and column_name='identity_number' and is_nullable='YES'),
    'canonical_trigger',exists(select 1 from pg_trigger where tgrelid='public.permanent_child_files'::regclass
      and tgname='sync_primary_child_guardian_link_trigger' and tgenabled='O'),
    'garden_ready',exists(select 1 from public.gardens where id='${garden}'::uuid and status='active'
      and public_profile_enabled and enrollment_availability='accepting'),
    'matching_rooms',(select count(*) from public.classrooms where garden_id='${garden}'::uuid
      and status='active' and min_age_months is not null and max_age_months is not null
      and (extract(year from age(current_date,'${birth}'::date))::integer*12+
        extract(month from age(current_date,'${birth}'::date))::integer) between min_age_months and max_age_months),
    'file',(select json_build_object('id',id,'full_name',full_name,
      'primary_parent_profile_id',primary_parent_profile_id,'birth_date',birth_date,
      'identity_number',identity_number,'source',source,'owner_status',owner_status,
      'is_demo',is_demo,'demo_batch_id',demo_batch_id)
      from public.permanent_child_files where id='${child}'::uuid),
    'link_count',(select count(*) from public.child_guardian_links where permanent_child_file_id='${child}'::uuid),
    'exact_link',exists(select 1 from public.child_guardian_links where permanent_child_file_id='${child}'::uuid
      and guardian_profile_id='${parent}'::uuid and relationship_type='parent' and is_primary
      and legal_authority and status='active' and access_scope->>'profile'='true'),
    'requests',(select count(*) from public.kindergarten_enrollment_requests where child_profile_id='${child}'::uuid),
    'enrollments',(select count(*) from public.child_kindergarten_enrollments where permanent_child_file_id='${child}'::uuid))`).trim());
}

function createOnce() {
  // sql() pins the local container/socket and uses ON_ERROR_STOP. A failed DO rolls back on disconnect.
  sql(`begin;
    select pg_advisory_xact_lock(hashtextextended('qa-parent-new-enrollment:${child}',0));
    do $fixture$ begin
      if not exists(select 1 from public.profiles p join auth.users u on u.id=p.id
        where p.id='${parent}'::uuid and p.role='parent' and u.email='parent-a@integration.qa.invalid')
        then raise exception 'synthetic_parent_missing'; end if;
      if exists(select 1 from public.permanent_child_files where id='${child}'::uuid)
        then raise exception 'fixture_race_or_replacement'; end if;
      if exists(select 1 from public.child_guardian_links where permanent_child_file_id='${child}'::uuid)
        then raise exception 'unexpected_guardian_link'; end if;
      insert into public.permanent_child_files(id,full_name,primary_parent_profile_id,birth_date,
        source,owner_status,is_demo,demo_batch_id)
      values('${child}'::uuid,'${name}','${parent}'::uuid,'${birth}'::date,
        'qa_parent_enrollment','active',true,'parent-new-enrollment-20261107');
      if (select count(*) from public.child_guardian_links where permanent_child_file_id='${child}'::uuid
        and guardian_profile_id='${parent}'::uuid and relationship_type='parent' and is_primary
        and legal_authority and status='active' and access_scope->>'profile'='true')<>1
        then raise exception 'canonical_guardian_link_missing'; end if;
    end $fixture$;
    commit;`);
}

async function main() {
  const [mode,expectedSha]=process.argv.slice(2);
  const receipt={task,mode,expectedSha,startedAt:new Date().toISOString(),status:'BLOCKED',
    environment:config.environment,productionAccess:false,childFileId:child,parentId:parent,gardenId:garden};
  let root;
  try {
    assert.ok(['--dry-run','--apply'].includes(mode),'Explicit dry-run or apply required');
    assert.match(expectedSha??'',/^[0-9a-f]{40}$/);
    assert.equal(config.environment,'DEVELOPMENT / INTEGRATION');
    assert.equal(config.productionAllowed,false);
    assert.equal(config.projectId,'gan-batuach-integration');
    assert.notEqual(process.env.GB_M31_EXTERNAL_DELIVERY_ENABLED,'true');
    assert.ok(!process.env.GB_M31_DELIVERY_WORKER_SECRET);
    const git=(...args)=>execFileSync('git',args,{encoding:'utf8',env:{...process.env,GIT_OPTIONAL_LOCKS:'0'}}).trim();
    assert.equal(git('rev-parse','HEAD'),expectedSha);
    assert.equal(git('branch','--show-current'),'codex/parent-new-enrollment-submission-20261107');
    assert.equal(git('status','--porcelain=v1','-uall'),'','Fixture run requires clean committed source');
    root=resolve(config.runtimeRoot,'parent-new-enrollment-submission-20261107');
    mkdirSync(root,{recursive:true,mode:0o700});
    const before=snapshot();
    const plan=evaluateSnapshot(before);
    receipt.before={plan,childFiles:before.file?1:0,links:before.link_count,
      requests:before.requests,enrollments:before.enrollments,matchingRooms:before.matching_rooms};
    if(mode==='--apply'&&plan==='CREATE_ONE_FILE')createOnce();
    const after=snapshot();
    const result=evaluateSnapshot(after);
    if(mode==='--apply')assert.equal(result,'EXISTING_EXACT');
    if(mode==='--dry-run')assert.deepEqual(after,before,'Dry run must not change database state');
    receipt.after={plan:result,childFiles:after.file?1:0,links:after.link_count,
      requests:after.requests,enrollments:after.enrollments};
    receipt.status='PASS';
  } catch(error) { receipt.reason=error instanceof Error?error.message:String(error); process.exitCode=1; }
  finally {
    receipt.finishedAt=new Date().toISOString();
    if(root) { const path=resolve(root,`fixture-${Date.now()}.json`);
      writeFileSync(path,JSON.stringify(receipt,null,2)+'\n',{mode:0o600});chmodSync(path,0o600);
      console.log(JSON.stringify({status:receipt.status,receiptPath:path,reason:receipt.reason??null,after:receipt.after??null}));
    } else console.log(JSON.stringify({status:receipt.status,reason:receipt.reason??null}));
  }
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
