# DIGITAL OBSERVER — ADVANCED INVESTIGATION REQUIREMENTS

Date: 2026-10-18
Current status: PARTIAL

## Proven bounded capability

Digital Observer has real proof for tenant-authorized natural-language search over canonical Events, Incidents and Evidence. Queries are typed and bounded, raw SQL is prohibited, results are grounded in record IDs, signed Evidence can be opened, and unsupported identity questions are refused. This does not prove advanced video search or identity.

## Missing advanced capability set

- search over authorized historical source recordings, not only Event clips;
- image-reference and video-reference search;
- person, vehicle, object and appearance/attribute search;
- cross-camera investigation and temporal correlation;
- multi-camera movement hypotheses and timelines;
- incident reconstruction across Events, source recordings and Evidence;
- investigation workspaces, notes, review state and collaboration;
- auditable report/export with uncertainty and alternative explanations;
- legal hold and immutable evidence linkage;
- scalable/federated investigation across customer VMS/NVR systems.

The existing source-recording reference contract is only a safe pointer model. Real DVR/NVR/VMS retrieval adapters are not implemented.

## Missing-person authorized use case

PUSH 48 owns the technical implementation and proof; PUSH 45 is a blocking legal/privacy dependency. A properly authorized investigative organization may search only permitted sources for a documented purpose and time window. The workflow must:

1. record authority, case, purpose, scope and expiry;
2. identify candidate observations without asserting identity;
3. compare observations before, during and after disappearance;
4. construct time/location hypotheses across cameras;
5. distinguish direct observation, similarity, correlation and inference;
6. show uncertainty, false-match risk and alternative explanations;
7. require human review before identity or movement conclusions;
8. preserve relevant Evidence with chain of custody and legal hold;
9. produce an auditable report of queries, reviewers, sources and exclusions;
10. expire access and enforce retention/deletion obligations.

## Biometrics and Re-ID separation

| Capability | Current status | Required boundary |
|---|---|---|
| Face detection | NOT STARTED | Detecting a face region only; does not identify a person |
| Face recognition | NOT STARTED | Identity comparison subject to explicit lawful-use approval |
| Biometric matching/search | NOT STARTED | Template security, thresholding, false-match handling and independent assessment |
| Person Re-ID | NOT STARTED | Appearance similarity across cameras with uncertainty; not identity by default |
| Appearance/attribute search | NOT STARTED | Purpose-limited descriptors and human review |
| Vehicle Re-ID | NOT STARTED | Separate from vehicle detection and LPR; uncertainty-aware cross-camera similarity |
| LPR/vehicle identity | NOT STARTED | Jurisdiction, retention and accuracy controls |

No sensitive capability may be enabled globally or for Gan Batuach by default. Required controls include lawful-use assessment, purpose limitation, role/case authorization, dataset provenance, retention/deletion, template protection, complete audit, false-match workflow, human review, documented limitations and independent benchmark evidence.

## Quality requirements

Each search class needs representative ground truth, precision/recall, false-positive and false-negative analysis, rank metrics where applicable, confidence calibration, latency, camera/environment coverage, drift detection and reviewer agreement. Tiny samples cannot support accuracy claims.

## Evidence and report integrity

Reports must preserve source IDs, camera/Site, timestamps/timezone, query and model versions, match scores, reviewer decisions, excluded evidence, uncertainty and chain-of-custody references. Exports must be access-controlled, watermarked where required, expiring and audited. Investigation must never silently convert a Track, similarity or co-occurrence into certain identity or movement.
