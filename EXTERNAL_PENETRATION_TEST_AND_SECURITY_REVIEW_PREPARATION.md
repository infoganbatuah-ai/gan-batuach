# External Penetration Test And Security Review Preparation

**READINESS PACKAGE ONLY**

This phase prepares Gan Batuach for an authorized external penetration test. It does not run a penetration test and does not provide security approval.

## Command Center

Route:

- `/dashboard/admin/security-review`

Shows:

- penetration test readiness score
- scope readiness
- test users readiness
- open security findings
- critical/high findings
- retest pending
- external review status

## Database Registers

- `penetration_test_scopes`
- `security_test_user_pack`
- `security_review_test_plans`
- `external_security_findings`
- `external_tester_access_modes`
- `penetration_test_readiness_score`

## Scope Areas

- authentication
- authorization
- parent portal
- manager portal
- staff portal
- inspector portal
- admin portal
- API routes
- Supabase RLS
- storage
- camera access
- AI observer
- payments
- webhooks
- mobile apps

## Test User Pack

Prepared roles:

- admin test user
- manager test user
- parent test user
- staff test user
- inspector test user
- suspended user
- inactive user
- user without MFA / limited user

Credentials are not stored in the database and must be generated and delivered securely out of band.

## Findings Workflow

Finding reported -> triage -> assign owner -> fix -> retest -> verify -> close.

Accepted risk requires:

- reason
- owner
- mitigation
- expiration or review plan

## Critical Examples

- parent accesses another child
- admin access bypass
- service role exposed
- camera credentials exposed
- medical data exposed
- payment data exposed
- raw AI exposed to parents

## Remaining External Testing Requirements

- create real staging test users
- attach demo kindergarten data
- configure mock/demo camera streams
- configure payment sandbox
- define test window and emergency contacts
- sign rules of engagement
- run authorized external PT
- import findings and retest results
