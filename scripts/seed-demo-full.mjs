import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

for (const envFile of [".env.local", ".env"]) {
  const envPath = resolve(process.cwd(), envFile);
  if (!existsSync(envPath)) continue;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for seed:demo-full");
if (supabaseUrl.includes("sample.supabase.co") || serviceRoleKey.includes("replace-with")) throw new Error("Set real Supabase credentials before seeding demo data");

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const now = new Date();
const day = 24 * 60 * 60 * 1000;
const iso = (offsetDays = 0) => new Date(now.getTime() + offsetDays * day).toISOString();
const date = (offsetDays = 0) => iso(offsetDays).slice(0, 10);
const avatar = (name) => `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=dae8ff,c8f7e2,fff1d6&fontFamily=Arial`;
const photo = (seed) => `https://images.unsplash.com/photo-${seed}?auto=format&fit=crop&w=900&q=80`;
const demoDomain = "demo.ganbatuach.com";
const DEMO_PREFIX = "[DEMO]";
const demoBatchId = process.env.DEMO_BATCH_ID || `demo-full-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const demoName = (name) => name.startsWith(DEMO_PREFIX) ? name : `${DEMO_PREFIX} ${name}`;
const demoRow = (row) => ({ ...row, is_demo: true, demo_batch_id: demoBatchId });
const demoRows = (rows) => rows.map(demoRow);
const withDemoFilter = (query) => process.env.DEMO_BATCH_ID ? query.eq("demo_batch_id", process.env.DEMO_BATCH_ID) : query.eq("is_demo", true);

const users = [
  ["admin-demo@demo.ganbatuach.com", "AdminDemo123!", "admin", "אדמין הדגמה גן בטוח", "050-7000001"],
  ["inspector.yael@demo.ganbatuach.com", "InspectorDemo123!", "inspector", "יעל בן דוד", "050-7000011"],
  ["inspector.ronen@demo.ganbatuach.com", "InspectorDemo123!", "inspector", "רונן מזרחי", "050-7000012"],
  ["manager.rakefet@demo.ganbatuach.com", "ManagerDemo123!", "manager", "רקפת כהן", "050-7100001"],
  ["owner.rakefet@demo.ganbatuach.com", "OwnerDemo123!", "owner", "אמיר כהן", "050-7100002"],
  ["manager.oranim@demo.ganbatuach.com", "ManagerDemo123!", "manager", "מיכל לוי", "050-7200001"],
  ["owner.oranim@demo.ganbatuach.com", "OwnerDemo123!", "owner", "דנה לוי", "050-7200002"],
  ["manager.shaked@demo.ganbatuach.com", "ManagerDemo123!", "manager", "שקד אברהמי", "050-7300001"],
  ["manager.tamar@demo.ganbatuach.com", "ManagerDemo123!", "manager", "תמר ישראלי", "050-7400001"],
  ["manager.yam@demo.ganbatuach.com", "ManagerDemo123!", "manager", "ים בן עמי", "050-7500001"],
  ["staff.1@demo.ganbatuach.com", "StaffDemo123!", "staff", "נועה פרץ", "050-7111001"],
  ["staff.2@demo.ganbatuach.com", "StaffDemo123!", "staff", "ליאת אזולאי", "050-7111002"],
  ["staff.3@demo.ganbatuach.com", "StaffDemo123!", "staff", "מעיין דגן", "050-7211001"],
  ["staff.4@demo.ganbatuach.com", "StaffDemo123!", "staff", "סיון ברק", "050-7211002"],
  ["staff.5@demo.ganbatuach.com", "StaffDemo123!", "staff", "אורית סלע", "050-7311001"],
  ["staff.6@demo.ganbatuach.com", "StaffDemo123!", "staff", "גלי נחום", "050-7411001"],
  ["parent.1@demo.ganbatuach.com", "ParentDemo123!", "parent", "אפרת רוזן", "050-7122001"],
  ["parent.2@demo.ganbatuach.com", "ParentDemo123!", "parent", "יניב רוזן", "050-7122002"],
  ["parent.3@demo.ganbatuach.com", "ParentDemo123!", "parent", "מאיה אלון", "050-7222001"],
  ["parent.4@demo.ganbatuach.com", "ParentDemo123!", "parent", "ערן אלון", "050-7222002"],
  ["parent.5@demo.ganbatuach.com", "ParentDemo123!", "parent", "שירה גולד", "050-7322001"],
  ["parent.6@demo.ganbatuach.com", "ParentDemo123!", "parent", "איתי גולד", "050-7422001"]
];

const gardens = [
  { key: "rakefet", name: "גן רקפת הקטנה", city: "רמת גן", address: "רחוב שדרות הילד 18", gps_lat: 32.084, gps_lng: 34.812, ages: ["שנה-3", "3-4"], capacity: 34, score: 9.2, safe: "safe", manager: "manager.rakefet@demo.ganbatuach.com", owner: "owner.rakefet@demo.ganbatuach.com", inspector: "inspector.yael@demo.ganbatuach.com", status: "active", next: 9, rating: 4.8 },
  { key: "oranim", name: "גן אורנים הירוק", city: "כפר סבא", address: "רחוב האורן 7", gps_lat: 32.178, gps_lng: 34.907, ages: ["תינוקייה", "פעוטות", "מעורב"], capacity: 42, score: 7.4, safe: "requires_fix", manager: "manager.oranim@demo.ganbatuach.com", owner: "owner.oranim@demo.ganbatuach.com", inspector: "inspector.yael@demo.ganbatuach.com", status: "active", next: 3, rating: 4.3 },
  { key: "shaked", name: "גן שקד וחברים", city: "ראשון לציון", address: "רחוב הכרמים 22", gps_lat: 31.973, gps_lng: 34.792, ages: ["3-4", "4-5"], capacity: 28, score: 8.7, safe: "safe", manager: "manager.shaked@demo.ganbatuach.com", inspector: "inspector.ronen@demo.ganbatuach.com", status: "active", next: 16, rating: 4.6 },
  { key: "tamar", name: "גן תמרים", city: "מודיעין", address: "עמק החולה 12", gps_lat: 31.899, gps_lng: 35.01, ages: ["שנה-3"], capacity: 24, score: null, safe: "pending_review", manager: "manager.tamar@demo.ganbatuach.com", inspector: "inspector.ronen@demo.ganbatuach.com", status: "active", next: 4, pendingFirst: true, rating: 4.1 },
  { key: "yam", name: "גן ים של ילדים", city: "נתניה", address: "רחוב הרצל 41", gps_lat: 32.321, gps_lng: 34.853, ages: ["מעורב", "4-5"], capacity: 30, score: 5.8, safe: "not_compliant", manager: "manager.yam@demo.ganbatuach.com", inspector: "inspector.ronen@demo.ganbatuach.com", status: "active", next: -6, late: true, rating: 3.7 }
];

const questions = [
  ["רישוי ומסמכים", "האם כל מסמכי הרישוי, הביטוח והבטיחות קיימים ובתוקף?", true, 1.3, false, true],
  ["בטיחות ילדים", "האם אזורי המשחק והכיתה נקיים ממפגעים מיידיים?", true, 1.5, true, true],
  ["יחס צוות-ילדים", "האם יחס אנשי הצוות למספר הילדים עומד בסטנדרט שהוגדר?", true, 1.4, true, false],
  ["מטבח ותזונה", "האם תפריט היום, הפרדת אלרגנים וניקיון המטבח מתועדים?", true, 1.1, false, true],
  ["בריאות", "האם קיימים כרטיסי בריאות, אלרגיות ואישורי תרופות מעודכנים?", true, 1.2, true, false],
  ["חירום ועזרה ראשונה", "האם ציוד חירום, ערכות עזרה ראשונה ונהלי פינוי מוכנים?", true, 1.3, true, true],
  ["איסוף ילדים", "האם מורשי האיסוף נבדקים ונרשמים במערכת?", true, 1, false, false],
  ["מצלמות ופרטיות", "האם מצלמות מוגדרות ללא חשיפת DVR ישיר והצפייה מתועדת?", true, 1, true, false],
  ["תקשורת הורים", "האם פניות הורים מקבלות מענה ותיעוד בזמן?", true, 0.9, false, false],
  ["תפעול יומי", "האם יומן יומי, נוכחות ומשימות בוקר מבוצעים באופן עקבי?", true, 1, false, false]
];

async function findUser(email) {
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (data.users.length < 1000) return null;
    page += 1;
  }
}

async function upsertUser([email, password, role, full_name, phone]) {
  const existing = await findUser(email);
  const attributes = { email, password, email_confirm: true, app_metadata: { role, is_demo: true, demo_batch_id: demoBatchId }, user_metadata: { full_name: demoName(full_name) } };
  const { data, error } = existing
    ? await supabase.auth.admin.updateUserById(existing.id, attributes)
    : await supabase.auth.admin.createUser(attributes);
  if (error) throw error;
  const user = data.user;
  const { error: profileError } = await supabase.from("profiles").upsert(demoRow({
    id: user.id, role, full_name: demoName(full_name), phone, username: email, email, active: true, must_change_password: false, profile_image_url: avatar(full_name)
  }), { onConflict: "id" });
  if (profileError) throw profileError;
  if (role !== "parent") {
    await supabase.from("generated_credentials").delete().eq("user_id", user.id);
    await supabase.from("generated_credentials").insert(demoRow({ user_id: user.id, username: email, temporary_password: password, created_by: user.id }));
  }
  return user.id;
}

async function resetDemoData() {
  const { data: demoProfiles } = await withDemoFilter(supabase.from("profiles").select("id"));
  const demoUserIds = (demoProfiles ?? []).map((profile) => profile.id);
  const tables = ["parent_camera_permissions", "stream_health_checks", "video_gateway_connections", "ai_events", "camera_streams", "inspection_signatures", "inspection_answers", "violations", "inspections", "required_inspections", "late_inspections", "child_daily_journals", "child_health_records", "medicine_given_logs", "pickup_confirmations", "attendance", "incident_reports", "complaints", "messages", "notifications", "documents", "tasks", "staff_certificates", "staff_shifts", "gallery_items", "schedule_items", "medical_events", "staff", "parents", "children", "leads", "policy_acceptances", "inspection_form_questions", "inspection_forms", "generated_credentials", "inspectors", "gardens", "audit_logs"];
  for (const table of tables) {
    await withDemoFilter(supabase.from(table).delete());
  }
  for (const userId of demoUserIds) await supabase.auth.admin.deleteUser(userId);
}

async function seed() {
  await resetDemoData();
  const ids = Object.fromEntries(await Promise.all(users.map(async (user) => [user[0], await upsertUser(user)])));
  await supabase.from("inspectors").upsert(demoRows([
    { id: ids["inspector.yael@demo.ganbatuach.com"], service_cities: ["רמת גן", "כפר סבא"], certification_notes: "הכשרת פיקוח גן בטוח, עזרה ראשונה ובטיחות חצר" },
    { id: ids["inspector.ronen@demo.ganbatuach.com"], service_cities: ["ראשון לציון", "מודיעין", "נתניה"], certification_notes: "פיקוח תפעולי, מסמכים, מצלמות ונהלי חירום" }
  ]), { onConflict: "id" });

  const gardenRows = demoRows(gardens.map((garden) => ({
    name: demoName(garden.name),
    city: garden.city,
    address: garden.address,
    gps_lat: garden.gps_lat,
    gps_lng: garden.gps_lng,
    framework_type: "mixed",
    ages: garden.ages,
    children_capacity: garden.capacity,
    current_children_count: garden.key === "tamar" ? 0 : garden.key === "yam" ? 4 : garden.key === "shaked" ? 5 : garden.key === "oranim" ? 6 : 5,
    staff_count: garden.key === "rakefet" || garden.key === "oranim" ? 2 : 1,
    owner_name: demoName(garden.owner ? users.find((user) => user[0] === garden.owner)?.[3] : users.find((user) => user[0] === garden.manager)?.[3]),
    phone: users.find((user) => user[0] === garden.manager)?.[4],
    email: garden.manager,
    manager_id: ids[garden.manager],
    owner_profile_id: garden.owner ? ids[garden.owner] : null,
    ownership_type: garden.owner ? "separate_owner" : "teacher_only",
    owner_role_label: garden.owner ? "בעלים נפרד" : "מנהלת/גננת",
    inspector_id: ids[garden.inspector],
    status: garden.status,
    safe_status: garden.safe,
    eligible_for_safe_status: garden.safe === "safe",
    public_profile_enabled: true,
    logo_url: avatar(garden.name),
    image_url: photo(garden.key === "rakefet" ? "1503454537195-1dcabb73ffb9" : garden.key === "oranim" ? "1544776193-352d25ca82cd" : "1596464716127-f2a82984de30"),
    rating: garden.rating,
    last_inspection_score: garden.score,
    last_inspection_at: garden.score ? iso(garden.late ? -36 : -21) : null,
    next_inspection_at: iso(garden.next),
    first_inspection_due_at: garden.pendingFirst ? iso(4) : iso(-25),
    first_inspection_grace_until: garden.pendingFirst ? iso(5) : iso(-24),
    inspection_required_status: garden.pendingFirst ? "pending_first_inspection" : garden.late ? "late" : "scheduled"
  })));
  const { data: insertedGardens, error: gardenError } = await supabase.from("gardens").insert(gardenRows).select("*");
  if (gardenError) throw gardenError;
  const gardenByKey = Object.fromEntries(gardens.map((garden, index) => [garden.key, insertedGardens[index]]));

  for (const garden of gardens) {
    await supabase.from("profiles").update({ garden_id: gardenByKey[garden.key].id }).in("id", [ids[garden.manager], ...(garden.owner ? [ids[garden.owner]] : [])]);
  }

  const { data: form, error: formError } = await supabase.from("inspection_forms").insert(demoRow({
    name: demoName("טופס פיקוח גן בטוח - דמו מלא"),
    description: "טופס בדיקה חודשי לפי בטיחות, צוות, מטבח, בריאות, חירום, מצלמות ושקיפות להורים.",
    framework_type: "mixed",
    active: true,
    frequency_months: 1,
    created_by: ids["admin-demo@demo.ganbatuach.com"]
  })).select("*").single();
  if (formError) throw formError;
  const { data: formQuestions, error: questionError } = await supabase.from("inspection_form_questions").insert(demoRows(questions.map((question, index) => ({
    form_id: form.id,
    category: question[0],
    question_text: question[1],
    required: question[2],
    weight: question[3],
    critical: question[4],
    requires_photo: question[5],
    requires_note: index % 2 === 0,
    sort_order: index + 1
  })))).select("*");
  if (questionError) throw questionError;

  const parentEmails = users.filter((user) => user[2] === "parent").map((user) => user[0]);
  const childNames = ["אורי רוזן", "הלל רוזן", "נועה אלון", "יובל אלון", "אלה גולד", "אדם גולד", "מאיה כהן", "תומר כהן", "רוני לוי", "גילי לוי", "איתן פרץ", "מיקה פרץ", "ליה דגן", "עידו דגן", "שירה סלע", "בן סלע", "עמית נחום", "דניאל נחום", "ריף אברהמי", "אביב ישראלי"];
  const gardenKeysForChildren = ["rakefet", "rakefet", "oranim", "oranim", "shaked", "yam", "rakefet", "oranim", "shaked", "yam", "rakefet", "oranim", "shaked", "yam", "rakefet", "oranim", "shaked", "oranim", "shaked", "yam"];
  const parentRows = parentEmails.map((email, index) => {
    const user = users.find((item) => item[0] === email);
    const gardenKey = ["rakefet", "oranim", "shaked", "yam", "rakefet", "oranim"][index];
    return { profile_id: ids[email], garden_id: gardenByKey[gardenKey].id, full_name: demoName(user[3]), identity_number: `0${31200000 + index}`, phone: user[4], email, address: `רחוב המשפחה ${index + 2}, ${gardenByKey[gardenKey].city}`, completed_profile: true, status: "active" };
  });
  const { data: parentRecords, error: parentError } = await supabase.from("parents").insert(demoRows(parentRows)).select("*");
  if (parentError) throw parentError;
  for (const parent of parentRecords) {
    if (parent.profile_id) await supabase.from("profiles").update({ garden_id: parent.garden_id }).eq("id", parent.profile_id);
  }

  const childRows = childNames.map((name, index) => {
    const garden = gardenByKey[gardenKeysForChildren[index]];
    const parent = parentRecords[index % parentRecords.length];
    const allergy = index % 7 === 0 ? "רגישות לבוטנים - אין להגיש מזון עם אגוזים" : index % 5 === 0 ? "רגישות ללקטוז" : "";
    return {
      garden_id: garden.id,
      primary_parent_id: parent.id,
      full_name: demoName(name),
      birth_date: date(-(900 + index * 22)),
      identity_number: `32${1000000 + index}`,
      hmo: ["כללית", "מכבי", "מאוחדת", "לאומית"][index % 4],
      allergies: allergy,
      sensitivities: allergy,
      regular_medications: index % 6 === 0 ? "משאף לפי צורך בלבד" : "",
      medical_notes: allergy ? "להציג אזהרת אלרגיה בכל ארוחה" : "אין הערות רפואיות חריגות",
      address: parent.address,
      mother_name: parent.full_name,
      mother_identity_number: parent.identity_number,
      mother_phone: parent.phone,
      emergency_phone: "050-7999999",
      photo_url: avatar(name),
      face_image_url: avatar(`${name} face`),
      face_attendance_enabled: true,
      pickup_authorized: [{ name: parent.full_name, phone: parent.phone, relation: "הורה" }, { name: "סבתא רחל", phone: "050-7666677", relation: "סבתא" }],
      photo_consent: true,
      system_consent: true,
      additional_consents: { camera: true, privacy: true, health_declaration: true },
      status: "active",
      parent_completed: true,
      manager_approved_at: iso(-18)
    };
  });
  const { data: children, error: childError } = await supabase.from("children").insert(demoRows(childRows)).select("*");
  if (childError) throw childError;

  const staffEmails = users.filter((user) => user[2] === "staff").map((user) => user[0]);
  const staffRows = staffEmails.map((email, index) => {
    const garden = gardenByKey[["rakefet", "rakefet", "oranim", "oranim", "shaked", "tamar"][index]];
    const user = users.find((item) => item[0] === email);
    return { profile_id: ids[email], garden_id: garden.id, full_name: demoName(user[3]), role_title: index % 2 ? "סייעת מובילה" : "אשת צוות", identity_number: `04${5500000 + index}`, phone: user[4], email, address: `רחוב הצוות ${index + 1}`, class_group: index % 2 ? "צעירים" : "בוגרים", start_date: date(-120 - index * 15), background_check_status: index === 5 ? "pending_review" : "valid", police_clearance_status: index === 5 ? "missing" : "valid", approved_to_work: index !== 5, profile_photo_url: avatar(user[3]), sexual_offense_clearance_url: "https://example.com/demo/clearance.pdf", criminal_clearance_url: "https://example.com/demo/background.pdf", onboarding_status: index === 5 ? "pending_manager_approval" : "approved", manager_approved_at: index === 5 ? null : iso(-50) };
  });
  const { data: staff, error: staffError } = await supabase.from("staff").insert(demoRows(staffRows)).select("*");
  if (staffError) throw staffError;
  await supabase.from("profiles").update({ garden_id: gardenByKey.rakefet.id }).in("id", [ids["staff.1@demo.ganbatuach.com"], ids["staff.2@demo.ganbatuach.com"]]);
  await supabase.from("profiles").update({ garden_id: gardenByKey.oranim.id }).in("id", [ids["staff.3@demo.ganbatuach.com"], ids["staff.4@demo.ganbatuach.com"]]);
  await supabase.from("profiles").update({ garden_id: gardenByKey.shaked.id }).eq("id", ids["staff.5@demo.ganbatuach.com"]);
  await supabase.from("profiles").update({ garden_id: gardenByKey.tamar.id }).eq("id", ids["staff.6@demo.ganbatuach.com"]);

  await supabase.from("documents").insert(demoRows([
    ...insertedGardens.map((garden, index) => ({ garden_id: garden.id, uploaded_by: garden.manager_id, name: demoName(index === 4 ? "אישור בטיחות חסר" : "ביטוח גן בתוקף"), document_type: "kindergarten_insurance", file_url: "https://example.com/demo/document.pdf", expires_at: date(index === 1 ? 12 : 120), status: index === 4 ? "missing" : index === 1 ? "pending_review" : "valid", owner_type: "kindergarten", notes: "מסמך דמו תפעולי" })),
    ...staff.map((item, index) => ({ garden_id: item.garden_id, staff_id: item.id, uploaded_by: item.profile_id, name: demoName("אישור היעדר עבירות מין"), document_type: "sexual_offense_clearance", file_url: "https://example.com/demo/staff-clearance.pdf", expires_at: date(index === 5 ? -3 : 180), status: index === 5 ? "expired" : "valid", owner_type: "staff" }))
  ]));

  await supabase.from("child_health_records").insert(demoRows(children.map((child, index) => ({ garden_id: child.garden_id, child_id: child.id, hmo: child.hmo, allergies: child.allergies, sensitivities: child.sensitivities, medications: child.regular_medications, emergency_contacts: [{ name: child.mother_name, phone: child.mother_phone }, { name: demoName("מוקד חירום משפחתי"), phone: child.emergency_phone }], medication_approval_url: index % 6 === 0 ? "https://example.com/demo/medicine-approval.pdf" : null, medication_approval_expires_at: index % 6 === 0 ? date(40) : null, medical_notes: child.medical_notes, missing_info: false, allergy_warning: Boolean(child.allergies), medication_due_at: index % 6 === 0 ? iso(0.5) : null, updated_by: child.primary_parent_id }))));
  await supabase.from("child_daily_journals").insert(demoRows(children.slice(0, 14).map((child, index) => ({ garden_id: child.garden_id, child_id: child.id, journal_date: date(0), meals: [{ time: "09:15", text: "כריך גבינה וירקות" }, { time: "12:20", text: index % 5 === 0 ? "ארוחה מותאמת ללא לקטוז" : "קציצות הודו, אורז וירקות" }], sleep_summary: index % 4 === 0 ? "נח/ה מעט מהרגיל" : "שנת צהריים רגועה", sleep_minutes: 55 + index * 3, mood: ["שמח/ה", "רגוע/ה", "סקרן/ית", "קצת עייף/ה"][index % 4], bathroom: index % 3 === 0 ? "נדרש סיוע קל" : "תקין", medicine: index % 6 === 0 ? "משאף לפי אישור הורה" : "", incidents: index === 3 ? "מעידה קלה בחצר, נבדק/ה ועודכן הורה" : "", notes_to_parents: "יום נעים, השתתף/ה בפעילות יצירה ושיח בוקר.", photo_urls: [avatar(`${child.full_name} journal`)], staff_signature: demoName("נחתם על ידי צוות הגן"), staff_id: staff[index % staff.length]?.id, created_by: staff[index % staff.length]?.profile_id, parent_notified_at: iso(0) }))));
  await supabase.from("attendance").insert(demoRows(children.map((child, index) => ({ garden_id: child.garden_id, child_id: child.id, attendance_date: date(0), status: index % 9 === 0 ? "late" : "present", check_in_at: iso(-0.1), note: index % 9 === 0 ? "איחור של 18 דקות, עודכן הורה" : "נוכחות בוקר תקינה" }))));
  await supabase.from("pickup_confirmations").insert(demoRows(children.slice(0, 8).map((child, index) => ({ garden_id: child.garden_id, child_id: child.id, parent_id: child.primary_parent_id, picked_up_by_name: demoName(index === 7 ? "דוד שלא מופיע ברשימה" : child.mother_name.replace(DEMO_PREFIX, "").trim()), authorized: index !== 7, gps_lat: 32.084, gps_lng: 34.812 }))));

  const cameras = demoRows(insertedGardens.flatMap((garden) => [
    { garden_id: garden.id, name: demoName("מצלמת כיתה מרכזית"), area: "כיתה", camera_type: "DVR", protocol: "RTSP", status: "pending_gateway", host: "192.168.1.20", port: 554, channel: "1", rtsp_path: "/Streaming/Channels/101", parent_view_allowed: true, ai_enabled: true, active: true },
    { garden_id: garden.id, name: demoName("מצלמת חצר"), area: "חצר", camera_type: "IP Camera", protocol: "ONVIF", status: garden.safe_status === "not_compliant" ? "offline" : "pending_gateway", host: "192.168.1.21", port: 554, channel: "2", onvif_path: "/onvif/device_service", parent_view_allowed: false, ai_enabled: true, active: true }
  ]));
  const { data: cameraRows, error: cameraError } = await supabase.from("camera_streams").insert(cameras).select("*");
  if (cameraError) throw cameraError;
  await supabase.from("stream_health_checks").insert(demoRows(cameraRows.map((camera, index) => ({ garden_id: camera.garden_id, camera_stream_id: camera.id, offline: camera.status === "offline", black_screen: index === 9, frozen: false, covered: index === 3, frame_loss_percent: index === 9 ? 42 : 3, latency_ms: 180 + index * 40, metadata: { source: "demo seed" } }))));
  await supabase.from("ai_events").insert(demoRows([
    { garden_id: gardenByKey.oranim.id, camera_stream_id: cameraRows.find((camera) => camera.garden_id === gardenByKey.oranim.id)?.id, event_type: "child_alone", severity: "high", confidence: 0.86, status: "open", screenshot_url: "https://example.com/demo/snapshot-child-alone.jpg", notes: "ילד זוהה לבד באזור החצר למשך יותר מדקה." },
    { garden_id: gardenByKey.yam.id, camera_stream_id: cameraRows.find((camera) => camera.garden_id === gardenByKey.yam.id)?.id, event_type: "camera_blocked", severity: "critical", confidence: 0.94, status: "open", screenshot_url: "https://example.com/demo/snapshot-camera-blocked.jpg", notes: "מצלמת חצר מכוסה/חשוכה, נדרש טיפול." },
    { garden_id: gardenByKey.rakefet.id, camera_stream_id: cameraRows.find((camera) => camera.garden_id === gardenByKey.rakefet.id)?.id, event_type: "cry_detection", severity: "medium", confidence: 0.72, status: "in_progress", screenshot_url: "https://example.com/demo/snapshot-cry.jpg", notes: "זיהוי בכי ממושך, צוות עודכן." }
  ]));

  const scoreSets = { rakefet: [10, 9, 9, 9, 9, 10, 9, 9, 9, 9], oranim: [8, 6, 7, 8, 7, 7, 8, 6, 8, 7], yam: [6, 4, 5, 6, 5, 4, 7, 3, 6, 5] };
  for (const key of Object.keys(scoreSets)) {
    const garden = gardenByKey[key];
    const { data: inspection, error } = await supabase.from("inspections").insert(demoRow({
      garden_id: garden.id,
      inspector_id: garden.inspector_id,
      form_id: form.id,
      status: "done",
      gps_lat: garden.gps_lat,
      gps_lng: garden.gps_lng,
      gps_verified: true,
      started_at: iso(key === "yam" ? -36 : -21),
      completed_at: iso(key === "yam" ? -36 : -21),
      weighted_score: garden.last_inspection_score,
      critical_failures: scoreSets[key].filter((score, index) => score <= 4 && formQuestions[index]?.critical).length,
      violation_count: scoreSets[key].filter((score) => score <= 4).length,
      signature_image: "https://example.com/demo/inspector-signature.png",
      signed_at: iso(key === "yam" ? -36 : -21),
      signed_by: garden.inspector_id,
      summary: key === "rakefet" ? "הגן עומד בסטנדרט גן בטוח עם תיעוד מסודר ושגרת בקרה טובה." : key === "oranim" ? "הגן דורש תיקון במסמכי צוות והרשאות מצלמות, ללא ליקוי קריטי פתוח." : "נמצאו ליקויים מהותיים במצלמות, בטיחות חצר ותיעוד חירום."
    })).select("*").single();
    if (error) throw error;
    await supabase.from("inspection_answers").insert(demoRows(formQuestions.map((question, index) => ({ inspection_id: inspection.id, question_id: question.id, score: scoreSets[key][index], note: scoreSets[key][index] <= 4 ? "נדרש תיקון ותיעוד חוזר בתוך 7 ימים." : "נבדק ונמצא תקין/סביר.", photo_url: question.requires_photo ? "https://example.com/demo/inspection-evidence.jpg" : null, answer_type: "score", category_score: scoreSets[key][index] }))));
    await supabase.from("inspection_signatures").insert(demoRow({ inspection_id: inspection.id, signature_image: "https://example.com/demo/inspector-signature.png", signed_by: garden.inspector_id, gps_lat: garden.gps_lat, gps_lng: garden.gps_lng, gps_distance_meters: 18, inspector_details: { name: demoName(users.find((user) => ids[user[0]] === garden.inspector_id)?.[3] ?? "פקח") }, kindergarten_details: { name: garden.name, city: garden.city }, result_snapshot: { score: garden.last_inspection_score, category_scores: { "בטיחות ילדים": scoreSets[key][1], "מצלמות ופרטיות": scoreSets[key][7], "חירום ועזרה ראשונה": scoreSets[key][5] } } }));
    const lowQuestions = formQuestions.filter((_, index) => scoreSets[key][index] <= 4);
    for (const question of lowQuestions) {
      const { data: task } = await supabase.from("tasks").insert(demoRow({ garden_id: garden.id, title: demoName(`תיקון ליקוי: ${question.category}`), description: question.question_text, assigned_to: garden.manager_id, created_by: garden.inspector_id, due_at: iso(7), status: "open", priority: question.critical ? "critical" : "high", task_type: "inspection_correction", requires_proof: true })).select("*").single();
      await supabase.from("violations").insert(demoRow({ garden_id: garden.id, inspection_id: inspection.id, question_id: question.id, task_id: task?.id, title: demoName(`ליקוי ${question.category}`), description: question.question_text, category: question.category, severity: question.critical ? "critical" : "high", score: scoreSets[key][formQuestions.indexOf(question)], status: "open", correction_due_at: iso(7) }));
    }
  }

  await supabase.from("required_inspections").insert(demoRows(gardens.map((garden) => ({ garden_id: gardenByKey[garden.key].id, inspector_id: ids[garden.inspector], due_at: iso(garden.next), status: garden.late ? "late" : garden.pendingFirst ? "required" : "required", countdown_day: garden.next > 0 && garden.next <= 5 ? garden.next : null }))));
  await supabase.from("late_inspections").insert(demoRow({ garden_id: gardenByKey.yam.id, inspector_id: ids["inspector.ronen@demo.ganbatuach.com"], due_at: iso(-6), days_late: 6, status: "late" }));

  await supabase.from("complaints").insert(demoRows([
    { garden_id: gardenByKey.oranim.id, parent_id: parentRecords[2].id, assigned_inspector_id: ids["inspector.yael@demo.ganbatuach.com"], subject: demoName("בקשה לבדוק יחס צוות בחצר"), description: "בשני ימי איסוף ראינו עומס בחצר בשעה 16:00. מבקשים בדיקה ותשובה מסודרת.", category: "safety", severity: "high", urgent: true, status: "in_progress", response_due_at: iso(1), child_id: children[2].id, internal_notes: "נדרש קשר עם המנהלת ובדיקת מצלמת חצר." },
    { garden_id: gardenByKey.rakefet.id, parent_id: parentRecords[0].id, subject: demoName("שאלה על תפריט ללא אלרגנים"), description: "מבקשים לוודא שבימי חמישי אין ממרח אגוזים בגן.", category: "medical", severity: "medium", status: "new", response_due_at: iso(2), child_id: children[0].id }
  ]));
  await supabase.from("incident_reports").insert(demoRows([
    { garden_id: gardenByKey.rakefet.id, child_id: children[3].id, incident_type: "fall", title: demoName("מעידה קלה בחצר"), description: "הילדה מעדה ליד מתקן טיפוס נמוך, נבדקה וקיבלה קרח. ההורה עודכן.", severity: "low", reported_by: staff[0].profile_id, assigned_to: ids["manager.rakefet@demo.ganbatuach.com"], status: "resolved", timeline: [{ time: iso(-1), text: "דווח להורה ונבדק על ידי מנהלת" }], resolution: "אין צורך בהמשך טיפול", parent_notified: true, inspector_notified: false },
    { garden_id: gardenByKey.yam.id, incident_type: "camera issue", title: demoName("מצלמת חצר לא משדרת"), description: "בדיקת בריאות זיהתה כיסוי/מסך שחור.", severity: "critical", assigned_to: ids["manager.yam@demo.ganbatuach.com"], status: "open", parent_notified: false, inspector_notified: true }
  ]));
  await supabase.from("messages").insert(demoRows([
    { garden_id: gardenByKey.rakefet.id, sender_id: ids["admin-demo@demo.ganbatuach.com"], recipient_id: ids["manager.rakefet@demo.ganbatuach.com"], subject: demoName("בדיקת מוכנות חודשית"), body: "נא לוודא שכל מסמכי הצוות עודכנו לפני ביקורת חודשית.", treatment_status: "open" },
    { garden_id: gardenByKey.oranim.id, sender_id: ids["inspector.yael@demo.ganbatuach.com"], recipient_id: ids["manager.oranim@demo.ganbatuach.com"], subject: demoName("השלמת תיקון מצלמות"), body: "נדרש צילום מסך של Gateway לאחר בדיקת חיבור.", treatment_status: "in_progress" }
  ]));
  await supabase.from("tasks").insert(demoRows(insertedGardens.map((garden) => ({ garden_id: garden.id, title: demoName("בדיקת בוקר יומית"), description: "נוכחות, מטבח, חצר, תרופות ועדכון הורים.", assigned_to: garden.manager_id, created_by: ids["admin-demo@demo.ganbatuach.com"], due_at: iso(1), status: garden.safe_status === "not_compliant" ? "overdue" : "open", priority: garden.safe_status === "not_compliant" ? "critical" : "medium", task_type: "daily_operations", requires_proof: false }))));
  await supabase.from("notifications").insert(demoRows([
    ...insertedGardens.map((garden) => ({ garden_id: garden.id, recipient_id: garden.manager_id, recipient_role: "manager", title: garden.next_inspection_at && new Date(garden.next_inspection_at) < now ? "פיקוח באיחור" : "פיקוח קרוב", body: `גן ${garden.name}: יש לעקוב אחרי מועד הפיקוח החודשי.`, entity_type: "inspection", severity: garden.safe_status === "not_compliant" ? "critical" : "medium" })),
    { garden_id: gardenByKey.yam.id, recipient_id: ids["inspector.ronen@demo.ganbatuach.com"], recipient_role: "inspector", title: "מצלמה מנותקת ואירוע AI קריטי", body: "גן ים של ילדים דורש טיפול מיידי.", entity_type: "ai_event", severity: "critical" }
  ]));
  await supabase.from("leads").insert(demoRows([
    { garden_id: gardenByKey.rakefet.id, lead_type: "parent", parent_name: demoName("טל מור"), child_name: demoName("אמה מור"), child_age: "2.8", phone: "050-7881000", email: "tal.mor@example.com", status: "new_parent_lead", notes: "מעוניינת בכניסה אחרי החגים" },
    { lead_type: "garden", garden_name: demoName("גן ניצנים"), owner_name: demoName("הילה בר"), city: "חולון", phone: "050-7882000", email: "nitzanim@example.com", children_count: 18, staff_count: 4, status: "new_garden_onboarding", notes: "יש מצלמות DVR ומסמכי ביטוח בתוקף" },
    { lead_type: "inspector", parent_name: demoName("אורן שמיר"), city: "הרצליה", phone: "050-7883000", email: "oren.inspector@example.com", status: "new_inspector_lead", notes: "ניסיון בניהול בטיחות מוסדות חינוך" }
  ]));

  const { data: policies } = await supabase.from("policies").select("id, policy_type, version").eq("active", true);
  if (policies?.length) {
    const acceptances = Object.entries(ids).flatMap(([email, userId]) => {
      const role = users.find((user) => user[0] === email)?.[2];
      const policyType = role === "manager" || role === "owner" ? "kindergarten" : role;
      const policy = policies.find((item) => item.policy_type === policyType);
      return policy ? [demoRow({ policy_id: policy.id, user_id: userId, policy_type: policy.policy_type, version: policy.version, accepted_at: iso(-7) })] : [];
    });
    if (acceptances.length) await supabase.from("policy_acceptances").upsert(acceptances, { onConflict: "policy_id,user_id" });
  }

  await supabase.from("audit_logs").insert(demoRow({ actor_id: ids["admin-demo@demo.ganbatuach.com"], actor_role: "admin", entity_type: "demo_seed", action: "seed_demo_full", after_data: { gardens: insertedGardens.length, children: children.length, users: users.length, demo_batch_id: demoBatchId }, performed_by_user: ids["admin-demo@demo.ganbatuach.com"], performed_by_role: "admin" }));
  console.log(`Demo seed completed. Batch: ${demoBatchId}`);
  console.table([
    ["Admin", "admin-demo@demo.ganbatuach.com", "AdminDemo123!"],
    ["Inspector", "inspector.yael@demo.ganbatuach.com", "InspectorDemo123!"],
    ["Manager", "manager.rakefet@demo.ganbatuach.com", "ManagerDemo123!"],
    ["Owner", "owner.rakefet@demo.ganbatuach.com", "OwnerDemo123!"],
    ["Staff", "staff.1@demo.ganbatuach.com", "StaffDemo123!"],
    ["Parent", "parent.1@demo.ganbatuach.com", "ParentDemo123!"]
  ]);
}

if (process.argv.includes("--reset")) {
  await resetDemoData();
  console.log("Demo data reset completed.");
} else {
  await seed();
}
