# Gan Batuach Backup And Restore

This runbook covers production backup and recovery for Supabase, Storage and application configuration. It contains no credentials.

## Backup Scope

- Supabase Postgres database
- Supabase Auth users
- Supabase Storage buckets
- Migration files in `supabase/migrations`
- Deployment environment variable inventory
- Audit logs and operational logs where retained by the hosting provider

## Database Backup Strategy

- Enable Supabase automated daily backups for production.
- Keep point-in-time recovery enabled when available.
- Before every major migration, create a manual backup snapshot.
- Export schema and data before destructive maintenance.
- Keep backups encrypted and access-limited to production operators.

Recommended cadence:

- Daily automated backup
- Manual backup before migrations
- Weekly restore verification in a non-production environment

## Storage Bucket Backup Strategy

Buckets to back up:

- `profile-photos`
- `child-photos`
- `pickup-person-photos`
- `kindergarten-logos`
- `documents`
- `camera-snapshots`

Guidelines:

- Treat child, parent and document files as sensitive data.
- Keep buckets private unless a specific bucket is intentionally public.
- Mirror storage objects to a secure backup location.
- Preserve object paths because database records may store paths.
- Back up storage metadata when supported.

## Migration Restore Process

1. Create a clean Supabase project or restore database snapshot.
2. Apply migrations in timestamp order from `supabase/migrations`.
3. Restore database data.
4. Restore Auth users or validate they were restored by the platform backup.
5. Restore Storage objects with the same bucket names and object paths.
6. Recreate private bucket policies if needed.
7. Re-enter server-only environment variables in the deployment platform.
8. Run `/api/health`.
9. Run `/api/health/deep` with `x-health-secret`.
10. Run role smoke tests for admin, manager, staff, parent and inspector.

## Disaster Recovery Checklist

- Confirm incident owner.
- Freeze writes if data corruption is suspected.
- Identify restore point.
- Restore database.
- Restore storage.
- Verify migrations and RLS policies.
- Verify first admin login.
- Verify parent and manager dashboards.
- Verify uploads and camera permissions.
- Verify cron jobs are not double-running.
- Communicate recovery status to operators.

## Recovery Validation

After restore, test:

- Admin can log in.
- Manager sees only assigned kindergarten data.
- Parent sees only own children and cameras.
- Staff sees only assigned kindergarten.
- Inspector sees only assigned kindergartens.
- Storage images load through allowed flows.
- Payments, requests and notifications are present.
- New write actions save correctly.

## Notes

- Never store backup credentials in the repository.
- Never restore production data into an unsecured local environment.
- Rotate secrets if a backup or export may have been exposed.
