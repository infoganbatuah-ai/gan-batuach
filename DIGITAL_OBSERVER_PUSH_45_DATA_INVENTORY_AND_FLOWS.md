# DIGITAL OBSERVER — PUSH 45 DATA INVENTORY AND FLOWS

Date: 2026-10-19
Classification: repository-safe metadata only; no secrets, invoices, private media or real personal data.

## Inventory

| Data | Owner/scope | Sensitivity | Primary system | Retention truth | Export/deletion truth |
|---|---|---|---|---|---|
| Users, sessions, MFA identities | profile / organization | personal, security-sensitive | Supabase Auth + bounded Product metadata | policy pending; sessions expire/revoke | verified requester; provider/Auth disposition tracked separately |
| Organizations, partner customers, Sites | organization / tenant / Site | business + personal membership | Supabase | contract and account lifecycle | tenant-scoped export; preserve audit and financial duties |
| Camera/source metadata and credentials | Site / source | security-critical | Supabase metadata; approved secret store/encryption | operational need; credentials rotate | never export secrets; revoke/delete only through source lifecycle |
| Live/source recordings | customer source system unless selected Evidence | highly sensitive video | DVR/NVR/VMS/vendor/managed edge | external owner policy | no deletion claim without external confirmation |
| Events, Incidents, Watch Rules | Site | personal/operational | Supabase bounded metadata | approved period pending | scoped export/redaction; hold check |
| Evidence media/references | Site / case | highly sensitive | private media backend + reference | policy + legal hold | backend delete before tombstone; external source separate |
| Investigation workspace/export | tenant/Site/case | highly sensitive | bounded case metadata + authorized references | case policy pending | time-bounded access, provenance, review and export controls |
| Biometrics, face/Re-ID templates | none operationally authorized | special/high risk | disabled | not applicable until approval | no activation; future explicit deletion policy required |
| Location/Guardian/Safety Circle | none operationally authorized | special/high risk | disabled/foundation only | not applicable until approval | no covert collection; explicit withdrawal/deletion design required |
| Notifications and mobile identifiers | tenant/Site/recipient | personal + operational | delivery metadata; provider token reference | bounded operational period | token revocation; content minimized; provider disposition separate |
| Billing, invoices, usage | billing account | financial | Supabase commercial ledger + future provider | tax/accounting decision pending | no raw card storage; provider outcome/reconciliation separate |
| Audit/security/privacy incidents | tenant/org/Site | security/compliance | append-only bounded metadata | incident/evidence need | integrity preserved; subject request reviewed, not blind-deleted |

## Canonical flow

```text
Authorized source
  -> secure supported connectivity
  -> bounded camera/health metadata
  -> AI candidate (only an approved execution path)
  -> Event -> Incident -> Decision
  -> selected private Evidence/reference
  -> authorized client / investigation

Identity and authorization
  -> organization/tenant/Site/resource permission
  -> privacy policy profile + purpose + jurisdiction
  -> scoped external approval where sensitive
  -> short-lived access + append-only audit

Rights / deletion
  -> verified requester
  -> scoped inventory
  -> retention and legal-hold check
  -> internal action
  -> per-external-system confirmation
  -> truthful completed or partial/pending receipt
```

## Processor register reconciliation

Provider dashboards, contracts and invoices remain authoritative. The repository records only a non-sensitive governance status.

| Provider | Potential data | Purpose | Geography/transfer | Contract/deletion status |
|---|---|---|---|---|
| Vercel | web/API request metadata, deployment logs | application hosting | requires account/DPA verification | review current DPA, logging, retention and support access |
| Supabase | accounts, tenant/Site transactional metadata | Auth/database/private storage | requires project/region verification | review DPA, backups, Auth/storage deletion and subprocessors |
| Cloudflare / R2 | approved private media or delivery metadata | object storage/edge | requires account/bucket verification | review DPA, region, lifecycle, access logs and deletion |
| AWS KMS/signing | keys/signing metadata | cryptographic service | requires account/region verification | verify key owner, logs, rotation and deletion dependencies |
| Sentry | minimized error/diagnostic metadata | observability | configuration must be verified | prevent credentials/media/child data; verify retention and DPA |
| Resend | recipient and delivery metadata | email | connected but external proof pending | verify DPA, retention, suppression and deletion duties |
| Firebase | device token and delivery metadata | mobile Push | account exists; app proof pending | verify Google terms/DPA, APNs/FCM token lifecycle and retention |
| Morning | commercial account/invoice/payment metadata | future billing/invoicing | account exists, integration not proven | verify legal invoice fit, DPA, payment processor relationships and retention |
| WhatsApp provider | phone/account and delivery metadata | optional verification/notification | not approved | direct Meta option must be evaluated; cannot be sole recovery factor |

No new supplier was activated and no processor is marked approved by this inventory.
