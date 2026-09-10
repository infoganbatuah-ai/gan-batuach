# DIGITAL OBSERVER — STORAGE ABSTRACTION

Date: 2026-09-10
Contract: `observer-storage-v1`

## Boundary

The canonical storage contract stores and opens Evidence media. It does not turn an Event into Evidence and does not redefine source recording or Investigation:

`EVENT != EVIDENCE != SOURCE RECORDING != IDENTITY != INVESTIGATION SOURCE`.

Core Evidence policy supplies tenant, Site, Evidence ID, content type, retention and privacy constraints. A backend supplies bounded write, read, stat, authorized access, delete, integrity and health operations. Provider paths and credentials do not enter Product responses.

## Implemented backends

| Backend | Class | Evidence |
|---|---|---|
| `supabase-private-evidence` | `CLOUD_OBJECT_STORAGE` | Current private bucket is wrapped by the canonical adapter. Upload and signed playback now use the adapter for new `observer-storage-v1` Evidence; pre-contract objects retain a named compatibility read/delete path. |
| `local-nas-evidence` | `LOCAL_NAS` | Real local filesystem QA under a scoped root passed write/read/stat/integrity/mediated access/delete, restart-independent persistence, tenant denial and traversal/absolute/symlink escape denial. This proves a NAS-style provider implementation, not a production network appliance. |

The same contract suite executed seven core operations on both providers. Broader enterprise S3/vendor storage is not claimed.

## Canonical object identity and access

Canonical IDs are generated internally as `tenant/Site/Evidence/variant.extension`; each segment is bounded and validated. Callers cannot supply unrestricted filesystem paths. The local provider resolves beneath a configured root, rejects traversal and absolute IDs, and rejects symlinked parent traversal. Local access returns a short-lived HMAC-mediated opaque grant; it never returns a filesystem path. Supabase access returns a short-lived signed private-object redirect only after existing Product authorization and tenant/Site scope checks.

Integrity uses SHA-256 over the stored bytes, with byte count, content type, backend ID/class and creation time in the canonical descriptor. This is corruption detection, not a claim of digital evidence notarization.

## Policy, failure and portability

- Storage selection is an explicit policy decision after Evidence selection. Backend failure does not create an Event or automatically move sensitive media to a disallowed location.
- Offline capture continues to use PUSH 21 `PENDING_UPLOAD → AVAILABLE`; no object is advertised as available before backend confirmation.
- Migration is copy → verify SHA-256 → atomically switch canonical reference → optionally retire the old copy. Interrupted copy, source unavailability and integrity mismatch keep the old reference authoritative.
- Every read/write/delete emits payload-free `observer-storage-usage-v1` byte telemetry with directly-metered attribution. Monetary rates remain PUSH 33 policy and are not invented.
- Backend health is separate from camera/source/playback/AI health.

## Compatibility retirement

Existing `digital_observer_event_clips.storage_bucket/storage_path` rows remain readable through an explicit bounded Supabase compatibility branch. New Evidence stores canonical backend/object/integrity fields in metadata immediately and has normalized columns available after migration. Retirement gate: migrate every legacy available object, verify hash and authorized access, reconcile counts, then remove the compatibility branch in a separately reviewed migration. No legacy data is dropped in PUSH 34.
