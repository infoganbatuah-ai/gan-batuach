import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const CONFIRMATION = "I_UNDERSTAND_SYNTHETIC_REFERENCE_DATA_ONLY";
const SAFE_ENVIRONMENTS = new Set(["local", "demo", "staging", "pilot"]);
const REPORT_PATH = "qa-evidence/digital-observer-reference-data/SEED_REPORT.md";

for (const envFile of [".env.qa-demo.local", ".env.local", ".env"]) {
  const envPath = resolve(process.cwd(), envFile);
  if (!existsSync(envPath)) continue;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

function fail(message) { throw new Error(message); }
if (process.env.QA_DEMO_REFERENCE_SEED_CONFIRM !== CONFIRMATION) fail(`Set QA_DEMO_REFERENCE_SEED_CONFIRM=${CONFIRMATION} before running.`);
const environment = String(process.env.QA_DEMO_ENVIRONMENT ?? "").toLowerCase();
if (!SAFE_ENVIRONMENTS.has(environment) || environment === "production" || process.env.VERCEL_ENV === "production") fail("Refusing to seed outside a local/demo/staging/pilot environment.");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !publishableKey) fail("The regular Supabase browser configuration is required.");

const accountSpecs = [
  {
    mode: "home",
    email: process.env.QA_DEMO_DIGITAL_OBSERVER_HOME_EMAIL || "qa.digital.observer.home@demo.ganbatuach.com",
    password: process.env.QA_DEMO_DIGITAL_OBSERVER_HOME_PASSWORD || process.env.QA_DEMO_DIGITAL_OBSERVER_PASSWORD,
    cameras: [
      ["home-entry", "כניסה ראשית", "כניסה", "home-entry"],
      ["home-living", "סלון", "חלל מרכזי", "home-living"],
      ["home-nursery", "חדר תינוק", "קומה עליונה", "home-nursery"],
      ["home-yard", "חצר אחורית", "חצר", "home-yard"]
    ],
    events: [
      ["home-person", "person_detected", "medium", 0.91, "בדיקה אנושית: זוהה אדם בכניסה", "home-entry"],
      ["home-animal", "animal_detected", "low", 0.88, "זוהתה תנועה של בעל חיים בחצר", "home-yard"],
      ["home-room", "room_entry", "info", 0.86, "זוהתה כניסה לחדר התינוק", "home-nursery"],
      ["home-hours", "motion_after_hours", "medium", 0.84, "נדרשת בדיקה של תנועה בשעות השקטות", "home-living"]
    ],
    people: [["home-person-1", "דניאל", "בן משפחה"], ["home-person-2", "מיכל", "בת משפחה"], ["home-person-3", "יואב", "בן משפחה"]],
    recipients: []
  },
  {
    mode: "business",
    email: process.env.QA_DEMO_DIGITAL_OBSERVER_BUSINESS_EMAIL || process.env.QA_DEMO_DIGITAL_OBSERVER_EMAIL || "qa.digital.observer@demo.ganbatuach.com",
    password: process.env.QA_DEMO_DIGITAL_OBSERVER_BUSINESS_PASSWORD || process.env.QA_DEMO_DIGITAL_OBSERVER_PASSWORD,
    cameras: [
      ["business-entry", "כניסה ראשית", "חזית העסק", "business-entry"],
      ["business-store", "חנות ראשית", "אולם מכירה", "business-store"],
      ["business-warehouse", "מחסן", "אזור תפעולי", "business-warehouse"],
      ["business-office", "משרד אחורי", "משרדים", "business-office"],
      ["business-parking", "חניה אחורית", "חניה", "business-parking"],
      ["business-loading", "אזור פריקה", "כניסת ספקים", "business-loading"]
    ],
    events: [
      ["business-unknown", "unknown_person_detected", "high", 0.89, "אדם לא מוכר דורש בדיקה אנושית", "business-entry"],
      ["business-restricted", "restricted_area", "medium", 0.87, "תנועה באזור מוגבל דורשת בדיקה", "business-warehouse"],
      ["business-hours", "motion_after_hours", "medium", 0.84, "פעילות מחוץ לשעות הפעילות", "business-store"],
      ["business-vehicle", "vehicle_entered", "info", 0.92, "רכב נכנס לאזור הפריקה", "business-loading"]
    ],
    people: [["business-person-1", "מנהל סניף", "מנהל"], ["business-person-2", "אחראית משמרת", "צוות"], ["business-person-3", "ספק מורשה", "ספק"]],
    recipients: [["business-recipient-owner", "מנהל העסק", "בעלים"], ["business-recipient-branch", "מנהל סניף", "ניהול מקומי"], ["business-recipient-security", "צוות אבטחה", "מורשה עדכונים"]]
  }
];

async function listExisting(client, table, siteId) {
  const { data, error } = await client.from(table).select("id,metadata").eq("observer_site_id", siteId);
  if (error) throw error;
  return data ?? [];
}

function seeded(existing, key) {
  return existing.some((item) => item.metadata?.reference_seed_key === key);
}

const results = [];
for (const account of accountSpecs) {
  if (!account.password) { results.push({ mode: account.mode, status: "BLOCKED_MISSING_LOCAL_CREDENTIAL", sites: 0, cameras: 0, events: 0, people: 0, recipients: 0, clips: 0, candidates: 0 }); continue; }
  const client = createClient(supabaseUrl, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: login, error: loginError } = await client.auth.signInWithPassword({ email: account.email, password: account.password });
  if (loginError || !login.user) { results.push({ mode: account.mode, status: "BLOCKED_QA_LOGIN_FAILED", sites: 0, cameras: 0, events: 0, people: 0, recipients: 0, clips: 0, candidates: 0 }); continue; }
  const { data: sites, error: sitesError } = await client.from("observer_sites").select("id,name,site_type,business_handles_children,vision_privacy_mode").eq("owner_profile_id", login.user.id).eq("site_type", account.mode);
  if (sitesError) throw sitesError;
  const counters = { cameras: 0, events: 0, people: 0, recipients: 0, clips: 0, candidates: 0 };
  for (const site of sites ?? []) {
    const { data: cameraRows, error: cameraReadError } = await client.from("digital_observer_camera_sources").select("id,display_name,metadata").eq("observer_site_id", site.id);
    if (cameraReadError) throw cameraReadError;
    for (const [key, displayName, location, scene] of account.cameras) {
      if ((cameraRows ?? []).some((item) => item.metadata?.reference_seed_key === key || item.display_name === displayName)) continue;
      const { error } = await client.from("digital_observer_camera_sources").insert({ observer_site_id: site.id, display_name: displayName, location_label: location, connector_type: "demo", connector_provider: "synthetic_qa", source_mode: "demo", status: "ready_to_test", health_status: "healthy", preview_scene: scene, capabilities: { preview: true, live_view: false, synthetic: true }, monitoring_targets: ["person", "entry_exit"], last_health_check_at: new Date().toISOString(), last_seen_at: new Date().toISOString(), created_by: login.user.id, metadata: { reference_seed_key: key, qa_demo: true, synthetic: true, no_real_camera: true, no_live_claim: true } });
      if (error) throw error;
      counters.cameras += 1;
    }

    const { data: currentCameras, error: currentCamerasError } = await client.from("digital_observer_camera_sources").select("id,preview_scene,metadata").eq("observer_site_id", site.id);
    if (currentCamerasError) throw currentCamerasError;
    const cameraBySeedKey = new Map((currentCameras ?? []).map((camera) => [camera.metadata?.reference_seed_key, camera]));
    const { data: eventRows, error: eventRowsError } = await client.from("observer_intelligence_signals").select("id,metadata").eq("observer_site_id", site.id);
    if (eventRowsError) throw eventRowsError;
    for (const [key, eventType, severity, confidence, action, cameraKey] of account.events) {
      const camera = cameraBySeedKey.get(cameraKey);
      const metadata = { reference_seed_key: key, event_type: eventType, camera_source_id: camera?.id ?? null, preview_scene: camera?.preview_scene ?? cameraKey, qa_demo: true, synthetic: true, no_real_ai: true };
      const existing = (eventRows ?? []).find((item) => item.metadata?.reference_seed_key === key);
      if (existing) {
        if (existing.metadata?.camera_source_id !== metadata.camera_source_id || existing.metadata?.preview_scene !== metadata.preview_scene) {
          const { error } = await client.from("observer_intelligence_signals").update({ metadata: { ...existing.metadata, ...metadata } }).eq("id", existing.id);
          if (error) throw error;
        }
        continue;
      }
      const { error } = await client.from("observer_intelligence_signals").insert({ signal_type: "ai_camera", source_type: "system", observer_site_id: site.id, severity, confidence, review_status: "needs_review", recommended_action: action, risk_score: severity === "high" ? 68 : severity === "medium" ? 42 : 18, human_review_required: true, parent_visible: false, metadata });
      if (error) throw error;
      counters.events += 1;
    }

    const peopleRows = await listExisting(client, "digital_observer_known_people", site.id);
    for (const [key, name, relationship] of account.people) {
      if (seeded(peopleRows, key)) continue;
      const { error } = await client.from("digital_observer_known_people").insert({ observer_site_id: site.id, display_name: name, relationship_label: relationship, consent_status: "approved", recognition_status: "readiness", notify_on_detection: false, created_by: login.user.id, metadata: { reference_seed_key: key, qa_demo: true, synthetic: true, no_biometric_data: true } });
      if (error) throw error;
      counters.people += 1;
    }

    const recipientRows = await listExisting(client, "digital_observer_authorized_recipients", site.id);
    for (const [key, name, relationship] of account.recipients) {
      if (seeded(recipientRows, key)) continue;
      const { error } = await client.from("digital_observer_authorized_recipients").insert({ observer_site_id: site.id, display_name: name, relationship_label: relationship, channels: ["in_app"], destination_hint: "פרטי קשר סינתטיים אינם נשמרים", receives_critical_alerts: false, active: true, created_by: login.user.id, metadata: { reference_seed_key: key, qa_demo: true, synthetic: true, no_real_contact: true, no_external_delivery: true } });
      if (error) throw error;
      counters.recipients += 1;
    }

    const { data: cameras, error: camerasError } = await client.from("digital_observer_camera_sources").select("id,display_name,metadata").eq("observer_site_id", site.id).order("created_at");
    if (camerasError) throw camerasError;
    // Event clips and identity candidates are ingestion outputs. Their tables intentionally
    // remain read-only to ordinary users, so this script never broadens those permissions.
    void cameras;
  }
  await client.auth.signOut();
  results.push({ mode: account.mode, status: (sites ?? []).length ? "SEEDED_OR_ALREADY_READY" : "BLOCKED_MISSING_SITE", sites: (sites ?? []).length, ...counters });
}

mkdirSync(dirname(resolve(process.cwd(), REPORT_PATH)), { recursive: true });
const report = ["# Digital Observer synthetic reference data seed", "", `Generated: ${new Date().toISOString()}`, `Environment: ${environment}`, "Credentials printed: no", "Real camera/media/AI/provider data created: no", "", "| Mode | Status | Sites | Cameras added | Events added | People added | Recipients added | Clips added | Candidates added |", "|---|---|---:|---:|---:|---:|---:|---:|---:|", ...results.map((item) => `| ${item.mode} | ${item.status} | ${item.sites} | ${item.cameras} | ${item.events} | ${item.people} | ${item.recipients} | ${item.clips} | ${item.candidates} |`), ""];
writeFileSync(resolve(process.cwd(), REPORT_PATH), report.join("\n"), "utf8");
process.stdout.write(`Synthetic reference seed finished for ${results.length} isolated QA accounts. No credentials or live provider data were printed.\n`);
