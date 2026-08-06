# AUTH ACCESS FIX 1 - Parent Children Query Investigation

## Finding

AUTHED UX QA 1 logs showed a backend error from a parent children query referencing:

`children.kindergarten_id`

## Files Checked

- `lib/domain/parent-family.ts`
- `lib/domain/smart-kindergarten-engine.ts`
- `app/api/parent/attendance/route.ts`
- `lib/domain/parent-camera-access.ts`
- `supabase/migrations/20260523000000_initial_schema.sql`
- `supabase/migrations/20260601001000_clean_parent_enrollment_flow.sql`
- `supabase/migrations/20260527006000_multi_kindergarten_parent_child_architecture.sql`

## Expected Schema

The stable legacy child-to-kindergarten field is:

`children.garden_id`

Some later migrations introduce generated aliases or newer relation tables such as:

- `child_kindergarten_enrollments.kindergarten_id`
- `parent_kindergarten_links.kindergarten_id`

However, the real checked environment did not expose `children.kindergarten_id`.

## Root Cause

Parent-facing code selected `kindergarten_id` directly from `children`, assuming the alias existed. That failed in the active Supabase environment.

## Safe Fix

Use `children.garden_id` for direct child rows and keep `kindergarten_id` only for tables where it is defined by migration, such as enrollment/link tables.

No RLS was changed. No service role bypass was added. Parent scope remains based on parent-linked rows and existing relations.

