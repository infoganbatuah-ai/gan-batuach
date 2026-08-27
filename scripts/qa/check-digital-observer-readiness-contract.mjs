import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const files = [
  "lib/domain/digital-observer/provider-readiness.ts",
  "app/digital-observer/readiness/page.tsx",
  "app/digital-observer/alerts/page.tsx",
  "app/digital-observer/settings/page.tsx",
  "app/digital-observer/billing/page.tsx"
];

const text = files.map((file) => readFileSync(resolve(process.cwd(), file), "utf8")).join("\n");

const assertions = [
  ["AI live analysis is off", /liveAnalysisEnabled:\s*false/.test(text)],
  ["AI live media is blocked", /acceptsLiveMedia:\s*false/.test(text) && /live_camera_stream/.test(text)],
  ["Alert channels include Push SMS WhatsApp and voice", /key:\s*"push"/.test(text) && /key:\s*"sms"/.test(text) && /key:\s*"whatsapp"/.test(text) && /key:\s*"voice"/.test(text)],
  ["Live billing is off", /liveBillingEnabled:\s*false/.test(text) && /collectPaymentMethodEnabled:\s*false/.test(text)],
  ["Emergency services auto dialing is blocked", /automaticEmergencyAuthorityCallsEnabled:\s*false/.test(text) && /emergencyServicesDialingAllowed:\s*false/.test(text)],
  ["Human confirmation and false alarm handling are required", /humanConfirmationRequired:\s*true/.test(text) && /falseAlarmFlowRequired:\s*true/.test(text)],
  ["No provider-specific implementation is hard-coded", !/twilio|stripe|cardcom|tranzila|pelecard|meshulam/i.test(text)]
];

let failed = 0;
for (const [name, pass] of assertions) {
  process.stdout.write(`${pass ? "PASS" : "FAIL"} | ${name}\n`);
  if (!pass) failed += 1;
}

process.stdout.write(`SUMMARY | ${assertions.length - failed}/${assertions.length}\n`);
if (failed) process.exitCode = 1;
