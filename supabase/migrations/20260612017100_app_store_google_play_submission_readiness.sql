-- PHASE 171: App Store and Google Play submission readiness.
-- Readiness only. No upload, signing, submission, publication or production mobile release is performed.

create table if not exists public.mobile_release_readiness_scores (
  id uuid primary key default gen_random_uuid(),
  snapshot_key text not null unique,
  ios_readiness integer not null default 0,
  android_readiness integer not null default 0,
  build_readiness integer not null default 0,
  push_readiness integer not null default 0,
  privacy_label_readiness integer not null default 0,
  store_metadata_readiness integer not null default 0,
  screenshot_readiness integer not null default 0,
  overall_readiness integer not null default 0,
  release_status text not null default 'preparing',
  release_blockers jsonb not null default '[]'::jsonb,
  notes text,
  calculated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint mobile_release_score_check check (
    ios_readiness between 0 and 100 and android_readiness between 0 and 100 and build_readiness between 0 and 100 and
    push_readiness between 0 and 100 and privacy_label_readiness between 0 and 100 and store_metadata_readiness between 0 and 100 and
    screenshot_readiness between 0 and 100 and overall_readiness between 0 and 100
  ),
  constraint mobile_release_status_check check (release_status in ('not_ready','preparing','internal_testing_ready','store_review_ready','blocked','released'))
);

create table if not exists public.mobile_architecture_reviews (
  id uuid primary key default gen_random_uuid(),
  review_key text not null unique,
  architecture_area text not null,
  current_state text not null,
  status text not null default 'documented',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mobile_architecture_area_check check (architecture_area in ('nextjs_web_app','capacitor_wrapper','ios_shell','android_shell','native_plugins')),
  constraint mobile_architecture_status_check check (status in ('documented','needs_review','blocked'))
);

create table if not exists public.mobile_store_platform_readiness (
  id uuid primary key default gen_random_uuid(),
  platform text not null unique,
  bundle_or_application_id text,
  display_name text not null default 'גן בטוח',
  app_icon_status text not null default 'draft',
  launch_screen_status text not null default 'draft',
  app_version text,
  build_number text,
  tablet_support_decision text,
  minimum_os_version text,
  target_sdk_readiness text,
  developer_account_status text not null default 'not_verified',
  status text not null default 'preparing',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mobile_store_platform_check check (platform in ('ios','android')),
  constraint mobile_store_platform_status_check check (status in ('not_ready','preparing','ready_for_internal_test','ready_for_store_review','blocked')),
  constraint mobile_store_asset_status_check check (app_icon_status in ('missing','draft','ready','needs_review') and launch_screen_status in ('missing','draft','ready','needs_review')),
  constraint mobile_store_developer_status_check check (developer_account_status in ('not_verified','checklist_ready','verified','blocked'))
);

create table if not exists public.capacitor_configuration_audit (
  id uuid primary key default gen_random_uuid(),
  audit_key text not null unique,
  config_area text not null,
  detected_value text,
  expected_value text,
  status text not null default 'needs_review',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint capacitor_config_area_check check (config_area in ('app_id','app_name','web_dir','server_url','plugins','permissions','deep_links','push','ios_config','android_config')),
  constraint capacitor_config_status_check check (status in ('ready','needs_review','missing','blocked','not_required'))
);

create table if not exists public.mobile_native_permissions_inventory (
  id uuid primary key default gen_random_uuid(),
  permission_key text not null unique,
  platform text not null,
  permission_name text not null,
  status text not null default 'not_requested',
  purpose text not null,
  gan_batuach_israel_mode_rule text not null,
  store_disclosure_required boolean not null default true,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mobile_native_permission_platform_check check (platform in ('ios','android','all')),
  constraint mobile_native_permission_status_check check (status in ('not_requested','requested','ready','should_not_request','future_only','needs_review')),
  constraint mobile_native_permission_rule_check check (gan_batuach_israel_mode_rule in ('allowed_for_feature','should_not_be_required','disabled_for_observer','legal_review_required','future_only'))
);

create table if not exists public.mobile_permission_explanations (
  id uuid primary key default gen_random_uuid(),
  explanation_key text not null unique,
  permission_type text not null,
  hebrew_copy text not null,
  english_copy text,
  status text not null default 'ready_for_review',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mobile_permission_explanation_type_check check (permission_type in ('location','notifications','camera_photos','microphone','biometric_unlock','storage')),
  constraint mobile_permission_explanation_status_check check (status in ('draft','ready_for_review','approved','needs_legal_review'))
);

create table if not exists public.mobile_push_release_readiness (
  id uuid primary key default gen_random_uuid(),
  readiness_key text not null unique,
  capability text not null,
  status text not null default 'prepared',
  provider text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mobile_push_release_capability_check check (capability in ('fcm','apns','web_push','device_token_registration','token_revocation','duplicate_cleanup','deep_links','notification_preferences','category_mapping')),
  constraint mobile_push_release_status_check check (status in ('not_configured','prepared','ready_for_test','production_ready','blocked'))
);

create table if not exists public.mobile_store_privacy_labels (
  id uuid primary key default gen_random_uuid(),
  label_key text not null unique,
  data_category text not null,
  collected boolean not null default true,
  purpose text not null,
  linked_to_user boolean not null default true,
  shared_with_third_parties boolean not null default false,
  store_disclosure_notes text,
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mobile_privacy_label_category_check check (data_category in ('contact_info','identifiers','user_content','health_medical','location','diagnostics','payment_information','photos_documents','camera_viewing_metadata')),
  constraint mobile_privacy_label_status_check check (status in ('draft','ready_for_review','approved','needs_legal_review'))
);

create table if not exists public.google_play_data_safety_items (
  id uuid primary key default gen_random_uuid(),
  item_key text not null unique,
  data_category text not null,
  collected boolean not null default true,
  purpose text not null,
  shared boolean not null default false,
  encrypted_in_transit boolean not null default true,
  deletion_supported boolean not null default true,
  account_deletion_supported boolean not null default true,
  status text not null default 'draft',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint google_play_data_safety_status_check check (status in ('draft','ready_for_review','approved','needs_legal_review'))
);

create table if not exists public.mobile_child_sensitive_data_review (
  id uuid primary key default gen_random_uuid(),
  review_key text not null unique,
  data_area text not null,
  status text not null default 'needs_review',
  review_summary text not null,
  misleading_copy_risk text,
  required_action text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mobile_child_sensitive_area_check check (data_area in ('child_data','parent_data','staff_data','medical_information','camera_viewing','location_usage','notifications','documents')),
  constraint mobile_child_sensitive_status_check check (status in ('ready_for_review','needs_review','approved','blocked'))
);

create table if not exists public.mobile_store_metadata_items (
  id uuid primary key default gen_random_uuid(),
  metadata_key text not null unique,
  locale text not null,
  field_name text not null,
  field_value text,
  status text not null default 'draft',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mobile_store_metadata_locale_check check (locale in ('he','en')),
  constraint mobile_store_metadata_field_check check (field_name in ('app_name','subtitle','short_description','full_description','keywords','support_url','privacy_policy_url','terms_url')),
  constraint mobile_store_metadata_status_check check (status in ('draft','ready_for_review','approved','needs_legal_review','missing'))
);

create table if not exists public.mobile_screenshot_plan (
  id uuid primary key default gen_random_uuid(),
  screenshot_key text not null unique,
  screen_name text not null,
  target_role text not null,
  platform text not null default 'all',
  status text not null default 'planned',
  demo_data_required boolean not null default true,
  privacy_rule text not null default 'synthetic_data_only',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mobile_screenshot_role_check check (target_role in ('parent','manager','staff','inspector','admin','all')),
  constraint mobile_screenshot_platform_check check (platform in ('ios','android','all')),
  constraint mobile_screenshot_status_check check (status in ('planned','captured','approved','needs_update','blocked')),
  constraint mobile_screenshot_privacy_rule_check check (privacy_rule in ('synthetic_data_only','redacted_demo_data','approved_public_data'))
);

create table if not exists public.mobile_branding_readiness (
  id uuid primary key default gen_random_uuid(),
  branding_key text not null unique,
  asset_type text not null,
  platform text not null default 'all',
  status text not null default 'draft',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mobile_branding_asset_type_check check (asset_type in ('app_icon','adaptive_android_icon','ios_icon_sizes','splash_screen','launch_screen','brand_colors','store_graphics')),
  constraint mobile_branding_platform_check check (platform in ('ios','android','all')),
  constraint mobile_branding_status_check check (status in ('missing','draft','ready','needs_review','approved'))
);

create table if not exists public.mobile_build_pipeline_readiness (
  id uuid primary key default gen_random_uuid(),
  build_key text not null unique,
  platform text not null,
  build_type text not null,
  status text not null default 'documented',
  signing_required boolean not null default true,
  env_requirements text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mobile_build_platform_check check (platform in ('ios','android','all')),
  constraint mobile_build_type_check check (build_type in ('local_build','ci_build','staging_build','production_build','signing_requirements','environment_variables')),
  constraint mobile_build_status_check check (status in ('documented','ready_for_internal_test','needs_setup','blocked','not_required'))
);

create table if not exists public.mobile_release_channels (
  id uuid primary key default gen_random_uuid(),
  channel_key text not null unique,
  platform text not null,
  channel_name text not null,
  status text not null default 'prepared',
  release_stage text not null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mobile_release_channel_platform_check check (platform in ('ios','android','all')),
  constraint mobile_release_stage_check check (release_stage in ('internal_testing','closed_beta','pilot_release','production_release','testflight','app_review','google_internal_testing','google_closed_testing')),
  constraint mobile_release_channel_status_check check (status in ('prepared','ready_for_test','blocked','submitted','approved','not_started'))
);

create table if not exists public.testflight_readiness (
  id uuid primary key default gen_random_uuid(),
  readiness_key text not null unique,
  item text not null,
  status text not null default 'prepared',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint testflight_status_check check (status in ('prepared','ready','needs_setup','blocked'))
);

create table if not exists public.google_internal_testing_readiness (
  id uuid primary key default gen_random_uuid(),
  readiness_key text not null unique,
  item text not null,
  status text not null default 'prepared',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint google_internal_testing_status_check check (status in ('prepared','ready','needs_setup','blocked'))
);

create table if not exists public.mobile_store_review_notes (
  id uuid primary key default gen_random_uuid(),
  note_key text not null unique,
  note_area text not null,
  note_text text not null,
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mobile_store_review_note_area_check check (note_area in ('demo_accounts','role_explanations','permission_rationale','camera_behavior','no_audio_monitoring','no_face_recognition','child_safety_privacy','known_limitations')),
  constraint mobile_store_review_note_status_check check (status in ('draft','ready_for_review','approved','needs_legal_review'))
);

create table if not exists public.mobile_demo_account_pack (
  id uuid primary key default gen_random_uuid(),
  account_key text not null unique,
  role_key text not null,
  display_name text not null,
  status text not null default 'planned',
  data_policy text not null default 'synthetic_only',
  instructions text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mobile_demo_account_role_check check (role_key in ('parent','manager','staff','inspector','admin_limited_reviewer')),
  constraint mobile_demo_account_status_check check (status in ('planned','created','ready','disabled','needs_refresh')),
  constraint mobile_demo_account_data_policy_check check (data_policy in ('synthetic_only','redacted_demo_only'))
);

create table if not exists public.mobile_legal_link_readiness (
  id uuid primary key default gen_random_uuid(),
  link_key text not null unique,
  link_type text not null,
  url_path text not null,
  status text not null default 'draft_for_legal_review',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mobile_legal_link_type_check check (link_type in ('privacy_policy','terms_of_use','camera_privacy_notice','ai_processing_notice','data_subject_rights_notice','support_contact')),
  constraint mobile_legal_link_status_check check (status in ('draft_for_legal_review','ready_for_review','approved','missing','blocked'))
);

create table if not exists public.mobile_release_qa_checklist (
  id uuid primary key default gen_random_uuid(),
  qa_key text not null unique,
  workflow text not null,
  role_key text not null,
  status text not null default 'not_tested',
  required_for_release boolean not null default true,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mobile_release_qa_workflow_check check (workflow in ('login','mfa','onboarding','parent_timeline','staff_workflow','manager_command_center','inspector_forms','push_notifications','deep_links','payments','documents','camera_viewing','logout','account_deletion_request')),
  constraint mobile_release_qa_role_check check (role_key in ('parent','staff','manager','inspector','admin','all')),
  constraint mobile_release_qa_status_check check (status in ('not_tested','passed','failed','blocked','needs_review'))
);

create table if not exists public.mobile_crash_diagnostics_readiness (
  id uuid primary key default gen_random_uuid(),
  diagnostics_key text not null unique,
  provider_option text not null,
  status text not null default 'future_ready',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mobile_crash_diagnostics_provider_check check (provider_option in ('sentry','firebase_crashlytics','other_provider')),
  constraint mobile_crash_diagnostics_status_check check (status in ('future_ready','selected','configured','blocked'))
);

create index if not exists idx_mobile_store_privacy_labels_status on public.mobile_store_privacy_labels(status, data_category);
create index if not exists idx_google_play_data_safety_status on public.google_play_data_safety_items(status, data_category);
create index if not exists idx_mobile_screenshot_plan_status on public.mobile_screenshot_plan(platform, status, target_role);
create index if not exists idx_mobile_release_qa_status on public.mobile_release_qa_checklist(role_key, workflow, status);
create index if not exists idx_mobile_store_platform_readiness_status on public.mobile_store_platform_readiness(platform, status);

alter table public.mobile_release_readiness_scores enable row level security;
alter table public.mobile_architecture_reviews enable row level security;
alter table public.mobile_store_platform_readiness enable row level security;
alter table public.capacitor_configuration_audit enable row level security;
alter table public.mobile_native_permissions_inventory enable row level security;
alter table public.mobile_permission_explanations enable row level security;
alter table public.mobile_push_release_readiness enable row level security;
alter table public.mobile_store_privacy_labels enable row level security;
alter table public.google_play_data_safety_items enable row level security;
alter table public.mobile_child_sensitive_data_review enable row level security;
alter table public.mobile_store_metadata_items enable row level security;
alter table public.mobile_screenshot_plan enable row level security;
alter table public.mobile_branding_readiness enable row level security;
alter table public.mobile_build_pipeline_readiness enable row level security;
alter table public.mobile_release_channels enable row level security;
alter table public.testflight_readiness enable row level security;
alter table public.google_internal_testing_readiness enable row level security;
alter table public.mobile_store_review_notes enable row level security;
alter table public.mobile_demo_account_pack enable row level security;
alter table public.mobile_legal_link_readiness enable row level security;
alter table public.mobile_release_qa_checklist enable row level security;
alter table public.mobile_crash_diagnostics_readiness enable row level security;

drop policy if exists "mobile release readiness admin only" on public.mobile_release_readiness_scores;
create policy "mobile release readiness admin only" on public.mobile_release_readiness_scores for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "mobile architecture reviews admin only" on public.mobile_architecture_reviews;
create policy "mobile architecture reviews admin only" on public.mobile_architecture_reviews for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "mobile store platform readiness admin only" on public.mobile_store_platform_readiness;
create policy "mobile store platform readiness admin only" on public.mobile_store_platform_readiness for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "capacitor configuration audit admin only" on public.capacitor_configuration_audit;
create policy "capacitor configuration audit admin only" on public.capacitor_configuration_audit for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "mobile native permissions admin only" on public.mobile_native_permissions_inventory;
create policy "mobile native permissions admin only" on public.mobile_native_permissions_inventory for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "mobile permission explanations admin only" on public.mobile_permission_explanations;
create policy "mobile permission explanations admin only" on public.mobile_permission_explanations for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "mobile push release readiness admin only" on public.mobile_push_release_readiness;
create policy "mobile push release readiness admin only" on public.mobile_push_release_readiness for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "mobile store privacy labels admin only" on public.mobile_store_privacy_labels;
create policy "mobile store privacy labels admin only" on public.mobile_store_privacy_labels for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "google play data safety admin only" on public.google_play_data_safety_items;
create policy "google play data safety admin only" on public.google_play_data_safety_items for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "mobile child sensitive review admin only" on public.mobile_child_sensitive_data_review;
create policy "mobile child sensitive review admin only" on public.mobile_child_sensitive_data_review for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "mobile store metadata admin only" on public.mobile_store_metadata_items;
create policy "mobile store metadata admin only" on public.mobile_store_metadata_items for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "mobile screenshot plan admin only" on public.mobile_screenshot_plan;
create policy "mobile screenshot plan admin only" on public.mobile_screenshot_plan for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "mobile branding readiness admin only" on public.mobile_branding_readiness;
create policy "mobile branding readiness admin only" on public.mobile_branding_readiness for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "mobile build pipeline readiness admin only" on public.mobile_build_pipeline_readiness;
create policy "mobile build pipeline readiness admin only" on public.mobile_build_pipeline_readiness for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "mobile release channels admin only" on public.mobile_release_channels;
create policy "mobile release channels admin only" on public.mobile_release_channels for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "testflight readiness admin only" on public.testflight_readiness;
create policy "testflight readiness admin only" on public.testflight_readiness for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "google internal testing readiness admin only" on public.google_internal_testing_readiness;
create policy "google internal testing readiness admin only" on public.google_internal_testing_readiness for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "mobile store review notes admin only" on public.mobile_store_review_notes;
create policy "mobile store review notes admin only" on public.mobile_store_review_notes for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "mobile demo account pack admin only" on public.mobile_demo_account_pack;
create policy "mobile demo account pack admin only" on public.mobile_demo_account_pack for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "mobile legal link readiness admin only" on public.mobile_legal_link_readiness;
create policy "mobile legal link readiness admin only" on public.mobile_legal_link_readiness for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "mobile release qa admin only" on public.mobile_release_qa_checklist;
create policy "mobile release qa admin only" on public.mobile_release_qa_checklist for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "mobile crash diagnostics admin only" on public.mobile_crash_diagnostics_readiness;
create policy "mobile crash diagnostics admin only" on public.mobile_crash_diagnostics_readiness for all using (public.is_admin()) with check (public.is_admin());

insert into public.mobile_release_readiness_scores (snapshot_key, ios_readiness, android_readiness, build_readiness, push_readiness, privacy_label_readiness, store_metadata_readiness, screenshot_readiness, overall_readiness, release_status, release_blockers, notes)
values (
  'mobile-release-baseline',
  64,
  68,
  56,
  62,
  42,
  48,
  25,
  52,
  'preparing',
  '["Apple Developer account not verified","Google Play Developer account not verified","privacy labels need legal review","screenshots must use synthetic data","signed production builds not prepared"]'::jsonb,
  'Capacitor mobile wrapper exists. Store submission remains blocked until metadata, privacy, screenshots, signing and reviewer packs are approved.'
)
on conflict (snapshot_key) do update set
  ios_readiness = excluded.ios_readiness,
  android_readiness = excluded.android_readiness,
  build_readiness = excluded.build_readiness,
  push_readiness = excluded.push_readiness,
  privacy_label_readiness = excluded.privacy_label_readiness,
  store_metadata_readiness = excluded.store_metadata_readiness,
  screenshot_readiness = excluded.screenshot_readiness,
  overall_readiness = excluded.overall_readiness,
  release_status = excluded.release_status,
  release_blockers = excluded.release_blockers,
  notes = excluded.notes,
  calculated_at = now();

insert into public.mobile_architecture_reviews (review_key, architecture_area, current_state, status, notes)
values
  ('nextjs-react-typescript-web','nextjs_web_app','Next.js / React / TypeScript web application','documented','This is the source application used by Capacitor.'),
  ('capacitor-mobile-wrapper','capacitor_wrapper','Capacitor mobile wrapper','documented','Not React Native and not Flutter. Native features are expected through Capacitor plugins.'),
  ('ios-native-shell','ios_shell','iOS native shell exists under ios/App','needs_review','Bundle signing and App Store metadata remain manual setup.'),
  ('android-native-shell','android_shell','Android native shell exists under android/app','documented','applicationId is com.ganbatuach.app.'),
  ('native-plugins','native_plugins','SplashScreen, Haptics and StatusBar configured in capacitor.config.ts','needs_review','Push/camera/location native plugins require provider QA before store submission.')
on conflict (review_key) do update set current_state = excluded.current_state, status = excluded.status, notes = excluded.notes, updated_at = now();

insert into public.mobile_store_platform_readiness (platform, bundle_or_application_id, display_name, app_icon_status, launch_screen_status, app_version, build_number, tablet_support_decision, minimum_os_version, target_sdk_readiness, developer_account_status, status, notes)
values
  ('ios','com.ganbatuach.app','גן בטוח','draft','draft','1.0.0','1','iPad support enabled in Info.plist orientations; final support decision required.','TBD in Xcode project settings','not_applicable','checklist_ready','preparing','iOS shell exists. Apple Developer account, signing, App Store privacy labels and screenshots still required.'),
  ('android','com.ganbatuach.app','גן בטוח','draft','draft','1.0','1','Tablet support allowed by responsive app; final Play device catalog review required.','Gradle minSdk from variables.gradle','target SDK from variables.gradle','checklist_ready','preparing','Android shell exists. Google Play account, signing, Data Safety and screenshots still required.')
on conflict (platform) do update set
  bundle_or_application_id = excluded.bundle_or_application_id,
  display_name = excluded.display_name,
  app_icon_status = excluded.app_icon_status,
  launch_screen_status = excluded.launch_screen_status,
  app_version = excluded.app_version,
  build_number = excluded.build_number,
  notes = excluded.notes,
  updated_at = now();

insert into public.capacitor_configuration_audit (audit_key, config_area, detected_value, expected_value, status, notes)
values
  ('capacitor-app-id','app_id','com.ganbatuach.app','com.ganbatuach.app','ready','Matches Android package strings and store readiness.'),
  ('capacitor-app-name','app_name','גן בטוח','גן בטוח','ready','Hebrew display name is configured.'),
  ('capacitor-web-dir','web_dir','public','public or configured live server','needs_review','Project uses server.url for live web app; confirm production/staging split before store builds.'),
  ('capacitor-server-url','server_url','CAPACITOR_SERVER_URL or NEXT_PUBLIC_APP_URL','staging/prod URL from env','needs_review','Do not hardcode production secrets.'),
  ('capacitor-plugins','plugins','SplashScreen, Haptics, StatusBar','Push/camera/location plugins where needed','needs_review','Native permission plugins require QA.'),
  ('android-permissions','permissions','INTERNET only','Add only required permissions with explanations','needs_review','Location/camera/photos/notifications should be requested only when feature implementation requires it.'),
  ('ios-permissions','ios_config','No NS permission descriptions detected in Info.plist','Add usage descriptions only for required permissions','needs_review','Avoid microphone usage for Gan Batuach observer.')
on conflict (audit_key) do update set detected_value = excluded.detected_value, status = excluded.status, notes = excluded.notes, updated_at = now();

insert into public.mobile_native_permissions_inventory (permission_key, platform, permission_name, status, purpose, gan_batuach_israel_mode_rule, store_disclosure_required, notes)
values
  ('location-all','all','Location','needs_review','GPS attendance, pickup validation and inspector field validation.','allowed_for_feature',true,'Use only when required for attendance/pickup/inspection.'),
  ('notifications-all','all','Notifications','needs_review','Child updates, messages, documents, payments, inspections, safety updates and system notifications.','allowed_for_feature',true,'Respect notification preferences.'),
  ('camera-photos-all','all','Camera / Photos','needs_review','Upload documents, profile photos and authorized evidence.','allowed_for_feature',true,'Not for automatic face recognition.'),
  ('microphone-all','all','Microphone','should_not_request','No kindergarten observer audio monitoring.','disabled_for_observer',true,'Do not claim microphone use for Gan Batuach observer.'),
  ('biometric-unlock-all','all','Biometric unlock','future_only','Optional device unlock convenience if implemented.','legal_review_required',true,'Do not store biometric templates in app tables.'),
  ('background-location-all','all','Background location','should_not_request','Not required for normal Gan Batuach workflows.','legal_review_required',true,'Avoid unless a future legal-approved workflow requires it.')
on conflict (permission_key) do update set status = excluded.status, purpose = excluded.purpose, gan_batuach_israel_mode_rule = excluded.gan_batuach_israel_mode_rule, notes = excluded.notes, updated_at = now();

insert into public.mobile_permission_explanations (explanation_key, permission_type, hebrew_copy, english_copy, status, notes)
values
  ('location-hebrew','location','המיקום משמש לאימות הגעה ואיסוף מהגן ולפיקוח בשטח, בהתאם להרשאות ולמדיניות הפרטיות.','Location is used to verify arrival, pickup and field inspection workflows according to permissions and privacy policy.','ready_for_review','Legal review required before store submission.'),
  ('notifications-hebrew','notifications','התראות משמשות לעדכוני גן, הודעות, מסמכים, תשלומים ועדכוני בטיחות שאושרו.','Notifications are used for kindergarten updates, messages, documents, payments and approved safety updates.','ready_for_review','Use approved categories only.'),
  ('camera-photos-hebrew','camera_photos','הגישה לתמונות משמשת להעלאת מסמכים, תמונות פרופיל ותיעוד מורשה בלבד.','Camera/photos access is used for document upload, profile photos and authorized evidence only.','ready_for_review','No face recognition claim.'),
  ('microphone-hebrew','microphone','המיקרופון אינו נדרש לתצפיתן הגן ואינו משמש לניטור שמע בגני ילדים.','Microphone is not required for the kindergarten observer and is not used for audio monitoring in kindergartens.','needs_legal_review','Do not request unless future non-Gan-Batuach feature is approved.')
on conflict (explanation_key) do update set hebrew_copy = excluded.hebrew_copy, status = excluded.status, notes = excluded.notes, updated_at = now();

insert into public.mobile_push_release_readiness (readiness_key, capability, status, provider, notes)
values
  ('push-fcm','fcm','prepared','Firebase Cloud Messaging','Android push readiness; production credentials not assumed.'),
  ('push-apns','apns','prepared','Apple Push Notification service','iOS APNs readiness; signing and APNs keys required.'),
  ('push-web','web_push','prepared','Web Push','Web push exists separately from store submission.'),
  ('push-token-registration','device_token_registration','ready_for_test','Supabase + API','Device token registration routes exist.'),
  ('push-token-revocation','token_revocation','ready_for_test','Supabase + API','Token unregister route exists.'),
  ('push-duplicate-cleanup','duplicate_cleanup','prepared','Internal readiness','Requires scheduled cleanup validation.'),
  ('push-deep-links','deep_links','prepared','Mobile deep link registry','Deep links must enforce auth and permissions.'),
  ('push-preferences','notification_preferences','prepared','Notification preferences','Respect category/channel preferences.'),
  ('push-categories','category_mapping','prepared','Gan Batuach categories','Child updates, messages, documents, payments, inspections, safety, system.')
on conflict (readiness_key) do update set status = excluded.status, notes = excluded.notes, updated_at = now();

insert into public.mobile_store_privacy_labels (label_key, data_category, collected, purpose, linked_to_user, shared_with_third_parties, store_disclosure_notes, status)
values
  ('privacy-contact-info','contact_info',true,'Account, communication, support and kindergarten operations.',true,false,'Includes parent/staff/manager contact details where applicable.','needs_legal_review'),
  ('privacy-identifiers','identifiers',true,'Authentication, account linking, audit and permissions.',true,false,'May include user IDs and device tokens.','needs_legal_review'),
  ('privacy-user-content','user_content',true,'Messages, documents, child updates and authorized uploads.',true,false,'Sensitive content is role-scoped.','needs_legal_review'),
  ('privacy-health-medical','health_medical',true,'Child medical notes and safety care workflows where approved.',true,false,'High sensitivity; disclosure must be legally reviewed.','needs_legal_review'),
  ('privacy-location','location',true,'GPS attendance, pickup and inspection validation.',true,false,'Not continuous background tracking by default.','needs_legal_review'),
  ('privacy-diagnostics','diagnostics',true,'Crash diagnostics and app health readiness.',true,false,'Future provider readiness only.','draft'),
  ('privacy-payment','payment_information',true,'Payment status, invoices and provider references.',true,false,'No raw card storage.','needs_legal_review'),
  ('privacy-photos-documents','photos_documents',true,'Document uploads, profile photos and authorized evidence.',true,false,'No real child screenshots for store assets.','needs_legal_review'),
  ('privacy-camera-metadata','camera_viewing_metadata',true,'Camera access audit logs and session metadata where camera viewing is approved.',true,false,'No raw RTSP exposure.','needs_legal_review')
on conflict (label_key) do update set status = excluded.status, store_disclosure_notes = excluded.store_disclosure_notes, updated_at = now();

insert into public.google_play_data_safety_items (item_key, data_category, collected, purpose, shared, encrypted_in_transit, deletion_supported, account_deletion_supported, status, notes)
select label_key, data_category, collected, purpose, shared_with_third_parties, true, true, true, 'needs_legal_review', store_disclosure_notes
from public.mobile_store_privacy_labels
on conflict (item_key) do update set purpose = excluded.purpose, status = excluded.status, notes = excluded.notes, updated_at = now();

insert into public.mobile_child_sensitive_data_review (review_key, data_area, status, review_summary, misleading_copy_risk, required_action)
values
  ('child-data-mobile-review','child_data','needs_review','Child data appears in parent/manager/staff flows and must be scoped by role.','Do not imply public child visibility.','Legal/privacy review before submission.'),
  ('medical-mobile-review','medical_information','needs_review','Medical information is high sensitivity and must remain server-authorized and audited.','Do not imply open staff access.','Confirm field-level encryption and access audit coverage.'),
  ('camera-mobile-review','camera_viewing','needs_review','Camera viewing is policy-gated and not unrestricted.','Do not promise unrestricted viewing or full screenshot prevention on web.','Review native camera viewing limitations.'),
  ('location-mobile-review','location_usage','needs_review','Location is for attendance, pickup and inspection validation.','Do not imply continuous tracking.','Confirm foreground-only use unless future review approves otherwise.'),
  ('notifications-mobile-review','notifications','ready_for_review','Notifications use approved categories and preferences.','Avoid panic language for safety notifications.','Review copy before store submission.'),
  ('documents-mobile-review','documents','needs_review','Documents can include sensitive IDs, medical files and evidence.','Do not show real docs in screenshots.','Use synthetic data only for store screenshots.')
on conflict (review_key) do update set status = excluded.status, required_action = excluded.required_action, updated_at = now();

insert into public.mobile_store_metadata_items (metadata_key, locale, field_name, field_value, status, notes)
values
  ('he-app-name','he','app_name','גן בטוח','ready_for_review','Hebrew primary brand.'),
  ('he-subtitle','he','subtitle','ניהול, שקיפות ובטיחות לגני ילדים','needs_legal_review','Avoid unsupported safety guarantees.'),
  ('he-short-description','he','short_description','פלטפורמה לניהול גן, תקשורת הורים, מסמכים, תשלומים ומוכנות פיקוח.','needs_legal_review','Draft for store review.'),
  ('he-full-description','he','full_description','גן בטוח מסייע לגני ילדים לנהל תפעול יומי, תקשורת עם הורים, מסמכים, תשלומים, מוכנות פיקוח ושקיפות מבוקרת. יכולות מצלמה ו-AI כפופות למדיניות, הרשאות ואישור אנושי.','needs_legal_review','No compliance/certification claim.'),
  ('he-keywords','he','keywords','גן ילדים, הורים, צוות, מסמכים, תשלומים, פיקוח, בטיחות, שקיפות','ready_for_review','Store keywords draft.'),
  ('he-support-url','he','support_url','/support','missing','Public support URL must be final before submission.'),
  ('he-privacy-url','he','privacy_policy_url','/privacy','draft','Final legal URL required before submission.'),
  ('he-terms-url','he','terms_url','/terms','draft','Final legal URL required before submission.'),
  ('en-app-name','en','app_name','Gan Batuach','ready_for_review','English readiness.'),
  ('en-subtitle','en','subtitle','Kindergarten management and trust platform','needs_legal_review','Draft English metadata.'),
  ('en-short-description','en','short_description','Management, parent communication, documents, payments and supervision readiness for kindergartens.','needs_legal_review','Draft English metadata.')
on conflict (metadata_key) do update set field_value = excluded.field_value, status = excluded.status, notes = excluded.notes, updated_at = now();

insert into public.mobile_screenshot_plan (screenshot_key, screen_name, target_role, platform, status, demo_data_required, privacy_rule, notes)
values
  ('screenshot-parent-child-timeline','Parent child timeline','parent','all','planned',true,'synthetic_data_only','Use demo child and no real photos.'),
  ('screenshot-parent-notifications','Parent notifications','parent','all','planned',true,'synthetic_data_only','Use non-alarming approved updates.'),
  ('screenshot-parent-documents','Parent documents','parent','all','planned',true,'synthetic_data_only','No real ID or medical document.'),
  ('screenshot-manager-command-center','Manager command center','manager','all','planned',true,'synthetic_data_only','Show operational readiness without sensitive names.'),
  ('screenshot-staff-daily-workflow','Staff daily workflow','staff','all','planned',true,'synthetic_data_only','Show tasks/attendance with demo data.'),
  ('screenshot-inspector-flow','Inspector inspection flow','inspector','all','planned',true,'synthetic_data_only','Show demo inspection only.'),
  ('screenshot-trust-view','Safety and trust view','parent','all','planned',true,'synthetic_data_only','Use careful language: reviewed updates.'),
  ('screenshot-login-onboarding','Login and onboarding','all','all','planned',true,'synthetic_data_only','No real phone/email.')
on conflict (screenshot_key) do update set status = excluded.status, notes = excluded.notes, updated_at = now();

insert into public.mobile_branding_readiness (branding_key, asset_type, platform, status, notes)
values
  ('branding-app-icon','app_icon','all','draft','Icons exist in native folders; final brand review required.'),
  ('branding-adaptive-android','adaptive_android_icon','android','draft','Adaptive icon resources exist; final Play preview required.'),
  ('branding-ios-icons','ios_icon_sizes','ios','draft','AppIcon asset exists; verify all App Store required sizes.'),
  ('branding-splash-screen','splash_screen','all','draft','Splash assets exist; verify launch appearance.'),
  ('branding-launch-screen','launch_screen','ios','draft','LaunchScreen storyboard exists.'),
  ('branding-brand-colors','brand_colors','all','ready','Primary blue already used in Capacitor splash/status bar.'),
  ('branding-store-graphics','store_graphics','all','missing','Store feature graphics and promotional images still required.')
on conflict (branding_key) do update set status = excluded.status, notes = excluded.notes, updated_at = now();

insert into public.mobile_build_pipeline_readiness (build_key, platform, build_type, status, signing_required, env_requirements, notes)
values
  ('ios-local-build','ios','local_build','needs_setup',true,'Xcode, Apple team, signing profile, CAPACITOR_SERVER_URL','Do not sign production build yet.'),
  ('android-local-build','android','local_build','needs_setup',true,'Android Studio, keystore, CAPACITOR_SERVER_URL','Do not sign production build yet.'),
  ('mobile-ci-build','all','ci_build','documented',true,'GitHub Actions runner with native toolchains or manual build process','CI native build not required yet.'),
  ('mobile-staging-build','all','staging_build','documented',true,'Staging app URL and test provider keys','Use internal testing first.'),
  ('mobile-production-build','all','production_build','blocked',true,'Production app URL, signing, final legal URLs and store metadata','Blocked until explicit release approval.'),
  ('mobile-env-vars','all','environment_variables','documented',false,'No NEXT_PUBLIC secrets; mobile uses public app URL only','Provider secrets remain server-side.')
on conflict (build_key) do update set status = excluded.status, notes = excluded.notes, updated_at = now();

insert into public.mobile_release_channels (channel_key, platform, channel_name, status, release_stage, notes)
values
  ('ios-testflight-internal','ios','TestFlight Internal Testing','prepared','testflight','No upload yet.'),
  ('ios-testflight-external','ios','TestFlight External Testing','not_started','testflight','Requires App Review beta information.'),
  ('ios-app-review','ios','Apple App Review','not_started','app_review','Requires metadata, privacy labels and reviewer notes.'),
  ('android-internal-testing','android','Google Play Internal Testing','prepared','google_internal_testing','No upload yet.'),
  ('android-closed-testing','android','Google Play Closed Testing','not_started','google_closed_testing','Requires tester groups.'),
  ('android-production','android','Google Play Production','not_started','production_release','Blocked until review approval.'),
  ('pilot-release','all','Pilot Release','prepared','pilot_release','Controlled release only after legal/security approval.')
on conflict (channel_key) do update set status = excluded.status, notes = excluded.notes, updated_at = now();

insert into public.testflight_readiness (readiness_key, item, status, notes)
values
  ('testflight-internal-testers','Internal testers','prepared','Define internal testers before upload.'),
  ('testflight-external-testers','External testers','needs_setup','Requires Apple beta review and external tester list.'),
  ('testflight-tester-notes','Tester notes','prepared','Use reviewer notes table as source.'),
  ('testflight-demo-accounts','Demo account instructions','prepared','Use synthetic accounts only.')
on conflict (readiness_key) do update set status = excluded.status, notes = excluded.notes, updated_at = now();

insert into public.google_internal_testing_readiness (readiness_key, item, status, notes)
values
  ('google-internal-track','Internal test track','prepared','Create upload only after signed build exists.'),
  ('google-tester-groups','Tester groups','needs_setup','Add approved testers in Play Console.'),
  ('google-test-instructions','Test instructions','prepared','Use reviewer notes and demo account pack.'),
  ('google-known-limitations','Known limitations','prepared','State camera/AI limitations clearly.')
on conflict (readiness_key) do update set status = excluded.status, notes = excluded.notes, updated_at = now();

insert into public.mobile_store_review_notes (note_key, note_area, note_text, status)
values
  ('review-demo-accounts','demo_accounts','Demo accounts use synthetic data only and cover parent, manager, staff and inspector roles.','ready_for_review'),
  ('review-role-explanations','role_explanations','The app has separate role dashboards for parents, managers, staff and inspectors. Access is scoped by role and permissions.','ready_for_review'),
  ('review-permissions','permission_rationale','Location is used for attendance, pickup and inspection validation. Notifications support operational updates. Camera/photos are for uploads only where authorized.','needs_legal_review'),
  ('review-camera-behavior','camera_behavior','Parent camera viewing, if enabled, is permission-gated, time-limited, audited and policy-controlled. No direct RTSP is exposed.','needs_legal_review'),
  ('review-no-audio','no_audio_monitoring','Gan Batuach Israel mode does not use audio monitoring for kindergarten observer features.','needs_legal_review'),
  ('review-no-face','no_face_recognition','Gan Batuach Israel mode does not use face recognition or face matching from kindergarten cameras.','needs_legal_review'),
  ('review-child-safety','child_safety_privacy','The product supports child safety workflows through controlled access, privacy boundaries and human-reviewed updates.','needs_legal_review')
on conflict (note_key) do update set note_text = excluded.note_text, status = excluded.status, updated_at = now();

insert into public.mobile_demo_account_pack (account_key, role_key, display_name, status, data_policy, instructions)
values
  ('demo-parent-reviewer','parent','Parent reviewer demo','planned','synthetic_only','Use synthetic child timeline, documents and messages.'),
  ('demo-manager-reviewer','manager','Manager reviewer demo','planned','synthetic_only','Use demo kindergarten and no real children.'),
  ('demo-staff-reviewer','staff','Staff reviewer demo','planned','synthetic_only','Use demo staff tasks and attendance.'),
  ('demo-inspector-reviewer','inspector','Inspector reviewer demo','planned','synthetic_only','Use demo inspection flow.'),
  ('demo-admin-limited-reviewer','admin_limited_reviewer','Limited admin reviewer demo','planned','synthetic_only','Only if required by store review; no secrets or real personal data.')
on conflict (account_key) do update set status = excluded.status, instructions = excluded.instructions, updated_at = now();

insert into public.mobile_legal_link_readiness (link_key, link_type, url_path, status, notes)
values
  ('mobile-privacy-policy','privacy_policy','/privacy','draft_for_legal_review','Final public URL required before submission.'),
  ('mobile-terms','terms_of_use','/terms','draft_for_legal_review','Final public URL required before submission.'),
  ('mobile-camera-notice','camera_privacy_notice','/camera-privacy','draft_for_legal_review','Can be draft until legal review.'),
  ('mobile-ai-notice','ai_processing_notice','/ai-processing-notice','draft_for_legal_review','Must explain human review and no automatic decisions.'),
  ('mobile-data-rights','data_subject_rights_notice','/dashboard/privacy','ready_for_review','In-app privacy request portal exists.'),
  ('mobile-support-contact','support_contact','/support','missing','Public support URL and contact details required.')
on conflict (link_key) do update set url_path = excluded.url_path, status = excluded.status, notes = excluded.notes, updated_at = now();

insert into public.mobile_release_qa_checklist (qa_key, workflow, role_key, status, required_for_release, notes)
values
  ('qa-login-all','login','all','not_tested',true,'Validate native shell login and auth callback.'),
  ('qa-mfa-all','mfa','all','not_tested',true,'Validate MFA-sensitive actions where enabled.'),
  ('qa-onboarding-all','onboarding','all','not_tested',true,'Validate first login/onboarding by role.'),
  ('qa-parent-timeline','parent_timeline','parent','not_tested',true,'Parent sees only own child data.'),
  ('qa-staff-workflow','staff_workflow','staff','not_tested',true,'Staff daily workflow and attendance.'),
  ('qa-manager-command','manager_command_center','manager','not_tested',true,'Manager command center mobile layout.'),
  ('qa-inspector-forms','inspector_forms','inspector','not_tested',true,'Inspection forms and signature readiness.'),
  ('qa-push','push_notifications','all','not_tested',true,'Push categories, preferences and deep links.'),
  ('qa-deep-links','deep_links','all','not_tested',true,'Deep links enforce auth and role permissions.'),
  ('qa-payments','payments','parent','not_tested',true,'No raw card storage; provider sandbox unless approved.'),
  ('qa-documents','documents','all','not_tested',true,'Sensitive document access audited.'),
  ('qa-camera-viewing','camera_viewing','parent','blocked',true,'Blocked until camera viewing policy approval and native protection QA.'),
  ('qa-logout','logout','all','not_tested',true,'Logout clears session.'),
  ('qa-account-deletion','account_deletion_request','all','not_tested',true,'Connects to Phase 156 privacy requests.')
on conflict (qa_key) do update set status = excluded.status, notes = excluded.notes, updated_at = now();

insert into public.mobile_crash_diagnostics_readiness (diagnostics_key, provider_option, status, notes)
values
  ('diagnostics-sentry','sentry','future_ready','Good fit for Next.js and Capacitor. No provider activation required yet.'),
  ('diagnostics-crashlytics','firebase_crashlytics','future_ready','Good fit for Android/FCM and native crash reporting. Requires Firebase setup.'),
  ('diagnostics-other','other_provider','future_ready','Provider-neutral placeholder.')
on conflict (diagnostics_key) do update set status = excluded.status, notes = excluded.notes, updated_at = now();

comment on table public.mobile_release_readiness_scores is 'App Store and Google Play submission readiness score snapshots. No submission is performed.';
comment on table public.mobile_architecture_reviews is 'Mobile architecture review: Next.js web app wrapped with Capacitor, not React Native or Flutter.';
comment on table public.mobile_store_platform_readiness is 'iOS and Android store platform readiness: identifiers, icons, versions, build numbers and developer account checklist.';
comment on table public.capacitor_configuration_audit is 'Capacitor configuration audit for app id, app name, webDir, plugins, permissions, deep links and push readiness.';
comment on table public.mobile_native_permissions_inventory is 'Native permission inventory and Gan Batuach Israel Mode rules.';
comment on table public.mobile_permission_explanations is 'Hebrew and English permission explanation copy for store and runtime prompts.';
comment on table public.mobile_store_privacy_labels is 'Apple App Store privacy label readiness mapping.';
comment on table public.google_play_data_safety_items is 'Google Play Data Safety readiness mapping.';
comment on table public.mobile_screenshot_plan is 'Store screenshot checklist using synthetic or redacted demo data only.';
comment on table public.mobile_store_review_notes is 'Reviewer notes for Apple and Google store review.';
comment on table public.mobile_demo_account_pack is 'Synthetic demo account pack for store reviewers.';
comment on table public.mobile_release_qa_checklist is 'Mobile release QA checklist before TestFlight, Google internal testing or production release.';

notify pgrst, 'reload schema';
