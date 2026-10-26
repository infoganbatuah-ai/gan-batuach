# Cross-language recipient snapshot digest v1 — local candidate, NOT APPLIED

Source inspected: `codex/event-ingest-replay-identity-20261025:lib/domain/digital-observer/event-risk-ownership-snapshot.ts` (`createDecisionTimeRecipientSnapshot`, lines 132–188); PR #259 source branch `codex/event-risk-effect-plan-review-20261026@784731da46aad974acfaa813e9efe948aab65204`, guarded `review-only/event-risk-effect-plan-transaction/RPC-BODY-NOT-APPLIED.sql`; PR #260's guarded effect body and the local dedicated-writer candidate at `f9568cf84387ee7d7cc832f07167478a9bee875b`. This package changes **none** of those existing contracts. Its SQL starts with an aborting guard and has no `COMMIT`; the guard was bypassed only in a fresh disposable, network-disabled PostgreSQL fixture.

## Verified incompatibility in existing proposals

The source Node snapshot fingerprint is SHA-256 of `JSON.stringify(content)` after `localeCompare`-based recipient/channel ordering. PR #259 names `pg-jsonb-text-v1`, hashing PostgreSQL `jsonb::text` for content and envelope. PR #260 requires that same algorithm. In the fixture, both existing-style digests differ from this candidate's fingerprint for the same nontrivial snapshot; they are **not interchangeable**. Node's `localeCompare` orders `ä` before `z` on this host, while PostgreSQL `COLLATE "C"` and UTF-8 byte order put `z` first. A silent change of the digest column or algorithm label would invalidate frozen plans and replay checks.

## Candidate wire format (not an approved application contract)

`canonical-v1.mjs` and guarded `CANONICAL-V1-NOT-APPLIED.sql` independently implement an unambiguous byte grammar for *typed JSON values*:

| Type | Encoding |
| --- | --- |
| null | `Z` |
| boolean | `B0` or `B1` |
| safe signed integer | `I<canonical decimal>;` |
| string | `S<8 lowercase hexadecimal UTF-8 byte count>:<UTF-8 bytes>` |
| array | `A<8 hex element count>:<element encodings in array order>` |
| object | `O<8 hex pair count>:<encoded key,value pairs sorted by UTF-8 byte order>` |

The SHA-256 input is UTF-8 `DO-DIGEST-V1:<domain>`, a zero byte, then the encoded value. Domains are `GENERIC`, `SNAPSHOT-CONTENT`, and `SNAPSHOT-ENVELOPE`. For the proposed recipient snapshot, `fingerprint` hashes the content; `digest` hashes the full envelope after adding that fingerprint. Both sides reject floats, decimals, unsafe integers, invalid JavaScript surrogate strings, NUL, excess size/depth, unsupported types, wrong schema, wrong Tenant/Site, duplicate or unsorted recipient/channel/level arrays, extra fields, and noncanonical timestamps. Timestamps must be exact valid UTC milliseconds (`YYYY-MM-DDTHH:mm:ss.sssZ`); offsets and alternate precision are rejected, not silently normalized. Unicode bytes are **not** normalized; visually similar composed/decomposed strings hash differently. Object property insertion order is irrelevant.

The snapshot checks bind the **supplied** Tenant/Site identifiers but do not certify ownership or the source of recipients/settings. A legitimate server-owned decision-time authority producer does not yet exist. No client may supply the expected digest as proof of authority.

## Isolated verification

`node review-only/event-risk-canonical-digest/run-isolated-postgres-qa.mjs`: **58 checks PASS** against Node and a fresh PostgreSQL 17.6 container (`--network none`, `--read-only`, no host mounts, no published ports, temporary database removed on exit). The runner first proves the SQL guard aborts, then evaluates the body only in that disposable fixture. Positive vectors cover nested key order, Hebrew/emoji, controls/quotes, booleans, `null`, integer bounds, canonical UTC time and exact cross-language content/envelope hashes. Negative vectors cover altered settings or digest, Tenant/Site swaps, duplicate recipient/channel/level identities, unsorted Unicode, oversized UTF-8 identifiers, extra fields, offset/invalid dates, fractional/unsafe numbers, NUL and invalid surrogates. It also demonstrates the current source-style and PostgreSQL-style hashes are not this v1 hash. `node --check` and Git diff validation are separate static checks.

**Known raw-input gap:** PostgreSQL `jsonb` and JavaScript `JSON.parse` both collapse duplicate *object keys* before these candidate functions see them; the fixture demonstrates this. Duplicate recipient/channel/level entries are rejected because arrays preserve multiplicity. A future trusted producer must create typed objects directly or a separately reviewed strict raw-JSON parser must reject duplicate object keys **before** conversion to `jsonb`/JavaScript objects. No raw HTTP payload acceptance is qualified. PostgreSQL's [JSON type documentation](https://www.postgresql.org/docs/17/datatype-json.html) confirms `jsonb` discards duplicate keys. PostgreSQL's [string documentation](https://www.postgresql.org/docs/17/functions-string.html) defines UTF-8 byte length; the fixture independently checks the chosen byte ordering.

## Impact gate

This candidate cannot replace `pg-jsonb-text-v1` in PR #259/#260 in place. Any future adoption needs a coordinated, versioned producer and reader change; exact authority provenance; frozen-plan compatibility and replay migration rules; proof on actual Development schema, RLS/ACL and Data API; and an authorized isolated rollout/rollback. Existing frozen records, if any, must retain their original algorithm and digest. No Development/Production database, route, Guard, provider, credential, PR, or remote branch was changed by this unit.
