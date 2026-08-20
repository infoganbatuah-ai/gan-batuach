begin;

-- Camera evidence is never read or written directly by a browser role. The
-- server-side gateway/storage API uses the service role only after role,
-- garden and audit checks, then issues a short-lived signed URL when allowed.
drop policy if exists "camera snapshots storage authenticated read" on storage.objects;
drop policy if exists "camera snapshots storage service insert" on storage.objects;

-- Keep the bucket private even if an earlier environment changed it manually.
update storage.buckets
set public = false
where id = 'camera-snapshots';

do $$
begin
  if to_regclass('public.database_storage_bucket_audit') is not null then
    update public.database_storage_bucket_audit
    set current_status = 'fixed',
        notes = 'Direct authenticated browser access removed. Camera evidence is server/gateway-only and must use short-lived signed URLs after authorization.',
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'privacy_hardening_migration', '20260820000100',
          'direct_browser_access', false,
          'signed_url_required', true
        ),
        updated_at = now()
    where bucket_id = 'camera-snapshots';
  end if;
end
$$;

commit;
