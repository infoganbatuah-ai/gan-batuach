import crypto from "node:crypto";

type SupabaseLike = {
  from: (table: string) => any;
};

function alertLevel(expiresAt: string) {
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  if (days < 0) return "expired";
  if (days <= 30) return "one_month";
  if (days <= 90) return "three_months";
  return "six_months";
}

function withinSixMonths(value?: string | null) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time <= Date.now() + 183 * 24 * 60 * 60 * 1000;
}

function key(parts: Array<string | null | undefined>) {
  return crypto.createHash("sha256").update(parts.filter(Boolean).join(":")).digest("hex").slice(0, 24);
}

export async function scanPermitExpirations(supabase: SupabaseLike) {
  const [staffRes, gardensRes] = await Promise.all([
    supabase
      .from("staff")
      .select("id,garden_id,full_name,police_sex_offender_clearance_expires_at,first_aid_certification_expires_at,safe_conduct_training_expires_at")
      .limit(5000),
    supabase
      .from("gardens")
      .select("id,name,fire_safety_permit_expires_at,home_front_command_readiness_expires_at,operating_permit_expires_at,camera_law_declaration_expires_at")
      .limit(5000)
  ]);
  if (staffRes.error) throw new Error(staffRes.error.message);
  if (gardensRes.error) throw new Error(gardensRes.error.message);

  const alerts: Array<Record<string, unknown>> = [];
  for (const row of staffRes.data ?? []) {
    const staff = row as any;
    [
      ["police_sex_offender_clearance", "אישור משטרה לפי חוק למניעת העסקת עברייני מין", staff.police_sex_offender_clearance_expires_at],
      ["first_aid_certification", "תעודת עזרה ראשונה", staff.first_aid_certification_expires_at],
      ["safe_conduct_training", "הכשרת התנהלות בטוחה", staff.safe_conduct_training_expires_at]
    ].forEach(([permitType, label, expiresAt]) => {
      if (!withinSixMonths(String(expiresAt ?? ""))) return;
      alerts.push({
        alert_key: `staff:${staff.id}:${permitType}:${key([staff.id, permitType, expiresAt])}`,
        garden_id: staff.garden_id,
        staff_id: staff.id,
        permit_type: permitType,
        permit_label: `${label} · ${staff.full_name}`,
        expires_at: expiresAt,
        alert_level: alertLevel(String(expiresAt)),
        status: "open",
        metadata: { source: "permit_expiry_scan", entity_type: "staff" }
      });
    });
  }

  for (const row of gardensRes.data ?? []) {
    const garden = row as any;
    [
      ["fire_safety", "אישור כבאות", garden.fire_safety_permit_expires_at],
      ["home_front_command", "מוכנות פיקוד העורף / ממ״ד", garden.home_front_command_readiness_expires_at],
      ["operating_permit", "רישיון / היתר הפעלה", garden.operating_permit_expires_at],
      ["camera_law_declaration", "הצהרת עמידה בחוק המצלמות", garden.camera_law_declaration_expires_at]
    ].forEach(([permitType, label, expiresAt]) => {
      if (!withinSixMonths(String(expiresAt ?? ""))) return;
      alerts.push({
        alert_key: `garden:${garden.id}:${permitType}:${key([garden.id, permitType, expiresAt])}`,
        garden_id: garden.id,
        permit_type: permitType,
        permit_label: `${label} · ${garden.name}`,
        expires_at: expiresAt,
        alert_level: alertLevel(String(expiresAt)),
        status: "open",
        metadata: { source: "permit_expiry_scan", entity_type: "garden" }
      });
    });
  }

  if (!alerts.length) return { scanned: true, alerts_created: 0, alerts: [] };
  const insertRes = await supabase
    .from("permit_expiry_alerts")
    .upsert(alerts, { onConflict: "alert_key" })
    .select("id,alert_key,garden_id,permit_label,expires_at,alert_level,status");
  if (insertRes.error) throw new Error(insertRes.error.message);

  const notifications = (insertRes.data ?? []).map((alert: any) => ({
    garden_id: alert.garden_id ?? null,
    recipient_role: "admin",
    title: "אישור חובה עומד לפוג",
    body: `${alert.permit_label} · תוקף ${new Date(alert.expires_at).toLocaleDateString("he-IL")}`,
    entity_type: "permit_expiry_alert",
    entity_id: alert.id,
    severity: alert.alert_level === "expired" ? "critical" : "high",
    status: "pending",
    metadata: { alert_key: alert.alert_key, iso_evidence: true }
  }));
  const notifyRes = await supabase.from("notifications").insert(notifications);
  if (notifyRes.error) console.error("[permit-expiry] notification insert failed", notifyRes.error.message);
  await supabase
    .from("permit_expiry_alerts")
    .update({ pushed_to_admin: true, status: "notified" })
    .in("id", (insertRes.data ?? []).map((alert: any) => alert.id));
  return { scanned: true, alerts_created: insertRes.data?.length ?? 0, alerts: insertRes.data ?? [] };
}
