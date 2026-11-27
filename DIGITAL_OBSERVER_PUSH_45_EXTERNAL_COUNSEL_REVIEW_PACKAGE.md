# DIGITAL OBSERVER — EXTERNAL COUNSEL REVIEW PACKAGE

Date: 2026-10-19
Decision state: **LEGAL REVIEW PENDING**

## Product and intended uses

Digital Observer is a camera/AI intelligence engine for Home, Small Business, Enterprise and OEM/white-label deployments. It can ingest supported camera metadata/media paths, produce Events/Incidents/Evidence references, support authorized playback/investigation, and send approved notifications/actions. Gan Batuach Management is a separate product and authorization domain. Planned sensitive scenarios include kindergarten safety, workplace monitoring, personal safety/location and properly authorized missing-person investigation; they are not activated by this package.

## Technical safeguards already implemented

- Tenant/organization/Site/resource authorization, RLS and negative-path QA.
- Private Evidence access, expiring grants, audit, retention and legal-hold foundations.
- Versioned product-context/jurisdiction policy profiles.
- Sensitive-capability activation denies unless a matching written approval record is current and a human reviewer is identified.
- Child biometric identification is prohibited by default.
- Data-subject request workflow records internal and external-system outcomes separately.
- Privacy incident state defaults to legal review; no regulator/data-subject notification is fabricated.
- Notice acknowledgement is evidence of display/acknowledgement only, not a complete legal basis.

## Questions requiring written advice

1. For each context, who is controller, joint controller, processor and subprocessor?
2. What lawful purpose/basis and notices are required for live viewing, Event metadata, selected Evidence and source-recording investigation?
3. Which data sets require registration or notification after Amendment 13, and is a DPO mandatory?
4. What security classification and incident-reporting procedure applies?
5. What retention schedule is lawful for Event metadata, Evidence, access/audit logs and investigation exports?
6. How should access/correction/export/deletion requests involving third-party images and external DVR/NVR/VMS data be handled?
7. What exact conditions apply to kindergarten cameras, parent/staff/manager/inspector access, sensitive areas, AI review and escalation?
8. What exact conditions apply to workplace monitoring and employee notices/consultation?
9. Are face detection, face recognition, person Re-ID, vehicle Re-ID, appearance similarity or biometric search lawful for any proposed context? Define required necessity/proportionality, benchmarks, false-match review, retention and oversight.
10. Under what authority and safeguards may a missing-person investigation search permitted sources across Sites/tenants? Define warrants/mandates, source permissions, uncertainty language and export restrictions.
11. What conditions apply to Guardian/Journey/SOS, background location and emergency contacts/actions?
12. What cross-border transfer mechanisms and supplier terms are required for each current provider?
13. What contractual clauses are required for Enterprise/OEM/white-label partners, customer exit and data portability?
14. What App Store/Google Play privacy disclosures match the actual mobile implementation?

## Proposed decisions to return

For every decision, counsel should return: jurisdiction; legal entity; product context; exact purpose; data categories; lawful basis/authority; controller/processor allocation; permitted recipients; area/source restrictions; roles; retention; notice/consent requirements; transfer mechanism; incident duty; prohibited uses; effective/expiry date; reviewer; written decision reference and checksum.

The Product will store `EXTERNALLY_APPROVED` only when this scope is complete. A general approval or an unsigned email should not enable a sensitive capability.

## Required attachments for counsel

- `DIGITAL_OBSERVER_PUSH_45_LEGAL_REQUIREMENTS_MATRIX.md`
- `DIGITAL_OBSERVER_PUSH_45_DATA_INVENTORY_AND_FLOWS.md`
- `DIGITAL_OBSERVER_GAN_BATUACH_INTEGRATION_REQUIREMENTS.md`
- `DIGITAL_OBSERVER_ADVANCED_INVESTIGATION_REQUIREMENTS.md`
- Relevant provider DPAs/terms and verified processing regions (external; not stored in Git)
- Proposed customer/partner agreements and notices (external; not yet approved)
- DPIA outputs for child, workplace, biometric, investigation and location use (to be completed)

## Current decision

No counsel approval has been received or recorded. Sensitive activation, child monitoring, biometrics/Re-ID, location tracking, external pilots and Production remain blocked.
