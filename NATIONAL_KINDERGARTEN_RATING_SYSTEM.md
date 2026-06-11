# National Kindergarten Rating System

## Purpose

The Gan Batuach rating system creates a transparent, measurable and explainable kindergarten quality and safety score.

The system is not a black box. Every score is broken into categories, weights, explanations and improvement recommendations.

## Core Tables

- `kindergarten_rating_profiles`: current rating per kindergarten
- `kindergarten_rating_history`: daily, weekly and monthly score history
- `kindergarten_rating_recommendations`: explainable improvement recommendations

## Rating Categories

Overall score is calculated from five visible categories:

| Category | Weight | Meaning |
| --- | ---: | --- |
| Safety | 28% | Incidents, observer signals, unresolved findings and corrective actions |
| Compliance | 22% | Licenses, insurance, certifications, procedures and document readiness |
| Inspection | 20% | Inspection outcomes, finding severity, closure rate and follow-up completion |
| Parent Satisfaction | 12% | Parent feedback readiness, complaint trends and engagement |
| Observer | 18% | Observer readiness, camera coverage, camera health, event review and calibration |

## Transparency Model

Every rating profile stores:

- Category scores
- Weighting model
- Reasons that lowered the score
- Reasons that improved the score
- Improvement guidance
- Data source counts

Managers, inspectors and admins can see the explanation behind the score.

## Public Rating Readiness

Public display is prepared but disabled by default.

Public display must not expose:

- Individual parent feedback
- Raw complaints
- Raw observer events
- Child, staff or parent information
- Sensitive inspection notes

Future public display should expose only:

- Public score
- Public badge
- Human-approved public summary

## Recommendation Model

Recommendations are generated when a category score drops below the target threshold.

Examples:

- Complete document and certification renewal
- Resolve inspection findings
- Improve document readiness
- Review observer events
- Improve camera health
- Resolve parent complaints

Recommendations are operational guidance, not punishment.

## Score History

`kindergarten_rating_history` stores snapshots by:

- Daily
- Weekly
- Monthly

Current migration seeds daily history. Weekly and monthly snapshots can be added through future scheduled jobs.

## AI Rating Assistant Readiness

The UI prepares assistant-style questions:

- Why did this kindergarten score drop?
- Which kindergartens improved most?
- Which kindergartens require attention?
- What improves rating fastest?

Answers must use existing score explanations and data sources only.

## Remaining Production Work

- Scheduled recalculation job
- Manual admin review before public score activation
- Legal review of public badge wording
- Parent satisfaction survey model beyond pilot feedback
- Regional benchmarking after enough real gardens join
- Formal appeal/correction process for kindergartens
