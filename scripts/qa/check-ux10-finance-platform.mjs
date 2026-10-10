import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");
const [owner, ledger, parent, subscription, admin, frame, panel, child, gardenApi, parentApi, tuitionMigration, billing, css, shell] = await Promise.all([
  read("app/dashboard/garden/finance/page.tsx"), read("app/dashboard/garden/tuition-ledger/page.tsx"),
  read("app/dashboard/parent/payments/page.tsx"), read("app/dashboard/garden/subscription/page.tsx"),
  read("app/dashboard/admin/subscriptions/page.tsx"), read("components/finance-platform-frame.tsx"),
  read("components/tuition-ledger-panel.tsx"), read("app/dashboard/garden/children/[id]/page.tsx"),
  read("app/api/garden/tuition-ledger/route.ts"), read("app/api/parent/tuition-ledger/route.ts"),
  read("supabase/migrations/20260913194000_management_parent_tuition_ledger.sql"), read("lib/domain/billing.ts"),
  read("app/globals.css"), read("components/role-app-shell.tsx")
]);

test("Owner command center reads the canonical GB-M27 ledger", () => {
  assert.match(owner, /tuition_billing_periods/); assert.match(owner, /tuition_ledger_entries/);
  assert.match(owner, /projectTuitionPeriod/); assert.match(owner, /getManagementGardenContext/);
  assert.doesNotMatch(owner, /frontend.balance|localStorage|Math\.random/);
  assert.match(owner, /tuitionUnavailable \? "לא זמין"/);
  assert.match(parent, /financeUnavailable \? "לא זמין"/);
});

test("Parent tuition and Garden subscription are visibly and technically separate", () => {
  assert.match(frame, /שכר לימוד ומנוי — בשני מסלולים נפרדים/);
  assert.match(owner, /שכר לימוד עובר מהורה לגן/); assert.match(subscription, /הגן ← גן בטוח/);
  assert.match(parent, /הפרדה מלאה ממנוי הפלטפורמה/);
  assert.doesNotMatch(parent, /kindergarten_subscriptions|billing_invoices|subscription_payments/);
  assert.doesNotMatch(subscription, /tuition_billing_periods|tuition_ledger_entries/);
});

test("Partial, manual, adjustment, overpayment and reconciliation remain canonical", () => {
  for (const value of ["partially_paid", "manual_settlement", "adjustment", "unapplied_credit", "reconciliation_required"]) assert.match(tuitionMigration, new RegExp(value));
  assert.match(panel, /manual_settlement/); assert.match(panel, /idempotency_key/);
  assert.match(gardenApi, /apply_manual_tuition_entry/); assert.match(gardenApi, /provider_payment_confirmed: false/);
  assert.match(child, /tuition_ledger_entries/);
});

test("Parent access is child scoped and read only", () => {
  assert.match(parent, /guardianChildIds/); assert.match(parent, /authorizedChildIds\.includes/);
  assert.match(parentApi, /guardianCanAccessChild/); assert.match(parentApi, /provider_payment_available: false/);
  assert.doesNotMatch(parentApi, /export async function POST/);
});

test("Multi-Garden management uses the server validated active Garden", () => {
  for (const page of [owner, ledger, subscription]) { assert.match(page, /getManagementGardenContext/); assert.match(page, /access\.gardenId/); }
});

test("Provider and tax-document truth are explicit", () => {
  assert.match(subscription, /providerReady = false/); assert.match(subscription, /אין Checkout, חיוב חוזר או הצלחה מדומה/);
  assert.match(parent, /אין מספרי קבלה או חשבונית מומצאים/); assert.match(gardenApi, /provider_payment_confirmed: false/);
  assert.match(billing, /FutureProviderAdapter/); assert.match(billing, /status: "manual"/);
});

test("Admin subscription view does not expose Parent tuition", () => {
  assert.match(admin, /לא מוצגים כאן יתרות של ילדים/); assert.match(admin, /SubscriptionAdminManager/);
  assert.doesNotMatch(admin, /tuition_billing_periods|tuition_ledger_entries|child_guardian_links/);
});

test("Finance visual layer is purpose built for desktop, mobile, RTL and accessibility", () => {
  for (const selector of ["finance-hero", "finance-metrics", "finance-ledger-row", "finance-child-switcher", "finance-subscription-card", "finance-provider-state"]) assert.match(css, new RegExp(`\\.${selector}`));
  assert.match(css, /@media\(max-width:760px\)/); assert.match(css, /direction:rtl/);
  assert.match(css, /prefers-reduced-motion/); assert.match(css, /focus-visible/);
  assert.match(shell, /שכר לימוד ומנוי הגן/);
});
