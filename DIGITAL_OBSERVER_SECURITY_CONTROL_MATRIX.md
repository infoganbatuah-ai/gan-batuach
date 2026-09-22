# DIGITAL OBSERVER — SECURITY CONTROL MATRIX

Date: 2026-09-07  
Contract: `digital-observer-security-privacy-v1`

Status legend: **PASS** = deterministic and/or controlled live proof exists; **PASS — APPLY MIGRATION** = implementation and deterministic proof complete, but the new migration must be applied before its controls exist in Production; **PARTIAL** = bounded protection exists with a documented follow-up; **DEFERRED FROZEN** = repair is intentionally held until PUSH 16 closes.

| Control | Scope / invariant | Primary enforcement | Regression / evidence | Current status | Owner / domain |
|---|---|---|---|---|---|
| Authentication | Canonical Product APIs require an authenticated Supabase user | server auth helpers; Supabase Auth | `qa:ci:security`; controlled role-boundary probe | PASS | Auth |
| RBAC | Owner/admin/operator/viewer permissions are explicit; billing is not a general viewer | `lib/domain/digital-observer/access.ts` | `qa:digital-observer-security`; role-boundary probe | PASS at API; DB billing helper is deferred | Product authorization |
| RLS | Tenant-sensitive canonical tables enable RLS and scoped read policies | Supabase migrations and policies | security/privacy contract checks 13 critical tables | PASS — APPLY MIGRATION | Database security |
| Tenant isolation | Tenant A cannot retrieve Tenant B sites/cameras/events/Incidents/Evidence/Risk/Verification/Feedback/Rules/Investigation data | RLS plus server site access | tenant QA; 11 controlled live boundary assertions | PASS | Tenant boundary |
| Direct-ID / IDOR | UUID lookup still requires membership and record/site agreement | route UUID validation, scoped query, RLS | security/privacy QA; media and preview route checks | PASS | API security |
| Service role | Service key is server-only and never a public environment variable | `server-only`; admin client module | secret scan; security/privacy QA | PASS | Server boundary |
| Field encryption | `FIELD_ENCRYPTION_KEY` is dedicated and cannot fall back to service role | encryption modules | `qa:encryption-key-separation`; security/privacy QA | PASS | Secrets / encryption |
| Camera/vendor credentials | Credentials stay encrypted/server-side and are omitted from safe columns | existing credential store and safe-column projections | secret scan; camera-column privacy QA | PASS; frozen implementation unchanged | Camera security |
| Media privacy | Evidence bucket is private; media is issued only after auth/site checks | storage policies; media route | event-media QA; storage-policy QA; security/privacy QA | PASS | Evidence |
| Signed media | Issuance is authorized, audited, non-cacheable and short lived | media/preview routes; provider signed URL | 60-second TTL assertions | PASS | Evidence access |
| Rate limiting | Sensitive mutations/media/login use atomic per-principal accounting | `consume_rate_limit` RPC; hashed identifier | security/privacy QA | PASS — APPLY MIGRATION | Abuse prevention |
| CSRF / origin | Cookie-authenticated mutations must be same-origin; bearer requests remain CSRF-resistant | `assertTrustedMutationOrigin` | security/privacy QA | PASS | API boundary |
| Input bounds | JSON body, UUIDs, enums, arrays/time/search windows are bounded | typed schemas and `parseBoundedJson` | canonical domain QA; security/privacy QA | PASS | API validation |
| Mass assignment | Canonical mutations build explicit payloads rather than spreading raw request JSON | route-level field mapping | focused inspection and typecheck | PASS | API correctness |
| Watch-rule security | Rule compiler cannot reference unauthorized resources or emit arbitrary actions/code/SQL | compiler schema, capability and tenant validators | watch-rule QA; security gate | PASS | Watch Rules |
| Investigation security | NL text compiles to a bounded query and cannot override RBAC or execute SQL | investigation compiler/service | investigation QA; injection tests | PASS | Investigation |
| Feedback/quality | Tenant feedback is scoped; reviewed cross-tenant quality data remains privileged | feedback service, RLS, admin check | feedback QA; role-boundary probe | PASS | Feedback / calibration |
| Immutable history | Canonical Risk/Decision/Verification/Feedback/Rule evaluation tables reject browser mutation | grants/RLS plus service paths | security/privacy QA | PASS — APPLY MIGRATION | Auditability |
| Audit integrity | Immutable audit stream blocks UPDATE/DELETE and uses a tamper-evident hash chain | DB triggers and RLS | immutable-audit QA | PASS; external WORM remains future | Audit |
| Audit coverage | Sensitive Product actions write sanitized events | audit service; hardened routes | static QA and route inspection | PARTIAL — audit persistence is fail-open | Audit |
| Security headers | HSTS, no sniff, referrer, permissions, framing, object and eval restrictions | `vercel.json` | security/privacy QA | PASS with documented `unsafe-inline` exception | Web security |
| Session security | Supabase session semantics and server authorization are re-evaluated per request | Supabase server client, membership lookup | auth/role QA | PASS; revocation-latency operational QA remains | Session |
| Webhooks | Provider routes validate signed messages, replay/idempotency and bounded input where enabled | webhook modules/routes | provider contract QA | PASS for enabled contracts; providers not activated by PUSH 25 | Integrations |
| Mock isolation | MOCK/SIMULATION/LOCAL_SHADOW/demo provenance cannot satisfy Production Event/Risk/Verification/Search gates | canonical provenance guards | `qa:ci:security`; domain QA | PASS | Production truthfulness |
| Privacy request ownership | A child can be attached only by admin, authorized parent, or garden manager | restrictive INSERT RLS and caller-scoped route check | security/privacy QA | PASS — APPLY MIGRATION | Privacy |
| Retention | Event media is purged from private storage and metadata records remain truthful | retention cron and event-clip lifecycle | event-media QA | PASS for media; broader legal schedule is PARTIAL | Privacy / Evidence |
| Delete/export | Controlled deletion tooling exists; legal holds/audit exceptions are preserved | right-to-be-forgotten tooling and privacy records | dry-run inspection | PARTIAL — broad subject export/deletion needs legal closure | Privacy / compliance |
| Biometric boundary | Known-person readiness does not activate biometric processing; unsupported identity is refused | known-person and identity-candidate routes | security/privacy and investigation QA | PASS | Identity privacy |
| Secret scanning | Tracked secret-shaped values and public secret names fail gates | CI/release scans | Push24/25 gates | PASS | Release security |
| Private artifact scanning | Credentials, media, screenshots, session DBs and dumps are excluded from releases | release preflight | release-contract QA | PASS | Release security |
| Dependency security | High/critical advisories block CI | npm audit high gate | `npm audit --audit-level=high` | PASS: 0 high/critical; 6 moderate tracked | Supply chain |
| DB function security | SECURITY DEFINER routines set search paths; browser roles cannot create shadow public objects | migrations | security/privacy QA: 71/71 functions | PASS — APPLY MIGRATION | Database security |
| Admin boundary | Hidden routes are insufficient; server platform-admin authorization is required | admin helpers and RLS | admin boundary/role QA | PASS | Platform admin |
| Frozen billing RLS | Billing-only members must not gain general camera/evidence read | currently route mitigation only | deferred finding `DO-SEC-25-FROZEN-001` | DEFERRED FROZEN | Camera authorization |

## Required release order

Before a future Production deployment of this change set:

1. Apply `20260907010000_digital_observer_security_privacy_hardening.sql`.
2. Verify the atomic rate-limit RPC and restrictive privacy policy in the target database.
3. Deploy the application only after the migration succeeds.
4. Run tenant/IDOR, signed-media and sensitive-route smoke checks.
5. Retain rollback references for both schema and application revisions.

