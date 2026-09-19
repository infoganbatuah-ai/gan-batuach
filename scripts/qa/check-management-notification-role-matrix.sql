-- Rollback-only synthetic recipient/RLS matrix on isolated Development.
begin;
insert into public.notifications(garden_id,recipient_id,title,body,entity_type,dedupe_key)
values
 ('00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000301','QA Staff A','QA','task','gbm30:role:staff-a'),
 ('00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000303','QA Staff AB A','QA','task','gbm30:role:staff-ab-a'),
 ('00000000-0000-4000-8000-000000000602','00000000-0000-4000-8000-000000000303','QA Staff AB B','QA','task','gbm30:role:staff-ab-b'),
 ('00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000201','QA Manager A','QA','system','gbm30:role:manager-a'),
 ('00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000304','QA Candidate','QA','task','gbm30:role:candidate'),
 ('00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000305','QA Revoked','QA','task','gbm30:role:revoked');
do $$ begin
 if (select count(*) from public.notifications where dedupe_key like 'gbm30:role:%')<>4
 then raise exception 'candidate_or_revoked_staff_not_suppressed'; end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000301',true);
do $$ begin
 if (select count(*) from public.notifications where dedupe_key like 'gbm30:role:%')<>1
 then raise exception 'staff_a_recipient_rls'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000303',true);
do $$ begin
 if (select count(*) from public.notifications where dedupe_key like 'gbm30:role:%')<>2
 then raise exception 'multi_garden_staff_recipient_rls'; end if;
 if (select count(distinct garden_id) from public.notifications where dedupe_key like 'gbm30:role:%')<>2
 then raise exception 'multi_garden_context_missing'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000201',true);
do $$ begin
 if (select count(*) from public.notifications where dedupe_key like 'gbm30:role:%')<>1
 then raise exception 'manager_cannot_read_only_own_notifications'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000401',true);
do $$ begin
 if exists (select 1 from public.notifications where dedupe_key like 'gbm30:role:%')
 then raise exception 'inspector_inherited_garden_notifications'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000501',true);
do $$ begin
 if exists (select 1 from public.notifications where dedupe_key like 'gbm30:role:%')
 then raise exception 'admin_blanket_notification_read'; end if;
end $$;
reset role;
select 'GB-M30 direct synthetic recipient/RLS matrix PASS';
rollback;
