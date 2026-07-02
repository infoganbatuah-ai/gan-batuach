# PILOT FIX 4 – Seed Data Plan

Date: 2026-07-03

## Required Synthetic Dataset For PILOT FIX 5

| Data item | Purpose |
|---|---|
| Kindergarten A | positive scope for manager/staff/inspector A |
| Kindergarten B | negative scope boundary |
| Manager A | owner/manager of Kindergarten A |
| Manager B | owner/manager of Kindergarten B |
| Parent A | linked to Child A |
| Parent B | linked to Child B |
| Child A | linked to Parent A and Kindergarten A |
| Child B | linked to Parent B and Kindergarten B |
| Staff assigned to Kindergarten A | assigned staff access test |
| Staff unassigned | unassigned staff denial test |
| Inspector assigned to Kindergarten A | assigned inspector access test |
| Inspector unassigned | unassigned inspector denial test |
| Enrollment request | parent/manager workflow |
| Attendance day | staff/manager/parent visibility |
| Schedule | role-specific schedule visibility |
| Messages | conversation privacy |
| Document records | signed URL/storage tests |
| Inspection form/report | inspector/admin/garden scope |
| Payment/subscription readiness state | payment RLS tests |
| Camera readiness state | camera no-secret tests |
| AI shadow/readiness state | raw AI denial tests |
| Digital Observer test site | product separation test |

## Naming Rules

- Use obvious synthetic Hebrew names.
- Prefix sensitive-looking records with `[DEMO]` or `[QA]`.
- No real child names.
- No real phone numbers.
- No real ID numbers.
- No real documents.
- No real camera credentials.
- No provider secrets.

## Existing Script Status

- `scripts/seed-demo-full.mjs` is destructive for demo batches and should be treated as demo-only.
- `scripts/seed-test-users.mjs` is account-only and incomplete for access-control validation.

## Recommendation

Do not run seed scripts in this phase. For PILOT FIX 5, use either manual synthetic setup in Supabase or create a new non-destructive `seed-access-control-fixtures` script after confirming the target environment is not production.

