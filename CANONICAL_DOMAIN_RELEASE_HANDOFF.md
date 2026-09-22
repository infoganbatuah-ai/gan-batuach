# Canonical domain release handoff

## Owner directive — 2026-09-22

- Do **not** deploy this change now.
- Preserve it for the owner's consolidated Production release planned for the following month.
- A date, restored quota, passing CI, integration completion, or this handoff is not release authorization. Production work begins only after a new explicit owner instruction.

## Preserved development unit

- Source branch: `codex/canonical-domain-auth-20260922`
- Initial validated commit: `e773145b1053150ef624b46b76f7062b8547a1dd`
- Migration: `supabase/migrations/20260922010000_canonical_public_domain.sql`
- Production deployment: **not performed**
- Production migration application: **not performed**

Supabase Authentication currently has `https://ganbatuach.com` as its Site URL and the canonical `/auth/callback` and `/auth/confirm` redirect URLs are allow-listed. The two legacy Vercel redirect entries remain temporarily allow-listed only to keep the current Production version compatible until the owner-authorized consolidated release.

## Mandatory release and post-release gates

1. Confirm the frozen release candidate contains this unit and the reviewed migration, then run the complete owner-controlled release process in `AGENTS.md`.
2. Do not remove the legacy Supabase redirect entries before the canonical-domain code is deployed and the exact deployed commit is verified.
3. After deployment, confirm requests to a legacy `*.vercel.app` host receive a permanent redirect to `https://ganbatuach.com` while preserving the full path and query string. Confirm `www.ganbatuach.com` also resolves to the apex canonical origin.
4. Use designated synthetic QA accounts to request fresh password-recovery emails for both Gan Batuach and Digital Observer. Do not use a real customer account and do not expose recovery tokens in logs or reports.
5. Inspect and follow each fresh email link. Every visible navigation hop must remain on `ganbatuach.com`: canonical Auth callback first, then `/reset-password` for Gan Batuach or `/digital-observer/set-password` for Digital Observer. Complete the QA recovery flow and verify sign-in with the newly set synthetic password. Record only redacted evidence.
6. Only after both recovery flows pass, remove the two legacy Vercel redirect entries from Supabase Authentication URL Configuration. Keep the canonical Site URL and canonical callback/confirm entries.
7. Request one new recovery email after removal and repeat the canonical-host check. Verify that Supabase no longer lists either legacy redirect and that no Product page, email, callback, Gateway default, or runtime response exposes the retired host.
8. Update the development, migration, and release ledgers with the deployed commit, migration evidence, recovery-flow result, Supabase cleanup result, and any residual historical-only references. Historical applied migrations and immutable Git history are not rewritten.

The release is incomplete until steps 3–8 are evidenced. A successful deployment alone is not closure.
