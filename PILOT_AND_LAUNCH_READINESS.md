# Pilot And Launch Readiness

Gan Batuach and the Digital Observer now include an internal operational layer for real-world pilot deployment and commercial launch preparation.

Admin routes:

- `/dashboard/admin/pilot-center`
- `/dashboard/admin/launch-readiness`

## Pilot Plan

Recommended pilot structure:

1. Select one real kindergarten.
2. Create or verify:
   - Admin account
   - Manager or owner account
   - Staff account
   - Inspector account
   - Parent accounts
3. Complete kindergarten setup:
   - Logo
   - Manager profile
   - Staff
   - Children
   - Parents
   - Cameras
   - Subscription status
4. Run daily workflows for one week:
   - Manager dashboard
   - Parent messages
   - Staff updates
   - Camera readiness
   - Observer review mode
   - Finance page
5. Collect feedback after each workflow.
6. Resolve critical and high issues before adding more kindergartens.

## Pilot Management

Tracked through `pilot_programs` and `pilot_participants`.

Pilot statuses:

- planned
- inviting
- active
- paused
- completed
- cancelled

Participant statuses:

- invited
- active
- completed
- suspended

Supported participant roles:

- kindergarten
- manager
- owner
- parent
- staff
- inspector
- admin

## Launch Readiness Score

Readiness categories:

- infrastructure
- onboarding
- notifications
- observer
- cameras
- security
- performance
- support

The launch dashboard averages the category scores and combines them with blockers, open issues and checklist completion.

## Production Configuration

Production configuration readiness tracks:

- WhatsApp
- SMS
- Push
- Email
- Cameras
- AI
- Security
- Backups

Statuses:

- ready
- partial
- not ready
- blocked
- not required

## Launch Issues

Issue severities:

- critical
- high
- medium
- low

Issue statuses:

- open
- investigating
- fixed
- verified
- accepted_risk

Critical issues should block pilot expansion.

## Launch Blockers

Blocker types:

- security
- data
- payments
- cameras
- observer
- notifications
- support
- performance
- legal
- operations

Any open critical blocker should block launch.

## Customer Success Readiness

Required before pilot:

- First kindergarten onboarding guide
- Support playbook
- Pilot success metrics
- Manager training material
- Pilot FAQ

Existing docs:

- `FIRST_KINDERGARTEN_ONBOARDING.md`
- `SUPPORT_PLAYBOOK.md`
- `PILOT_SUCCESS_METRICS.md`

## Performance Readiness

Track health for:

- Database
- API
- Observer
- Notifications
- Cameras

Before launch:

- Run `npm run typecheck`
- Run `npm run build`
- Verify `/api/health`
- Verify `/api/health/deep`
- Smoke test role dashboards
- Review slow or failing routes

## Go-Live Checklist

Required launch gates:

- Security audit completed
- Backup verified
- Pilot completed
- Camera validation completed
- Support ready
- Performance smoke completed

Optional or phased gates:

- Real WhatsApp/SMS/Push providers
- Digital Observer real AI
- Real recording

## Success Criteria

Pilot is ready to expand when:

- No critical launch blockers are open.
- No critical launch issues are open.
- At least one kindergarten completes the pilot.
- Core role workflows pass.
- Mobile experience is usable.
- Manager can operate daily work without support intervention.
- Parents understand messages, documents and cameras.
- Camera and observer language remains careful and review-first.

## Rollback Strategy

If pilot operations fail:

1. Pause pilot status.
2. Keep parent and manager access to historical data.
3. Disable optional integrations first:
   - Real notifications
   - Observer automation
   - Camera live viewing
4. Keep core management pages available.
5. Record the issue in `launch_issues` or `launch_blockers`.
6. Verify fix before reactivating.

## Remaining Launch Work

- Add admin actions for editing pilot and launch records.
- Connect real telemetry into performance readiness.
- Wire support tickets into launch issues.
- Run real backup/restore validation.
- Validate real camera gateway with pilot hardware.
