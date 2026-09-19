-- Run with GB-M31 migrations inside a rollback-only synthetic Development transaction.
update public.profiles set contact_verification_required=true,email_verified_at=now(),phone_verified_at=null
where id='00000000-0000-4000-8000-000000000101';
do $$ begin
  if not public.management_account_verification_satisfied('00000000-0000-4000-8000-000000000101') then raise exception 'email_only_account_blocked'; end if;
end $$;
update public.profiles set email_verified_at=null where id='00000000-0000-4000-8000-000000000101';
do $$ begin
  if public.management_account_verification_satisfied('00000000-0000-4000-8000-000000000101') then raise exception 'unverified_email_accepted'; end if;
end $$;
update public.profiles set email_verified_at=now() where id='00000000-0000-4000-8000-000000000101';
insert into public.communication_preferences(profile_id,receive_email,notification_category_channels)
values('00000000-0000-4000-8000-000000000101',true,'{"system":["email"]}'::jsonb)
on conflict(profile_id) do update set receive_email=true,notification_category_channels='{"system":["email"]}'::jsonb,
  quiet_hours_start=null,quiet_hours_end=null;
insert into public.notifications(garden_id,recipient_id,title,body,entity_type,dedupe_key)
values('00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000101',
  'Synthetic QA','Synthetic QA','system','gbm31:synthetic:delivery');
select set_config('gb_m31.notification_id',id::text,true) from public.notifications where dedupe_key='gbm31:synthetic:delivery';
do $$ begin
  if (select count(*) from public.communication_logs where notification_id=current_setting('gb_m31.notification_id')::uuid
    and channel='email' and status='queued')<>1 then raise exception 'delivery_not_queued_once'; end if;
  if exists(select 1 from public.communication_logs where notification_id=current_setting('gb_m31.notification_id')::uuid
    and (recipient_email is not null or message_preview is not null or sent_at is not null)) then raise exception 'false_send_or_private_content'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',true);
do $$ begin
  if exists(select 1 from public.communication_logs where notification_id=current_setting('gb_m31.notification_id')::uuid) then raise exception 'cross_user_log_read'; end if;
  begin
    perform public.claim_management_delivery_intents(1);
    raise exception 'authenticated_claim_succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select set_config('gb_m31.intent_id',id::text,true),set_config('gb_m31.lease_token',lease_token::text,true)
from public.claim_management_delivery_intents(1)
where notification_id=current_setting('gb_m31.notification_id')::uuid;
do $$ begin
  if current_setting('gb_m31.intent_id',true) is null then raise exception 'claim_missing'; end if;
  if exists(select 1 from public.claim_management_delivery_intents(1) where id=current_setting('gb_m31.intent_id')::uuid) then raise exception 'duplicate_claim'; end if;
  if not public.finish_management_delivery_intent(current_setting('gb_m31.intent_id')::uuid,current_setting('gb_m31.lease_token')::uuid,'accepted_by_provider','resend','synthetic-provider-message',null,null,null) then raise exception 'finish_failed'; end if;
  if public.finish_management_delivery_intent(current_setting('gb_m31.intent_id')::uuid,current_setting('gb_m31.lease_token')::uuid,'accepted_by_provider','resend','synthetic-provider-message',null,null,null) then raise exception 'duplicate_finish'; end if;
  if not public.apply_management_delivery_receipt('resend','synthetic-event-1','synthetic-provider-message','delivered',now()) then raise exception 'receipt_failed'; end if;
  if not public.apply_management_delivery_receipt('resend','synthetic-event-1','synthetic-provider-message','delivered',now()) then raise exception 'receipt_replay_failed'; end if;
  if not public.apply_management_delivery_receipt('resend','synthetic-event-2','synthetic-provider-message','accepted_by_provider',now()-interval '1 minute') then raise exception 'out_of_order_receipt_failed'; end if;
  if (select status from public.communication_logs where id=current_setting('gb_m31.intent_id')::uuid)<>'delivered' then raise exception 'out_of_order_status_regression'; end if;
  if (select count(*) from public.management_delivery_receipts where communication_log_id=current_setting('gb_m31.intent_id')::uuid)<>2 then raise exception 'receipt_dedupe_failed'; end if;
end $$;
reset role;
