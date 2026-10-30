# DIGITAL OBSERVER — PUSH 45 LEGAL / PRIVACY REQUIREMENTS MATRIX

Date: 2026-10-19
Status: **TECHNICALLY IMPLEMENTED — EXTERNAL LEGAL REVIEW PENDING**
Scope: Development only; no legal conclusion, provider activation, real customer processing or Production change.

## Decision taxonomy

Every real use must be classified as `TECHNICALLY_IMPLEMENTED`, `LEGAL_REVIEW_PENDING`, `EXTERNALLY_APPROVED`, `PROHIBITED` or `NOT_APPLICABLE`. Only a scoped `EXTERNALLY_APPROVED` decision with a verifiable written reference, matching purpose/context/jurisdiction and valid dates may activate a sensitive capability. Consent or notice acknowledgement alone is never sufficient.

| Context | Intended purpose | Main data categories | Controller / processor question | Default decision | Mandatory review before activation |
|---|---|---|---|---|---|
| HOME | Household safety and authorized camera access | account, Site, camera metadata, Events, selected Evidence | Determine customer/platform roles and vendor subprocessors | LEGAL_REVIEW_PENDING | notices, retention, household-member access, recording areas, external media path |
| SMALL BUSINESS | Premises safety and operational monitoring | users, employees/visitors, camera metadata, Events, Evidence | Determine business/platform roles and employee notice duties | LEGAL_REVIEW_PENDING | necessity/proportionality, workplace policy, camera areas, retention, access review |
| ENTERPRISE | Multi-Site security and authorized investigation | organization users, sites, audit, Events, Evidence, investigations | Contractual controller/processor allocation and DPA | LEGAL_REVIEW_PENDING | DPA, SSO/SCIM, cross-border processing, support access, incident responsibilities |
| OEM / WHITE-LABEL | Partner-delivered Digital Observer service | partner/customer/tenant mappings, API usage, Events/Evidence references | Partner/platform/customer role allocation | LEGAL_REVIEW_PENDING | DPA, subprocessor terms, data ownership, deletion/export, partner exit, branding notices |
| KINDERGARTEN | Narrow child-safety workflows | child-related context, staff roles, camera metadata, minimized Event/Incident/Evidence | Gan Batuach and Observer remain separate authorization domains | LEGAL_REVIEW_PENDING; sensitive identification PROHIBITED by default | child privacy, area exclusions, role matrix, retention, human review, regulator/counsel decision |
| AUTHORIZED INVESTIGATION | Time-bounded case investigation | source-recording references, observations, Evidence, audit, uncertainty | Case authority and source-by-source lawful access | LEGAL_REVIEW_PENDING | case owner, purpose, source authorization, export limits, human verification, legal hold |
| PERSONAL SAFETY | Guardian/Journey/SOS/check-in support | mobile/session, emergency contacts, optional location | Explicit revocable permissions and platform/provider roles | LEGAL_REVIEW_PENDING | location/background processing, emergency escalation, recovery, retention, no covert tracking |

## Israeli source mapping

This table is an engineering issue list for qualified counsel, not legal advice.

| Topic | Current authoritative source reviewed | Engineering consequence | Open legal decision |
|---|---|---|---|
| Privacy Law Amendment 13 | [Official PPA Amendment 13 portal](https://govextra.gov.il/privacy-protection-regulations/privacy-protection-regulations/), [official Knesset law PDF](https://fs.knesset.gov.il/25/law/25_lsr_4810658.pdf), reviewed 2026-10-19 | Keep purpose, categories, owners, decisions and evidence versioned; do not infer exemption from lack of registration | Applicability to each entity/use; registration/notification; DPO duty; lawful basis |
| Database registration/notification | [PPA registration service](https://www.gov.il/he/service/registration_in_the_database), reviewed 2026-10-19 | Registry status cannot substitute for all other privacy/security duties | Which databases require registration or notice and when |
| Information security | [PPA security-regulations Q&A](https://www.gov.il/he/pages/data_security_fqa?chapterIndex=1), reviewed 2026-10-19 | Tenant/Site RLS, audit, incident workflow, suppliers and recovery remain required controls | Security level/classification and complete regulation mapping |
| Serious security incident | [PPA serious-incident reporting service](https://www.gov.il/he/service/report-of-data-breach), reviewed 2026-10-19 | Incident records default to `pending_legal_review`; the Product never claims a regulator report occurred | Reporting threshold, timing, who files, subject notification decision |
| Data-subject access/correction | [PPA access-right guidance](https://www.gov.il/BlobFolder/reports/right_to_access2023/he/The%20right%20to%20access.pdf), [PPA digital audio/video access guidance](https://www.gov.il/BlobFolder/legalinfo/right_of_access/he/voice%20audio_tikun13.pdf), reviewed 2026-10-19 | Governed request/export workflow covers digital video references; external-system outcomes remain separate | Authentication, exemptions, third-party redaction, deadlines, correction scope |
| Workplace cameras | [PPA workplace-camera guidance 5/2017](https://www.gov.il/he/pages/workplace_camera), updated 2025-05-08, reviewed 2026-10-19 | Require documented purpose, necessity, proportionality, notices and restricted areas | Per-deployment lawfulness and employee relations requirements |
| General surveillance cameras | [PPA surveillance-camera guidance 4/2012](https://www.gov.il/BlobFolder/legalinfo/surveillance_cameras_guidelines/he/The%20use%20of%20security%20cameras_2025.pdf), reviewed 2026-10-19 | Camera-area restrictions and purpose limitation belong in the policy profile | Applicability to private, business and partner deployments |
| Children / education | [PPA student-privacy guide](https://www.gov.il/BlobFolder/reports/students_privacy_guide/he/students_privacy_guide.pdf), reviewed 2026-10-19 | Minimize camera coverage and retention; child biometric identification remains denied | Kindergarten-specific applicability, parent/staff/inspector access, precise retention and approvals |
| Biometrics | [National biometric applications policy](https://www.gov.il/he/pages/_2bio_biopolicy_app), reviewed 2026-10-19 | Detection, recognition, Re-ID and similarity remain separate; purpose, proportionality, security and human review are gates | Whether each intended use is lawful and what benchmark/oversight is required |
| Cross-border transfer | [Israeli transfer regulations](https://www.gov.il/BlobFolder/news/post_schrems_update/he/TakanotHul.pdf), [PPA EEA-transfer Q&A](https://www.gov.il/he/pages/europe_transfer?chapterIndex=12), reviewed 2026-10-19 | Supplier geography and transfer mechanism must be recorded per processor | Valid transfer basis, contractual terms and EEA-origin obligations |
| Privacy impact assessment | [PPA DPIA tool](https://mojforms.justice.gov.il/mojaemprivacyprotectionauthority/dpiaform.html), reviewed 2026-10-19 | High-risk pilots require a documented DPIA-style review before activation | Required form, reviewer and residual-risk acceptance |
| DPO | [PPA DPO resources](https://www.gov.il/he/Departments/targetaudience/dpo), reviewed 2026-10-19 | Register a decision and owner; do not self-declare that appointment is unnecessary | Whether Digital Observer and each participating entity must appoint a DPO |

## Data-class lifecycle

| Class | Canonical owner | Storage truth | Default lifecycle |
|---|---|---|---|
| Event / Alert metadata | Digital Observer tenant/Site | Transactional metadata only | Legal period pending; manual review; legal hold checked |
| Digital Observer Evidence | Private approved object path plus bounded metadata | Selected evidence, not continuous video | Private access, expiring grant, hold-aware deletion; legal period pending |
| Source recording reference | Customer DVR/NVR/VMS remains authoritative | Reference/provenance only unless authorized retrieval occurs | Removing a reference never claims source-system deletion |
| Investigation case/export | Authorized case workspace | Purpose- and time-bounded | Case closure/review, hold and export controls |
| Audit/security log | Append-only bounded metadata | No private media or credentials | Integrity and incident-response need; deletion requires review |
| Biometric/location data | Not activated | No real operational template/location processing authorized | Denied until a scoped written approval exists |

## Mandatory external decisions

1. Controller/processor and subprocessor roles per commercial profile.
2. Legal basis, transparency and lawful purpose per use and jurisdiction.
3. Approved retention periods per data class, including Evidence and camera logs.
4. Kindergarten access matrix, sensitive areas, child-safety review and escalation.
5. Workplace camera necessity/proportionality and employee notice requirements.
6. Biometrics, face, Re-ID, similarity and missing-person investigation boundaries.
7. Data-subject request identity proof, deadlines, exemptions and third-party redaction.
8. Serious-incident classification and notification procedure.
9. Cross-border transfer basis and supplier agreements.
10. DPO/database registration or notification duties.

Until these decisions are documented, the canonical external legal status is **PENDING**.
