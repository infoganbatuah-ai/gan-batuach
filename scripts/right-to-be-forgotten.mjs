import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const parentId = process.argv.find((arg) => arg.startsWith("--parent-id="))?.split("=")[1];
const execute = process.argv.includes("--execute");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!parentId) throw new Error("Usage: node scripts/right-to-be-forgotten.mjs --parent-id=<uuid> [--execute]");
if (!supabaseUrl || !serviceRoleKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const runKey = `rtbf:${parentId}:${crypto.randomUUID()}`;
const parentRes = await supabase.from("parents").select("id,garden_id,profile_id,user_id").eq("id", parentId).maybeSingle();
if (parentRes.error) throw new Error(parentRes.error.message);
if (!parentRes.data) throw new Error("Parent not found");

const childRes = await supabase.from("children").select("id").eq("primary_parent_id", parentId);
if (childRes.error) throw new Error(childRes.error.message);
const childIds = (childRes.data ?? []).map((child) => child.id);

await supabase.from("right_to_be_forgotten_runs").insert({
  run_key: runKey,
  garden_id: parentRes.data.garden_id,
  parent_profile_id: parentRes.data.profile_id ?? parentRes.data.user_id ?? null,
  parent_id: parentId,
  status: execute ? "running" : "planned",
  metadata: { dry_run: !execute, child_count: childIds.length }
});

const plan = {
  parent_id: parentId,
  child_ids: childIds,
  dry_run: !execute,
  actions: [
    "delete parent signature files from restricted-signatures bucket when storage path is available",
    "null parent PII fields",
    "null child medical and family PII fields",
    "delete or anonymize medical logs linked to children",
    "preserve non-identifiable telemetry and aggregate operational stats"
  ]
};

if (!execute) {
  console.log(JSON.stringify(plan, null, 2));
  process.exit(0);
}

if (childIds.length) {
  const signatures = await supabase
    .from("attendance_digital_signatures")
    .select("id,signature_image")
    .in("child_id", childIds);
  if (signatures.error) throw new Error(signatures.error.message);

  for (const signature of signatures.data ?? []) {
    const value = signature.signature_image;
    if (value && !String(value).startsWith("cbc.v1.")) {
      await supabase.storage.from("restricted-signatures").remove([value]);
    }
  }

  await supabase.from("attendance_digital_signatures").update({ signature_image: null, signature_hash: null, metadata: { erased_by_rtbf: true } }).in("child_id", childIds);
  await supabase.from("medicine_given_logs").delete().in("child_id", childIds);
  await supabase.from("child_health_records").delete().in("child_id", childIds);
  await supabase.from("children").update({
    identity_number: null,
    allergies: null,
    sensitivities: null,
    regular_medications: null,
    medical_notes: null,
    allergies_encrypted: null,
    medical_notes_encrypted: null,
    regular_medications_encrypted: null,
    mother_name: null,
    mother_identity_number: null,
    mother_phone: null,
    father_name: null,
    father_identity_number: null,
    father_phone: null,
    emergency_phone: null,
    parent_photo_url: null,
    pickup_authorized: [],
    medical_encryption_status: "erased"
  }).in("id", childIds);
}
await supabase.from("parents").update({
  full_name: "נמחק לבקשת פרטיות",
  identity_number: null,
  phone: "erased",
  email: null,
  address: null,
  status: "erased"
}).eq("id", parentId);
await supabase.from("right_to_be_forgotten_runs").update({
  status: "completed",
  pii_deleted: true,
  signatures_deleted: true,
  medical_history_deleted: true,
  anonymized_telemetry_preserved: true,
  executed_at: new Date().toISOString()
}).eq("run_key", runKey);

console.log(JSON.stringify({ ...plan, completed: true }, null, 2));
