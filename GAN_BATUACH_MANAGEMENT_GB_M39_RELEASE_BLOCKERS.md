# GB-M39 Production Release Blockers

Date: 2026-09-23

## Blockers

1. **Recoverable plaintext credentials remain in Production.** Aggregate read-only inspection found 23 populated `generated_credentials.temporary_password` rows. The Development candidate removes the active path and drops the column, but affected Auth credentials must be rotated/recovered and backup retention handled. No value or customer identifier was read into evidence.
2. **Production Auth is not independently verified.** Supabase signup, Email verification/SMTP, allowed redirect URLs and recovery configuration need provider evidence before release.
3. **Configured cron jobs cannot authenticate.** `CRON_SECRET` is absent from the Vercel Production variable-name inventory.
4. **Provider backup restore and Storage recovery are unproved.** Eight recent Supabase physical backups are visible, but provider restore has not been tested. Database backup does not prove recovery of private Storage objects.
5. **Core Production URL/deep-health/encryption configuration needs reconciliation.** Canonical app/Auth URL variables, `HEALTHCHECK_SECRET`, encryption key version and hash pepper are absent from the observed Vercel inventory.
6. **Cost ceiling cannot be certified.** Actual supplier invoices, defensible project allocation and active-paying-user denominator were unavailable. The required ≤₪15/user/month gate cannot be calculated honestly.
7. **Owner release authorization and maintenance window are absent.** Migration 12 breaks compatibility with the old application and requires the staged sequence in the migration plan.

## Optional capability blocks

- Passkeys remain fail-closed until `PASSKEY_RP_ID` and `PASSKEY_ORIGIN` are configured; disable the UI until verified.
- Resend and FCM credential names exist, but real Production send/domain/receipt proof is absent.
- Payment, invoice, SMS and WhatsApp providers are unconfigured; their UI must remain truthfully unavailable. Normal Email-verified accounts and manual tuition flows must remain usable.
- Digital Observer Production capability is external; Management remains usable and Safety UI must remain readiness/unavailable without verified capability.

## Non-blocking follow-up

- Dependency audit reports six moderate advisories in the optional Firebase Admin/Google Storage chain, with zero high or critical findings. Review reachability before enabling FCM and upgrade under a scoped compatibility test.
- `/api/health` currently reports version `unknown`; publish non-sensitive release SHA/version for operational traceability.
- No Production private-object sample exists, so live signed-object authorization must be part of the owner-authorized release smoke using controlled data.
