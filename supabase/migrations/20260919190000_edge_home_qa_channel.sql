-- HOME_QA is an exact-device, signed pilot channel; old channel values remain valid.
alter table public.observer_edge_releases
  drop constraint if exists observer_edge_releases_channel_check;
alter table public.observer_edge_releases
  add constraint observer_edge_releases_channel_check
  check (channel in ('INTERNAL','CANARY','STABLE','HOME_QA'));
