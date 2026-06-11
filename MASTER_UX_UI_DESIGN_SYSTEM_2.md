# Master UX/UI & Design System 2.0

## Goal

Gan Batuach should feel like one premium SaaS product across parent, staff, manager, inspector and admin experiences.

This phase focuses on clarity, hierarchy, consistency, speed and mobile-first use. It does not remove business functionality or weaken permissions.

## Design Language

The final layer uses a calm operational palette:

- Deep teal for primary actions
- Soft green surfaces for successful/ready states
- Warm amber for attention states
- Warm red for urgent states
- Neutral text and borders for scanning

The UI now favors:

- 8-20px radius depending on component scale
- Light card shadows
- Clear white surfaces
- Muted support text
- High-contrast primary buttons
- Consistent badges and status pills

## Standardized Components

The global CSS override standardizes:

- Buttons
- Inputs
- Selects
- Textareas
- Cards
- Panels
- Tables
- Dashboard heroes
- Metric cards
- Action cards
- Empty states
- Status badges
- Mobile tab bar
- Sidebar navigation

## Information Architecture

Navigation is grouped around product domains:

- Operations
- Children
- Parents
- Staff
- Safety
- Compliance
- Communications
- Cameras
- Smart assistant and observer tools
- Reports
- Settings

In the Hebrew UI these are presented as:

- תפעול
- ילדים
- הורים
- צוות
- בטיחות
- ציות
- תקשורת
- מצלמות
- חכם
- דוחות
- הגדרות

The goal is fewer long unstructured menus and easier discovery by intent.

## Dashboard Pattern

Dashboards should follow the same structure:

1. Top: what needs attention, assistant insights, action items
2. Middle: 3-5 core KPIs
3. Bottom: recent activity and deeper workflows

The visual hierarchy now supports this pattern through shared hero, metric, action and section styling.

## Language Cleanup

High-visibility navigation language was updated to reduce technical terms.

Examples:

- Gateway → חיבור שידור / חיבור וידאו
- Replay → סקירת תצפיתן
- Production → פעיל / הפעלה
- Demo → נתוני ניסיון
- Mock → בדיקה בטוחה
- SLA → זמן טיפול
- AI → תצפיתן / חכם / זיהוי חזותי where appropriate

Remaining code-level or admin-only technical language may still exist in deep infrastructure screens and should be reviewed before public/customer rollout.

## Role Experience Direction

Parent:

- Child-first
- Timeline, messages, documents, cameras and trust information should be easiest to reach

Staff:

- One-hand mobile use
- Fast updates, shift flow, tasks and incidents

Manager:

- Operational control
- KOS, children, staff, compliance, inspections, payments and communications in one mental model

Inspector:

- Inspections, findings, complaints, safety, cameras and reports grouped by field workflow

Admin:

- National operations grouped by business domain: operations, gardens, safety, compliance, communications, cameras, smart systems and reports

## Mobile Rules

The final CSS layer improves:

- Mobile spacing
- Card density
- Hero sizing
- Touch target consistency
- Bottom navigation readability
- Form control sizing

All critical screens still require real device QA before declaring the design complete.

## Remaining UX Debt

High:

- Some deep admin infrastructure pages still contain English or technical words.
- Some older module list pages still feel table-heavy.
- A few pages still use long explanatory paragraphs above the fold.

Medium:

- Empty states are visually unified, but not all have a specific next action.
- Parent/staff mobile routes need device review at 360px, 390px and 414px.
- Some dashboard content still depends on legacy card classes.

Low:

- Further icon consistency pass.
- More exact wording pass for inspector and admin deep tools.
- Add active-route state in sidebar.

## Verification Scope

This phase updates shared surfaces rather than replacing individual business pages:

- Global design tokens
- Shared dashboard shell navigation
- Shared card/button/form/table styling
- High-visibility navigation text

No permissions or backend business logic were changed.
