-- GB-M30: normalize existing Management notifications; keep external delivery disabled.
-- Rows are transactional metadata, not message/task/complaint content or provider proof.
alter table public.notifications
  add column if not exists source_domain text,
  add column if not exists notification_type text,
  add column if not exists preference_category text,
  add column if not exists dedupe_key text,
  add column if not exists archived_at timestamptz;

create unique index if not exists management_notifications_recipient_dedupe_idx
  on public.notifications(recipient_id, dedupe_key) where dedupe_key is not null;
create index if not exists management_notifications_unread_idx
  on public.notifications(recipient_id, created_at desc)
  where read_at is null and archived_at is null;

alter table public.communication_preferences
  add column if not exists notification_category_channels jsonb not null default '{}'::jsonb,
  add column if not exists quiet_hours_start time,
  add column if not exists quiet_hours_end time,
  add column if not exists quiet_hours_timezone text not null default 'Asia/Jerusalem';

alter table public.communication_logs
  add column if not exists notification_id uuid references public.notifications(id) on delete set null,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists attempts integer not null default 0;
create index if not exists management_communication_logs_notification_idx
  on public.communication_logs(notification_id, channel) where notification_id is not null;
alter table public.communication_logs drop constraint if exists communication_logs_channel_check;
alter table public.communication_logs add constraint communication_logs_channel_check
  check (channel in ('in_app','sms','whatsapp','email','push'));
alter table public.communication_logs drop constraint if exists communication_logs_status_check;
alter table public.communication_logs add constraint communication_logs_status_check
  check (status in ('queued','sent_mock','sent','failed','delivered','read','skipped_preferences','deduped',
                   'unavailable','unverified_contact','suppressed_quiet_hours'));

create or replace function public.management_notification_domain(p_entity_type text)
returns text language sql immutable as $$
  select case
    when p_entity_type in ('communication_thread','message','messages') then 'messaging'
    when p_entity_type in ('task','tasks','workflow_task') then 'tasks'
    when p_entity_type in ('complaint','complaints') then 'complaints'
    when p_entity_type in ('inspection','monthly_inspection') then 'inspections'
    when p_entity_type in ('corrective_action','violation') then 'corrective_actions'
    when p_entity_type in ('tuition','tuition_billing_period','payment') then 'tuition'
    when p_entity_type in ('subscription','garden_subscription') then 'platform_subscription'
    when p_entity_type in ('enrollment','enrollment_request') then 'enrollment'
    when p_entity_type in ('invitation','staff_invitation') then 'invitations'
    else 'system' end;
$$;
revoke all on function public.management_notification_domain(text) from public, anon;
grant execute on function public.management_notification_domain(text) to authenticated, service_role;

create or replace function public.normalize_management_notification()
returns trigger language plpgsql security definer set search_path = public as $$
declare recipient public.profiles%rowtype; thread_row public.communication_threads%rowtype;
begin
  new.recipient_id := coalesce(new.recipient_id, new.recipient_profile_id);
  if new.recipient_id is null then return new; end if; -- historical role-only queue compatibility
  new.recipient_profile_id := new.recipient_id;
  select * into recipient from public.profiles where id = new.recipient_id;
  if recipient.id is null or recipient.active is false then return null; end if;
  new.garden_id := coalesce(new.garden_id, new.kindergarten_id);
  new.kindergarten_id := new.garden_id;
  -- The persisted source is derived from the domain entity, never a caller's label.
  new.source_domain := public.management_notification_domain(new.entity_type);
  if new.entity_type in ('observer_alert','digital_observer_event','safety_shadow') then
    return null; -- shadow/mock output cannot become a production Safety alert
  end if;
  new.notification_type := coalesce(new.notification_type, new.source_domain || '_update');
  new.preference_category := coalesce(new.preference_category,
    case new.source_domain when 'messaging' then 'message' when 'tuition' then 'payment'
      when 'platform_subscription' then 'payment' when 'corrective_actions' then 'inspection'
      else new.source_domain end);
  if new.source_domain = 'messaging' and new.entity_type = 'communication_thread' then
    select * into thread_row from public.communication_threads where id = new.entity_id;
    if thread_row.id is null or thread_row.garden_id is distinct from new.garden_id
      or not exists (select 1 from public.communication_thread_participants p
                     where p.thread_id=thread_row.id and p.profile_id=recipient.id and p.left_at is null)
    then return null; end if;
    if recipient.role::text = 'staff' and not exists (
      select 1 from public.staff_kindergarten_employments e
      where e.profile_id=recipient.id and e.garden_id=new.garden_id and e.status='active'
    ) then return null; end if;
    if recipient.role::text in ('manager','owner') and not exists (
      select 1 from public.garden_management_memberships m
      where m.profile_id=recipient.id and m.garden_id=new.garden_id and m.status='active'
    ) then return null; end if;
    if recipient.role::text = 'parent' and not exists (
      select 1 from public.child_guardian_links l
      join public.children c on c.permanent_child_file_id=l.permanent_child_file_id
      join public.child_kindergarten_enrollments e on e.child_id=c.id
      where l.guardian_profile_id=recipient.id and l.status='active' and l.legal_authority
        and e.garden_id=new.garden_id and e.status='active'
        and (thread_row.child_id is null or c.id=thread_row.child_id)
    ) then return null; end if;
    if recipient.role::text not in ('parent','staff','manager','owner') then return null; end if;
    new.title := case when coalesce(new.metadata->>'broadcast','false')='true' then 'הודעת גן חדשה' else 'הודעה חדשה' end;
    new.body := 'יש לך הודעה חדשה בגן';
    new.message := new.body;
    new.metadata := jsonb_build_object('message_id',new.metadata->>'message_id');
    new.notification_type := 'message_received';
    if new.metadata->>'message_id' is not null then
      new.dedupe_key := 'message:' || (new.metadata->>'message_id');
    end if;
  elsif new.source_domain = 'messaging' then
    new.title := 'הודעה חדשה';
    new.body := 'יש לך הודעה חדשה בגן';
    new.message := new.body;
    new.metadata := '{}'::jsonb;
  elsif new.source_domain in ('tasks','complaints') then
    if new.source_domain='tasks' and new.garden_id is not null and recipient.role::text='staff'
      and not exists (select 1 from public.staff_kindergarten_employments e
                      where e.profile_id=recipient.id and e.garden_id=new.garden_id and e.status='active')
    then return null; end if;
    if new.source_domain='tasks' and new.entity_type='task' and new.entity_id is not null
      and new.title='משימה חדשה' then
      new.notification_type := 'task_created';
      new.dedupe_key := coalesce(new.dedupe_key,'task:'||new.entity_id::text||':created');
    elsif new.source_domain='complaints' and new.entity_id is not null and new.title='תלונה חדשה' then
      new.notification_type := 'complaint_submitted';
      new.dedupe_key := coalesce(new.dedupe_key,'complaint:'||new.entity_id::text||':submitted');
    end if;
    -- Operational task titles and complaint descriptions do not belong on lock screens.
    new.title := case when new.source_domain='tasks' then 'עדכון משימה' else 'עדכון תלונה' end;
    new.body := 'יש עדכון חדש במערכת';
    new.message := new.body;
  end if;
  if new.dedupe_key is not null then
    new.dedupe_key := left(new.dedupe_key, 180);
    perform pg_advisory_xact_lock(hashtextextended(new.recipient_id::text || ':' || new.dedupe_key,0));
    if exists (select 1 from public.notifications n
               where n.recipient_id=new.recipient_id and n.dedupe_key=new.dedupe_key) then return null; end if;
  end if;
  return new;
end; $$;
revoke all on function public.normalize_management_notification() from public, anon, authenticated;
drop trigger if exists management_notification_normalize on public.notifications;
create trigger management_notification_normalize before insert on public.notifications
for each row execute function public.normalize_management_notification();

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
           when in_quiet then 'suppressed_quiet_hours' else 'unavailable' end,
      'not_configured', 'notification:'||new.id::text||':'||channel, new.id,
      jsonb_build_object('source_domain',new.source_domain,'category',new.preference_category),
      case when allowed and verified then 'GB-M31 provider delivery not configured' else null end,
      case when allowed and verified and in_quiet then quiet_until else null end)
    on conflict (dedupe_key) where dedupe_key is not null and btrim(dedupe_key) <> '' do nothing;
  end loop;
  return new;
end; $$;
revoke all on function public.queue_management_notification_intents() from public, anon, authenticated;
drop trigger if exists management_notification_intents on public.notifications;
create trigger management_notification_intents after insert on public.notifications
for each row execute function public.queue_management_notification_intents();

drop policy if exists "notifications recipient scoped" on public.notifications;
create policy "management notifications recipient only" on public.notifications for select
using (recipient_id=auth.uid() or recipient_profile_id=auth.uid());
drop policy if exists "communication preferences own read" on public.communication_preferences;
create policy "communication preferences own read" on public.communication_preferences
for select using (profile_id=auth.uid());
drop policy if exists "communication preferences own write" on public.communication_preferences;
create policy "communication preferences own write" on public.communication_preferences
for all using (profile_id=auth.uid()) with check (profile_id=auth.uid());
drop policy if exists "notifications recipient update" on public.notifications;
revoke update, delete on public.notifications from authenticated, anon;
drop policy if exists "notifications system insert" on public.notifications;
create policy "management notifications controlled insert" on public.notifications for insert
with check (
  garden_id is not null and public.can_manage_garden(garden_id)
      and ((entity_type='message' and exists (
        select 1 from public.messages source_message
        where source_message.id=notifications.entity_id
          and source_message.garden_id=notifications.garden_id
          and source_message.sender_id=auth.uid()
          and source_message.recipient_id=coalesce(notifications.recipient_id,notifications.recipient_profile_id)
      )) or (entity_type='task' and exists (
        select 1 from public.tasks source_task
        where source_task.id=notifications.entity_id
          and source_task.garden_id=notifications.garden_id
          and source_task.assigned_to=coalesce(notifications.recipient_id,notifications.recipient_profile_id)
      )))
      and coalesce(recipient_id,recipient_profile_id) in (
        select m.profile_id from public.garden_management_memberships m
          where m.garden_id=notifications.garden_id and m.status='active'
        union
        select e.profile_id from public.staff_kindergarten_employments e
          where e.garden_id=notifications.garden_id and e.status='active'
        union
        select l.guardian_profile_id from public.child_guardian_links l
          join public.children c on c.permanent_child_file_id=l.permanent_child_file_id
          join public.child_kindergarten_enrollments en on en.child_id=c.id and en.garden_id=notifications.garden_id and en.status='active'
          where l.status='active' and l.legal_authority
      )
);
drop policy if exists "communication logs notification private" on public.communication_logs;
create policy "communication logs notification private" on public.communication_logs as restrictive
for select using (notification_id is null or public.is_admin());
drop policy if exists "communication logs notification insert private" on public.communication_logs;
create policy "communication logs notification insert private" on public.communication_logs as restrictive
for insert with check (notification_id is null or public.is_admin());

create or replace function public.mark_management_notifications_read(p_ids uuid[] default null)
returns integer language plpgsql security definer set search_path=public as $$
declare changed integer;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  update public.notifications set read_at=coalesce(read_at,now()), status='read'
  where (recipient_id=auth.uid() or recipient_profile_id=auth.uid()) and read_at is null
    and (p_ids is null or id=any(p_ids));
  get diagnostics changed = row_count;
  return changed;
end; $$;
revoke all on function public.mark_management_notifications_read(uuid[]) from public, anon;
grant execute on function public.mark_management_notifications_read(uuid[]) to authenticated;
notify pgrst, 'reload schema';
