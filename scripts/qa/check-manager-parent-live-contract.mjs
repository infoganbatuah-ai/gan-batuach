import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const checks = [];

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function check(label, pass, evidence) {
  checks.push({ label, pass: Boolean(pass), evidence });
}

const managerApplication = read("app/api/garden/manager-application/route.ts");
const onboarding = read("app/api/kindergarten-onboarding/route.ts");
const legacyParent = read("app/api/garden/create-parent/route.ts");
const managerInvite = read("app/api/garden/parent-invitations/route.ts");
const parentInvite = read("app/api/parent/garden-invitations/route.ts");
const enrollment = read("lib/domain/enrollment-activation.ts");
const liveExperience = read("components/dashboard-live-experience.tsx");
const parentFamily = read("lib/domain/parent-family.ts");
const loginAction = read("app/login/actions.ts");
const authRouting = read("lib/auth.ts");

check("Manager registration has no admin approval gate", managerApplication.includes("admin_approval_required: false"), "manager application metadata");
check("Manager receives continuous onboarding access", managerApplication.includes('self_service_status: "profile_incomplete"') && managerApplication.includes("active: true"), "manager profile write");
check("Trial lasts 14 days", read("lib/domain/kindergarten-onboarding.ts").includes("ganBatuachTrialDays = 14"), "central trial constant");
check("Trial charges zero today", onboarding.includes("charge_today_nis: 0"), "subscription metadata");
check("Live payment remains manual/sandbox readiness", onboarding.includes('payment_mode: "manual_or_sandbox_until_provider_approval"'), "subscription metadata");
check("At least one age group is required", onboarding.includes("יש לבחור לפחות קבוצת גיל אחת"), "server-side activation validation");
check("Legacy direct parent creation is blocked", legacyParent.includes("parent_acceptance_required: true") && legacyParent.includes("replacement_endpoint"), "compatibility endpoint");
check("Manager invitation requires parent acceptance", managerInvite.includes("parent_acceptance_required: true"), "invitation metadata");
check("Parent can accept or reject only own invitation", parentInvite.includes('action: z.enum(["accept", "reject"])') && parentInvite.includes("invited_parent_profile_id: profile.id"), "parent invitation route");
check("Accepted child creates formal garden enrollment", enrollment.includes('from("child_kindergarten_enrollments"') && enrollment.includes('status: "active"'), "activation helper");
check("Accepted child creates an audit timeline event", enrollment.includes('event_type: "kindergarten_enrollment_activated"'), "activation helper");
check("Profile opens as an in-screen live drawer", liveExperience.includes("gb-live-profile-drawer") && liveExperience.includes("data-live-panel='profile'"), "dashboard runtime");
check("Known invalid parent fields remain removed", !parentFamily.includes("pickup_status") && !parentFamily.includes("children.kindergarten_id"), "parent family query");
check("Login routing reads profile identity and active state", loginAction.includes('select("id, role, garden_id, active")'), "login action");
check("Inspector routing uses assigned garden scope", authRouting.includes('.eq("inspector_id", profile.id)') && authRouting.includes('profile.active === false'), "role redirect helper");

for (const file of [
  "components/subscription-admin-manager.tsx",
  "components/kindergarten-application-admin-actions.tsx",
  "components/garden-child-create-panel.tsx",
  "components/garden-payout-configuration-form.tsx",
  "components/dashboard-error-state.tsx"
]) {
  check(`${file} avoids full-page reload`, !read(file).includes("window.location.reload") && !read(file).includes("window.location.href"), file);
}

for (const item of checks) {
  process.stdout.write(`${item.pass ? "PASS" : "FAIL"} | ${item.label} | ${item.evidence}\n`);
}

const failed = checks.filter((item) => !item.pass);
process.stdout.write(`SUMMARY | ${checks.length - failed.length}/${checks.length} checks passed\n`);
if (failed.length) process.exitCode = 1;
