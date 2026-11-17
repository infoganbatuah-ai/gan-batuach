# Admin attendance-compliance heading hierarchy

Source Development: `456d9e35f091523742eb2692c93fdcbe841031d2`.

A settled, authenticated synthetic Admin browser read of `/dashboard/admin/attendance-compliance` showed one visible `main` but two visible `h1` elements: the DashboardShell workspace title and the PremiumDashboardHero title. A first early-DOM probe had observed the temporary loading state and was discarded. The settled probe had zero browser page errors.

This change lets the existing hero render a semantic `h2` on this route while preserving its default `h1` on other routes. All six existing hero title CSS selectors style either level identically, so the visual composition should remain unchanged. There is no data, RLS, role, provider, migration, Digital Observer core, payment or Production change. No new dependency or fixed monthly cost.

Required validation after commit: typecheck, scoped lint, build, six exact-head CI gates and a fresh settled Desktop/Mobile Admin/denied-role DOM check on merged Development. A source diff or HTTP 200 alone is not proof of the browser accessibility result. The restricted pre-fix Product note is `exports/restricted/gb-admin-attendance-compliance-smoke-20261115/RESULT.md` (SHA256 `b8048614a640da62447acfc7c1a7b5147167cdea2e6b916b12f619608ad3d484`). External owner visual acceptance, full Product/security, all-in cost and Production release remain separate.
