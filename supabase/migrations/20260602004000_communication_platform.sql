create table if not exists public.communication_preferences (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  receive_sms boolean not null default false,
  receive_whatsapp boolean not null default false,
  receive_email boolean not null default true,
  emergency_messages_allowed boolean not null default true,
  preferred_language text not null default 'he',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean not null default false,
  demo_batch_id text,
  unique (profile_id)
);

create table if not exists public.kindergarten_communication_settings (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  default_parent_channel text not null default 'in_app',
  sms_enabled boolean not null default false,
  whatsapp_enabled boolean not null default false,
  email_fallback_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean not null default false,
  demo_batch_id text,
  unique (garden_id),
  constraint kindergarten_communication_default_channel_check
    check (default_parent_channel in ('in_app', 'sms', 'whatsapp', 'email'))
);

create table if not exists public.communication_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  audience_role text not null,
  title text not null,
  body text not null,
  whatsapp_template_name text,
  whatsapp_template_language text not null default 'he',
  approved_template_variables jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean not null default false,
  demo_batch_id text
);

create table if not exists public.communication_logs (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid references public.profiles(id) on delete set null,
  kindergarten_id uuid references public.gardens(id) on delete set null,
  channel text not null,
  template_key text not null,
  recipient_phone text,
  recipient_email text,
  message_preview text,
  status text not null default 'queued',
  provider text not null default 'mock',
  provider_message_id text,
  failure_reason text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  dedupe_key text,
  created_at timestamptz not null default now(),
  is_demo boolean not null default false,
  demo_batch_id text,
  constraint communication_logs_channel_check
    check (channel in ('in_app', 'sms', 'whatsapp', 'email')),
  constraint communication_logs_status_check
    check (status in ('queued', 'sent_mock', 'sent', 'failed', 'delivered', 'read', 'skipped_preferences', 'deduped'))
);

create unique index if not exists communication_logs_dedupe_key_idx
  on public.communication_logs (dedupe_key)
  where dedupe_key is not null and btrim(dedupe_key) <> '';

create index if not exists communication_logs_kindergarten_idx on public.communication_logs(kindergarten_id, created_at desc);
create index if not exists communication_logs_recipient_idx on public.communication_logs(recipient_profile_id, created_at desc);
create index if not exists communication_logs_channel_status_idx on public.communication_logs(channel, status, created_at desc);
create index if not exists communication_preferences_profile_idx on public.communication_preferences(profile_id);

alter table public.communication_preferences enable row level security;
alter table public.kindergarten_communication_settings enable row level security;
alter table public.communication_templates enable row level security;
alter table public.communication_logs enable row level security;

drop policy if exists "communication preferences own read" on public.communication_preferences;
create policy "communication preferences own read" on public.communication_preferences
for select using (public.is_admin() or profile_id = auth.uid());

drop policy if exists "communication preferences own write" on public.communication_preferences;
create policy "communication preferences own write" on public.communication_preferences
for all using (public.is_admin() or profile_id = auth.uid())
with check (public.is_admin() or profile_id = auth.uid());

drop policy if exists "kindergarten communication settings scoped read" on public.kindergarten_communication_settings;
create policy "kindergarten communication settings scoped read" on public.kindergarten_communication_settings
for select using (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "kindergarten communication settings manager write" on public.kindergarten_communication_settings;
create policy "kindergarten communication settings manager write" on public.kindergarten_communication_settings
for all using (public.is_admin() or public.can_access_garden(garden_id))
with check (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "communication templates readable" on public.communication_templates;
create policy "communication templates readable" on public.communication_templates
for select using (active = true or public.is_admin());

drop policy if exists "communication templates admin write" on public.communication_templates;
create policy "communication templates admin write" on public.communication_templates
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "communication logs scoped read" on public.communication_logs;
create policy "communication logs scoped read" on public.communication_logs
for select using (
  public.is_admin()
  or recipient_profile_id = auth.uid()
  or (kindergarten_id is not null and public.can_access_garden(kindergarten_id))
);

drop policy if exists "communication logs scoped insert" on public.communication_logs;
create policy "communication logs scoped insert" on public.communication_logs
for insert with check (
  public.is_admin()
  or recipient_profile_id = auth.uid()
  or (kindergarten_id is not null and public.can_access_garden(kindergarten_id))
);

drop policy if exists "communication logs admin update" on public.communication_logs;
create policy "communication logs admin update" on public.communication_logs
for update using (public.is_admin())
with check (public.is_admin());

insert into public.communication_templates (template_key, audience_role, title, body, whatsapp_template_name, approved_template_variables)
values
  ('parent_lead_submitted', 'parent', 'בקשת ההצטרפות נשלחה', 'בקשת ההצטרפות לגן התקבלה ונשלחה לאישור.', 'parent_lead_submitted_he', '["kindergartenName"]'::jsonb),
  ('parent_approved', 'parent', 'הגן אישר את בקשת ההצטרפות', 'הגן אישר את הבקשה. ניתן להתחבר ולהשלים את כרטיס הילד.', 'parent_approved_he', '["kindergartenName","childName"]'::jsonb),
  ('child_profile_needs_completion', 'parent', 'צריך להשלים את פרטי הילד', 'נדרש להשלים את כרטיס הילד כדי שהגן יוכל לאשר את הרישום.', 'child_profile_needs_completion_he', '["childName"]'::jsonb),
  ('child_approved', 'parent', 'הילד אושר בגן', 'כרטיס הילד אושר והילד פעיל בגן.', 'child_approved_he', '["childName","kindergartenName"]'::jsonb),
  ('child_rejected', 'parent', 'עדכון מבקשת הרישום', 'הגן עדכן את סטטוס בקשת הרישום. יש להיכנס למערכת לפרטים.', 'child_rejected_he', '["childName"]'::jsonb),
  ('document_requested', 'parent', 'נדרש מסמך', 'הגן ביקש להשלים מסמך עבור הילד.', 'document_requested_he', '["childName"]'::jsonb),
  ('payment_failed', 'parent', 'תשלום לא עבר', 'הגן סימן שתשלום לא עבר ויש צורך בבדיקה.', 'payment_failed_he', '["childName","amount"]'::jsonb),
  ('payment_due', 'parent', 'תשלום קרוב', 'יש תשלום קרוב עבור הגן.', 'payment_due_he', '["childName","dueDate"]'::jsonb),
  ('daily_update', 'parent', 'עדכון חדש מהגן', 'יש עדכון חדש לגבי היום של הילד.', 'daily_update_he', '["childName"]'::jsonb),
  ('request_answered', 'parent', 'הפנייה שלך נענתה', 'הגן השיב לפנייה שלך.', 'request_answered_he', '["childName"]'::jsonb),
  ('new_parent_lead', 'manager', 'בקשת הצטרפות חדשה', 'התקבלה בקשת הצטרפות חדשה מגן/הורה.', 'new_parent_lead_he', '["parentName","childName"]'::jsonb),
  ('child_pending_approval', 'manager', 'ילד ממתין לאישור', 'הורה השלים כרטיס ילד שממתין לאישור הגן.', 'child_pending_approval_he', '["childName"]'::jsonb),
  ('parent_request_received', 'manager', 'פניית הורה חדשה', 'התקבלה פנייה חדשה מהורה.', 'parent_request_received_he', '["parentName","childName"]'::jsonb),
  ('manager_payment_failed', 'manager', 'תשלום לא עבר', 'תשלום סומן כלא עבר וממתין לטיפול.', 'manager_payment_failed_he', '["childName"]'::jsonb),
  ('subscription_renewal', 'manager', 'חידוש מנוי מתקרב', 'מועד חידוש המנוי מתקרב.', 'subscription_renewal_he', '["kindergartenName","renewalDate"]'::jsonb),
  ('camera_issue', 'manager', 'מצלמה דורשת בדיקה', 'אחת המצלמות אינה מחוברת או דורשת טיפול.', 'camera_issue_he', '["cameraName"]'::jsonb),
  ('inspection_due', 'manager', 'פיקוח מתקרב', 'ביקורת/פיקוח מתקרבים ויש להיערך.', 'inspection_due_he', '["dueDate"]'::jsonb),
  ('staff_new_task', 'staff', 'משימה חדשה', 'הוקצתה לך משימה חדשה.', 'staff_new_task_he', '["taskTitle"]'::jsonb),
  ('staff_missing_document', 'staff', 'חסר מסמך', 'נדרש להשלים מסמך צוות.', 'staff_missing_document_he', '["documentName"]'::jsonb),
  ('manager_message', 'staff', 'הודעה מהמנהלת', 'התקבלה הודעה חדשה מהגן.', 'manager_message_he', '["managerName"]'::jsonb),
  ('inspection_assigned', 'inspector', 'ביקורת חדשה שובצה', 'שובצה לך ביקורת חדשה.', 'inspection_assigned_he', '["kindergartenName","dueDate"]'::jsonb),
  ('violation_opened', 'inspector', 'ליקוי חדש נפתח', 'נפתח ליקוי חדש למעקב.', 'violation_opened_he', '["kindergartenName"]'::jsonb),
  ('new_kindergarten_request', 'admin', 'בקשת גן חדשה', 'התקבלה בקשה חדשה לצירוף גן.', 'new_kindergarten_request_he', '["kindergartenName"]'::jsonb),
  ('subscription_issue', 'admin', 'בעיית מנוי', 'זוהתה בעיית מנוי שדורשת בדיקה.', 'subscription_issue_he', '["kindergartenName"]'::jsonb),
  ('system_alert', 'admin', 'התראת מערכת', 'אירוע מערכת דורש בדיקה.', 'system_alert_he', '["severity"]'::jsonb)
on conflict (template_key) do update set
  audience_role = excluded.audience_role,
  title = excluded.title,
  body = excluded.body,
  whatsapp_template_name = excluded.whatsapp_template_name,
  approved_template_variables = excluded.approved_template_variables,
  updated_at = now();
