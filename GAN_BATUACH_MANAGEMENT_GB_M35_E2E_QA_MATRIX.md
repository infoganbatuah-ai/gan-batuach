# GB-M35 controlled role E2E QA matrix

Observed 2026-09-20 in loopback-only `DEVELOPMENT / INTEGRATION`, source baseline `48f3803ec15529dface13ac4f03b5312fe711e99`. `PASS` means the exact stated probe passed; a dashboard load or API authorization check is not a completed domain journey. All identities and data are synthetic. The isolated Inspector fix is separately reviewed in PR #85; its local browser retest is recorded below. Status is provisional until cumulative integrated QA is rerun on the final head.

| Journey | Role | Environment | Result | Defect | Severity | Fix PR | Retest | Remaining debt |
|---|---|---|---|---|---|---|---|---|
| Baseline local Auth, REST profile, RLS | 20 synthetic accounts | Local Development | PASS (20/20; baseline RLS script) | — | — | — | PASS | Extended domain RLS matrix |
| Dashboard first render | Manager A/B, Owner A/A+B/Teacher, Parent A/B/Multi, Staff A/A+B/Candidate/Teacher, Inspector A/Unassigned/Suspended, Admin | Chrome desktop/mobile | PARTIAL: routes render; redirects are role dependent | Inspector A redirected to application before fix | P1 | #85 | Local fixed Inspector browser PASS | Full interactive journeys, console/network sweep |
| Approved assigned Inspector entry | Inspector A | Chrome + local Auth/RLS | PASS on scoped fix | Direct `inspectors` read was RLS-hidden | P1 | #85 | Dashboard reached, no page error | Exact-head CI and integration retest |
| Unassigned/suspended Inspector boundary | Inspector Unassigned/Suspended | Chrome + local Auth/RLS | PASS for no Garden A content; suspension routed to application | — | — | #85 | Local browser PASS | API mutation denial matrix on final head |
| Parent tuition Child IDOR | Parent A/B/Multi | Local authenticated API | PASS (5 checks) | — | — | — | PASS | Actual billing and settlement journey |
| Garden context switch/IDOR | Manager A/B, Owner A+B | Local authenticated API | PASS (6 checks) | — | — | — | PASS | Browser context switch and all Garden pages |
| Cross-Garden document list | Manager A | Local authenticated API | PASS: B list empty | — | — | — | PASS | Upload/signed retrieval in GB-M35 run |
| Candidate operational denial | Candidate Staff | Local authenticated API | PASS | — | — | — | PASS | Candidate→employment browser journey |
| Wage/payroll denial | Delegated Teacher, Inspector A/Suspended | Local authenticated API | PASS | — | — | — | PASS | Staff time transaction/export journey |
| Own notification list | Parent A, Staff A | Local authenticated API | PASS | — | — | — | PASS | Preferences, quiet hours, read-state journey |
| Owner registration, Email verification, save/resume | New Owner | Local Development | NOT RUN | — | — | — | — | New-account browser flow and email capture |
| Owner-only vs Owner-as-Teacher capabilities | Owner A / Owner Teacher | Local Development | PARTIAL: identities and memberships seeded | — | — | — | — | Operational page/permission matrix |
| Owner A+B full Garden switching | Owner A+B | Local Development | PARTIAL: API selection A/B allowed, C denied | — | — | — | — | Dashboards, finance, documents, messages by context |
| Same-age Classrooms, capacity, move | Manager, Parent | Local Development | PARTIAL: A1/A2/B1 fixtures seeded | — | — | — | — | UI move and last-seat concurrent reservation |
| Staffing policy truthfulness | Manager | Local Development | NOT RUN | — | — | — | — | Browser empty-policy and QA-only policy checks |
| Parent registration/Child creation/discovery | Parent | Local Development | NOT RUN | — | — | — | — | End-to-end forms and no-fake-distance check |
| Enrollment request/review/payment activation | Parent, Manager | Local Development | NOT RUN | — | — | — | — | Pending/waitlist/approval/manual-payment fixtures and browser flow |
| Multi-Child Parent context | Parent Multi | Local authenticated API | PARTIAL: Child C/A Garden and Child B/B Garden reads allowed | — | — | — | — | UI child switch and cross-Child pages |
| Staff candidate/application/invitation | Candidate, Manager | Local Development | NOT RUN | — | — | — | — | Signed invitation and employment activation |
| Multi-Garden Staff tasks/messages/shifts/time | Staff A+B | Local Development | PARTIAL: active A/B fixture and dashboard load | — | — | — | — | Garden switch and domain-specific IDOR |
| Inspector application/Admin approval/assignment/suspension | Inspector, Admin | Local Development | PARTIAL: assigned/unassigned/suspended fixtures, guard retest | P1 guard defect fixed locally | P1 | #85 | Local Inspector browser PASS | Full admin decision and post-suspension mutation |
| Inspector preliminary Garden bootstrap | Inspector, Owner | Local Development | NOT RUN | — | — | — | — | Garden C invitation→activation; GB-M21 debt |
| Monthly inspection/evidence/report | Inspector, Garden, Parent | Local Development | NOT RUN | — | — | — | — | GB-M22 role journey and private evidence retrieval |
| Concurrent inspection submission | Inspector | Separate connections | NOT RUN | — | — | — | — | GB-M22 race |
| Corrective action/review/evidence | Garden, Inspector | Local Development | NOT RUN | — | — | — | — | GB-M23 role journey and private evidence |
| Conflicting corrective review decisions | Inspector | Separate connections | NOT RUN | — | — | — | — | GB-M23 race |
| Task create/assign/complete/source boundary | Manager, Staff, Inspector | Local Development | NOT RUN | — | — | — | — | GB-M24 role journey and completion race |
| Complaint SLA/response/resolution/private attachment | Parent, Garden, Inspector, Admin | Local Development | NOT RUN | — | — | — | — | GB-M25 role journey and attachment access |
| Platform subscription/Admin override | Owner, Admin | Local Development | NOT RUN | — | — | — | — | GB-M26 controlled no-charge flow |
| Tuition manual/partial/duplicate settlement | Parent, Manager | Local Development | NOT RUN | — | — | — | — | GB-M27 role journey and separate-connection race |
| Disabled electronic provider truth | Parent, Owner | Local Development | NOT RUN | — | — | — | — | GB-M28 checkout UI proof |
| Messaging/broadcast/read/attachment | Parent, Staff, Manager | Local Development | NOT RUN | — | — | — | — | GB-M29 controlled browser flow; isolated prior RLS/attachment evidence remains |
| Notification fan-out/preferences/quiet hours | Parent, Staff, Manager | Local Development | NOT RUN | — | — | — | — | GB-M30 role journey; no external delivery |
| Resend/FCM QA-only delivery | Controlled destination | Local Development | NOT RUN | — | — | — | — | GB-M31 provider readiness; SMS/WhatsApp optional |
| Garden/Staff/Child/Inspector document lifecycle | Authorized roles | Local Development | NOT RUN | — | — | — | — | GB-M32 upload, signed retrieval, expiry, replacement, retention |
| Child arrival/authorized pickup/revocation | Parent, Staff, Manager | Local Development | NOT RUN | — | — | — | — | GB-M33 role journey and release races |
| Camera/face detection never releases Child | Parent, Staff | Local Development | NOT RUN | — | — | — | — | Explicit E2E boundary assertion |
| Staff clock/shift/correction/export | Staff, Manager | Local Development | NOT RUN | — | — | — | — | GB-M34 role journey and separate-connection races |
| Mobile/desktop/RTL/accessibility/console/network | Parent, Staff, Manager, Inspector, Admin | Chrome | PARTIAL: desktop/mobile first render, no page exceptions | — | — | — | — | Interactive forms, keyboard/focus, RTL and network audit |
| Cross-domain ID substitution and live revocation | All roles | Local Development | PARTIAL: tuition, Garden and document-list probes | — | — | — | — | Full IDOR suite and stale-session revocation |
| Production and real providers | All | Production | NOT RUN by policy | — | — | — | — | Owner-controlled later release only |

Evidence: `/private/tmp/gb-m35-api-matrix.json`, `/private/tmp/gb-m35-browser-smoke.json`, `/private/tmp/gb-m35-inspector-fix-browser.json`, plus the isolated Development `services-qa-receipt.json` generated locally. These contain synthetic identifiers only and stay outside Git unless a redacted receipt is explicitly added. The initial browser receipt predates PR #85 and has superseded exact-path assertions; use the targeted fix receipt for the Inspector outcome.
