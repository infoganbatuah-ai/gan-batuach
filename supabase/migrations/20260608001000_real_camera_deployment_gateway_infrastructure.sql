-- PHASE 102: real camera deployment and gateway infrastructure.
-- Deployment readiness only. No customer credentials are required and no production activation is performed.

create table if not exists public.home_test_sites (
  id uuid primary key default gen_random_uuid(),
  site_key text not null unique,
  owner_profile_id uuid references public.profiles(id) on delete set null,
  display_name text not null,
  location_label text,
  connection_type text not null default 'manual_rtsp',
  status text not null default 'draft',
  isolation_status text not null default 'isolated',
  camera_count integer not null default 0,
  gateway_provider text,
  last_test_at timestamptz,
  last_test_status text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint home_test_sites_connection_type_check check (connection_type in ('dvr_nvr','ip_camera','manual_rtsp','onvif','generic')),
  constraint home_test_sites_status_check check (status in ('draft','ready_for_test','testing','active_test','disabled','archived')),
  constraint home_test_sites_isolation_status_check check (isolation_status in ('isolated','needs_review','blocked'))
);

create table if not exists public.camera_connection_flow_catalog (
  id uuid primary key default gen_random_uuid(),
  flow_key text not null unique,
  camera_type text not null,
  display_name text not null,
  explanation_he text not null,
  required_fields jsonb not null default '[]'::jsonb,
  gateway_required boolean not null default true,
  supports_home_test boolean not null default false,
  status text not null default 'ready',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint camera_connection_flow_catalog_status_check check (status in ('ready','partial','disabled'))
);

create table if not exists public.camera_deployment_readiness_checks (
  id uuid primary key default gen_random_uuid(),
  check_key text not null unique,
  category text not null,
  title text not null,
  status text not null default 'partial',
  score integer not null default 0,
  evidence_summary text,
  recommended_action text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint camera_deployment_readiness_category_check check (category in ('camera_types','connection_wizard','gateway','connection_testing','playback','health','home_test','observer','security','documentation')),
  constraint camera_deployment_readiness_status_check check (status in ('ready','partial','not_ready','blocked')),
  constraint camera_deployment_readiness_score_check check (score >= 0 and score <= 100)
);

create index if not exists idx_home_test_sites_status on public.home_test_sites(status, isolation_status);
create index if not exists idx_camera_connection_flow_catalog_type on public.camera_connection_flow_catalog(camera_type, status);
create index if not exists idx_camera_deployment_readiness_category on public.camera_deployment_readiness_checks(category, status);

alter table public.home_test_sites enable row level security;
alter table public.camera_connection_flow_catalog enable row level security;
alter table public.camera_deployment_readiness_checks enable row level security;

drop policy if exists "home test sites admin only" on public.home_test_sites;
create policy "home test sites admin only"
on public.home_test_sites
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "camera connection flow catalog admin read" on public.camera_connection_flow_catalog;
create policy "camera connection flow catalog admin read"
on public.camera_connection_flow_catalog
for select using (public.is_admin());

drop policy if exists "camera connection flow catalog admin write" on public.camera_connection_flow_catalog;
create policy "camera connection flow catalog admin write"
on public.camera_connection_flow_catalog
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "camera deployment readiness admin only" on public.camera_deployment_readiness_checks;
create policy "camera deployment readiness admin only"
on public.camera_deployment_readiness_checks
for all using (public.is_admin())
with check (public.is_admin());

insert into public.camera_connection_flow_catalog (
  flow_key,
  camera_type,
  display_name,
  explanation_he,
  required_fields,
  gateway_required,
  supports_home_test,
  metadata
)
values
  ('dvr_nvr', 'dvr_nvr', 'DVR / NVR', 'מכשיר מרכזי שמרכז כמה מצלמות. לכל מצלמה יש מספר ערוץ.', '["brand","host_ip","port","username","password","channel_number","stream_type","test_connection"]'::jsonb, true, false, '{"brands":["hikvision","dahua","uniview","axis","generic"]}'::jsonb),
  ('ip_camera', 'ip_camera', 'מצלמת IP', 'מצלמה עצמאית שמחוברת לרשת ומספקת RTSP או ONVIF.', '["host_ip","port","username","password","rtsp_support","onvif_support","test_connection"]'::jsonb, true, true, '{"default_port":554}'::jsonb),
  ('manual_rtsp', 'rtsp', 'RTSP ידני', 'כתובת שידור מלאה מטכנאי או מספק המצלמות. הכתובת נשמרת בצד שרת בלבד.', '["rtsp_url","username","password","test_connection"]'::jsonb, true, true, '{"secret_handling":"server_only"}'::jsonb),
  ('onvif', 'onvif', 'ONVIF', 'תקן שמאפשר גילוי מצלמות ויכולות. צפייה חיה עדיין עוברת דרך Gateway.', '["host_ip","port","username","password","channel_number","test_connection"]'::jsonb, true, true, '{"discovery_ready":true}'::jsonb),
  ('home_test', 'home_test', 'מצלמת בדיקת בית', 'מצלמה פרטית לבדיקה בלבד. הנתונים מבודדים מנתוני גן פעיל.', '["camera_name","location","connection_type","rtsp_or_onvif_support","test_connection"]'::jsonb, true, true, '{"production_data":false,"isolated":true}'::jsonb),
  ('hikvision', 'hikvision', 'Hikvision', 'חיבור DVR/NVR/IP לפי תבניות Hikvision וערוצי Streaming/Channels.', '["host_ip","port","username","password","channel_number","stream_type","test_connection"]'::jsonb, true, false, '{"vendor":"hikvision"}'::jsonb),
  ('dahua', 'dahua', 'Dahua', 'חיבור DVR/NVR/IP לפי תבנית realmonitor וערוץ מצלמה.', '["host_ip","port","username","password","channel_number","stream_type","test_connection"]'::jsonb, true, false, '{"vendor":"dahua"}'::jsonb),
  ('uniview', 'uniview', 'Uniview', 'חיבור DVR/NVR/IP לפי תבניות Uniview וערוץ מצלמה.', '["host_ip","port","username","password","channel_number","stream_type","test_connection"]'::jsonb, true, false, '{"vendor":"uniview"}'::jsonb),
  ('axis', 'axis', 'Axis', 'חיבור מצלמות Axis לפי נתיב מדיה סטנדרטי.', '["host_ip","port","username","password","rtsp_support","onvif_support","test_connection"]'::jsonb, true, false, '{"vendor":"axis"}'::jsonb),
  ('generic', 'generic', 'Generic', 'חיבור כללי למצלמה או למערכת שאינה מזוהה מראש.', '["host_ip","port","username","password","channel_number","stream_type","test_connection"]'::jsonb, true, true, '{"fallback":true}'::jsonb)
on conflict (flow_key) do update set
  camera_type = excluded.camera_type,
  display_name = excluded.display_name,
  explanation_he = excluded.explanation_he,
  required_fields = excluded.required_fields,
  gateway_required = excluded.gateway_required,
  supports_home_test = excluded.supports_home_test,
  metadata = public.camera_connection_flow_catalog.metadata || excluded.metadata,
  updated_at = now();

insert into public.camera_deployment_readiness_checks (
  check_key,
  category,
  title,
  status,
  score,
  evidence_summary,
  recommended_action,
  metadata
)
values
  ('camera_types_supported', 'camera_types', 'סוגי מצלמות נתמכים', 'ready', 90, 'DVR, NVR, IP Camera, RTSP, ONVIF, Hikvision, Dahua, Uniview, Axis ו-Generic קיימים בקטלוג.', 'לחבר מצלמות אמיתיות בפיילוט ולשמור תוצאות בדיקה.', '{"types":["dvr","nvr","ip_camera","rtsp","onvif","hikvision","dahua","uniview","axis","generic"]}'::jsonb),
  ('separate_connection_wizards', 'connection_wizard', 'אשפי חיבור נפרדים', 'ready', 88, 'מסך ניהול מצלמות מציג זרימות נפרדות ל-DVR/NVR, IP, RTSP, ONVIF ובדיקת בית.', 'לבצע בדיקת דפדפן מול כל זרימה עם נתוני דמו.', '{}'::jsonb),
  ('gateway_infrastructure', 'gateway', 'תשתית Gateway', 'partial', 72, 'MediaMTX, go2rtc וספק מותאם קיימים כמוכנות. הפעלה אמיתית תלויה ב-env ובשרת חיצוני.', 'להגדיר VIDEO_GATEWAY_URL ומפתח בסביבת פיילוט.', '{"providers":["mediamtx","go2rtc","custom"]}'::jsonb),
  ('friendly_connection_testing', 'connection_testing', 'בדיקות חיבור ידידותיות', 'partial', 75, 'השרת מתעד בדיקת host, authentication, stream, channel ו-Gateway בלי להחזיר סודות לדפדפן.', 'להחליף mock readiness בבדיקת Gateway אמיתית אחרי חיבור ספק.', '{}'::jsonb),
  ('playback_architecture', 'playback', 'ארכיטקטורת צפייה', 'partial', 76, 'HLS, WebRTC, Token זמני, בדיקת הרשאות ו-audit מוכנים ברמת תשתית.', 'להפעיל Gateway אמיתי ולוודא token signing בסביבת פיילוט.', '{}'::jsonb),
  ('camera_health_monitoring', 'health', 'ניטור בריאות מצלמות', 'partial', 74, 'סטטוסים online/offline/unstable/reconnecting/needs_attention נתמכים במודל התפעולי.', 'להוסיף cron/worker לבדיקות בריאות רציפות.', '{}'::jsonb),
  ('home_camera_pilot', 'home_test', 'פיילוט מצלמת בית', 'ready', 86, 'home_test_sites ואתרי בדיקה מבודדים קיימים ולא מתערבבים עם נתוני גן פעיל.', 'להוסיף מצלמת בית אמיתית רק אחרי Gateway פעיל.', '{"isolated_from_kindergarten_data":true}'::jsonb),
  ('observer_camera_separation', 'observer', 'הפרדת Gan Batuach ותצפיתן עצמאי', 'ready', 84, 'camera_streams תומך ב-garden_id וב-observer_site_id, עם audit נפרד והרשאות נפרדות.', 'לבדוק הרשאות משתמש standalone observer לפני פיילוט עסקי.', '{}'::jsonb),
  ('camera_security_controls', 'security', 'אבטחת מצלמות', 'ready', 88, 'RTSP, סיסמאות ומפתחות Gateway אינם נחשפים לדפדפן; audit קיים לבדיקות ולשינויים.', 'לוודא הצפנת סודות בפועל לפני הכנסת סיסמאות לקוחות.', '{}'::jsonb),
  ('deployment_documentation', 'documentation', 'מדריך פריסה', 'ready', 82, 'מדריך PHASE 102 נדרש ומעודכן בקוד.', 'לעדכן לפי ספק Gateway אמיתי בפיילוט.', '{}'::jsonb)
on conflict (check_key) do update set
  category = excluded.category,
  title = excluded.title,
  status = excluded.status,
  score = excluded.score,
  evidence_summary = excluded.evidence_summary,
  recommended_action = excluded.recommended_action,
  metadata = public.camera_deployment_readiness_checks.metadata || excluded.metadata,
  updated_at = now();

insert into public.home_test_sites (
  site_key,
  display_name,
  location_label,
  connection_type,
  status,
  isolation_status,
  camera_count,
  gateway_provider,
  notes,
  metadata
)
values (
  'daniel_home_camera',
  'בדיקת מצלמת בית',
  'בית פרטי לבדיקה',
  'manual_rtsp',
  'ready_for_test',
  'isolated',
  0,
  'custom',
  'מיועד לבדיקה פרטית של Daniel לפני חיבור גן אמיתי. אין ערבוב עם נתוני ייצור.',
  '{"owner":"Daniel","production_data":false,"allowed_scopes":["home_test"]}'::jsonb
)
on conflict (site_key) do update set
  display_name = excluded.display_name,
  location_label = excluded.location_label,
  connection_type = excluded.connection_type,
  status = excluded.status,
  isolation_status = excluded.isolation_status,
  gateway_provider = excluded.gateway_provider,
  notes = excluded.notes,
  metadata = public.home_test_sites.metadata || excluded.metadata,
  updated_at = now();

insert into public.camera_deployment_test_sites (site_key, site_type, display_name, purpose, metadata)
values (
  'daniel_home_camera',
  'home_test',
  'בדיקת מצלמת בית',
  'בדיקה מבודדת עם מצלמה ביתית לפני חיבור גנים אמיתיים.',
  '{"owner":"Daniel","production_data":false,"home_test_sites_table":true}'::jsonb
)
on conflict (site_key) do update set
  display_name = excluded.display_name,
  purpose = excluded.purpose,
  metadata = public.camera_deployment_test_sites.metadata || excluded.metadata,
  updated_at = now();

comment on table public.home_test_sites is 'Isolated private camera pilot sites. Never mix with kindergarten production data.';
comment on table public.camera_connection_flow_catalog is 'Admin camera setup flow catalog. Contains field requirements and explanations only, never secrets.';
comment on table public.camera_deployment_readiness_checks is 'Admin-only deployment readiness checks for real camera and gateway rollout.';
comment on column public.home_test_sites.isolation_status is 'Isolation guard for home/business test sites. Production kindergarten data must not be attached to these sites.';

notify pgrst, 'reload schema';
