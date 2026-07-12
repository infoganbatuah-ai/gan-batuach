# MANUAL SIGNOFF EXECUTION 2 - Feature Flags / Kill Switch Results

| Feature / switch | Evidence | Local status | Pilot impact |
|---|---|---|---|
| Parent registration | Documented in pilot feature flag plan | manual_required | Must be controlled before real users. |
| Parent enrollment | Documented in pilot feature flag plan | manual_required | Blocks real parent/child data until RLS/legal pass. |
| Real child profiles | Real data admission rules exist | safe default should remain disabled until signoff | Blocks real child data. |
| Document uploads | Storage/signoff docs exist | manual_required | Blocks real sensitive documents until storage RLS verified. |
| Live payments | Provider mode/flag docs exist | safe default documented as disabled/manual/sandbox | Blocks live billing. |
| Invoices | Provider mode docs exist | safe default documented as disabled/manual/sandbox | Blocks production invoices. |
| External notifications | Email/SMS/WhatsApp/push mode docs exist | safe default documented as disabled/test/limited | Blocks production external sends. |
| Camera module | Camera policy and gateway docs exist | readiness/internal only by policy | Blocks live camera unless signed off. |
| Parent camera viewing | Camera lockdown docs and UI source show locked state | safe default disabled | Blocks parent viewing. |
| AI observer | AI policy docs exist | readiness/shadow only by policy | Blocks live AI. |
| AI parent summary | AI policy docs exist | safe default disabled | Blocks parent AI output. |
| Digital Observer live features | Separation docs exist | manual_required | Blocks cross-product live use until scoped. |

Final status: **PARTIAL_MANUAL_ENV_CONFIRMATION_REQUIRED**

The safe defaults are documented and partly represented in source/UI, but real deployed env values must be confirmed before any pilot using real users.

