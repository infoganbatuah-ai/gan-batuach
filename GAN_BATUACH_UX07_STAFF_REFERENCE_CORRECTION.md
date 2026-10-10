# Gan Batuach UX-07 Staff visual reference correction

## Scope and source

- Source branch: `origin/integration/development`
- Source integration SHA: `a9eda0abd371364feb147c558c326ff99b1ce26c`
- Correction branch: `codex/ux07-staff-reference-correction`
- Correct visual reference: `/Users/danielderi/Desktop/גן בטוח/עיצוב עדכון גרסה/GB_UX_REF_STAFF_FULL_PLATFORM.png`
- Reference SHA-256: `4026a8eb545dc27cb95dacb8a7375a539ba82e6aaa74b2fdb57266114bf9662b`
- Reference dimensions: `1536 × 1024`
- Environment: isolated `DEVELOPMENT / INTEGRATION`
- Production access: none

The canonical UX-07 functionality is unchanged. This correction only aligns the active Staff surfaces with the verified Staff visual reference and adds repeatable screenshot evidence.

## Corrections

- Applied the reference's deep-navy desktop sidebar and dark Staff mobile header.
- Strengthened Staff identity with a photo-led dashboard hero and a profile header that exposes role, active Garden, employment state, and Classroom context.
- Reworked the manager Staff directory into a compact roster with search, employment filters, avatars, status chips, and mobile-first ordering.
- Added a purpose-built Staff settings menu matching the reference while preserving the canonical profile and security form.
- Tightened metric, CTA, card, and typography hierarchy across manager and Staff shells.
- Kept schedules, clock actions, time records, payroll-ready hours, documents, Tasks, messages, and camera-policy behavior canonical.

## Screen review inventory

| Concept | Desktop route | Mobile route | Desktop | Mobile |
| --- | --- | --- | --- | --- |
| Staff dashboard | `/dashboard/staff` | `/dashboard/staff` | OWNER_REVIEW_READY | OWNER_REVIEW_READY |
| Staff list | `/dashboard/garden/staff` | `/dashboard/garden/staff` | OWNER_REVIEW_READY | OWNER_REVIEW_READY |
| Staff profile | `/dashboard/staff/settings` | `/dashboard/staff/settings` | OWNER_REVIEW_READY | OWNER_REVIEW_READY |
| Multi-Garden Staff | `/dashboard/staff` | `/dashboard/staff` | OWNER_REVIEW_READY | OWNER_REVIEW_READY |
| Schedule | `/dashboard/staff/shifts` | `/dashboard/staff/shifts` | OWNER_REVIEW_READY | OWNER_REVIEW_READY |
| Current shift | `/dashboard/staff` | `/dashboard/staff` | OWNER_REVIEW_READY | OWNER_REVIEW_READY |
| Clock in/out | `/dashboard/staff/attendance` | `/dashboard/staff/attendance` | OWNER_REVIEW_READY | OWNER_REVIEW_READY |
| Time records | `/dashboard/staff/shifts` | `/dashboard/staff/shifts` | OWNER_REVIEW_READY | OWNER_REVIEW_READY |
| Staff hours | `/dashboard/garden/staff-time` | `/dashboard/garden/staff-time` | OWNER_REVIEW_READY | OWNER_REVIEW_READY |
| Missing clock-out | `/dashboard/garden/staff-time` | `/dashboard/garden/staff-time` | OWNER_REVIEW_READY | OWNER_REVIEW_READY |
| Documents | `/dashboard/staff/documents` | `/dashboard/staff/documents` | OWNER_REVIEW_READY | OWNER_REVIEW_READY |
| Tasks | `/dashboard/staff/tasks` | `/dashboard/staff/tasks` | OWNER_REVIEW_READY | OWNER_REVIEW_READY |
| Messaging | `/dashboard/staff/messages` | `/dashboard/staff/messages` | OWNER_REVIEW_READY | OWNER_REVIEW_READY |
| Settings | `/dashboard/staff/settings` | `/dashboard/staff/settings` | OWNER_REVIEW_READY | OWNER_REVIEW_READY |
| Safety/Cameras permission | `/dashboard/staff/cameras` | `/dashboard/staff/cameras` | OWNER_REVIEW_READY | OWNER_REVIEW_READY |

Review totals: 15 concepts, 30 viewport captures, 30 `OWNER_REVIEW_READY`, 0 `NEEDS_POLISH`, 0 `VISUAL_DRIFT`, 0 `BROKEN`.

## Visual evidence

- Screenshot pack: `qa-evidence/ux07-staff-reference-correction/screenshots/`
- Desktop contact sheet: `qa-evidence/ux07-staff-reference-correction/contact-sheet-desktop.webp`
- Mobile contact sheet: `qa-evidence/ux07-staff-reference-correction/contact-sheet-mobile.webp`
- Reference comparison: `qa-evidence/ux07-staff-reference-correction/comparison-board.webp`
- Structured results: `qa-evidence/ux07-staff-reference-correction/results.json`
- Checksums: `qa-evidence/ux07-staff-reference-correction/SHA256SUMS`

All implementation screenshots were freshly captured at `1440 × 1024` and `390 × 844` from the corrected Development product tree. No reference image is used as implementation evidence.

## Functional and repository validation

- UX-07 focused QA: PASS, 7/7
- Multi-Garden Staff QA: PASS, 8/8
- Staff time/role E2E: PASS, 15 checks
- UX-06 attendance integration: PASS, 8/8
- Attendance/pickup E2E: PASS, 16 checks
- TypeScript: PASS
- Lint regression: PASS, 0 new errors and 0 new warnings
- Production build: PASS, 534 pages
- Domain gate: PASS, 30/30
- Security/isolation gate: PASS, 10/10
- Migration audit: PASS, 244 migrations
- Isolated Development migration drift: PASS, 244/244
- Release-contract preflight: PASS
- Integration workflow and ledger checks: PASS
- Accessibility baseline: visible focus, semantic navigation/forms, status text, touch targets, and reduced-motion behavior preserved
- RTL: Staff navigation, profile, roster, schedules, time, mixed phone/email, documents, and mobile layouts reviewed
- QA personas: preserved; no global reset or deletion
- Digital Observer core product diff: 0
- New fixed monthly commitment: ₪0
- Production: untouched
