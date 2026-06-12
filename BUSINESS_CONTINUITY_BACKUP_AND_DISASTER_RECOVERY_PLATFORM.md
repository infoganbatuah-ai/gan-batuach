# Business Continuity, Backup And Disaster Recovery Platform

## Purpose

Gan Batuach must keep operating during provider failures, recover critical data quickly, and protect kindergarten, parent, staff, inspection, compliance, camera and observer records.

This phase adds the operational readiness layer. It does not activate production backups by itself and does not store provider secrets.

## Backup Architecture

Tracked coverage:

- Supabase database
- Supabase Auth users
- Supabase Storage buckets
- Documents and evidence
- Medical records
- Inspection reports
- Digital signatures
- Parent communications
- Compliance records
- Observer metadata
- AI telemetry
- Configuration settings

Each backup readiness item tracks:

- Backup frequency
- Last and next backup
- Restore status
- Readiness score
- Retention period
- RTO and RPO targets
- Legal hold support
- Deletion request handling

## Restore Architecture

Restore tests are tracked in `restore_test_runs`.

Required restore drills:

- Database restore
- Storage restore
- Document restore
- Auth user restore
- Inspection report restore
- Full platform restore, when production infrastructure is ready

Each test should record:

- Status
- Start and completion time
- Duration
- RTO and RPO result
- Evidence link
- Summary
- Next test date

## Disaster Recovery Plans

Disaster recovery plans are stored in `disaster_recovery_plans`.

Covered incidents:

- Database outage
- Storage outage
- Auth outage
- Supabase outage
- Vercel outage
- Camera gateway outage
- Digital Observer outage
- Email outage
- SMS outage
- WhatsApp outage
- Payment outage

Each plan includes:

- Detection signals
- Recovery steps
- Failover strategy
- Communication plan
- RTO and RPO
- Last and next test date

## Provider Strategy

Provider health is tracked in `provider_health_checks`.

Providers currently prepared:

- Supabase
- Vercel
- Resend
- Twilio SMS
- Meta WhatsApp
- Push provider
- Camera gateway
- Observer services
- Payment provider

Provider states:

- `healthy`
- `degraded`
- `failed`

When a provider is degraded, the system should create or show a recovery recommendation.

## Failover Strategy

Failover rules are stored in `failover_rules`.

Prepared fallback behavior:

- Email failure queues messages and may fall back to SMS for critical notices.
- SMS failure may fall back to email where allowed.
- WhatsApp failure may fall back to SMS where allowed.
- AI failure switches to manual review mode.
- Camera gateway failure switches cameras to offline mode and logs attempts.

No broad production sending is activated automatically.

## Offline Operations

Offline readiness is stored in `offline_operations_modes`.

Prepared modes:

- Manager: continue core operations and queue changes.
- Inspector: continue inspections, photos and signatures offline.
- Staff: queue attendance and child updates.
- Parent: read-only cached mode.
- Admin: manual export and incident checklist.

All offline writes require sync and conflict review when connectivity returns.

## Incident Workflow

Operational incidents are stored in `operational_incidents`.

Lifecycle:

1. Open incident
2. Investigate
3. Mitigate
4. Resolve
5. Postmortem
6. Close

Each incident should include:

- Severity
- Impact
- Affected systems
- Start and end time
- Root cause
- Mitigation
- Postmortem

## Audit Workflow

Business continuity audit events are stored in `business_continuity_audit_events`.

Tracked events:

- Backup created
- Backup failed
- Restore executed
- Restore failed
- Retention changed
- Provider failed
- Incident opened
- Incident resolved

Audit events should not contain secrets.

## Retention And Privacy Alignment

Retention alignment is tracked in `retention_alignment_checks`.

Continuity planning must respect:

- Deletion requests
- Privacy rules
- Legal holds
- Data retention policies
- Child data protection
- Camera and observer privacy boundaries

Backups must not become a way to bypass deletion or privacy rules.

## Recovery Objectives

Recovery objectives are stored in `recovery_objectives`.

Each critical system area defines:

- RTO: how quickly the service must recover
- RPO: how much data loss is acceptable
- Priority
- Test status

Current priority areas:

- Database
- Storage
- Documents
- Inspections
- Compliance
- Observer
- Communications
- Camera gateway

## Continuity Dashboard

The admin dashboard is available at:

`/dashboard/admin/business-continuity`

It shows:

- Business Continuity Score
- Backup readiness
- Restore readiness
- Provider health
- Active incidents
- Recovery recommendations
- Disaster recovery plans
- Failover readiness
- Offline mode readiness
- Retention alignment
- Recovery objectives

## Remaining Production Work

- Connect real Supabase automated backup metadata.
- Run isolated restore drills and attach evidence.
- Connect provider status checks to live health APIs.
- Add incident creation actions and postmortem workflow UI.
- Validate offline sync on real mobile devices.
- Finalize legal retention policy with counsel.
- Define production escalation contacts and on-call ownership.
