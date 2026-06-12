-- PHASE 142: Customer success, support, training and knowledge platform.
-- Proactive success layer after activation. No customer data is exposed across tenants.

create table if not exists public.customer_health_scores (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  customer_health_score integer not null default 0,
  platform_usage_score integer not null default 0,
  login_frequency_score integer not null default 0,
  parent_adoption_score integer not null default 0,
  staff_adoption_score integer not null default 0,
  inspection_completion_score integer not null default 0,
  compliance_completion_score integer not null default 0,
  renewal_risk_level text not null default 'low',
  lifecycle_status text not null default 'active',
  explanation text,
  calculated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_health_score_range_check check (
    customer_health_score between 0 and 100
    and platform_usage_score between 0 and 100
    and login_frequency_score between 0 and 100
    and parent_adoption_score between 0 and 100
    and staff_adoption_score between 0 and 100
    and inspection_completion_score between 0 and 100
    and compliance_completion_score between 0 and 100
  ),
  constraint customer_health_renewal_risk_check check (renewal_risk_level in ('low','medium','high','critical')),
  constraint customer_lifecycle_status_check check (lifecycle_status in ('lead','demo_booked','approved','onboarding','active','at_risk','renewal_pending','suspended','churned'))
);

create table if not exists public.customer_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid references public.gardens(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  previous_status text,
  new_status text not null,
  reason text,
  changed_by uuid references public.profiles(id) on delete set null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint customer_lifecycle_event_status_check check (new_status in ('lead','demo_booked','approved','onboarding','active','at_risk','renewal_pending','suspended','churned'))
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique default ('CS-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  garden_id uuid references public.gardens(id) on delete cascade,
  requester_profile_id uuid references public.profiles(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  ticket_type text not null default 'issue',
  priority text not null default 'normal',
  status text not null default 'open',
  subject text not null,
  description text,
  channel text not null default 'in_app',
  first_response_due_at timestamptz,
  resolution_due_at timestamptz,
  first_responded_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  satisfaction_rating integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_ticket_type_check check (ticket_type in ('issue','feature_request','bug','billing','onboarding','training','technical','account')),
  constraint support_ticket_priority_check check (priority in ('low','normal','important','urgent','critical')),
  constraint support_ticket_status_check check (status in ('open','assigned','in_progress','waiting_customer','resolved','closed')),
  constraint support_ticket_channel_check check (channel in ('whatsapp','email','in_app','phone','admin')),
  constraint support_ticket_satisfaction_check check (satisfaction_rating is null or satisfaction_rating between 1 and 5)
);

create table if not exists public.training_hub_items (
  id uuid primary key default gen_random_uuid(),
  item_key text not null unique,
  audience_role text not null,
  title text not null,
  description text,
  content_type text not null default 'guide',
  content_url text,
  checklist jsonb not null default '[]'::jsonb,
  required_for_onboarding boolean not null default false,
  estimated_minutes integer not null default 5,
  active boolean not null default true,
  display_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_hub_audience_check check (audience_role in ('manager','owner','staff','parent','inspector','admin','network_manager','all')),
  constraint training_hub_content_type_check check (content_type in ('video','tutorial','walkthrough','checklist','onboarding_guide','article'))
);

create table if not exists public.training_completion_records (
  id uuid primary key default gen_random_uuid(),
  training_item_id uuid not null references public.training_hub_items(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  garden_id uuid references public.gardens(id) on delete cascade,
  completion_status text not null default 'pending',
  progress_percent integer not null default 0,
  completed_at timestamptz,
  certification_issued boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_completion_status_check check (completion_status in ('pending','in_progress','completed','expired','waived')),
  constraint training_completion_progress_check check (progress_percent between 0 and 100),
  unique(training_item_id, profile_id)
);

create table if not exists public.knowledge_base_articles (
  id uuid primary key default gen_random_uuid(),
  article_key text not null unique,
  category text not null,
  audience_role text not null default 'all',
  title text not null,
  summary text,
  body text not null,
  searchable_keywords text[] not null default '{}'::text[],
  status text not null default 'published',
  helpful_count integer not null default 0,
  not_helpful_count integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_base_category_check check (category in ('parents','staff','managers','inspectors','admins','billing','cameras','onboarding','troubleshooting')),
  constraint knowledge_base_audience_check check (audience_role in ('manager','owner','staff','parent','inspector','admin','network_manager','all')),
  constraint knowledge_base_status_check check (status in ('draft','published','archived','needs_update'))
);

create table if not exists public.customer_success_tasks (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid references public.gardens(id) on delete cascade,
  task_type text not null,
  priority text not null default 'normal',
  status text not null default 'open',
  title text not null,
  description text,
  assigned_to uuid references public.profiles(id) on delete set null,
  due_at timestamptz,
  completed_at timestamptz,
  related_ticket_id uuid references public.support_tickets(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_success_task_type_check check (task_type in ('onboarding_follow_up','document_completion','payment_follow_up','renewal_follow_up','training','support_follow_up','adoption_review','churn_prevention')),
  constraint customer_success_task_priority_check check (priority in ('low','normal','important','urgent','critical')),
  constraint customer_success_task_status_check check (status in ('open','assigned','in_progress','blocked','completed','cancelled'))
);

create table if not exists public.renewal_risk_signals (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  signal_type text not null,
  severity text not null default 'medium',
  status text not null default 'open',
  risk_score integer not null default 0,
  explanation text,
  recommended_action text,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint renewal_risk_signal_type_check check (signal_type in ('low_usage','low_engagement','unresolved_issues','failed_payments','onboarding_incomplete','renewal_expiring','support_overload')),
  constraint renewal_risk_signal_severity_check check (severity in ('low','medium','high','critical')),
  constraint renewal_risk_signal_status_check check (status in ('open','reviewing','action_planned','resolved','dismissed')),
  constraint renewal_risk_signal_score_check check (risk_score between 0 and 100)
);

create table if not exists public.success_playbooks (
  id uuid primary key default gen_random_uuid(),
  playbook_key text not null unique,
  playbook_type text not null,
  title text not null,
  description text,
  trigger_conditions jsonb not null default '{}'::jsonb,
  recommended_steps jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  owner_role text not null default 'admin',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint success_playbook_type_check check (playbook_type in ('new_kindergarten','low_engagement','renewal_risk','compliance_risk','staff_adoption_issues','payment_risk','support_escalation')),
  constraint success_playbook_owner_check check (owner_role in ('admin','network_manager','manager','customer_success'))
);

create table if not exists public.customer_success_surveys (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid references public.gardens(id) on delete cascade,
  survey_type text not null,
  title text not null,
  status text not null default 'draft',
  nps_score integer,
  satisfaction_score integer,
  sent_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_success_survey_type_check check (survey_type in ('onboarding','quarterly','annual','support_follow_up','renewal')),
  constraint customer_success_survey_status_check check (status in ('draft','scheduled','sent','completed','closed','cancelled')),
  constraint customer_success_survey_score_check check ((nps_score is null or nps_score between 0 and 10) and (satisfaction_score is null or satisfaction_score between 1 and 5))
);

create table if not exists public.product_adoption_analytics (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid references public.gardens(id) on delete cascade,
  feature_key text not null,
  feature_category text not null,
  usage_count integer not null default 0,
  active_users integer not null default 0,
  adoption_score integer not null default 0,
  period_start date not null,
  period_end date not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint product_adoption_category_check check (feature_category in ('parent_usage','staff_usage','camera_usage','ai_usage','documents','payments','messages','inspections','onboarding')),
  constraint product_adoption_score_check check (adoption_score between 0 and 100)
);

create table if not exists public.customer_success_reports (
  id uuid primary key default gen_random_uuid(),
  report_type text not null,
  period_start date not null,
  period_end date not null,
  summary text,
  onboarding_score integer not null default 0,
  adoption_score integer not null default 0,
  retention_score integer not null default 0,
  satisfaction_score integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint customer_success_report_type_check check (report_type in ('onboarding','adoption','retention','satisfaction','executive')),
  constraint customer_success_report_score_check check (
    onboarding_score between 0 and 100
    and adoption_score between 0 and 100
    and retention_score between 0 and 100
    and satisfaction_score between 0 and 100
  )
);

create index if not exists customer_health_scores_garden_idx on public.customer_health_scores(garden_id, calculated_at desc);
create index if not exists customer_lifecycle_events_garden_idx on public.customer_lifecycle_events(garden_id, occurred_at desc);
create index if not exists support_tickets_status_idx on public.support_tickets(status, priority, created_at desc);
create index if not exists support_tickets_garden_idx on public.support_tickets(garden_id, status, created_at desc);
create index if not exists training_hub_audience_idx on public.training_hub_items(audience_role, active, display_order);
create index if not exists training_completion_profile_idx on public.training_completion_records(profile_id, completion_status);
create index if not exists knowledge_base_search_idx on public.knowledge_base_articles(category, audience_role, status);
create index if not exists customer_success_tasks_status_idx on public.customer_success_tasks(status, priority, due_at);
create index if not exists renewal_risk_signals_garden_idx on public.renewal_risk_signals(garden_id, status, severity);
create index if not exists product_adoption_garden_period_idx on public.product_adoption_analytics(garden_id, period_end desc, feature_category);

alter table public.customer_health_scores enable row level security;
alter table public.customer_lifecycle_events enable row level security;
alter table public.support_tickets enable row level security;
alter table public.training_hub_items enable row level security;
alter table public.training_completion_records enable row level security;
alter table public.knowledge_base_articles enable row level security;
alter table public.customer_success_tasks enable row level security;
alter table public.renewal_risk_signals enable row level security;
alter table public.success_playbooks enable row level security;
alter table public.customer_success_surveys enable row level security;
alter table public.product_adoption_analytics enable row level security;
alter table public.customer_success_reports enable row level security;

drop policy if exists "customer health scoped read" on public.customer_health_scores;
create policy "customer health scoped read" on public.customer_health_scores for select using (public.is_admin() or public.can_access_garden(garden_id));
drop policy if exists "customer health admin write" on public.customer_health_scores;
create policy "customer health admin write" on public.customer_health_scores for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "customer lifecycle scoped read" on public.customer_lifecycle_events;
create policy "customer lifecycle scoped read" on public.customer_lifecycle_events for select using (public.is_admin() or (garden_id is not null and public.can_access_garden(garden_id)));
drop policy if exists "customer lifecycle admin write" on public.customer_lifecycle_events;
create policy "customer lifecycle admin write" on public.customer_lifecycle_events for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "support tickets scoped" on public.support_tickets;
create policy "support tickets scoped" on public.support_tickets for all using (
  public.is_admin()
  or requester_profile_id = auth.uid()
  or assigned_to = auth.uid()
  or (garden_id is not null and public.can_access_garden(garden_id))
) with check (
  public.is_admin()
  or requester_profile_id = auth.uid()
  or assigned_to = auth.uid()
  or (garden_id is not null and public.can_access_garden(garden_id))
);

drop policy if exists "training hub scoped read" on public.training_hub_items;
create policy "training hub scoped read" on public.training_hub_items for select using (active = true or public.is_admin());
drop policy if exists "training hub admin write" on public.training_hub_items;
create policy "training hub admin write" on public.training_hub_items for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "training completion scoped" on public.training_completion_records;
create policy "training completion scoped" on public.training_completion_records for all using (
  public.is_admin()
  or profile_id = auth.uid()
  or (garden_id is not null and public.can_access_garden(garden_id))
) with check (
  public.is_admin()
  or profile_id = auth.uid()
  or (garden_id is not null and public.can_access_garden(garden_id))
);

drop policy if exists "knowledge base scoped read" on public.knowledge_base_articles;
create policy "knowledge base scoped read" on public.knowledge_base_articles for select using (status = 'published' or public.is_admin());
drop policy if exists "knowledge base admin write" on public.knowledge_base_articles;
create policy "knowledge base admin write" on public.knowledge_base_articles for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "customer success tasks scoped" on public.customer_success_tasks;
create policy "customer success tasks scoped" on public.customer_success_tasks for all using (
  public.is_admin()
  or assigned_to = auth.uid()
  or (garden_id is not null and public.can_access_garden(garden_id))
) with check (
  public.is_admin()
  or assigned_to = auth.uid()
  or (garden_id is not null and public.can_access_garden(garden_id))
);

drop policy if exists "renewal risk scoped read" on public.renewal_risk_signals;
create policy "renewal risk scoped read" on public.renewal_risk_signals for select using (public.is_admin() or public.can_access_garden(garden_id));
drop policy if exists "renewal risk admin write" on public.renewal_risk_signals;
create policy "renewal risk admin write" on public.renewal_risk_signals for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "success playbooks scoped read" on public.success_playbooks;
create policy "success playbooks scoped read" on public.success_playbooks for select using (active = true or public.is_admin());
drop policy if exists "success playbooks admin write" on public.success_playbooks;
create policy "success playbooks admin write" on public.success_playbooks for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "customer success surveys scoped" on public.customer_success_surveys;
create policy "customer success surveys scoped" on public.customer_success_surveys for all using (public.is_admin() or (garden_id is not null and public.can_access_garden(garden_id))) with check (public.is_admin() or (garden_id is not null and public.can_access_garden(garden_id)));

drop policy if exists "product adoption scoped read" on public.product_adoption_analytics;
create policy "product adoption scoped read" on public.product_adoption_analytics for select using (public.is_admin() or (garden_id is not null and public.can_access_garden(garden_id)));
drop policy if exists "product adoption admin write" on public.product_adoption_analytics;
create policy "product adoption admin write" on public.product_adoption_analytics for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "customer success reports admin only" on public.customer_success_reports;
create policy "customer success reports admin only" on public.customer_success_reports for all using (public.is_admin()) with check (public.is_admin());

insert into public.training_hub_items (item_key, audience_role, title, description, content_type, checklist, required_for_onboarding, estimated_minutes, display_order)
values
  ('manager-first-week', 'manager', 'שבוע ראשון למנהלת', 'צעדי הפעלה, ילדים, צוות, הורים, מסמכים ותשלום.', 'onboarding_guide', '["בדיקת פרופיל גן","השלמת צוות","הזמנת הורים","בדיקת מסמכים","סקירת תשלומים"]'::jsonb, true, 18, 10),
  ('staff-fast-updates', 'staff', 'עדכונים מהירים לצוות', 'איך להשלים עדכוני ילדים ומשימות בלי עומס.', 'walkthrough', '["כניסה למשמרת","עדכון ילד","דיווח אירוע","סיום משימה"]'::jsonb, true, 8, 20),
  ('parent-daily-use', 'parent', 'שימוש יומי להורים', 'יומן הילד, הודעות, מסמכים והתראות.', 'tutorial', '["פתיחת בית משפחתי","קריאת עדכונים","שליחת הודעה","בדיקת מסמכים"]'::jsonb, false, 6, 30)
on conflict (item_key) do update set
  title = excluded.title,
  description = excluded.description,
  checklist = excluded.checklist,
  active = true,
  updated_at = now();

insert into public.knowledge_base_articles (article_key, category, audience_role, title, summary, body, searchable_keywords, status)
values
  ('manager-onboarding-checklist', 'onboarding', 'manager', 'צ׳קליסט קליטת גן', 'מה צריך להשלים אחרי הפעלה.', 'השלימו פרופיל גן, צוות, ילדים, הורים, מסמכים ותשלום. מרכז Customer Success עוקב אחרי ההתקדמות.', array['onboarding','manager','kindergarten'], 'published'),
  ('parent-support-basics', 'parents', 'parent', 'עזרה להורים', 'איפה מוצאים הודעות, מסמכים ועדכונים.', 'הורים יכולים לפתוח את הבית המשפחתי, מרכז הודעות, מסמכים ומרכז אמון. מידע רגיש מוצג רק אם אושר.', array['parent','messages','documents'], 'published'),
  ('support-ticket-flow', 'troubleshooting', 'all', 'איך פותחים פנייה', 'פניות תמיכה נרשמות ומטופלות לפי עדיפות.', 'פנייה יכולה להגיע מתוך המערכת, במייל או ב-WhatsApp בעתיד. כל פנייה מקבלת סטטוס ומעקב.', array['support','ticket','whatsapp'], 'published')
on conflict (article_key) do update set
  title = excluded.title,
  summary = excluded.summary,
  body = excluded.body,
  searchable_keywords = excluded.searchable_keywords,
  status = 'published',
  updated_at = now();

insert into public.success_playbooks (playbook_key, playbook_type, title, description, trigger_conditions, recommended_steps, active)
values
  ('new-kindergarten-first-14-days', 'new_kindergarten', 'גן חדש - 14 ימים ראשונים', 'מעקב יזום אחרי הפעלה והטמעה.', '{"lifecycle_status":"onboarding"}'::jsonb, '["לקבוע הדרכה","לבדוק השלמת צוות","לבדוק הזמנות הורים","לוודא מסמכים ותשלום"]'::jsonb, true),
  ('low-engagement-recovery', 'low_engagement', 'אימוץ נמוך', 'סיוע לגן שלא משתמש מספיק במערכת.', '{"customer_health_score_lt":60}'::jsonb, '["לפנות למנהלת","לקבוע הדרכה קצרה","לבדוק חסמי שימוש","לפתוח משימת מעקב"]'::jsonb, true),
  ('renewal-risk-save', 'renewal_risk', 'מניעת נטישה לפני חידוש', 'פעולות מומלצות כאשר מנוי מתקרב לסיום או שימוש יורד.', '{"renewal_risk_level":["high","critical"]}'::jsonb, '["לבדוק פניות פתוחות","לפתור חיוב","להציג ערך שימוש","לקבוע שיחה"]'::jsonb, true)
on conflict (playbook_key) do update set
  title = excluded.title,
  description = excluded.description,
  trigger_conditions = excluded.trigger_conditions,
  recommended_steps = excluded.recommended_steps,
  active = true,
  updated_at = now();

comment on table public.customer_health_scores is '0-100 customer health score for adoption, usage, onboarding, compliance, inspection and renewal risk.';
comment on table public.support_tickets is 'Unified support tickets across WhatsApp, email and in-app readiness.';
comment on table public.training_hub_items is 'Guided training hub content: videos, tutorials, walkthroughs, checklists and onboarding guides.';
comment on table public.knowledge_base_articles is 'Searchable help center knowledge base for all roles.';
comment on table public.renewal_risk_signals is 'Proactive churn and renewal risk signals.';
