# Advanced Observer Intelligence

## Purpose

Advanced Observer Intelligence unifies Digital Observer signals into one review-oriented intelligence layer.

It aggregates camera events, audio indicators, correlated timelines, watch requests, pickup verification signals, learning profiles, camera health, zones and routines into careful situation summaries.

This phase is mock/readiness only:

- No automatic accusations.
- No automatic disciplinary conclusions.
- No parent notifications without human approval.
- No child profiling.
- No staff scoring.
- No biometric assumptions.
- Human review remains required.

## Intelligence Architecture

Inputs:

- AI camera events
- audio observer events
- observer correlated events
- observer watch requests
- pickup verification events
- safety indicators
- learning profiles
- camera health
- zone and routine context

Output:

- `observer_situation_summaries`

The engine does not create new facts. It summarizes existing system data and recommends safe review actions.

## Situation Summary Model

`observer_situation_summaries` stores:

- observer site
- kindergarten
- summary type
- severity
- confidence
- title
- summary
- recommended actions
- related event ids
- status
- dedupe key
- context snapshot

Summary statuses:

- open
- reviewing
- handled
- dismissed
- escalated
- snoozed

## Context-Aware Interpretation

The engine uses context to avoid overreacting:

- site routine configuration
- camera zones
- restricted zones
- learning maturity
- anomaly readiness
- active watch requests
- recent correlated events
- camera health

Context makes recommendations more practical, but never turns an indicator into a conclusion.

## Recommended Actions

Allowed wording is operational and cautious:

- בדיקת מצלמה מומלצת
- מומלץ לבדוק את האירוע
- מומלץ לוודא מול הצוות
- מומלץ לסמן כתקין / לא תקין לאחר בדיקה
- מומלץ לבדוק מוכנות למידה ואזורים

Avoid:

- legal conclusions
- disciplinary language
- blame
- accusations
- certainty about intent or identity

## Review Model

Every summary requires human review.

Flow:

```text
Observer signals
↓
Situation summary
↓
Manager/Admin review
↓
Handled / dismissed / escalated / snoozed
```

Parents are not notified automatically. Parent-facing updates require a separate approved workflow.

## Notification Policy

High, urgent and critical summaries can notify:

- manager
- owner
- admin
- optionally inspector in future configuration

Parents are never notified automatically by this engine.

Notifications use dedupe metadata so the same summary is not repeatedly sent within the same day.

## Privacy Boundaries

Hard boundaries:

- No child profiling.
- No staff scoring.
- No biometric assumptions.
- No parent raw AI access.
- No automatic accusation.
- No automatic disciplinary conclusion.
- No automatic parent notification.

The engine summarizes site-level and event-level data only.

## Future AI Expansion

Future expansion may add:

- richer natural-language phrasing
- inspector-specific escalation rules
- cross-site trend analysis
- automatic grouping by zone/routine windows
- confidence adjustment from learning feedback

External AI may only phrase summaries better. It must not invent facts or override system data.

## Testing Scope

Current testing is mock/system-data only:

- generate mixed summaries
- review summaries
- verify manager sees only own kindergarten
- verify admin sees global summaries
- verify parent sees none
- verify high/critical notifications target manager/admin only
- verify dedupe prevents repeated open summaries
