# GAN BATUACH MANAGEMENT — GB-M17 Staff Candidate Job Discovery

## Before State

The repository already had `staff_candidate_profiles`, `kindergarten_staff_openings`, a Staff job-market screen, certificates, and an earlier application endpoint. The job market read raw openings and did not have one server-side candidate completeness or explainable matching authority.

## Candidate Profile Model

GB-M17 extends the existing candidate profile rather than introducing a second identity: city, structured qualification keys, professional role, availability, age preferences, employment preference, summary, matching pause state, and an evaluated completeness result.

Candidate state remains independent from active Staff employment. Completing a profile does not create Staff, Garden membership, Classroom assignment, or Garden access.

## Qualification Model

Qualification keys are structured text identifiers with free-text professional summary as supplemental content. Existing certificate/document state remains the evidence source; uploaded files are not represented as verified merely because they exist.

## Completeness Evaluation

`evaluate_staff_candidate_profile` runs server-side and returns percentage, blockers, document readiness, and `incomplete`, `ready_for_matching`, or `paused` state. It requires full name, city, professional role, at least one qualification, availability, and documented readiness.

## Garden Job Model

The existing `kindergarten_staff_openings` is canonical. GB-M17 adds qualification keys, optional canonical Classroom context, and publication/closure timestamps. Statuses are draft, published, paused, filled, and closed.

## Matching Rules

`find_relevant_staff_jobs` returns published openings only. Ordering is deterministic: exact role/qualification match, same city, recency, stable ID. Results include explainable reasons: profession match, qualification match or missing qualification, same city, preferred age group, and location unavailable. No distance is calculated or displayed without coordinates.

## Location

City matching is supported. Coordinates are not used, so no distance claim is made.

## Existing UI Integration

`/dashboard/staff/job-market` now edits the canonical candidate profile and calls the matching RPC. It shows safe recruitment data, match reasons, and existing application state. The UI does not submit or accept applications in GB-M17; GB-M18 owns that lifecycle.

## Job Management

Garden managers create openings through the existing route and can update role, structured requirements, Classroom context, and status only inside an authorized active Garden context. Classroom IDs are verified against that Garden.

## Privacy

The matching projection exposes Garden name, city, role, requirements, optional age context, employment type, description, match reasons, and application state. It contains no Children, Parents, private Staff records, camera data, incidents, finance, or documents.

## Security / RLS

Candidate profile save/evaluation is self-scoped (or Platform Admin). Job mutation uses `can_manage_garden`, never a selected client Garden ID. Discovery returns published recruitment rows only; application state is constrained to the current candidate.

## Tests

Focused QA covers profile completeness, self-scope IDOR, qualification-aware matching, published-only discovery, no fake distance, manager job authority/Classroom tenant integrity, UI integration, and privacy projection.

## Live QA

`LIVE STAFF JOB DISCOVERY QA: BLOCKED BY ENVIRONMENT`

No controlled Candidate and Manager QA identities were available. No customer Staff profiles or job records were changed.

## Remaining Debt

GB-M18 owns canonical application submission, information requests, invitation acceptance, and hiring decisions. GB-M19 owns multi-Garden employment context. GB-M32 closes document lifecycle and verification.

## Inputs For GB-M18

GB-M18 receives a canonical candidate completeness result, safe job projection, open-job authority, and truthful existing application state without creating employment in this push.

Digital Observer core diff: 0.
