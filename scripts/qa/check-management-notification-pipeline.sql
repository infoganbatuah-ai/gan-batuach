insert into public.communication_preferences(profile_id,receive_sms,notification_category_channels)
values ('00000000-0000-4000-8000-000000000101',true,'{"message":["sms","push"]}'::jsonb)
on conflict(profile_id) do update set receive_sms=true,notification_category_channels='{"message":["sms","push"]}'::jsonb;
insert into public.push_category_preferences(profile_id,category,enabled)
values ('00000000-0000-4000-8000-000000000101','message',false)
on conflict(profile_id,category) do update set enabled=false;

insert into public.notifications(garden_id,recipient_id,title,body,entity_type,entity_id,metadata)
values ('00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000101',
        'SECRET SUBJECT','SECRET MESSAGE BODY','communication_thread','c799367d-f860-44ff-89a2-fcdf2cbf0656',
        '{"message_id":"a1111111-1111-4111-8111-111111111111"}');
insert into public.notifications(garden_id,recipient_id,title,body,entity_type,entity_id,metadata)
values ('00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000101',
        'SECRET SUBJECT','SECRET MESSAGE BODY','communication_thread','c799367d-f860-44ff-89a2-fcdf2cbf0656',
        '{"message_id":"a1111111-1111-4111-8111-111111111111"}');
insert into public.notifications(garden_id,recipient_id,title,body,entity_type,entity_id,metadata)
values ('00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000102',
        'SECRET SUBJECT','SECRET MESSAGE BODY','communication_thread','c799367d-f860-44ff-89a2-fcdf2cbf0656',
        '{"message_id":"a1111111-1111-4111-8111-111111111111"}');
insert into public.notifications(garden_id,recipient_id,title,body,entity_type,entity_id,metadata)
select '00000000-0000-4000-8000-000000000601', id, 'SECRET SUBJECT','SECRET MESSAGE BODY',
  'communication_thread','c799367d-f860-44ff-89a2-fcdf2cbf0656',
  '{"message_id":"a1111111-1111-4111-8111-111111111111"}'::jsonb
from public.profiles where id in ('00000000-0000-4000-8000-000000000305',
  '00000000-0000-4000-8000-000000000401','00000000-0000-4000-8000-000000000501');
insert into public.notifications(garden_id,recipient_id,title,body,entity_type,entity_id)
values ('00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000101',
        'shadow','shadow','observer_alert','a1111111-1111-4111-8111-111111111112');

do $$ begin
  if (select count(*) from public.notifications where dedupe_key='message:a1111111-1111-4111-8111-111111111111') <> 1 then raise exception 'message_dedupe_or_parent_staff_inspector_admin_scope_failed'; end if;
  if exists (select 1 from public.notifications where title like '%SECRET%' or body like '%SECRET%' or entity_type='observer_alert') then raise exception 'sensitive_content_or_shadow_leaked'; end if;
  if (select count(*) from public.communication_logs where dedupe_key like 'notification:%:sms' and status='unverified_contact' and provider='not_configured') <> 1 then raise exception 'unverified_sms_not_suppressed'; end if;
  if (select count(*) from public.communication_logs where dedupe_key like 'notification:%:push' and status='skipped_preferences') <> 1 then raise exception 'push_category_preference_ignored'; end if;
  if exists (select 1 from public.communication_logs where dedupe_key like 'notification:%:sms' and (sent_at is not null or recipient_phone is not null or message_preview is not null)) then raise exception 'external_content_or_delivery_claim'; end if;
end $$;

update public.push_category_preferences set enabled=true
where profile_id='00000000-0000-4000-8000-000000000101' and category='message';
update public.communication_preferences
set quiet_hours_start=((now() at time zone 'Asia/Jerusalem')::time - interval '1 minute'),
    quiet_hours_end=((now() at time zone 'Asia/Jerusalem')::time + interval '1 minute')
where profile_id='00000000-0000-4000-8000-000000000101';
insert into public.notifications(garden_id,recipient_id,title,body,entity_type,entity_id,metadata)
values ('00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000101',
  'SECRET SUBJECT','SECRET MESSAGE BODY','communication_thread','c799367d-f860-44ff-89a2-fcdf2cbf0656',
  '{"message_id":"a2222222-2222-4222-8222-222222222222"}');
do $$ begin
  if not exists (select 1 from public.communication_logs l
    join public.notifications n on n.id=l.notification_id
    where n.dedupe_key='message:a2222222-2222-4222-8222-222222222222'
      and l.channel='push' and l.status='suppressed_quiet_hours'
      and l.next_attempt_at>now() and l.sent_at is null)
  then raise exception 'quiet_hours_not_respected'; end if;
end $$;

select set_config('gb_m30.target_notification_id',
  (select id::text from public.notifications where dedupe_key='message:a1111111-1111-4111-8111-111111111111'),true);
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',true);
do $$ declare changed integer; begin
  if exists (select 1 from public.notifications where dedupe_key='message:a1111111-1111-4111-8111-111111111111') then raise exception 'cross_user_read'; end if;
  if public.mark_management_notifications_read(array[current_setting('gb_m30.target_notification_id')::uuid]) <> 0 then raise exception 'cross_user_mark_read'; end if;
  if exists (select 1 from public.communication_preferences where profile_id='00000000-0000-4000-8000-000000000101') then raise exception 'cross_user_preferences_read'; end if;
  update public.communication_preferences set receive_sms=false
    where profile_id='00000000-0000-4000-8000-000000000101';
  get diagnostics changed=row_count;
  if changed <> 0 then raise exception 'cross_user_preferences_update'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
do $$ begin
  if (select count(*) from public.notifications where dedupe_key='message:a1111111-1111-4111-8111-111111111111') <> 1 then raise exception 'owner_read_failed'; end if;
  if public.mark_management_notifications_read(array[(select id from public.notifications where dedupe_key='message:a1111111-1111-4111-8111-111111111111')]) <> 1 then raise exception 'owner_mark_read_failed'; end if;
  begin
    insert into public.notifications(recipient_id,title,body,entity_type)
    values ('00000000-0000-4000-8000-000000000101','fake payment received','paid','payment');
    raise exception 'client_forged_financial_notification';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000201',true);
insert into public.notifications(garden_id,recipient_id,title,body,entity_type,entity_id)
values ('00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000303',
  'private legacy subject','private legacy body','message','7997ac32-c18b-4bef-9bf6-7142cd49f3a2');
do $$ begin
  if (select count(*) from public.notifications where entity_id='7997ac32-c18b-4bef-9bf6-7142cd49f3a2') <> 0 then
    raise exception 'manager_can_read_staff_notification';
  end if;
  begin
    insert into public.notifications(garden_id,recipient_id,title,body,entity_type,entity_id)
    values ('00000000-0000-4000-8000-000000000602',
      '00000000-0000-4000-8000-000000000302','forged B','forged B','message',
      '7997ac32-c18b-4bef-9bf6-7142cd49f3a2');
    raise exception 'manager_cross_garden_insert';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$ begin
  if not exists (select 1 from public.notifications where entity_id='7997ac32-c18b-4bef-9bf6-7142cd49f3a2'
      and title='הודעה חדשה' and body='יש לך הודעה חדשה בגן') then
    raise exception 'authorized_legacy_manager_message_notification_failed';
  end if;
end $$;
select 'GB-M30 synthetic transactional notification QA PASS';
