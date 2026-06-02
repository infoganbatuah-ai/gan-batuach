alter table public.camera_streams
  add column if not exists system_type text,
  add column if not exists connection_host text,
  add column if not exists connection_port integer,
  add column if not exists connection_channel integer,
  add column if not exists stream_quality text,
  add column if not exists connection_username_encrypted text,
  add column if not exists connection_password_encrypted text,
  add column if not exists rtsp_template text,
  add column if not exists last_test_status text,
  add column if not exists last_test_message text,
  add column if not exists last_test_at timestamptz,
  add column if not exists gateway_registration_status text,
  add column if not exists gateway_last_error text,
  add column if not exists masked_connection_summary jsonb not null default '{}'::jsonb;

create index if not exists idx_camera_streams_system_type on public.camera_streams(system_type);
create index if not exists idx_camera_streams_gateway_registration on public.camera_streams(gateway_registration_status);
create index if not exists idx_camera_streams_last_test on public.camera_streams(last_test_at desc);

comment on column public.camera_streams.connection_username_encrypted is 'Encrypted camera username. Never expose to browser.';
comment on column public.camera_streams.connection_password_encrypted is 'Encrypted camera password. Never expose to browser.';
comment on column public.camera_streams.rtsp_template is 'Server-only RTSP generation template identifier, not a full credential URL.';
