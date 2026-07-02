# PILOT FIX 4 – Real Data Admission Rules

Date: 2026-07-03

Default rule: **No real child or parent data before RLS verification and legal/privacy consent readiness.**

| Data type | Allowed environment | Required gate before entry | Required legal/consent document | RLS/security requirement | Owner approval | Retention requirement | Rollback/delete process |
|---|---|---|---|---|---|---|---|
| Real kindergarten profile | pilot/staging only | environment confirmed, manager agreement draft reviewed | manager pilot terms | manager scope RLS verified | Daniel + pilot owner | pilot retention profile | deactivate garden, export/remove records if pilot cancelled |
| Real manager account | pilot/staging only | auth/RLS gate, support owner assigned | terms, privacy, manager terms | role scoped to own garden | Daniel | account retention policy | disable account, preserve audit |
| Real staff account | pilot/staging after manager approval | staff access gate | staff notice | assignment-based RLS | manager + Daniel | staff document retention | disable/unassign, delete/correct by request |
| Real parent account | only after RLS/legal signoff | parent RLS gate passed | privacy, terms, child data, parent consent | own-child only RLS | Daniel + kindergarten | parent/child retention policy | deactivate, deletion request workflow |
| Real child profile | only after RLS/legal signoff | child privacy gate passed | child data notice + parent authorization | parent-child/garden scope verified | parent/guardian + manager | child retention policy | delete/anonymize by policy |
| Real child documents | only after storage/RLS signoff | private bucket and signed URL tests | child data + document notice | private storage, short signed URLs | parent/manager | document retention policy | remove file + metadata where allowed |
| Real staff documents | pilot/staging after staff consent | storage/RLS verified | staff notice | private storage, manager/admin scope | staff + manager | staff retention policy | delete/correct by request |
| Real inspection evidence | pilot/staging after inspector setup | inspector assignment RLS verified | inspector notice + pilot terms | assigned-garden only | inspector/admin | evidence retention policy | archive/remove per legal process |
| Real messages | pilot/staging after role flow validation | message privacy tests | privacy + support notice | conversation membership checks | relevant role owner | message retention policy | export/delete where allowed |
| Real attendance | pilot/staging after role flow validation | staff/manager RLS verified | child data + staff notice | garden/child scoped | manager | attendance retention policy | correction log, no silent deletion |
| Real payments | later pilot only | provider/legal/payment gate | payment/subscription terms | payment RLS verified | finance/Daniel | accounting retention | refund/cancel/provider process |
| Real camera stream | only after camera legal/security approval | gateway, tokens, audit, notice | camera notice, manager terms, parent notice if relevant | no RTSP/client secrets, scoped tokens | Daniel + legal/camera owner | camera session retention | disable camera/gateway token |
| Real AI processing | only after AI legal/security approval | shadow mode, human review, retention | AI notice, DPIA/legal review | no raw parent visibility | Daniel + legal/AI owner | AI event retention | disable AI, archive/delete per policy |
| Real Digital Observer site data | separate pilot/staging context | product separation gate | Digital Observer terms/privacy | site/customer scoped | Digital Observer owner | site retention profile | deactivate site, export/delete |

