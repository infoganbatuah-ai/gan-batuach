# Security Hardening And Enterprise Readiness

Gan Batuach and the future Digital Observer platform now include an internal security readiness layer for pilot operations and enterprise deployment preparation.

This phase does not weaken permissions and does not expose secrets. It adds tracking, visibility, and operational readiness.

## Security Architecture

Security readiness is tracked across:

- Authentication
- Authorization
- RLS coverage
- API protection
- Secrets management
- Audit logging
- Backup readiness
- Disaster recovery
- Rate limiting
- Security monitoring
- Compliance readiness

Admin route:

- `/dashboard/admin/security`

## Data Model

New admin-only readiness tables:

- `security_readiness_checks`
- `security_findings`
- `security_secret_inventory`
- `backup_readiness_checks`
- `disaster_recovery_checkpoints`
- `security_monitoring_events`
- `audit_event_catalog`

All tables are RLS protected with admin-only policies using `public.is_admin()`.

## Secrets Model

The platform tracks secret readiness by name and status only.

Stored:

- Secret key name
- Type
- Location
- Required yes/no
- Server-only yes/no
- Rotation status
- Readiness status

Not stored:

- Secret values
- Tokens
- Passwords
- Gateway credentials
- Provider API keys

## Audit Logging Readiness

Audit coverage is tracked for:

- Login success
- Failed login
- Permission changes
- Camera changes
- Observer changes
- User management
- Subscription changes

Existing `audit_logs` remain the operational source. The new `audit_event_catalog` shows which required audit categories are implemented and which still need wiring.

## Backup Model

Backup readiness tracks:

- Supabase database backup
- Private storage backup
- Camera recording backup readiness
- Configuration backup
- Secrets recovery readiness

Each record can track:

- Retention days
- RPO
- RTO
- Last backup
- Last restore test
- Validation status

## Disaster Recovery Model

Recovery checkpoints cover:

- Database restore
- Storage restore
- Auth configuration recovery
- Video Gateway recovery
- Communications provider recovery
- Digital Observer worker recovery
- Full platform recovery exercise

These are readiness checkpoints only. A full dry-run recovery is still required before enterprise launch.

## Rate Limiting Readiness

Existing `rate_limit_events` are surfaced in the security center.

Priority endpoints for rate limiting:

- Login and auth flows
- Upload APIs
- Observer APIs
- Notification APIs
- Messaging APIs
- Camera playback token APIs

## Security Monitoring

`security_monitoring_events` prepares tracking for:

- Failed login
- Suspicious login
- Permission change
- Camera change
- Observer change
- User management action
- Subscription change
- API rate-limit event
- Unusual activity
- Admin security alert

Future implementation should write monitoring records from auth callbacks, API guards, and sensitive server actions.

## Compliance Readiness

Compliance readiness should validate:

- Privacy policy
- Parent consent
- Staff consent
- Camera consent
- AI observer consent
- Retention policy
- Audit evidence
- Data deletion process
- Storage bucket access

Because the product handles minors, consent and retention evidence must be validated before broad production use.

## Pilot Readiness

Before first real pilot:

1. Run full role access smoke test.
2. Verify RLS on all production tables.
3. Verify no debug routes are public.
4. Verify no service role key is exposed to client bundles.
5. Verify private storage buckets.
6. Verify upload validation.
7. Run database backup test.
8. Run storage restore test.
9. Confirm admin recovery account.
10. Review open security findings.

## Remaining Enterprise Gaps

- Wire auth success/failure events into `security_monitoring_events`.
- Add explicit audit writes for all permission, camera, observer and subscription changes.
- Complete schema-wide RLS audit.
- Add operational restore validation.
- Add rate limiting to every sensitive route.
- Add provider-level secret rotation runbooks.
- Add incident response workflow for security findings.
