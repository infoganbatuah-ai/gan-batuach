# Public Website, Marketing, Lead Generation And Conversion Platform

## Goal

The public Gan Batuach website is now positioned as an acquisition engine, not a brochure.

It should:

- Generate kindergarten leads
- Help parents demand transparency
- Explain the Gan Batuach safety standard
- Build authority and trust
- Move visitors toward demo, pilot and subscription

## Marketing Architecture

Public routes:

- `/` homepage
- `/book-demo`
- `/parents-demand-safety`
- `/why-gan-batuach`
- `/safety-standard`
- `/parent-portal`
- `/ai-observer`
- `/inspection-platform`
- `/compliance-trust`
- `/case-studies`
- `/roi-calculator`
- `/kindergarten-directory`
- `/gardens`
- `/join-kindergarten`

The homepage now leads with:

“גן בטוח – תקן הבטיחות, הפיקוח והשקיפות החדש לגני ילדים”

## Conversion Funnel

Funnel:

1. Visit
2. Learn
3. Book demo
4. Trial
5. Subscription

Tracked fields on leads:

- Source
- Campaign
- UTM source
- UTM medium
- UTM campaign
- Funnel stage
- Owner
- Follow-up
- Lead score
- Qualification
- Conversion goal

## Lead Flow

Kindergarten lead flow:

1. Visitor reaches website.
2. Visitor reads authority pages.
3. Visitor books demo or submits join form.
4. Lead is stored in `leads`.
5. Demo booking is stored in `demo_booking_requests`.
6. Admin reviews lead in dashboard.
7. Lead moves to trial/onboarding.
8. Subscription flow begins after conversion.

## Parent Pressure Strategy

Parent route:

`/parents-demand-safety`

Message:

“גן הילדים שלכם עדיין לא בגן בטוח?”

Purpose:

- Give parents language to request Gan Batuach.
- Educate parents on transparency.
- Encourage kindergartens to book demo because parents ask for it.

Parent-safe claims only:

- Approved updates
- Parent-visible documents
- Status summaries
- Human-reviewed safety communication

No raw AI events are exposed.

## Kindergarten Acquisition Strategy

Kindergarten conversion route:

`/book-demo`

The demo form captures:

- Garden name
- Contact name
- Phone
- Email
- City
- Children count
- Staff count
- Camera status
- Current tools
- Biggest challenge
- Decision timeline
- Interest areas

This creates both a lead and a demo booking request.

## ROI Strategy

ROI route:

`/roi-calculator`

Focus areas:

- Operational savings
- Document readiness
- Inspection preparation
- Parent trust
- Commercial differentiation

Numbers are presented as estimates only.

## Authority Pages

Authority pages:

- Why Gan Batuach
- Safety Standard
- Parent Portal
- AI Observer
- Inspection Platform
- Compliance & Trust

The AI Observer page avoids unsafe claims:

- No automatic accusations
- No disciplinary decisions
- No panic notifications
- Human review remains required

## SEO Foundation

Added:

- Structured metadata in root layout
- Open Graph metadata
- Keywords
- `sitemap.ts`
- `robots.ts`
- Organization schema on homepage

SEO landing pages focus on:

- Safety in kindergartens
- Parent transparency
- Inspection platform
- AI observer safety
- Compliance and trust

## Analytics And Conversion Tracking

Created tables:

- `website_conversion_events`
- `marketing_campaigns`
- `marketing_content_ideas`
- `demo_booking_requests`

Prepared events:

- Visit
- CTA click
- Lead submitted
- Demo booked
- ROI calculated
- Parent request
- Trial requested
- Subscription started

## Remaining Website Gaps

- Real analytics provider is not connected yet.
- Calendar scheduling is readiness-only.
- Case studies need real pilot results.
- Public directory needs approved participating kindergartens.
- A/B testing is not implemented.
- Blog CMS is not implemented.
- Automated email sequences are prepared conceptually but not connected.
