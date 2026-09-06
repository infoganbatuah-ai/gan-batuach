# DIGITAL OBSERVER — PUSH 13

# NATURAL-LANGUAGE VIDEO SEARCH & INVESTIGATION

## FINAL STATUS

`PASS`

Digital Observer now provides one bounded, tenant-authorized investigation path from a natural-language question to canonical Production Events, Incidents and Evidence. The compiler does not emit SQL, the retrieval layer independently validates the compiled query, and every answer preserves the IDs of the records that support it.

Production verification completed against the real pilot site and channel 11. Two grounded Hebrew investigation queries returned real Production records, an unsupported identity question was refused truthfully, and a real Evidence clip was opened from a search result through the authorized media route and played successfully.

Implementation commit: `2ff60813dee51f14c2dfea97abb7d965bd16d34a` (`feat: add grounded observer investigation search`). This commit remains an ancestor of the currently deployed repository head.

Active Production deployment verified on 2026-09-06:

- Deployment ID: `dpl_3o6dFMsqW76hr2tMFWf1THppNNKG`
- Status: `READY`
- Canonical alias: `https://ganbatuach.com`
- Authenticated product alias used for browser verification: `https://gan-batuach.vercel.app`

## EXISTING SEARCH INVENTORY

| System | Before PUSH 13 | Decision |
|---|---|---|
| Digital Observer conversation route | Partial keyword/history search with an explicit `journal_query` contract | Kept for backward compatibility; ordinary investigation questions now use the canonical compiler and search service |
| Guard Journal search | Useful bounded Journal history lookup | Kept as the explicit legacy Journal path; not used as a parallel canonical investigation stack |
| Event APIs | Canonical real Event retrieval foundations | Reused |
| Incident APIs/UI | Canonical Incident, Risk, Verification and Decision data | Reused |
| Event media route | Authorized signed Evidence access | Reused without exposing Storage paths |
| Camera/site selection | Existing tenant/site authorization and camera inventory | Reused for entity resolution |
| Baseline/history APIs | Context-specific historical aggregation | Not duplicated into investigation search |
| Mock/scenario search | QA-only data | Excluded from normal Production investigation |

## CANONICAL QUERY MODEL

The canonical contract is `do-investigation-query-v1`, compiled by `do-investigation-compiler-v1`.

It supports bounded filters for:

- tenant-authorized site, camera and zone;
- Event types, Incident states and time range;
- detector confidence as a distinct Event fact;
- Risk score/band, Verification state and Decision;
- Evidence state, reviewed feedback label, Track ID and watch-rule match;
- Event/Incident scopes and real provenance;
- cursor pagination and deterministic ranking.

Safety invariants are part of the schema: `readOnly = true`, `rawSqlAllowed = false`, real provenance is restricted to `REAL_CAMERA_AI` and `CAMERA_NATIVE_EVENT`, the result page is capped at 25 records, the cursor is bounded, and the maximum query window is 32 days.

## COMPILER ARCHITECTURE

The implemented path is:

`Natural language → deterministic intent/entity/time parsing → strict Zod schema → capability validation → authorization → typed Supabase retrieval → deterministic filtering/ranking → grounded answer`

No model-generated text is executed against the database. The database service receives only a previously validated typed query. The conversation route delegates investigation questions to this same path and retains the older Journal query only when the caller explicitly supplies `journal_query`.

## TEMPORAL PARSING

Deterministic parsing supports Hebrew and bounded English equivalents for:

- today, yesterday, last night and this week;
- the last hour, last two hours and bounded `N`-hour windows;
- explicit dates;
- `between HH:MM and HH:MM` and `after HH:MM`;
- morning, afternoon, evening and night.

All wall-clock conversion uses the authorized site's timezone. The home pilot resolved with `Asia/Jerusalem`. DST gaps and repeated local times fail closed rather than silently selecting an incorrect instant. Overnight windows are represented explicitly.

## RESOURCE RESOLUTION

Camera and zone words are resolved only against the selected site's authorized inventory. Exact camera names, location labels, stream labels, aliases and zone aliases may participate. An explicit source ID must still belong to the selected site.

The Production UI test demonstrated the ambiguity guard: “מצלמת הכניסה” matched more than one authorized entry resource, so the compiler returned `NEEDS_CLARIFICATION` and did not query data. Selecting `כניסה לבית — ערוץ 11` then produced the grounded result. No cross-site guess was made.

## EVENT SEARCH

Event search reads canonical validated Event records only. Normal Production results require real provenance and preserve:

- Event ID, type and occurred-at timestamp;
- camera/source, stream, site and Track ID where present;
- detector confidence without treating it as Risk;
- Evidence availability and authorized playback route.

Query A returned six real `person_entered` Events for channel 11 on 2026-09-06. No mock, simulation, manual or seeded Event was used.

## INCIDENT SEARCH

Incident search reads the canonical `do-track-v1` Incident model and exposes:

- status and chronological Event timeline;
- site/camera and activity times;
- current Risk score/band and evaluation confidence;
- Verification status/confidence;
- current/final Decision;
- Evidence state and authorized playback candidates.

Different cameras are not presented as the same person or Track. Track IDs remain investigation references, not identities.

## EVIDENCE SEARCH

Search distinguishes:

- `AVAILABLE`;
- `NO_RECORDING_BY_POLICY`;
- `EXPIRED`;
- `FAILED`;
- `UNAVAILABLE`.

The result model returns only relative authorized media endpoints such as `/api/digital-observer/event-clips/{evidence_id}/media?kind=clip`. It never returns a raw bucket/object path or permanent Storage URL.

## GROUNDED ANSWER MODEL

Answers are deterministic summaries of retrieved records. Grounding preserves supporting Event IDs, Incident IDs, Evidence IDs, camera names and timestamps. Zero matches return the factual response “לא נמצאו אירועים תואמים בטווח שביקשת.” and do not generate a narrative.

The admin/debug surface exposes the complete chain:

`question → compiled query → resource resolution → retrieved record IDs → grounded answer → query latency`

## NO-HALLUCINATION GUARDS

The compiler rejects unsupported identity and intent questions before retrieval. It does not infer theft, suspicion, motive, identity or cross-camera sameness from a person Event.

Production test question `מי האדם הזה?` returned:

- status: `UNSUPPORTED_CAPABILITY`;
- code: `IDENTITY_NOT_AVAILABLE`;
- explanation: no verified identity is available and a Track/person detection is not identity;
- retrieval executed: `false`.

Prompt/SQL injection phrases are classified as unsafe and cannot enable raw SQL, broaden authorization or populate fields outside the strict schema.

## TIMELINE RECONSTRUCTION

Incident timelines are built from canonical Event relationships and sorted chronologically. Each item preserves Event ID, timestamp, Event label and Evidence state. Risk, Verification and Decision are attached from the canonical Incident state, not inferred from wording.

## RISK / VERIFICATION / DECISION SEARCH

The query model supports exact Risk bands, bounded Risk score ranges, Verification states and canonical Decisions. These filters read PUSH 9/10 data without recomputing or rewriting historical evaluations.

The latest entrance Incident retrieved in Production reported:

- Risk: `23 / GUARDED`;
- Risk confidence: `0.5553`;
- Verification: `CONFIRMED`, confidence `0.86`;
- Decision: `NOTIFY_IN_APP`, confidence `0.7381`.

## FEEDBACK / QUALITY SEARCH

Reviewed PUSH 11 labels are supported as an authorized query filter. The bounded taxonomy remains versioned and distinct: expected activity is not false detection. Normal Production search does not include synthetic calibration fixtures; admin access is still tenant/site scoped.

## PERFORMANCE / INDEXING

Migration `20260906050000_digital_observer_investigation_indexes.sql` added partial indexes only for validated real observations and canonical real Incidents. The indexes cover common site/camera/Event/time, recency, Decision, Risk score, Risk band and Verification filters.

The migration was applied in isolation after a dry run proved that it was the only pending migration. No old migration was replayed, repaired or reset.

Representative current-Production latency:

- Query A: `382.1 ms` for 12 returned records and six Incident/Event matches;
- Query B: `263.1 ms` for the latest grounded Incident.

The service applies database filters before a 500-row safety scan cap, uses a maximum 25-record page and reports when narrowing is required.

## SECURITY / QUERY INJECTION

- Normal authentication and Digital Observer admin/site authorization are enforced before compilation and retrieval.
- Site privacy restrictions are preserved.
- Camera/zone resolution cannot cross the selected site.
- Strict schema validation runs independently after compilation.
- `rawSqlAllowed` is fixed to `false`; no generated SQL path exists.
- Real Production defaults exclude mock/test provenance.
- Evidence is accessed only through the existing tenant-authorized media endpoint.
- Signed URLs are short-lived and were not stored in this report or source control.
- Injection QA confirms that user text cannot request SQL, another tenant's cameras or permission bypass.

## PRODUCT UX

Added a minimal Hebrew investigation experience at:

- `/digital-observer/investigation`
- `/digital-observer/admin/investigation`

The product flow shows the question, safe interpretation, clarification choices when required, factual answer, metrics, Incident cards, chronological timeline, Risk/Verification/Decision and Evidence states. Results link to the existing Incident UI and authorized Evidence playback. No broad dashboard redesign was performed.

## ADMIN / DEBUG VIEW

Authorized admin mode includes a collapsible structured view of the compiled query, resource resolution, grounding IDs and latency. It does not reveal credentials, media bytes or raw Storage paths.

## REAL PRODUCTION QUERY A

Question:

`תראה לי את הכניסות דרך מצלמת הכניסה היום`

After the required authorized camera clarification, the answer was:

`נמצאו 6 תקריות ו-6 אירועים תואמים מתוך נתוני Production אמיתיים במצלמות: כניסה לבית — ערוץ 11. קיימות 6 הפניות לראיות מורשות.`

Verified grounding:

- 6 canonical real Incidents;
- 6 real Events;
- 3 unique Evidence records represented across the matching records;
- 12 returned Incident/Event records;
- provenance guard passed;
- no mock/manual data.

## REAL PRODUCTION QUERY B

Question:

`מה קרה בתקרית האחרונה בכניסה?`

Grounded result:

- Incident ID: `bdf84923-cc3b-4f31-a8ea-57de8b9edcb5`;
- Event ID: `7b7d90ce-cf49-4a57-9a67-953c0f25240c`;
- camera: `כניסה לבית — ערוץ 11`;
- latest activity: 2026-09-06 18:43 local time;
- Incident status: open for review;
- Risk: `23 / GUARDED`;
- Verification: `CONFIRMED`;
- Decision: `NOTIFY_IN_APP`;
- Evidence: `AVAILABLE` through the authorized product media route.

The generated summary contained only these stored facts and did not infer identity, motive or threat.

## UNSUPPORTED QUESTION TEST

Question:

`מי האדם הזה?`

Result: truthful capability refusal, no database retrieval and no invented identity. This satisfies the required unsupported identity/intent behavior.

## REAL EVIDENCE PLAYBACK

`PASS`

Evidence ID `3c385ada-3ab4-45d8-b9b1-2ae88e4cdd78` was opened directly from the authenticated Production search result. The product media endpoint authorized the request and redirected to a short-lived signed URL for the private `digital-observer-event-media` bucket.

Verified browser behavior:

- no `localhost`, `127.0.0.1` or private Gateway hostname;
- native browser media controls loaded;
- playback was started and the media position advanced to `00:01`;
- no CORS/CSP/hostname error was observed;
- no permanent URL, credential or signing token is included in this report.

The Evidence was reached from the grounded search result, preserving the Event/Incident/camera association already returned by the authorized API.

## TEST MATRIX

| Test | Result |
|---|---|
| PUSH 13 focused compiler/retrieval QA (Hebrew time, timezone, ambiguity, authorization, unsupported identity, injection, provenance, grounding, zero result, playback path) | PASS — 10/10 |
| Current Production investigation QA, including Query A, Query B and unsupported identity | PASS |
| Authorized browser UI, clarification and grounded result rendering | PASS |
| Authorized Evidence playback from search | PASS |
| Legacy Guard Journal search | PASS — 13/13 |
| Event Journal QA | PASS |
| Evidence/media QA | PASS |
| Context/baseline QA | PASS |
| Risk/Decision QA | PASS |
| Verification QA | PASS |
| Feedback/calibration QA | PASS |
| Natural-language Watch Rule QA | PASS |
| Product Observer real-source/mock isolation QA | PASS |
| Tenant boundary QA | PASS — 15/15 |
| Environment and Storage policy safety QA | PASS |
| Gateway session/offline safety QA | PASS |
| Full Digital Observer product QA | PASS — 68/68 |
| TypeScript typecheck | PASS |
| Focused lint | PASS — 0 errors; one pre-existing `<img>` warning in the app shell |
| Production build | PASS — 485 routes/pages |
| Production release preflight | PASS |
| Production database migration dry-run/apply/post-check | PASS — exact PUSH 13 migration only; post-check up to date |

## PUSH 14 READINESS

`YES`

PUSH 13 is complete. Natural-language investigation now searches only authorized, canonical real Production records; answers are bounded and grounded; ambiguous resources require clarification; unsupported identity/intent is refused; and real Evidence can be opened and played from a result.

ARE WE READY FOR PUSH 14 — DIGITAL-FIRST UNIVERSAL CAMERA CONNECTION HARDENING?

`YES`

