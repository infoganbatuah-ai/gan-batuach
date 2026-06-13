import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

function alertLevel(expiresAt) {
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
  if (days < 0) return "expired";
  if (days <= 30) return "one_month";
  if (days <= 90) return "three_months";
  return "six_months";
}

function withinSixMonths(value) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time <= Date.now() + 183 * 86400000;
}

const [staffRes, gardensRes] = await Promise.all([
  supabase.from("staff").select("id,garden_id,full_name,police_sex_offender_clearance_expires_at,first_aid_certification_expires_at,safe_conduct_training_expires_at").limit(5000),
  supabase.from("gardens").select("id,name,fire_safety_permit_expires_at,home_front_command_readiness_expires_at,operating_permit_expires_at,camera_law_declaration_expires_at").limit(5000)
]);

if (staffRes.error) throw new Error(staffRes.error.message);
if (gardensRes.error) throw new Error(gardensRes.error.message);

const alerts = [];
for (const staff of staffRes.data ?? []) {
  [
    ["police_sex_offender_clearance", "אישור משטרה לפי חוק למניעת העסקת עברייני מין", staff.police_sex_offender_clearance_expires_at],
    ["first_aid_certification", "תעודת עזרה ראשונה", staff.first_aid_certification_expires_at],
    ["safe_conduct_training", "הכשרת התנהלות בטוחה", staff.safe_conduct_training_expires_at]
  ].forEach(([permitType, label, expiresAt]) => {
    if (!withinSixMonths(expiresAt)) return;
    alerts.push({
      alert_key: `staff:${staff.id}:${permitType}:${expiresAt}`,
      garden_id: staff.garden_id,
      staff_id: staff.id,
      permit_type: permitType,
      permit_label: `${label} · ${staff.full_name}`,
      expires_at: expiresAt,
      alert_level: alertLevel(expiresAt),
      status: "open",
      metadata: { source: "script_scan", entity_type: "staff" }
    });
  });
}

for (const garden of gardensRes.data ?? []) {
  [
    ["fire_safety", "אישור כבאות", garden.fire_safety_permit_expires_at],
    ["home_front_command", "מוכנות פיקוד העורף / ממ״ד", garden.home_front_command_readiness_expires_at],
    ["operating_permit", "רישיון / היתר הפעלה", garden.operating_permit_expires_at],
    ["camera_law_declaration", "הצהרת עמידה בחוק המצלמות", garden.camera_law_declaration_expires_at]
  ].forEach(([permitType, label, expiresAt]) => {
    if (!withinSixMonths(expiresAt)) return;
    alerts.push({
      alert_key: `garden:${garden.id}:${permitType}:${expiresAt}`,
      garden_id: garden.id,
      permit_type: permitType,
      permit_label: `${label} · ${garden.name}`,
      expires_at: expiresAt,
      alert_level: alertLevel(expiresAt),
      status: "open",
      metadata: { source: "script_scan", entity_type: "garden" }
    });
  });
}

if (alerts.length) {
  const { error } = await supabase.from("permit_expiry_alerts").upsert(alerts, { onConflict: "alert_key" });
  if (error) throw new Error(error.message);
}

console.log(JSON.stringify({ scanned: true, alerts_created: alerts.length }, null, 2));
