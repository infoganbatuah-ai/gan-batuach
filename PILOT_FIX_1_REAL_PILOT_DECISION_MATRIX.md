# PILOT FIX 1 - Real Pilot Decision Matrix

Date: 2026-06-27

## NO_GO

- allowed users: internal engineers only
- allowed data: synthetic/local
- prohibited: all real users/data
- trigger: build failure, RLS failure, secret leak, legal block

## INTERNAL_DEMO_ONLY

- allowed users: internal/demo stakeholders
- allowed data: synthetic
- allowed features: demo walkthrough/readiness
- prohibited: real pilot, real child/parent data, live camera/AI/payments
- current status: active decision

## PILOT_PREP_ONLY

- allowed users: internal team, pilot admins
- allowed data: synthetic plus setup metadata only
- allowed features: environment setup, test accounts, RLS tests
- required gates: build/runtime, environment separation

## PILOT_WITH_SYNTHETIC_DATA

- allowed users: pilot team only
- allowed data: synthetic in pilot environment
- purpose: end-to-end role rehearsal
- prohibited: real children/parents/staff docs

## PILOT_WITH_REAL_MANAGER_ONLY

- allowed users: real manager/admin only
- allowed data: real kindergarten metadata only
- prohibited: children/parents/staff documents/camera/AI
- required gates: RLS manager scope, legal minimum notice

## PILOT_WITH_REAL_STAFF_ONLY

- allowed users: manager/admin/limited staff
- allowed data: limited staff profile data
- prohibited: child/parent data unless approved
- required gates: staff assignment boundaries and staff document policy

## PILOT_WITH_LIMITED_PARENT_DATA

- allowed users: selected parents
- allowed data: limited child/parent data
- prohibited: camera/AI raw data
- required gates: RLS, privacy, consent, support

## PILOT_WITHOUT_CAMERA_AI

- allowed users: approved pilot roles
- allowed features: core role flows, messages, documents, inspections
- prohibited: camera viewing, AI processing/claims
- required gates: RLS/legal/support

## PILOT_WITH_CAMERA_INTERNAL_ONLY

- allowed users: admin/manager/internal only
- prohibited: parent viewing
- required gates: camera notice, gateway no-RTSP, token/audit

## PILOT_WITH_AI_SHADOW_ONLY

- allowed users: admin/internal reviewer only
- prohibited: parent raw AI, automatic accusations
- required gates: legal mode, human review, parent denial tests

## CONTROLLED_REAL_PILOT_READY

- allowed users: approved limited real pilot users
- allowed data: approved pilot data only
- prohibited: features outside signed pilot scope
- required gates: all critical/high gates passed
- current status: not achieved
