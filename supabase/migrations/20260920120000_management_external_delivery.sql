-- GB-M31: bounded server-only delivery claims; provider submission remains disabled until configured.
-- Reuse GB-M30 communication_logs. No historical row is rewritten.
alter table public.communication_logs
  add column if not exists lease_token uuid,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists estimated_cost_ils numeric(12,4),
  add column if not exists actual_cost_ils numeric(12,4);
alter table public.communication_logs drop constraint if exists communication_logs_status_check;
alter table public.communication_logs add constraint communication_logs_status_check check (status in (
  'queued','sent_mock','sent','failed','delivered','read','skipped_preferences','deduped',
  'unavailable','unverified_contact','suppressed_quiet_hours','sending','accepted_by_provider',
  'failed_transient','failed_permanent','bounced','expired'));
create index if not exists management_delivery_claim_idx on public.communication_logs(next_attempt_at,created_at)
  where notification_id is not null and status in ('queued','failed_transient','suppressed_quiet_hours');

create or replace function public.queue_management_notification_intents()
returns trigger language plpgsql security definer set search_path = public as $$
declare pref public.communication_preferences%rowtype; recipient public.profiles%rowtype;
  channels jsonb; channel text; allowed boolean; verified boolean; in_quiet boolean;
  local_time time; timezone_name text; quiet_until timestamptz;
begin
  if new.recipient_id is null or new.channel <> 'in_app' then return new; end if;
  select * into pref from public.communication_preferences where profile_id=new.recipient_id;
  if pref.id is null then return new; end if; -- no external intent without explicit preferences
  select * into recipient from public.profiles where id=new.recipient_id;
  channels := coalesce(pref.notification_category_channels->new.preference_category,
                       pref.parent_category_channels->new.preference_category, '[]'::jsonb);
  if jsonb_typeof(channels) <> 'array' then return new; end if;
  timezone_name := case when exists
    (select 1 from pg_timezone_names where name=pref.quiet_hours_timezone)
    then pref.quiet_hours_timezone else 'Asia/Jerusalem' end;
  local_time := (now() at time zone timezone_name)::time;
  in_quiet := pref.quiet_hours_start is not null and pref.quiet_hours_end is not null
    and pref.quiet_hours_start <> pref.quiet_hours_end and
    case when pref.quiet_hours_start < pref.quiet_hours_end
      then local_time >= pref.quiet_hours_start and local_time < pref.quiet_hours_end
      else local_time >= pref.quiet_hours_start or local_time < pref.quiet_hours_end end;
  if in_quiet then
    quiet_until := (((now() at time zone timezone_name)::date
      + case when local_time >= pref.quiet_hours_end then 1 else 0 end)
      + pref.quiet_hours_end) at time zone timezone_name;
  end if;
  for channel in select distinct value from jsonb_array_elements_text(channels) as c(value)
  loop
    if channel not in ('push','email','sms','whatsapp') then continue; end if;
    allowed := case channel when 'email' then pref.receive_email
      when 'sms' then pref.receive_sms when 'whatsapp' then pref.receive_whatsapp
      else pref.receive_push end;
    if channel='push' then
      allowed := allowed and coalesce((select pc.enabled from public.push_category_preferences pc
        where pc.profile_id=new.recipient_id and pc.category=new.preference_category),true);
    end if;
    verified := case channel when 'email' then recipient.email_verified_at is not null
      when 'sms' then recipient.phone_verified_at is not null
      when 'whatsapp' then recipient.phone_verified_at is not null else true end;
    insert into public.communication_logs
      (recipient_profile_id,kindergarten_id,channel,template_key,status,provider,dedupe_key,
       notification_id,metadata,failure_reason,next_attempt_at)
    values (new.recipient_id,new.garden_id,channel,new.notification_type,
      case when not allowed then 'skipped_preferences' when not verified then 'unverified_contact'
           when in_quiet then 'suppressed_quiet_hours' else 'queued' end,
      'not_configured', 'notification:'||new.id::text||':'||channel, new.id,
      jsonb_build_object('source_domain',new.source_domain,'category',new.preference_category),
      null,
      case when allowed and verified and in_quiet then quiet_until else null end)
    on conflict (dedupe_key) where dedupe_key is not null and btrim(dedupe_key) <> '' do nothing;
  end loop;
  return new;
end; $$;

-- A worker cannot claim an in-flight row again. Expired leases require manual reconciliation:
-- automatic retry after an uncertain provider request could double bill.
create or replace function public.claim_management_delivery_intents(p_limit integer default 20)
returns setof public.communication_logs language plpgsql security definer set search_path=public as $$
begin
  if auth.role() <> 'service_role' then raise exception 'service_role_required' using errcode='42501'; end if;
  return query
  with picked as (
    select l.id from public.communication_logs l
    where l.notification_id is not null and l.status in ('queued','failed_transient','suppressed_quiet_hours')
      and l.attempts < 3 and (l.next_attempt_at is null or l.next_attempt_at <= now())
    order by l.created_at, l.id limit least(greatest(p_limit,1),50)
    for update skip locked
  )
  update public.communication_logs l set status='sending', attempts=l.attempts+1,
    lease_token=gen_random_uuid(), lease_expires_at=now()+interval '5 minutes', updated_at=now()
  from picked where l.id=picked.id returning l.*;
end $$;
revoke all on function public.claim_management_delivery_intents(integer) from public, anon, authenticated;
grant execute on function public.claim_management_delivery_intents(integer) to service_role;

create or replace function public.finish_management_delivery_intent(
  p_id uuid,p_lease_token uuid,p_status text,p_provider text,p_provider_message_id text default null,
  p_failure_code text default null,p_retry_at timestamptz default null,p_estimated_cost_ils numeric default null)
returns boolean language plpgsql security definer set search_path=public as $$
declare changed integer;
begin
  if auth.role() <> 'service_role' then raise exception 'service_role_required' using errcode='42501'; end if;
  if p_status not in ('accepted_by_provider','unavailable','unverified_contact','skipped_preferences','suppressed_quiet_hours',
     'failed_transient','failed_permanent','bounced','expired') then raise exception 'invalid_delivery_status' using errcode='23514'; end if;
  update public.communication_logs set status=p_status, provider=left(p_provider,80),
    provider_message_id=left(p_provider_message_id,200),failure_reason=left(p_failure_code,120),
    next_attempt_at=case when (p_status='failed_transient' and attempts < 3) or p_status='suppressed_quiet_hours' then p_retry_at else null end,
    attempts=case when p_status='suppressed_quiet_hours' then greatest(attempts-1,0) else attempts end,
    accepted_at=case when p_status='accepted_by_provider' then now() else accepted_at end,
    sent_at=case when p_status='accepted_by_provider' then now() else sent_at end,
    estimated_cost_ils=p_estimated_cost_ils,lease_token=null,lease_expires_at=null,updated_at=now()
  where id=p_id and status='sending' and lease_token=p_lease_token;
  get diagnostics changed=row_count;
  return changed=1;
end $$;
revoke all on function public.finish_management_delivery_intent(uuid,uuid,text,text,text,text,timestamptz,numeric) from public,anon,authenticated;
grant execute on function public.finish_management_delivery_intent(uuid,uuid,text,text,text,text,timestamptz,numeric) to service_role;

create or replace function public.management_delivery_recipient_authorized(p_notification_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.notifications n join public.profiles p on p.id=n.recipient_id
    where n.id=p_notification_id and p.active=true and (
      (n.garden_id is null and n.source_domain <> 'messaging')
      or (p.role::text='staff' and exists (
        select 1 from public.staff_kindergarten_employments e
        where e.profile_id=p.id and e.garden_id=n.garden_id and e.status='active'))
      or (p.role::text in ('manager','owner') and exists (
        select 1 from public.garden_management_memberships m
        where m.profile_id=p.id and m.garden_id=n.garden_id and m.status='active'))
      or (p.role::text='parent' and exists (
        select 1 from public.child_guardian_links l
        join public.children c on c.permanent_child_file_id=l.permanent_child_file_id
        join public.child_kindergarten_enrollments e on e.child_id=c.id
        where l.guardian_profile_id=p.id and l.status='active' and l.legal_authority
          and e.garden_id=n.garden_id and e.status='active'
          and (n.child_id is null or c.id=n.child_id)))
      or (p.role::text='inspector' and n.source_domain in ('inspections','corrective_actions','complaints')
        and public.is_approved_inspector(p.id)
        and exists(select 1 from public.gardens g where g.id=n.garden_id and g.inspector_id=p.id))
    )
  );
$$;
revoke all on function public.management_delivery_recipient_authorized(uuid) from public,anon,authenticated;
grant execute on function public.management_delivery_recipient_authorized(uuid) to service_role;

-- Minimal verified receipt index. No raw provider payload or destination is retained.
create table if not exists public.management_delivery_receipts (
  provider text not null,
  event_id text not null,
  communication_log_id uuid not null references public.communication_logs(id) on delete restrict,
  normalized_status text not null check (normalized_status in ('accepted_by_provider','delivered','bounced','failed_permanent')),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  primary key(provider,event_id)
);
create index if not exists management_delivery_receipts_log_idx on public.management_delivery_receipts(communication_log_id,received_at desc);
alter table public.management_delivery_receipts enable row level security;
revoke all on public.management_delivery_receipts from public,anon,authenticated;
grant select,insert on public.management_delivery_receipts to service_role;

create or replace function public.apply_management_delivery_receipt(
  p_provider text,p_event_id text,p_provider_message_id text,p_status text,p_occurred_at timestamptz)
returns boolean language plpgsql security definer set search_path=public as $$
declare target public.communication_logs%rowtype; inserted integer;
begin
  if auth.role() <> 'service_role' then raise exception 'service_role_required' using errcode='42501'; end if;
  if p_status not in ('accepted_by_provider','delivered','bounced','failed_permanent')
    or length(p_event_id)>200 or length(p_provider_message_id)>200 then raise exception 'invalid_delivery_receipt' using errcode='23514'; end if;
  select * into target from public.communication_logs
   where notification_id is not null and provider=p_provider and provider_message_id=p_provider_message_id
   order by created_at desc limit 1 for update;
  if target.id is null then return false; end if;
  insert into public.management_delivery_receipts(provider,event_id,communication_log_id,normalized_status,occurred_at)
    values(p_provider,p_event_id,target.id,p_status,p_occurred_at) on conflict do nothing;
  get diagnostics inserted=row_count;
  if inserted=0 then return true; end if;
  -- A delayed acceptance receipt cannot regress a delivered or bounced state.
  if target.status in ('delivered','bounced','failed_permanent') then return true; end if;
  if p_status='accepted_by_provider' and target.status='accepted_by_provider' then return true; end if;
  update public.communication_logs set status=p_status,
    delivered_at=case when p_status='delivered' then p_occurred_at else delivered_at end,
    failure_reason=case when p_status in ('bounced','failed_permanent') then p_status else failure_reason end,
    updated_at=now() where id=target.id;
  return true;
end $$;
revoke all on function public.apply_management_delivery_receipt(text,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.apply_management_delivery_receipt(text,text,text,text,timestamptz) to service_role;

create or replace function public.management_delivery_cost_summary(p_month date)
returns table(garden_id uuid,channel text,provider text,intent_count bigint,submission_attempts bigint,
  estimated_cost_ils numeric,actual_cost_ils numeric,unknown_cost_count bigint)
language plpgsql stable security definer set search_path=public as $$
begin
  if auth.role()<>'service_role' and not public.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  return query select l.kindergarten_id,l.channel,l.provider,count(*),sum(l.attempts)::bigint,
    sum(l.estimated_cost_ils),sum(l.actual_cost_ils),count(*) filter (where l.actual_cost_ils is null)
  from public.communication_logs l
  where l.notification_id is not null and l.created_at>=date_trunc('month',p_month::timestamp)
    and l.created_at<date_trunc('month',p_month::timestamp)+interval '1 month'
  group by l.kindergarten_id,l.channel,l.provider;
end $$;
revoke all on function public.management_delivery_cost_summary(date) from public,anon,authenticated;
grant execute on function public.management_delivery_cost_summary(date) to service_role;

comment on table public.management_delivery_receipts is
  'Verified provider event identifiers only. No payload, content, address, token, or secret. Retention requires approved financial/security policy before automated deletion.';
