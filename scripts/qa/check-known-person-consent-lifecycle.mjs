import { readFileSync } from "node:fs";

const route = readFileSync("app/api/digital-observer/known-people/route.ts", "utf8");
const migration = readFileSync("supabase/migrations/20260829020000_digital_observer_known_person_consent_audit.sql", "utf8");

for (const required of [
  'action: z.literal("revoke_consent")',
  'consent_status: "revoked"',
  'recognition_status: "disabled"',
  "image_storage_path: null",
  "biometric_reference: null",
  'eventType: "consent_revoked"',
  'eventType: "biometric_reference_deleted"',
  "biometric_processing_active: false",
  "camera_source_ids: z.array(z.string().uuid()).min(1)",
  '.eq("observer_site_id", site.id)',
  "camera_scope: cameraSourceIds",
  "camera_scope_confirmed: true"
]) {
  if (!route.includes(required)) throw new Error(`Missing known-person consent safety control: ${required}`);
}

const form = readFileSync("components/digital-observer/observer-action-forms.tsx", "utf8");
for (const required of [
  "camera_source_ids",
  "מצלמות מורשות לתצפיות על האדם",
  "יש בידי הסכמה מפורשת של האדם להגדרה זו ולמצלמות שנבחרו"
]) {
  if (!form.includes(required)) throw new Error(`Missing known-person camera scope UI: ${required}`);
}

for (const required of ["consent_recorded", "consent_revoked", "biometric_reference_deleted"]) {
  if (!migration.includes(required)) throw new Error(`Missing consent audit migration event: ${required}`);
}

console.log("Known-person consent lifecycle QA PASS");
