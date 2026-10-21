-- PR #235 REVIEW-ONLY metadata preflight. Not a migration. Do not execute
-- against Production in this task. Contains no verifier or credential SELECT.
-- Re-run only in a separately authorized read-only review window, then check
-- results without logging private data. A changed result invalidates the plan.
begin transaction read only;

-- Confirm exact current schema grants and roles that rely on PUBLIC USAGE.
select n.nspname, n.nspacl::text as schema_acl
from pg_namespace n where n.nspname = 'public';

with acl as (select nspacl from pg_namespace where nspname = 'public')
select r.rolname, r.rolcanlogin, r.rolsuper, r.rolbypassrls,
       has_schema_privilege(r.rolname, 'public', 'USAGE') as effective_public_usage,
       coalesce((select bool_or(grantee = r.oid)
                 from aclexplode(acl.nspacl) where privilege_type = 'USAGE'), false)
         as direct_public_usage
from pg_roles r, acl
where has_schema_privilege(r.rolname, 'public', 'USAGE')
  and r.rolname not like 'pg_%'
order by r.rolname;

-- Current callable function surface; volatility alone is not mutation proof.
select count(*) filter (where exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                                      where a.grantee = 0 and a.privilege_type = 'EXECUTE'))
         as public_executable_functions,
       count(*) filter (where exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                                      where a.grantee = 0 and a.privilege_type = 'EXECUTE')
                              and p.provolatile = 'v') as public_executable_volatile
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public';

-- Exact five independently reviewed writable SECURITY DEFINER signatures.
select p.oid::regprocedure::text as signature, p.prosecdef, p.provolatile,
       p.proacl::text as function_acl
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in
  ('assign_child_to_classroom', 'assign_staff_to_classroom',
   'escalate_task', 'notify_role', 'process_monthly_inspection_reminders')
order by p.proname;

-- RLS shape and exact Home metadata only; never select refresh_token_hash.
select c.relrowsecurity, c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'video_gateway_device_enrollments';

select id, gateway_id, tenant_id, observer_site_id, deployment_profile,
       config_version, status, lifecycle_state, identity_scheme
from public.video_gateway_device_enrollments
where id in ('1c450dca-38a8-4e49-853f-c613ca498c27'::uuid,
             'd7ee3c9f-0b2e-4943-947b-c410c6bc2a41'::uuid)
order by id;

rollback;
