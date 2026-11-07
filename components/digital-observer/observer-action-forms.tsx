"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Baby, Bell, BrainCircuit, Cable, Camera, CameraOff, CarFront, Check, ChevronLeft, Cloud, DoorOpen, HardDrive, Heart, HeartPulse, Image, Lightbulb, LoaderCircle, LockKeyhole, Mic, Moon, PawPrint, Pencil, QrCode, Radar, RotateCcw, Router, ShieldCheck, Smartphone, Trash2, UserPlus, UsersRound, X } from "lucide-react";
import { readObserverAccessToken } from "@/lib/domain/digital-observer/client-session";
import {
  classifyObserverPairingPayload,
  connectorTypeForPairing,
  observerCameraConnectionMethods,
  observerCameraManufacturers,
  type ObserverCameraPairingMethod
} from "@/lib/domain/digital-observer/camera-connection-methods";
import { getObserverSiteTemplate, observerSiteTemplates, type ObserverSiteTemplateKey } from "@/lib/domain/digital-observer/site-templates";
import { ObserverAddressFields, type ObserverAddressFormValue } from "@/components/digital-observer/observer-address-fields";
import { ObserverCameraMedia } from "@/components/digital-observer/observer-camera-media";
import { ObserverFcmPushRegistration } from "@/components/digital-observer/observer-fcm-push-registration";

type ActionState = { busy: boolean; error: string; message: string };

type CameraConnectionAssessmentView = {
  recommendation: "DIRECT_CONNECTION_AVAILABLE" | "SOFTWARE_CONNECTOR_REQUIRED" | "PHYSICAL_GATEWAY_REQUIRED" | "ENTERPRISE_EDGE_RECOMMENDED" | "UNSUPPORTED_SYSTEM";
  preferredMethod: string | null;
  adapterType: string | null;
  productionEligible: boolean;
  reasonCodes: string[];
  missingRequirements: string[];
  securityNotes: string[];
};

const connectionRecommendationLabels: Record<CameraConnectionAssessmentView["recommendation"], string> = {
  DIRECT_CONNECTION_AVAILABLE: "חיבור דיגיטלי זמין",
  SOFTWARE_CONNECTOR_REQUIRED: "נדרש מחבר תוכנה",
  PHYSICAL_GATEWAY_REQUIRED: "נדרש Gateway פיזי",
  ENTERPRISE_EDGE_RECOMMENDED: "מומלץ Enterprise Edge",
  UNSUPPORTED_SYSTEM: "נדרשים פרטים נוספים"
};

const connectionMethodLabels: Record<string, string> = {
  VENDOR_CLOUD_API: "API מאובטח של היצרן",
  DIRECT_SECURE: "חיבור דיגיטלי ישיר",
  RTSP: "RTSP מאובטח",
  ONVIF: "ONVIF",
  DVR_NVR: "מערכת DVR / NVR",
  SOFTWARE_CONNECTOR: "מחבר תוכנה מקומי",
  PHYSICAL_GATEWAY: "Gateway פיזי",
  ENTERPRISE_EDGE: "Enterprise Edge",
  DEMO: "מצב הדמיה"
};

const connectionReasonLabels: Record<string, string> = {
  AUTHORIZED_VENDOR_API_AVAILABLE: "קיים API מורשה של היצרן",
  TLS_TRANSPORT_AVAILABLE: "התקשורת מוצפנת",
  OUTBOUND_SECURE_DIRECT_PATH_AVAILABLE: "קיים מסלול ישיר, מוצפן ויוצא",
  STANDARD_PROTOCOL_SECURELY_REACHABLE: "פרוטוקול תקני זמין בצורה מאובטחת",
  STANDARD_PROTOCOL_IS_LAN_SCOPED: "המקור זמין רק ברשת המקומית",
  UNDERLYING_PROTOCOL_ONVIF: "החיבור משתמש ב-ONVIF",
  UNDERLYING_PROTOCOL_RTSP: "החיבור משתמש ב-RTSP",
  LEGACY_RECORDER_REQUIRES_LOCAL_BRIDGE: "המקליט הוותיק דורש גשר מקומי",
  OUTBOUND_AUTHENTICATED_GATEWAY_AVAILABLE: "ה-Gateway פועל בחיבור יוצא ומאומת",
  NO_VERIFIED_SAFE_CONNECTION_PATH: "עדיין לא נמצא מסלול חיבור בטוח ומאומת",
  EXPLICIT_TEST_DEMO_ONLY: "זהו מקור הדמיה בלבד"
};

async function postJson(path: string, body: unknown, accessToken?: string | null, isCurrent: () => boolean = () => true) {
  if (!isCurrent()) return null;
  const authenticatedToken = accessToken || readObserverAccessToken();
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(authenticatedToken ? { Authorization: `Bearer ${authenticatedToken}` } : {})
    },
    body: JSON.stringify(body)
  });
  if (!isCurrent()) return null;
  const payload = await response.json().catch(() => ({}));
  if (!isCurrent()) return null;
  if (!response.ok) throw new Error(payload.error || "הפעולה נכשלה");
  return payload.data;
}

function ResultMessage({ state }: { state: ActionState }) {
  if (state.busy) return <div className="do-action-result loading"><LoaderCircle className="do-spin" /> שומר את הפעולה ברקע...</div>;
  if (state.error) return <div className="do-action-result error" role="alert"><AlertTriangle /> {state.error}</div>;
  if (state.message) return <div className="do-action-result success"><Check /> {state.message}</div>;
  return null;
}

export function ObserverOnboardingWizard({ packages, defaultType = "home" }: { packages: any[]; defaultType?: "home" | "business" }) {
  return <ScopedObserverOnboardingWizard key={defaultType} packages={packages} defaultType={defaultType} />;
}

function ScopedObserverOnboardingWizard({ packages, defaultType = "home" }: Parameters<typeof ObserverOnboardingWizard>[0]) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<ActionState>({ busy: false, error: "", message: "" });
  const emptyAddress: ObserverAddressFormValue = { address_query: "", city: "", street: "", building_number: "", apartment_number: "", floor_kind: "floor", floor_number: "", postal_code: "", address_place_id: "", address_session_token: "", formatted_address: "", address_verification_status: "unverified" };
  const initialTemplate = getObserverSiteTemplate(defaultType === "home" ? "home" : "custom");
  const [form, setForm] = useState({ name: "", site_type: defaultType, site_template: initialTemplate.key, business_handles_children: false, vision_privacy_mode: "standard_consent", ...emptyAddress, camera_count: 1, branch_count: 1, active_days: ["sun", "mon", "tue", "wed", "thu"], opening_time: "08:00", closing_time: "18:00", schedule_mode: defaultType === "home" ? "event_only" : "business_hours", package_id: "", monitoring_targets: defaultType === "home" ? [] : initialTemplate.defaultTargets });
  const [renderedContext, setRenderedContext] = useState(0);
  const owner = useRef({ active: true, context: 0, operation: 0, busy: false });
  useEffect(() => {
    const lifetime = owner.current;
    lifetime.active = true;
    return () => { lifetime.active = false; lifetime.operation += 1; lifetime.busy = false; };
  }, []);
  const ownsRenderedContext = () => owner.current.active && owner.current.context === renderedContext;
  function changeContext() {
    if (!ownsRenderedContext()) return false;
    const lifetime = owner.current;
    lifetime.context += 1;
    lifetime.operation += 1;
    lifetime.busy = false;
    setRenderedContext(lifetime.context);
    setState({ busy: false, error: "", message: "" });
    return true;
  }
  function editDraft(change: (current: typeof form) => typeof form) {
    if (changeContext()) setForm(change);
  }
  const update = (key: string, value: any) => editDraft((current) => ({ ...current, [key]: value }));
  function updateAddress(address: ObserverAddressFormValue) {
    editDraft(current => ({ ...current, ...address }));
  }
  function updateChildPrivacy(checked: boolean) {
    editDraft(current => ({ ...current, business_handles_children: checked, site_template: checked ? "child_education" : current.site_template === "child_education" ? "custom" : current.site_template, vision_privacy_mode: checked ? "skeleton_only" : "standard_consent" }));
  }
  function goToStep(next: number) {
    if (changeContext()) setStep(next);
  }
  const toggleTarget = (value: string) => update("monitoring_targets", form.monitoring_targets.includes(value) ? form.monitoring_targets.filter((item) => item !== value) : [...form.monitoring_targets, value]);
  const weekdays = [["sun", "א׳"], ["mon", "ב׳"], ["tue", "ג׳"], ["wed", "ד׳"], ["thu", "ה׳"], ["fri", "ו׳"], ["sat", "ש׳"]] as const;
  const toggleDay = (value: string) => update("active_days", form.active_days.includes(value) ? form.active_days.filter((item) => item !== value) : [...form.active_days, value]);
  function chooseSiteTemplate(key: ObserverSiteTemplateKey) {
    if (!ownsRenderedContext()) return;
    const template = getObserverSiteTemplate(key);
    editDraft((current) => ({
      ...current,
      site_template: template.key,
      business_handles_children: template.childPrivacyRequired,
      vision_privacy_mode: template.childPrivacyRequired ? "skeleton_only" : "standard_consent",
      monitoring_targets: template.defaultTargets
    }));
  }
  async function submit() {
    if (!ownsRenderedContext() || step !== 4 || owner.current.busy) return;
    const lifetime = owner.current;
    lifetime.busy = true;
    const operation = ++lifetime.operation;
    const submitted = form;
    const isCurrent = () => lifetime.active && lifetime.context === renderedContext && lifetime.operation === operation;
    setState({ busy: true, error: "", message: "" });
    try {
      const data = await postJson(
        "/api/digital-observer/onboarding",
        { ...submitted, package_id: submitted.package_id || null },
        undefined,
        isCurrent
      );
      if (!isCurrent()) return;
      setState({ busy: false, error: "", message: "האתר הוקם ותקופת ניסיון של 14 יום נפתחה ללא חיוב." });
      if (!isCurrent()) return;
      router.push(data.next);
      if (!isCurrent()) return;
      router.refresh();
    } catch (error) {
      if (!isCurrent()) return;
      setState({ busy: false, error: error instanceof Error ? error.message : "לא ניתן להשלים את ההקמה", message: "" });
    } finally {
      if (isCurrent()) lifetime.busy = false;
    }
  }
  const addressValid = form.city.trim().length >= 2 && form.street.trim().length >= 2 && form.building_number.trim().length >= 1;
  const detailsStep = defaultType === "home" ? 2 : 1;
  const cameraStep = defaultType === "home" ? 3 : 2;
  const targetsStep = defaultType === "home" ? 1 : 3;
  const stepLabels = defaultType === "home"
    ? ["מה חשוב לכם?", "פרטי הבית", "התקנת מצלמות", "סיום"]
    : ["פרטי העסק", "הגדרות מערכת", "ניטור והרשאות", "סיום"];
  const monitoringOptions = defaultType === "home"
    ? [["family", "משפחה"], ["children", "ילדים"], ["baby", "תינוק"], ["animal", "חיות מחמד"], ["entry_exit", "כניסה ושער"]]
    : [["person","אדם"],["unknown_person","אדם לא מוכר"],["animal","בעל חיים"],["entry_exit","כניסה ויציאה"],["vehicle","רכב וחניה"],["vehicle_tampering","חשד לפגיעה ברכב"],["distress","סימני מצוקה"],["after_hours","פעילות מחוץ לשעות"],["camera_obstruction","מצלמה מכוסה"],["restricted_area","אזור מוגבל"],["crowding","צפיפות"],["door_left_open","דלת שנשארה פתוחה"],["suspected_theft","חשד לגניבה"],["suspected_violence","חשד לעימות או אלימות"],["suspected_robbery","חשד לשוד"]];
  const homeMonitoringIcons: Record<string, typeof Radar> = { family: UsersRound, children: Heart, baby: Baby, animal: PawPrint, entry_exit: DoorOpen };
  const homeMonitoringDescriptions: Record<string, string> = {
    family: "מעקב אחר פעילות המשפחה בבית",
    children: "שמירה על בטיחות הילדים",
    baby: "מעקב ושקט נפשי",
    animal: "מעקב אחר חיות המחמד",
    entry_exit: "מעקב אחר כניסות ויציאות"
  };
  const validStep = step === detailsStep ? form.name.trim().length >= 2 && addressValid : step === cameraStep ? form.camera_count > 0 : true;
  return (
    <div className="do-wizard">
      <div className="do-stepper" aria-label="שלבי הקמה">{stepLabels.map((label, index) => <div className={step >= index + 1 ? "active" : ""} key={label}><b>{step > index + 1 ? <Check /> : index + 1}</b><span>{label}</span></div>)}</div>
      {step === detailsStep ? <section className="do-panel do-form-section"><h2>{defaultType === "home" ? "פרטי הבית" : "פרטי העסק"}</h2><p>המסלול נבחר בהרשמה ונשמר בחשבון. האתר נשמר כמוצר עצמאי ואינו מקושר לגן בטוח.</p>{form.site_type === "business" ? <div className="do-business-registration-grid"><label className="do-field wide"><span>שם העסק</span><input value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="הקלידו שם עסק" /></label><label className="do-field"><span>סוג העסק</span><select value={form.site_template} onChange={(event) => chooseSiteTemplate(event.target.value as ObserverSiteTemplateKey)}>{observerSiteTemplates.filter((template) => template.key !== "home").map((template) => <option value={template.key} key={template.key}>{template.label}</option>)}</select></label><label className="do-field"><span>מספר סניפים</span><input type="number" min={1} max={100} value={form.branch_count} onChange={(event) => update("branch_count", Math.max(1, Number(event.target.value) || 1))} /></label><label className="do-field wide"><span>ימי פעילות</span><span className="do-weekday-row">{weekdays.map(([value, label]) => <button type="button" className={form.active_days.includes(value) ? "selected" : ""} onClick={() => toggleDay(value)} key={value}>{label}</button>)}</span></label><label className="do-field"><span>משעה</span><input type="time" value={form.opening_time} onChange={(event) => update("opening_time", event.target.value)} /></label><label className="do-field"><span>עד שעה</span><input type="time" value={form.closing_time} onChange={(event) => update("closing_time", event.target.value)} /></label></div> : <div className="do-form-grid"><label className="do-field full"><span>שם הבית</span><input value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="הבית שלי" /></label></div>}<ObserverAddressFields value={form} collapsibleDetails={form.site_type === "business"} onChange={updateAddress} />{form.site_type === "business" ? <div className="do-privacy-choice"><label className="do-check"><input type="checkbox" checked={form.business_handles_children} onChange={(event) => { if (ownsRenderedContext()) updateChildPrivacy(event.target.checked); }} /><span><strong>העסק מטפל בילדים</strong><small>גן, בית ספר, צהרון או מסגרת ילדים. במצב זה ניתוח הווידאו מוגבל לזיהוי שלד ותנועה ללא זיהוי פנים של ילדים.</small></span></label></div> : null}<div className="do-notice info"><ShieldCheck /><span>הווידאו, התמונות והאירועים נשמרים רק בחשבון שלכם ובהרשאות שבחרתם. הם אינם משותפים ללקוחות אחרים ואינם משמשים לזיהוי של אדם אצל משתמש אחר.</span></div></section> : null}
      {step === cameraStep ? <section className="do-panel do-form-section"><h2>{defaultType === "home" ? "התקנת מצלמות" : "הגדרות המערכת"}</h2><p>{defaultType === "home" ? "המספר משמש להתאמת חבילה בלבד. אין כאן חיבור חי." : "הגדירו את היקף המערכת ואת שעות הניטור. חיבור המצלמות עצמו יבוצע במסך הבא."}</p><div className="do-camera-scope-row"><div><span>מספר מצלמות משוער</span><div className="do-counter"><button type="button" aria-label="הפחתה" onClick={() => update("camera_count", Math.max(1, form.camera_count - 1))}>−</button><strong>{form.camera_count}</strong><button type="button" aria-label="הוספה" onClick={() => update("camera_count", Math.min(500, form.camera_count + 1))}>+</button></div></div><label className="do-field"><span>מתי לנטר?</span><select value={form.schedule_mode} onChange={(event) => update("schedule_mode", event.target.value)}><option value="event_only">רק סביב אירועים</option><option value="night_only">לילה</option><option value="business_hours">שעות פעילות</option><option value="24_7">24/7 לאחר הפעלה מאושרת</option><option value="custom_schedule">לוח מותאם</option></select></label></div><div className="do-notice info"><Camera /><span>מצלמות אינן מתחברות בשלב הזה. אחרי פתיחת תקופת הניסיון תעברו לאשף חיבור מאובטח עם QR, יצרן, NVR/DVR או Gateway.</span></div></section> : null}
      {step === targetsStep ? <section className="do-panel do-form-section"><h2>{defaultType === "home" ? "מה הכי חשוב לכם?" : "מה תרצו לנטר?"}</h2><p>{defaultType === "home" ? "בחרו את הדברים החשובים בבית, כדי שנוכל להתאים עבורכם התראות חכמות ומדויקות." : "התצפיתן מתחיל מיעדי התבנית שבחרתם. אפשר לשנות דגשים בלי לבנות כללים טכניים."}</p><div className={`do-toggle-grid ${defaultType === "home" ? "do-home-priority-grid" : ""}`}>{monitoringOptions.map(([value,label]) => { const TargetIcon = defaultType === "home" ? homeMonitoringIcons[value] ?? Radar : Radar; const selected = form.monitoring_targets.includes(value); return <button type="button" className={selected ? "selected" : ""} onClick={() => toggleTarget(value)} key={value}><TargetIcon />{defaultType === "home" ? <span className="do-priority-copy"><strong>{label}</strong><small>{homeMonitoringDescriptions[value]}</small></span> : <span>{label}</span>}{defaultType === "home" ? <span className="do-option-check" aria-hidden="true">{selected ? <Check /> : null}</span> : selected ? <Check /> : null}</button>; })}</div>{defaultType === "home" ? <p className="do-onboarding-change-note">ניתן לשנות את ההעדפות בכל עת</p> : null}{defaultType === "business" ? <div className="do-notice warn"><ShieldCheck /><span>גניבה, שוד, עימות או אלימות יוצגו תמיד כחשד עם ראיות ורמת ביטחון. נדרשת החלטה אנושית; אין חיוג או פעולה אוטומטית.</span></div> : null}{defaultType === "business" && form.vision_privacy_mode === "skeleton_only" ? <div className="do-notice good"><ShieldCheck /><span>מצב פרטיות לילדים פעיל: זיהוי שלד, תנועה ודפוסים בלבד. זיהוי פנים ואודיו אינם חלק מהמסלול הזה.</span></div> : defaultType === "business" ? <div className="do-notice info"><ShieldCheck /><span>אנשים מוכרים יוצעו רק לאחר תצפיות חוזרות, וכל שמירה תחייב הסכמה מפורשת. לא מופעל זיהוי ביומטרי חי בשלב זה.</span></div> : null}</section> : null}
      {step === 4 ? <section className="do-panel do-form-section"><h2>בחירת חבילה והתחלת ניסיון</h2><p>החבילה קובעת את מגבלות המצלמות והשמירה. תקופת הניסיון נמשכת 14 יום.</p><div className="do-plan-grid">{packages.filter((item) => item.package_type === form.site_type || (form.site_type === "business" && item.package_type === "enterprise")).map((item) => <label className={form.package_id === item.id ? "do-plan selected" : "do-plan"} key={item.id}><input type="radio" name="package_id" value={item.id} checked={form.package_id === item.id} onChange={() => update("package_id", item.id)} /><strong>{item.name}</strong><b>{Number(item.monthly_price || 0).toLocaleString("he-IL")} ₪</b><span>14 ימי ניסיון</span><span>עד {item.camera_limit ?? "לפי הסכם"} מצלמות</span><span>שמירת מקטעים עד {item.recording_retention_hours ?? 0} שעות</span></label>)}</div><div className="do-notice info"><ShieldCheck /><span>ספק התשלום עדיין אינו מחובר, לכן לא ייאסף כרטיס ולא יתבצע חיוב. בתקופת הפיילוט ניתן להגדיר ולבדוק מצלמות; ניטור חי ו-AI יופעלו רק לאחר חיבור ואישור הספקים.</span></div></section> : null}
      <ResultMessage state={state} />
      <div className="do-wizard-actions">{step > 1 ? <button className="do-button secondary" type="button" onClick={() => goToStep(step - 1)}>חזרה</button> : <span />}{step < 4 ? <button className="do-button primary" type="button" disabled={!validStep} onClick={() => goToStep(step + 1)}>המשך <ChevronLeft /></button> : <button className="do-button primary" type="button" disabled={state.busy || !form.package_id} onClick={submit}>{state.busy ? <LoaderCircle className="do-spin" /> : null}התחלת 14 ימי ניסיון והמשך <ChevronLeft /></button>}</div>
    </div>
  );
}

export function ObserverCameraWizard({ sites, initialSiteId }: { sites: any[]; initialSiteId?: string }) {
  return <ScopedObserverCameraWizard key={initialSiteId ?? ""} sites={sites} initialSiteId={initialSiteId} />;
}

function ScopedObserverCameraWizard({ sites, initialSiteId }: Parameters<typeof ObserverCameraWizard>[0]) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<ActionState>({ busy: false, error: "", message: "" });
  const [form, setForm] = useState({
    observer_site_id: initialSiteId || sites[0]?.id || "",
    display_name: "",
    location_label: "",
    pairing_method: "network_discovery" as ObserverCameraPairingMethod,
    connector_type: "onvif",
    connector_provider: "unknown",
    pairing_payload_kind: "unknown",
    monitoring_targets: ["person", "children", "animal", "known_faces", "entry_exit", "after_hours", "camera_obstruction"],
    preview_scene: ""
  });
  const [scanState, setScanState] = useState("");
  const [connectionAssessment, setConnectionAssessment] = useState<CameraConnectionAssessmentView | null>(null);
  const [assessmentBusy, setAssessmentBusy] = useState(false);
  const [assessmentError, setAssessmentError] = useState("");
  const [renderedContext, setRenderedContext] = useState(0);
  const owner = useRef({ active: true, context: 0, save: 0, scan: 0, assessment: 0, busy: false });
  useEffect(() => {
    const lifetime = owner.current;
    lifetime.active = true;
    return () => { lifetime.active = false; lifetime.save += 1; lifetime.scan += 1; lifetime.assessment += 1; lifetime.busy = false; };
  }, []);
  const ownsRenderedContext = () => owner.current.active && owner.current.context === renderedContext;
  function changeContext(assessmentChanged: boolean, clearAssessment = assessmentChanged) {
    if (!ownsRenderedContext()) return null;
    const lifetime = owner.current;
    const context = ++lifetime.context;
    lifetime.save += 1;
    lifetime.scan += 1;
    lifetime.busy = false;
    setRenderedContext(context);
    setState({ busy: false, error: "", message: "" });
    setScanState("");
    if (assessmentChanged) { lifetime.assessment += 1; setAssessmentBusy(false); }
    if (clearAssessment) { setConnectionAssessment(null); setAssessmentError(""); }
    return context;
  }
  const update = (key: string, value: any) => {
    const context = changeContext(["observer_site_id", "connector_type", "connector_provider", "pairing_method", "pairing_payload_kind"].includes(key));
    if (context === null) return;
    setForm(current => ({ ...current, [key]: value }));
  };
  function goToStep(next: number) {
    if (changeContext(true, false) === null) return;
    setStep(next);
  }
  function exitWizard() {
    if (changeContext(true) === null) return;
    owner.current.active = false;
    router.push("/digital-observer/cameras");
  }
  const toggleTarget = (value: string) => update("monitoring_targets", form.monitoring_targets.includes(value) ? form.monitoring_targets.filter((item) => item !== value) : [...form.monitoring_targets, value]);
  async function submit() {
    if (!ownsRenderedContext() || step !== 4 || owner.current.busy) return;
    const lifetime = owner.current;
    lifetime.busy = true;
    const operation = ++lifetime.save;
    const submitted = form;
    const isCurrent = () => lifetime.active && lifetime.context === renderedContext && lifetime.save === operation;
    setState({ busy: true, error: "", message: "" });
    try {
      const data = await postJson("/api/digital-observer/cameras", { action: "create", ...submitted, preview_scene: submitted.preview_scene || null }, undefined, isCurrent);
      if (!isCurrent()) return;
      await postJson("/api/digital-observer/camera-onboarding", {
        action: "attach_source",
        observer_site_id: submitted.observer_site_id,
        camera_source_id: data.camera.id
      }, undefined, isCurrent);
      if (!isCurrent()) return;
      setState({ busy: false, error: "", message: data.message });
      if (!isCurrent()) return;
      router.push(`/digital-observer/cameras?site=${submitted.observer_site_id}&camera=${data.camera.id}`);
      if (!isCurrent()) return;
      router.refresh();
    } catch (error) {
      if (isCurrent()) setState({ busy: false, error: error instanceof Error ? error.message : "לא ניתן לשמור מצלמה", message: "" });
    } finally { if (isCurrent()) lifetime.busy = false; }
  }
  const selectedMethod = observerCameraConnectionMethods.find((item) => item.key === form.pairing_method) ?? observerCameraConnectionMethods[0];
  const primaryPairingLabels: Partial<Record<ObserverCameraPairingMethod, string>> = { network_discovery: "מצלמת IP", recorder: "NVR / DVR", manufacturer_app: "ספק ענן", manual_network: "חיבור ידני" };
  const primaryPairingIcons: Partial<Record<ObserverCameraPairingMethod, typeof Camera>> = { network_discovery: Camera, recorder: HardDrive, manufacturer_app: Cloud, manual_network: Cable, qr_scan: QrCode, secure_gateway: Router };
  const targetIcons: Record<string, typeof Radar> = { person: UsersRound, children: Baby, animal: PawPrint, known_faces: UserPlus, entry_exit: DoorOpen, after_hours: Moon, camera_obstruction: CameraOff };
  const primaryPairingMethods = (["network_discovery", "recorder", "manufacturer_app", "manual_network"] as ObserverCameraPairingMethod[]).map((key) => observerCameraConnectionMethods.find((item) => item.key === key)).filter(Boolean) as (typeof observerCameraConnectionMethods)[number][];
  const additionalPairingMethods = observerCameraConnectionMethods.filter((item) => ["qr_scan", "secure_gateway", "demo"].includes(item.key));
  const selectedSite = sites.find((site) => site.id === form.observer_site_id) ?? sites[0];
  const previewName = form.display_name.trim() || "מצלמת כניסה";
  const previewMode = selectedSite?.site_type === "business" ? "business" : "home";
  const stepHeading = step === 1 ? "הוספת מצלמה" : step === 2 ? "בדיקת חיבור" : step === 3 ? "מה חשוב לך שנזהה?" : previewName;
  const stepDescription = step === 1
    ? "בחרו את סוג החיבור המתאים לכם"
    : step === 2
      ? "נבדוק את החיבור למצלמה"
      : step === 3
        ? "בחרו במה התצפיתן יתמקד לאחר החיבור"
        : `${form.location_label || "כניסה ראשית"} · מקור מצלמה במצב מוכנות`;
  useEffect(() => {
    if (step !== 2 || !form.observer_site_id) return;
    let cancelled = false;
    const lifetime = owner.current;
    const assessment = ++lifetime.assessment;
    const isCurrent = () => lifetime.active && !cancelled && lifetime.assessment === assessment;
    void Promise.resolve().then(async () => {
      if (!isCurrent()) return;
      setAssessmentBusy(true);
      setAssessmentError("");
      try {
        const data = await postJson("/api/digital-observer/connection-assessment", {
          action: "assess_new",
          observer_site_id: form.observer_site_id,
          connector_type: form.connector_type,
          connector_provider: form.connector_provider,
          pairing_method: form.pairing_method,
          pairing_payload_kind: form.pairing_payload_kind
        }, undefined, isCurrent);
        if (isCurrent()) {
          setConnectionAssessment(data.assessment);
          const systemKind = form.pairing_method === "recorder" ? "DVR_NVR" : form.pairing_method === "manufacturer_app" || form.pairing_method === "qr_scan" ? "VENDOR_CLOUD" : form.connector_type === "rtsp" ? "RTSP" : form.connector_type === "onvif" ? "ONVIF" : form.connector_type === "ip_camera" ? "IP_CAMERAS" : "UNKNOWN";
          await postJson("/api/digital-observer/camera-onboarding", {
            action: "save",
            observer_site_id: form.observer_site_id,
            system_kind: systemKind,
            connector_type: form.connector_type,
            connector_provider: form.connector_provider,
            pairing_method: form.pairing_method,
            pairing_payload_kind: form.pairing_payload_kind,
            mappings: []
          }, undefined, isCurrent);
        }
      } catch (error) {
        if (isCurrent()) {
          setConnectionAssessment(null);
          setAssessmentError(error instanceof Error ? error.message : "לא ניתן להעריך את מסלול החיבור");
        }
      } finally {
        if (isCurrent()) setAssessmentBusy(false);
      }
    });
    return () => { cancelled = true; };
  }, [step, form.observer_site_id, form.connector_type, form.connector_provider, form.pairing_method, form.pairing_payload_kind]);
  function chooseMethod(method: ObserverCameraPairingMethod, resetProvider = false) {
    const context = changeContext(true);
    if (context === null) return null;
    const descriptor = observerCameraConnectionMethods.find((item) => item.key === method) ?? observerCameraConnectionMethods[0];
    setForm((current) => ({ ...current, pairing_method: method, connector_type: descriptor.connectorType, pairing_payload_kind: "unknown", ...(resetProvider ? { connector_provider: "unknown" } : {}) }));
    setScanState("");
    setConnectionAssessment(null);
    setAssessmentError("");
    return { context, method, connectorType: descriptor.connectorType, payloadKind: "unknown" };
  }
  function startQr(file?: File) {
    const selection = chooseMethod("qr_scan");
    if (selection === null) return;
    setStep(2);
    void scanQrImage(file, selection.context, selection);
  }
  async function scanQrImage(file?: File, context = renderedContext, pairing = { method: form.pairing_method, connectorType: form.connector_type, payloadKind: form.pairing_payload_kind }) {
    const lifetime = owner.current;
    if (!lifetime.active || lifetime.context !== context || !file) return;
    const scan = ++lifetime.scan;
    lifetime.save += 1;
    lifetime.busy = false;
    const isCurrent = () => lifetime.active && lifetime.context === context && lifetime.scan === scan;
    let bitmap: ImageBitmap | undefined;
    setScanState("קורא את הקוד במכשיר...");
    try {
      const Detector = (window as any).BarcodeDetector;
      if (!Detector) {
        setScanState("הדפדפן אינו תומך בסריקה ישירה. אפשר להמשיך דרך אפליקציית היצרן או Gateway.");
        return;
      }
      const detector = new Detector({ formats: ["qr_code"] });
      bitmap = await createImageBitmap(file);
      if (!isCurrent()) return;
      const codes = await detector.detect(bitmap);
      if (!isCurrent()) return;
      const rawValue = String(codes[0]?.rawValue || "");
      if (!rawValue) {
        setScanState("לא נמצא קוד QR ברור בתמונה. נסו שוב בתאורה טובה.");
        return;
      }
      const payloadKind = classifyObserverPairingPayload(rawValue);
      if (!isCurrent()) return;
      const connectorType = connectorTypeForPairing(pairing.method, payloadKind);
      if (!isCurrent()) return;
      const classifiedContext = ++lifetime.context;
      lifetime.save += 1;
      if (payloadKind !== pairing.payloadKind || connectorType !== pairing.connectorType) {
        lifetime.assessment += 1;
        setAssessmentBusy(false);
        setConnectionAssessment(null);
        setAssessmentError("");
      }
      setRenderedContext(classifiedContext);
      setForm((current) => ({ ...current, pairing_payload_kind: payloadKind, connector_type: connectorType }));
      setScanState(`הקוד זוהה וסווג כ-${payloadKind === "web_link" ? "קישור יצרן" : payloadKind === "vendor_code" ? "קוד מכשיר" : payloadKind.toUpperCase()}. תוכן הקוד לא נשמר.`);
    } catch {
      if (isCurrent()) setScanState("לא ניתן לקרוא את הקוד. תוכן התמונה לא הועלה ולא נשמר.");
    } finally {
      if (bitmap) { try { bitmap.close(); } catch { /* Best-effort once-only release, never retry or retain the bitmap. */ } }
    }
  }
  const mobileStep = step === 1 ? 1 : step === 4 ? 3 : 2;
  return <div className="do-wizard do-camera-wizard">
    <header className="do-intro do-camera-flow-heading"><h1>{stepHeading}</h1><p>{stepDescription}</p></header>
    <div className="do-stepper do-stepper-desktop">{["סוג חיבור", "בדיקת חיבור", "מה לנטר", "סיום"].map((label,index) => <div className={step >= index + 1 ? "active" : ""} key={label}><b>{step > index + 1 ? <Check /> : index + 1}</b><span>{label}</span></div>)}</div>
    <div className="do-stepper do-stepper-mobile" aria-label={`שלב ${mobileStep} מתוך 3`}>{["פרטים", "התחברות", "סיום"].map((label,index) => <div className={mobileStep >= index + 1 ? "active" : ""} key={label}><b>{mobileStep > index + 1 ? <Check /> : index + 1}</b><span>{label}</span></div>)}</div>
    {step === 1 ? <section className="do-camera-mobile-first" aria-label="התחלת הוספת מצלמה">
      <div className="do-camera-device-image" role="img" aria-label="מצלמת אבטחה ביתית" />
      <h2>נוסיף מצלמה חדשה</h2>
      <p>חברו את המצלמה לחשמל ולרשת, ונמשיך בדרך המתאימה לכם.</p>
      <button className="do-button navy full" type="button" onClick={() => startQr()}>המשך</button>
      <label className="do-button secondary full"><Camera /> סריקת קוד QR<input type="file" accept="image/*" capture="environment" onChange={(event) => { if (ownsRenderedContext()) startQr(event.target.files?.[0]); }} /></label>
      <small>או גללו לבחירת חיבור דרך יצרן, רשת, NVR/DVR או Gateway.</small>
    </section> : null}
    {step === 1 ? <section className="do-panel do-form-section do-camera-connector-selection"><h2>הוספת מצלמה</h2><p>בחרו את סוג החיבור המוכר לכם. התצפיתן יציג רק את הפרטים הנדרשים למסלול הזה.</p><button type="button" className="do-button secondary" onClick={() => { chooseMethod("network_discovery", true); }}>אני לא יודע/ת איזו מערכת יש לי</button><small className="do-help-copy">נתחיל באיתור מאובטח ונציע רק חיבור שניתן לאמת. אם נדרש רכיב מקומי, נסביר למה ונשמור את ההתקדמות.</small><div className="do-connector-grid do-pairing-grid do-primary-pairing-grid">{primaryPairingMethods.map((method) => { const PairingIcon = primaryPairingIcons[method.key] ?? Camera; return <button type="button" className={form.pairing_method === method.key ? "selected" : ""} onClick={() => chooseMethod(method.key)} key={method.key}><PairingIcon /><strong>{primaryPairingLabels[method.key] ?? method.label}</strong><span>{method.shortDescription}</span>{form.pairing_method === method.key ? <Check /> : <ChevronLeft />}</button>; })}</div><details className="do-additional-pairing"><summary>אפשרויות נוספות: QR, ‏Gateway ומצלמת הדמיה</summary><div className="do-connector-grid do-pairing-grid">{additionalPairingMethods.map((method) => { const PairingIcon = primaryPairingIcons[method.key] ?? Camera; return <button type="button" className={form.pairing_method === method.key ? "selected" : ""} onClick={() => chooseMethod(method.key)} key={method.key}><PairingIcon /><strong>{method.label}</strong><span>{method.shortDescription}</span><b className="do-badge info">{method.badge}</b>{form.pairing_method === method.key ? <Check /> : null}</button>; })}</div></details><div className="do-notice info"><ShieldCheck /><span>פרטי חיבור רגישים נשמרים רק ב-Gateway או בכספת השרת, ולא בדפדפן.</span></div></section> : null}
    {step === 2 ? <section className="do-panel do-form-section do-camera-test-step">
      <div className="do-section-head">
        <div><h2>בדיקת דרך החיבור</h2><p>נעדיף חיבור דיגיטלי בטוח ונציע חומרה רק כשיש לכך סיבה.</p></div>
        <span className={connectionAssessment?.recommendation === "PHYSICAL_GATEWAY_REQUIRED" ? "do-badge warn" : "do-badge info"}>
          {assessmentBusy ? "בודק אפשרויות..." : connectionAssessment ? connectionRecommendationLabels[connectionAssessment.recommendation] : "ממתין לבדיקה"}
        </span>
      </div>
      <div className="do-camera-connection-form">
        <div className="do-form-grid">
          <label className="do-field"><span>אתר</span><select value={form.observer_site_id} onChange={(event) => update("observer_site_id", event.target.value)}>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
          <label className="do-field"><span>שם המצלמה</span><input value={form.display_name} onChange={(event) => update("display_name", event.target.value)} placeholder="מצלמת כניסה" /></label>
          <label className="do-field"><span>מיקום</span><input value={form.location_label} onChange={(event) => update("location_label", event.target.value)} placeholder="כניסה ראשית" /></label>
          <label className="do-field"><span>יצרן / מערכת</span><select value={form.connector_provider} onChange={(event) => update("connector_provider", event.target.value)}>{observerCameraManufacturers.map((manufacturer) => <option key={manufacturer.value} value={manufacturer.value}>{manufacturer.label}</option>)}</select></label>
        </div>
        <dl className="do-connection-facts">
          <div><dt>מערכת קיימת</dt><dd>{primaryPairingLabels[selectedMethod.key] ?? selectedMethod.label}</dd></div>
          <div><dt>דרך מומלצת</dt><dd>{connectionAssessment?.preferredMethod ? connectionMethodLabels[connectionAssessment.preferredMethod] ?? connectionAssessment.preferredMethod : "טרם נקבעה"}</dd></div>
          <div><dt>מתאם</dt><dd>{connectionAssessment?.adapterType ?? "ייקבע לאחר האימות"}</dd></div>
        </dl>
      </div>
      <div className="do-camera-test-preview"><ObserverCameraMedia name={previewName} scene={previewMode === "home" ? "home-entry" : "business-entry"} mode={previewMode} status="readiness" sourceMode={form.connector_type === "demo" ? "demo" : "readiness"} /><div className="do-camera-preview-controls" aria-label="בקרות תצוגה במצב מוכנות"><span>תצוגה מקדימה</span><button type="button" disabled aria-label="השהיה"><Camera /></button><button type="button" disabled aria-label="שמע"><Mic /></button><button type="button" disabled aria-label="צילום"><Image /></button></div></div>
      {assessmentError ? <div className="do-notice warn"><AlertTriangle /><span>{assessmentError}</span></div> : null}
      {connectionAssessment ? <div className="do-connection-check-result"><span><Check /></span><div><strong>{connectionRecommendationLabels[connectionAssessment.recommendation]}</strong><small>{connectionAssessment.reasonCodes.map((code) => connectionReasonLabels[code] ?? code).join(" · ")}</small>{connectionAssessment.missingRequirements.length ? <small>להשלמה: {connectionAssessment.missingRequirements.join(" · ")}</small> : null}</div><b>{connectionAssessment.productionEligible ? "מוכן לחיבור מאומת" : "דורש השלמה"}</b></div> : null}
      {connectionAssessment?.recommendation === "SOFTWARE_CONNECTOR_REQUIRED" ? <div className="do-notice info"><Cable /><span>נדרש Connector מקומי קל, מכיוון שהמערכת זמינה רק בתוך הרשת. ההתקדמות נשמרה ואפשר להמשיך להתקנה מאובטחת על מחשב או שרת קיים.</span><a className="do-button secondary" href={`/digital-observer/cameras/connector?site=${encodeURIComponent(form.observer_site_id)}`}>המשך להתקנת Connector</a></div> : null}
      {connectionAssessment?.recommendation === "PHYSICAL_GATEWAY_REQUIRED" ? <div className="do-notice warn"><Router /><span>Gateway מוצע רק משום שלא נמצא מסלול ישיר מאובטח למערכת הזו. נבקש זיווג מאומת, ולא פרטי חיבור בדפדפן.</span></div> : null}
      {connectionAssessment?.recommendation === "DIRECT_CONNECTION_AVAILABLE" ? <div className="do-notice good"><LockKeyhole /><span>בשלב הבא תתבקשו לאשר את ההרשאה הנדרשת אצל הספק או בכספת השרת. לא נשמור סיסמה, כתובת RTSP או טוקן בדפדפן.</span></div> : null}
      <div className="do-notice info"><ShieldCheck /><span>סיסמאות וכתובות מקור נשמרות רק בצד השרת או במחבר המקומי. לא תתבצע ירידה אוטומטית למסלול חלש או חשוף.</span></div>
      {form.pairing_method === "qr_scan" ? <div className="do-qr-capture"><label className="do-button secondary"><QrCode /> צילום או בחירת קוד QR<input type="file" accept="image/*" capture="environment" onChange={(event) => { if (ownsRenderedContext()) void scanQrImage(event.target.files?.[0]); }} /></label>{scanState ? <p>{scanState}</p> : <span>הסריקה מתבצעת במכשיר. התמונה ותוכן הקוד אינם נשמרים.</span>}</div> : null}
      <details className="do-camera-test-help"><summary>הוראות חיבור מפורטות</summary><div className="do-pairing-instructions"><div><strong>מה צריך להכין</strong><ul>{selectedMethod.requiredItems.map((item) => <li key={item}>{item}</li>)}</ul></div><ol>{selectedMethod.steps.map((item) => <li key={item}>{item}</li>)}</ol></div></details>
    </section> : null}
    {step === 3 ? <section className="do-panel do-form-section do-camera-target-step"><h2>מה חשוב לך שנזהה?</h2><p>בחרו במה התצפיתן יתמקד לאחר חיבור ואישור. אפשר לשנות בכל עת.</p><div className="do-toggle-grid do-camera-target-grid">{[["person","אדם"],["children","ילד / תינוק"],["animal","חיית מחמד"],["known_faces","פנים מוכרות"],["entry_exit","כניסה / יציאה"],["after_hours","תנועה אחרי שעות"],["camera_obstruction","מצלמה מכוסה"]].map(([value,label]) => { const TargetIcon = targetIcons[value] ?? Radar; return <button type="button" className={form.monitoring_targets.includes(value) ? "selected" : ""} onClick={() => toggleTarget(value)} key={value}><TargetIcon /><span>{label}</span>{form.monitoring_targets.includes(value) ? <Check /> : null}</button>; })}</div><div className="do-notice info"><BrainCircuit /><span>התצפיתן ילמד דפוסים רק לאחר חיבור מאושר ומשוב מאומת. מצב זה אינו מפעיל AI חי או זיהוי ביומטרי.</span></div></section> : null}
    {step === 4 ? <section className="do-panel do-form-section do-camera-connect-summary do-camera-summary-detail">
      <div className="do-camera-summary-head">
        <div><span className="do-badge good"><Check /> מוכן להגדרה</span><h2>{previewName}</h2><p>{form.location_label || "כניסה ראשית"} · {selectedSite?.name || "האתר שלי"}</p></div>
        <ShieldCheck />
      </div>
      <div className="do-camera-summary-layout">
        <div className="do-camera-summary-preview">
          <ObserverCameraMedia name={previewName} scene={previewMode === "home" ? "home-entry" : "business-entry"} mode={previewMode} status="readiness" sourceMode={form.connector_type === "demo" ? "demo" : "readiness"} />
          <div className="do-camera-summary-actions" aria-label="פעולות מהירות במצב מוכנות">
            <button type="button" disabled><Lightbulb /><span>תאורה<small>לא זמין</small></span></button>
            <button type="button" disabled><Mic /><span>דיבור<small>לא זמין</small></span></button>
            <button type="button" disabled><Image /><span>צילום<small>לא זמין</small></span></button>
            <button type="button" disabled><Bell /><span>אזעקה<small>לא זמין</small></span></button>
          </div>
        </div>
        <div className="do-camera-summary-lower">
          <section className="do-camera-facts-card" aria-labelledby="camera-facts-title">
            <div className="do-camera-summary-section-head"><div><Camera /><h3 id="camera-facts-title">פרטי המצלמה</h3></div><span className="do-badge info">מוכנות</span></div>
            <div className="do-summary-list">
              <div><span>דרך חיבור</span><strong>{selectedMethod.label}</strong></div>
              <div><span>מצב</span><strong>{form.connector_type === "demo" ? "הדמיה בטוחה" : connectionAssessment ? connectionRecommendationLabels[connectionAssessment.recommendation] : "מוכן להערכת חיבור"}</strong></div>
              <div><span>דרך מומלצת</span><strong>{connectionAssessment?.preferredMethod ? connectionMethodLabels[connectionAssessment.preferredMethod] ?? connectionAssessment.preferredMethod : "טרם נקבעה"}</strong></div>
              <div><span>מיקום</span><strong>{form.location_label || "כניסה ראשית"}</strong></div>
              <div><span>מטרות ניטור</span><strong>{form.monitoring_targets.length} נבחרו</strong></div>
            </div>
          </section>
          <section className="do-camera-events-card" aria-labelledby="camera-events-title">
            <div className="do-camera-summary-section-head"><div><Radar /><h3 id="camera-events-title">אירועים אחרונים</h3></div><span className="do-badge warn">ממתין לחיבור</span></div>
            <div className="do-camera-events-readiness">
              <span><Radar /></span>
              <strong>עדיין אין אירועים</strong>
              <p>לא יוצגו זיהויים או שעות לפני שמקור המצלמה יחובר ויאושר.</p>
            </div>
          </section>
        </div>
      </div>
      <div className="do-notice info"><ShieldCheck /><span>השמירה יוצרת מקור מוכנות עם המלצת חיבור מתועדת. וידאו, AI והתראות יתחילו רק לאחר חיבור מאובטח והסכמה מתאימה.</span></div>
    </section> : null}
    <ResultMessage state={state} /><div className="do-wizard-actions">{step < 4 ? <button className="do-button primary" type="button" disabled={step === 2 && (form.display_name.trim().length < 2 || assessmentBusy || !connectionAssessment)} onClick={() => goToStep(step + 1)}>המשך <ChevronLeft /></button> : <button className="do-button primary" type="button" disabled={state.busy || !form.observer_site_id || form.display_name.trim().length < 2} onClick={submit}>שמירת מקור המצלמה</button>}{step > 1 ? <button className="do-button secondary" type="button" onClick={() => goToStep(step - 1)}>חזרה</button> : <button className="do-button secondary" type="button" onClick={exitWizard}>ביטול</button>}</div>
  </div>;
}

function observerQuickActionScope(endpoint: string, body: unknown, confirmText?: string) {
  let nodes = 0;
  let characters = 0;
  const ancestors = new Set<object>();
  function bounded(text: string) {
    characters += text.length;
    if (characters > 16384) throw new Error("Unsupported quick-action identity size");
    return text;
  }
  function encode(value: unknown, depth: number): string {
    if (++nodes > 1024 || depth > 16) throw new Error("Unsupported quick-action identity depth");
    if (value === undefined) return "undefined";
    if (value === null) return "null";
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return bounded(JSON.stringify(value));
    if (typeof value !== "object") throw new Error("Unsupported quick-action identity value");
    const array = Array.isArray(value);
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== null && prototype !== (array ? Array.prototype : Object.prototype)) throw new Error("Unsupported quick-action identity prototype");
    const customJson = Object.getOwnPropertyDescriptor(value, "toJSON") ?? (prototype && Object.getOwnPropertyDescriptor(prototype, "toJSON"));
    if (customJson && (!("value" in customJson) || typeof customJson.value === "function")) throw new Error("Unsupported quick-action identity serialization");
    if (ancestors.has(value)) throw new Error("Unsupported quick-action identity cycle");
    ancestors.add(value);
    try {
      if (array) {
        const length = Object.getOwnPropertyDescriptor(value, "length");
        if (!length || !("value" in length) || !Number.isSafeInteger(length.value) || length.value > 1024) throw new Error("Unsupported quick-action identity array");
        const parts: string[] = [];
        for (let index = 0; index < length.value; index += 1) {
          const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
          if (!descriptor || !("value" in descriptor)) throw new Error("Unsupported quick-action identity element");
          parts.push(descriptor.value === undefined ? "null" : encode(descriptor.value, depth + 1));
        }
        return bounded(`[${parts.join(",")}]`);
      }
      const keys = Object.keys(value).sort();
      if (keys.length > 1024) throw new Error("Unsupported quick-action identity keys");
      const parts: string[] = [];
      for (const key of keys) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !("value" in descriptor)) throw new Error("Unsupported quick-action identity property");
        if (descriptor.value !== undefined) parts.push(`${bounded(JSON.stringify(key))}:${encode(descriptor.value, depth + 1)}`);
      }
      return bounded(`{${parts.join(",")}}`);
    } finally { ancestors.delete(value); }
  }
  try { return JSON.stringify([endpoint, confirmText || null, "json", encode(body, 0)]); }
  catch {
    // Preserve existing click-time serialization for custom/unsupported bodies.
    // Body-target equivalence is NOT proven within this fallback scope.
    return JSON.stringify([endpoint, confirmText || null, "unsupported"]);
  }
}

export function ObserverQuickAction({ endpoint, body, children, confirmText, onDone }: { endpoint: string; body: unknown; children: ReactNode; confirmText?: string; onDone?: () => void }) {
  return <ScopedObserverQuickAction key={observerQuickActionScope(endpoint, body, confirmText)} endpoint={endpoint} body={body} confirmText={confirmText} onDone={onDone}>{children}</ScopedObserverQuickAction>;
}

function ScopedObserverQuickAction({ endpoint, body, children, confirmText, onDone }: Parameters<typeof ObserverQuickAction>[0]) {
  const router = useRouter();
  const [state, setState] = useState<ActionState>({ busy: false, error: "", message: "" });
  const owner = useRef({ active: true, operation: 0, busy: false });
  useEffect(() => {
    const lifetime = owner.current;
    lifetime.active = true;
    return () => { lifetime.active = false; lifetime.operation += 1; lifetime.busy = false; };
  }, []);
  async function run() {
    const lifetime = owner.current;
    if (!lifetime.active || lifetime.busy) return;
    lifetime.busy = true;
    const operation = ++lifetime.operation;
    const isCurrent = () => lifetime.active && lifetime.operation === operation;
    const submittedEndpoint = endpoint;
    const submittedBody = body;
    const submittedOnDone = onDone;
    try {
      if (confirmText && !window.confirm(confirmText)) return;
      if (!isCurrent()) return;
      setState({ busy: true, error: "", message: "" });
      try {
        const data = await postJson(submittedEndpoint, submittedBody, undefined, isCurrent);
        if (!isCurrent()) return;
        setState({ busy: false, error: "", message: data.message || "הפעולה הושלמה" });
        if (!isCurrent()) return;
        submittedOnDone?.();
        if (!isCurrent()) return;
        router.refresh();
      } catch (error) {
        if (isCurrent()) setState({ busy: false, error: error instanceof Error ? error.message : "הפעולה נכשלה", message: "" });
      }
    } finally { if (isCurrent()) lifetime.busy = false; }
  }
  return <div className="do-inline-action"><button className="do-button secondary" type="button" onClick={run} disabled={state.busy}>{state.busy ? <LoaderCircle className="do-spin" /> : null}{children}</button><ResultMessage state={state} /></div>;
}

export function ObserverCameraNameForm({ camera }: { camera: any }) {
  return <ScopedObserverCameraNameForm key={camera.id} camera={camera} />;
}

function ScopedObserverCameraNameForm({ camera }: Parameters<typeof ObserverCameraNameForm>[0]) {
  const router = useRouter();
  const [name, setName] = useState(camera.display_name || "");
  const [location, setLocation] = useState(camera.location_label || "");
  const [zone, setZone] = useState(camera.metadata?.zone_type || "");
  const [lineEnabled, setLineEnabled] = useState(Boolean(camera.metadata?.crossing_line));
  const [lineAxis, setLineAxis] = useState(camera.metadata?.crossing_line?.axis || "x");
  const [linePosition, setLinePosition] = useState(Number(camera.metadata?.crossing_line?.position ?? 0.5) * 100);
  const [lineInside, setLineInside] = useState(camera.metadata?.crossing_line?.inside || "positive");
  const [state, setState] = useState<ActionState>({ busy: false, error: "", message: "" });
  const owner = useRef({ active: true, operation: 0, busy: false, revision: 0 });
  const [renderedRevision, setRenderedRevision] = useState(0);
  useEffect(() => {
    const lifetime = owner.current;
    lifetime.active = true;
    return () => { lifetime.active = false; lifetime.operation += 1; lifetime.busy = false; };
  }, []);
  function editDraft<Value>(previous: Value, readValue: () => Value, setValue: (value: Value) => void) {
    if (!owner.current.active) return;
    const next = readValue();
    if (Object.is(previous, next)) return;
    const revision = ++owner.current.revision;
    setRenderedRevision(revision);
    setValue(next);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    const lifetime = owner.current;
    if (!lifetime.active) return;
    event.preventDefault();
    if (lifetime.busy || lifetime.revision !== renderedRevision) return;
    lifetime.busy = true;
    const operation = ++lifetime.operation;
    const submittedRevision = lifetime.revision;
    const isCurrent = () => lifetime.active && lifetime.operation === operation;
    setState({ busy: true, error: "", message: "" });
    try {
      const result = await postJson("/api/digital-observer/cameras", {
        action: "rename",
        id: camera.id,
        display_name: name,
        location_label: location,
        zone_type: zone || undefined,
        crossing_line: lineEnabled ? { axis: lineAxis, position: linePosition / 100, inside: lineInside } : null
      }, undefined, isCurrent);
      if (!isCurrent()) return;
      const unchanged = lifetime.revision === submittedRevision;
      setState({ busy: false, error: "", message: unchanged ? result.message : `${result.message} השינויים החדשים בטופס טרם נשלחו.` });
      if (isCurrent() && unchanged && lifetime.revision === submittedRevision) router.refresh();
    } catch (error) {
      if (!isCurrent()) return;
      setState({ busy: false, error: error instanceof Error ? error.message : "לא ניתן לעדכן את שם המצלמה", message: "" });
    } finally {
      if (isCurrent()) lifetime.busy = false;
    }
  }
  const suggestedName = typeof camera.metadata?.ai_suggested_name === "string" ? camera.metadata.ai_suggested_name : null;
  return <form className="do-camera-name-form" onSubmit={submit}>
    <div className="do-form-grid">
      <label className="do-field"><span>שם המצלמה</span><input value={name} onChange={(event) => editDraft(name, () => event.target.value, setName)} minLength={2} maxLength={100} required /></label>
      <label className="do-field"><span>חלל או מיקום</span><input value={location} onChange={(event) => editDraft(location, () => event.target.value, setLocation)} maxLength={100} placeholder="למשל: כניסה, סלון או חניה" /></label>
      <label className="do-field"><span>סוג אזור לזיהוי אירועים</span><select value={zone} onChange={event => editDraft(zone, () => event.target.value, setZone)}><option value="">לא מופה — פעילות כללית בלבד</option><option value="POOL">בריכה</option><option value="PARKING">חנייה</option><option value="ENTRANCE">כניסה</option><option value="PERIMETER">היקף וגדר</option><option value="INDOOR">חלל פנימי</option></select></label>
      <label className="do-check"><input type="checkbox" checked={lineEnabled} onChange={event => editDraft(lineEnabled, () => event.target.checked, setLineEnabled)} /><span>הגדרת קו מעבר לכניסה ויציאה</span></label>
      {lineEnabled ? <><label className="do-field"><span>כיוון הקו בתמונה</span><select value={lineAxis} onChange={event => editDraft(lineAxis, () => event.target.value, setLineAxis)}><option value="x">אנכי</option><option value="y">אופקי</option></select></label><label className="do-field"><span>מיקום הקו באחוזים משמאל / מלמעלה</span><input type="number" min={5} max={95} required value={linePosition} onChange={event => editDraft(linePosition, () => Number(event.target.value), setLinePosition)} /></label><label className="do-field"><span>הצד הפנימי של האזור</span><select value={lineInside} onChange={event => editDraft(lineInside, () => event.target.value, setLineInside)}><option value="positive">ימינה / למטה מהקו</option><option value="negative">שמאלה / למעלה מהקו</option></select></label></> : <p>ללא קו מעבר לא ניתן להסיק כיוון כניסה או יציאה. זיהויי חירום מיוחדים דורשים מודל מתאים ומאומת.</p>}
    </div>
    {suggestedName && suggestedName !== camera.display_name ? <button className="do-camera-name-suggestion" type="button" onClick={() => editDraft(name, () => suggestedName, setName)}>הצעת התצפיתן: {suggestedName}</button> : null}
    <button className="do-button primary" type="submit" disabled={state.busy || name.trim().length < 2}>{state.busy ? <LoaderCircle className="do-spin" /> : <Check />} שמירת שם</button>
    <ResultMessage state={state} />
  </form>;
}

export function ObserverCameraInlineRename({ camera }: { camera: any }) {
  return <ScopedObserverCameraInlineRename key={camera.id} camera={camera} />;
}

function ScopedObserverCameraInlineRename({ camera }: Parameters<typeof ObserverCameraInlineRename>[0]) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(camera.display_name || "");
  const [state, setState] = useState<ActionState>({ busy: false, error: "", message: "" });

  const owner = useRef({ active: true, session: 0, editing: false, operation: 0, busy: false, revision: 0 });
  const [session, setSession] = useState(0);
  const [renderedRevision, setRenderedRevision] = useState(0);
  const ownsEdit = () => owner.current.active && owner.current.editing && owner.current.session === session;
  useEffect(() => {
    const lifetime = owner.current;
    lifetime.active = true;
    return () => { lifetime.active = false; lifetime.operation += 1; lifetime.busy = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    if (!ownsEdit()) return;
    event.preventDefault();
    event.stopPropagation();
    const lifetime = owner.current;
    if (lifetime.busy || lifetime.revision !== renderedRevision) return;
    lifetime.busy = true;
    const operation = ++lifetime.operation;
    const submittedRevision = lifetime.revision;
    const isCurrent = () => ownsEdit() && lifetime.operation === operation;
    setState({ busy: true, error: "", message: "" });
    try {
      await postJson("/api/digital-observer/cameras", {
        action: "rename",
        id: camera.id,
        display_name: name,
        location_label: camera.location_label || ""
      }, undefined, isCurrent);
      if (!isCurrent()) return;
      if (lifetime.revision !== submittedRevision) {
        setState({ busy: false, error: "", message: "השינוי שנשלח נשמר. השם החדש בטופס טרם נשלח." });
        return;
      }
      setEditing(false);
      if (!isCurrent()) return;
      setState({ busy: false, error: "", message: "" });
      if (!isCurrent()) return;
      router.refresh();
      if (isCurrent()) { lifetime.editing = false; lifetime.session += 1; setSession(lifetime.session); lifetime.operation += 1; lifetime.busy = false; }
    } catch (error) {
      if (!isCurrent()) return;
      setState({ busy: false, error: error instanceof Error ? error.message : "לא ניתן לעדכן את שם המצלמה", message: "" });
    } finally {
      if (isCurrent()) lifetime.busy = false;
    }
  }

  if (editing) return <form className="do-camera-inline-rename" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
    <input value={name} onChange={(event) => { if (!ownsEdit() || name === event.target.value) return; setRenderedRevision(++owner.current.revision); setName(event.target.value); }} minLength={2} maxLength={100} required autoFocus aria-label="שם המצלמה" />
    <button type="submit" disabled={state.busy || name.trim().length < 2} aria-label="שמירת שם המצלמה" title="שמירת שם">{state.busy ? <LoaderCircle className="do-spin" /> : <Check />}</button>
    <button type="button" onClick={() => { if (!ownsEdit()) return; const lifetime = owner.current; lifetime.session += 1; setSession(lifetime.session); lifetime.operation += 1; lifetime.editing = false; lifetime.busy = false; lifetime.revision = 0; setRenderedRevision(0); setName(camera.display_name || ""); setEditing(false); setState({ busy: false, error: "", message: "" }); }} aria-label="ביטול שינוי שם" title="ביטול"><X /></button>
    {state.error ? <span role="alert">{state.error}</span> : null}
    {state.message ? <span role="status">{state.message}</span> : null}
  </form>;

  return <button className="do-camera-rename-trigger" type="button" onClick={(event) => { const lifetime = owner.current; if (!lifetime.active || lifetime.editing || lifetime.session !== session) return; event.preventDefault(); event.stopPropagation(); lifetime.session += 1; setSession(lifetime.session); lifetime.editing = true; lifetime.operation += 1; lifetime.busy = false; lifetime.revision = 0; setRenderedRevision(0); setEditing(true); }} aria-label={`עריכת השם ${camera.display_name || "מצלמה"}`} title="עריכת שם מצלמה"><Pencil /></button>;
}

function useObserverSiteFormSubmission(failureMessage: string, resetOnSuccess: boolean) {
  const router = useRouter();
  const [state, setState] = useState<ActionState>({ busy: false, error: "", message: "" });
  const formRef = useRef<HTMLFormElement>(null);
  const owner = useRef({ active: true, operation: 0, busy: false, revision: 0 });
  useEffect(() => {
    const lifetime = owner.current;
    lifetime.active = true;
    return () => { lifetime.active = false; lifetime.operation += 1; lifetime.busy = false; };
  }, []);
  function markEdited() {
    if (owner.current.active) owner.current.revision += 1;
  }
  async function submit(event: FormEvent<HTMLFormElement>, path: string, buildBody: (data: FormData) => unknown) {
    const lifetime = owner.current;
    if (!lifetime.active) return;
    event.preventDefault();
    if (lifetime.busy) return;
    const form = event.currentTarget;
    if (form !== formRef.current) return;
    lifetime.busy = true;
    const operation = ++lifetime.operation;
    const submittedRevision = lifetime.revision;
    const isCurrent = () => lifetime.active && lifetime.operation === operation && formRef.current === form;
    try {
      const data = new FormData(form);
      setState({ busy: true, error: "", message: "" });
      const result = await postJson(path, buildBody(data), undefined, isCurrent);
      if (!isCurrent()) return;
      const unchanged = lifetime.revision === submittedRevision;
      setState({ busy: false, error: "", message: unchanged ? result.message : `${result.message} השינויים החדשים בטופס טרם נשלחו.` });
      if (!isCurrent() || !unchanged) return;
      if (resetOnSuccess) form.reset();
      if (!isCurrent() || lifetime.revision !== submittedRevision) return;
      router.refresh();
    } catch (error) {
      if (!isCurrent()) return;
      setState({ busy: false, error: error instanceof Error ? error.message : failureMessage, message: "" });
    } finally {
      if (isCurrent()) lifetime.busy = false;
    }
  }
  return { state, formRef, markEdited, submit };
}

export function ObserverRuleForm({ siteId, cameras }: { siteId: string; cameras: any[] }) {
  return <ScopedObserverRuleForm key={siteId} siteId={siteId} cameras={cameras} />;
}

function ScopedObserverRuleForm({ siteId, cameras }: Parameters<typeof ObserverRuleForm>[0]) {
  const { state, formRef, markEdited, submit } = useObserverSiteFormSubmission("לא ניתן לשמור כלל", true);
  return <form ref={formRef} className="do-panel do-form-section do-observer-chat" onChange={markEdited} onSubmit={event => submit(event, "/api/digital-observer/watch-requests", data => ({ action: "create", observer_site_id: siteId, camera_source_id: data.get("camera_source_id") || null, title: data.get("title"), description: data.get("description"), watch_type: data.get("watch_type"), priority: Number(data.get("priority") || 5), schedule_mode: data.get("schedule_mode") }))}><h2>דברו עם התצפיתן</h2><p>כתבו מה חשוב לכם והוא יהפוך את הבקשה לכלל מסודר. הכלל נשמר מיד; ניתוח וידאו יופעל רק כשהספקים מחוברים.</p><div className="do-form-grid"><label className="do-field"><span>שם הכלל</span><input name="title" required minLength={2} placeholder="למשל: תנועה אחרי שעות" /></label><label className="do-field"><span>מצלמה</span><select name="camera_source_id"><option value="">כל המצלמות</option>{cameras.map((camera) => <option key={camera.id} value={camera.id}>{camera.display_name}</option>)}</select></label><label className="do-field"><span>סוג</span><select name="watch_type"><option value="after_hours_activity">פעילות מחוץ לשעות</option><option value="restricted_area_entry">כניסה לאזור מוגבל</option><option value="camera_obstruction">מצלמה מכוסה</option><option value="door_left_open">דלת נשארה פתוחה</option><option value="movement_in_area">תנועה באזור</option><option value="custom_text_instruction">הנחיה מותאמת</option></select></label><label className="do-field"><span>לוח זמנים</span><select name="schedule_mode"><option value="always_active">תמיד</option><option value="business_hours">שעות פעילות</option><option value="night_only">לילה</option></select></label><label className="do-field full"><span>מה חשוב לבדוק?</span><textarea name="description" rows={4} required placeholder="לדוגמה: שים לב אם דלת הכניסה נשארת פתוחה יותר מחמש דקות אחרי 22:00" /></label><label className="do-field"><span>רמת דחיפות 1–10</span><input name="priority" type="number" min={1} max={10} defaultValue={5} /></label></div><button className="do-button primary" disabled={state.busy} type="submit"><Radar /> שמירת בקשה לתצפיתן</button><ResultMessage state={state} /></form>;
}

export function ObserverKnownPersonForm({ siteId }: { siteId: string }) {
  return <ScopedObserverKnownPersonForm key={siteId} siteId={siteId} />;
}

function ScopedObserverKnownPersonForm({ siteId }: Parameters<typeof ObserverKnownPersonForm>[0]) {
  const { state, formRef, markEdited, submit } = useObserverSiteFormSubmission("לא ניתן לשמור", true);
  return <form ref={formRef} className="do-panel do-form-section" onChange={markEdited} onSubmit={event => submit(event, "/api/digital-observer/known-people", data => ({ action: "create", observer_site_id: siteId, display_name: data.get("display_name"), relationship_label: data.get("relationship_label"), consent_confirmed: data.get("consent") === "on", notify_on_detection: data.get("notify") === "on" }))}><h2>הוספת אדם מוכר</h2><p>המערכת לא מפעילה זיהוי פנים נסתר. תמונה ועיבוד ביומטרי יתווספו רק לאחר הסכמה וחיבור מאושר.</p><div className="do-form-grid"><label className="do-field"><span>שם</span><input name="display_name" required minLength={2} /></label><label className="do-field"><span>קשר</span><input name="relationship_label" placeholder="בן משפחה / עובד / בעל גישה" /></label></div><label className="do-check"><input name="consent" type="checkbox" /><span>קיימת הסכמה מפורשת לתהליך ההגדרה</span></label><label className="do-check"><input name="notify" type="checkbox" /><span>להכין התראה כאשר הזיהוי יהיה פעיל</span></label><button className="do-button primary" type="submit" disabled={state.busy}>שמירה במצב מוכנות</button><ResultMessage state={state} /></form>;
}

export function ObserverSettingsForm({ siteId, schedule, channels, consent = {} }: { siteId: string; schedule?: any; channels: any[]; consent?: Record<string, unknown> }) {
  return <ScopedObserverSettingsForm key={siteId} siteId={siteId} schedule={schedule} channels={channels} consent={consent} />;
}

function ScopedObserverSettingsForm({ siteId, schedule, channels, consent = {} }: Parameters<typeof ObserverSettingsForm>[0]) {
  const { state, formRef, markEdited, submit } = useObserverSiteFormSubmission("לא ניתן לשמור", false);
  const enabled = (channel: string) => Boolean(channels.find((item) => item.channel === channel)?.enabled);
  const quiet = schedule?.schedule?.quiet_hours ?? {};
  return <form ref={formRef} className="do-panel do-form-section" onChange={markEdited} onSubmit={event => submit(event, "/api/digital-observer/settings", data => ({ observer_site_id: siteId, schedule_mode: data.get("schedule_mode"), quiet_start: data.get("quiet_start") || undefined, quiet_end: data.get("quiet_end") || undefined, in_app: data.get("in_app") === "on", email: data.get("email") === "on", push: data.get("push") === "on", sms: data.get("sms") === "on", whatsapp: data.get("whatsapp") === "on", monitoring_consent: data.get("monitoring_consent") === "on", safe_action_consent: data.get("safe_action_consent") === "on", model_improvement_consent: data.get("model_improvement_consent") === "on" }))}>
    <h2>ניטור והתראות</h2>
    <div className="do-form-grid"><label className="do-field"><span>מצב ניטור</span><select name="schedule_mode" defaultValue={schedule?.schedule_mode || "event_only"}><option value="event_only">סביב אירועים בלבד</option><option value="night_only">לילה</option><option value="business_hours">שעות פעילות</option><option value="custom_schedule">לוח מותאם</option><option value="24_7">24/7 לאחר אישור הפעלה</option></select></label><label className="do-field"><span>שעות שקטות</span><span className="do-time-fields"><input aria-label="התחלה" name="quiet_start" type="time" defaultValue={quiet.start || "23:00"} /><input aria-label="סיום" name="quiet_end" type="time" defaultValue={quiet.end || "06:00"} /></span></label></div>
    <div className="do-channel-grid"><label><input name="in_app" type="checkbox" defaultChecked={enabled("in_app") || !channels.length} /><Bell /><span><strong>בתוך האפליקציה</strong><small>Sandbox פנימי ללא ספק חיצוני</small></span></label><label><input name="email" type="checkbox" defaultChecked={enabled("email")} /><Bell /><span><strong>דוא״ל</strong><small>העדפה בלבד; הספק כבוי</small></span></label><label><input name="push" type="checkbox" defaultChecked={enabled("push")} /><Bell /><span><strong>Push</strong><small>העדפה ורישום מכשיר בלבד; מסירה חיצונית כבויה</small></span></label><label><input name="sms" type="checkbox" defaultChecked={enabled("sms")} /><Bell /><span><strong>SMS</strong><small>העדפה בלבד; הספק כבוי</small></span></label><label><input name="whatsapp" type="checkbox" defaultChecked={enabled("whatsapp")} /><Bell /><span><strong>WhatsApp</strong><small>העדפה בלבד; הספק כבוי</small></span></label></div>
    <div className="do-consent-grid"><label className="do-check"><input name="monitoring_consent" type="checkbox" defaultChecked={consent.observer_monitoring_consent === true} /><span><strong>ניטור ולמידת שגרת המקום</strong><small>ניתוח אירועים מהמצלמות הפעילות ובניית קו בסיס מקומי.</small></span></label><label className="do-check"><input name="safe_action_consent" type="checkbox" defaultChecked={consent.observer_safe_action_consent === true} /><span><strong>פעולות בטוחות שאושרו מראש</strong><small>צילום, הקלטה והתראות. פעולות פיזיות דורשות אישור בכל הפעלה.</small></span></label><label className="do-check"><input name="model_improvement_consent" type="checkbox" defaultChecked={consent.model_improvement_consent === true} /><span><strong>שיפור המודל הכללי</strong><small>תובנות מנותקות מזהות בלבד, ללא וידאו גולמי, כתובות או סיסמאות.</small></span></label></div>
    <button className="do-button primary" type="submit" disabled={state.busy}>שמירת הגדרות והסכמות</button><ResultMessage state={state} />
  </form>;
}

export function ObserverRecipientsDevicesForm({ siteId, recipients, devices }: { siteId: string; recipients: any[]; devices: any[] }) {
  return <ScopedObserverRecipientsDevicesForm key={siteId} siteId={siteId} recipients={recipients} devices={devices} />;
}

function ScopedObserverRecipientsDevicesForm({ siteId, recipients, devices }: Parameters<typeof ObserverRecipientsDevicesForm>[0]) {
  const router = useRouter();
  const [recipientState, setRecipientState] = useState<ActionState>({ busy: false, error: "", message: "" });
  const formRef = useRef<HTMLFormElement>(null);
  const owner = useRef({ active: true, operation: 0, busy: false, revision: 0 });
  useEffect(() => {
    const lifetime = owner.current;
    lifetime.active = true;
    return () => { lifetime.active = false; lifetime.operation += 1; lifetime.busy = false; };
  }, []);
  const hasActivePushDevice = devices.some((device) => device.active && device.platform === "web");

  async function addRecipient(event: FormEvent<HTMLFormElement>) {
    const lifetime = owner.current;
    if (!lifetime.active) return;
    event.preventDefault();
    if (lifetime.busy) return;
    const form = event.currentTarget;
    if (form !== formRef.current) return;
    lifetime.busy = true;
    const operation = ++lifetime.operation;
    const submittedRevision = lifetime.revision;
    const isCurrent = () => lifetime.active && lifetime.operation === operation && formRef.current === form;
    try {
      const data = new FormData(form);
      const channels = data.getAll("recipient_channels").map(String);
      setRecipientState({ busy: true, error: "", message: "" });
      const result = await postJson("/api/digital-observer/access-settings", {
        action: "create_recipient",
        observer_site_id: siteId,
        display_name: data.get("display_name"),
        relationship_label: data.get("relationship_label"),
        destination: data.get("destination"),
        channels,
        receives_critical_alerts: data.get("critical") === "on"
      }, undefined, isCurrent);
      if (!isCurrent()) return;
      const unchanged = lifetime.revision === submittedRevision;
      setRecipientState({ busy: false, error: "", message: unchanged ? result.message : `${result.message} הפרטים החדשים בטופס טרם נשלחו.` });
      if (!isCurrent() || !unchanged) return;
      form.reset();
      if (!isCurrent() || lifetime.revision !== submittedRevision) return;
      router.refresh();
    } catch (error) {
      if (!isCurrent()) return;
      setRecipientState({ busy: false, error: error instanceof Error ? error.message : "לא ניתן לשמור מורשה", message: "" });
    } finally {
      if (isCurrent()) lifetime.busy = false;
    }
  }

  return <section className="do-grid cols-2">
    <form ref={formRef} className="do-panel do-form-section" onSubmit={addRecipient} onChange={() => { if (owner.current.active) owner.current.revision += 1; }}>
      <div className="do-section-head"><div><h2>מורשי עדכונים</h2><p>פרטי הקשר מוצפנים ואינם מוצגים מחדש.</p></div><UserPlus /></div>
      <div className="do-form-grid"><label className="do-field"><span>שם</span><input name="display_name" required minLength={2} /></label><label className="do-field"><span>קשר</span><input name="relationship_label" placeholder="בן משפחה / מנהל / אחראי" /></label><label className="do-field full"><span>דוא״ל או טלפון</span><input name="destination" required autoComplete="off" placeholder="נשמר מוצפן בצד השרת" /></label></div>
      <div className="do-channel-inline"><label><input type="checkbox" name="recipient_channels" value="email" defaultChecked /> דוא״ל</label><label><input type="checkbox" name="recipient_channels" value="sms" /> SMS</label><label><input type="checkbox" name="recipient_channels" value="whatsapp" /> WhatsApp</label><label><input type="checkbox" name="recipient_channels" value="voice" /> שיחה</label></div>
      <label className="do-check"><input type="checkbox" name="critical" /><span>מורשה לקבל אירועים קריטיים לאחר חיבור ספק ואישור הפעלה</span></label>
      <button className="do-button primary" type="submit" disabled={recipientState.busy}>{recipientState.busy ? <LoaderCircle className="do-spin" /> : <UserPlus />} הוספת מורשה</button>
      <ResultMessage state={recipientState} />
      {recipients.length ? <div className="do-row-list">{recipients.map((recipient) => <div className="do-row" key={recipient.id}><Bell /><span className="do-row-main"><strong>{recipient.display_name}</strong><small>{recipient.destination_hint || "פרטי קשר שמורים"} · {(recipient.channels || []).join(", ")}</small></span><ObserverQuickAction endpoint="/api/digital-observer/access-settings" body={{ action: "delete_recipient", id: recipient.id }} confirmText="להסיר את מורשה העדכונים?"><Trash2 /> הסרה</ObserverQuickAction></div>)}</div> : null}
    </form>
    <article className="do-panel do-form-section">
      <div className="do-section-head"><div><h2>מכשירים מחוברים</h2><p>עד שני מכשירים פעילים לכל אתר.</p></div><Smartphone /></div>
      <div className="do-device-limit"><strong>{devices.filter((device) => device.active).length}/2</strong><span>חריצי מכשיר בשימוש</span></div>
      <ObserverFcmPushRegistration siteId={siteId} initialRegistered={hasActivePushDevice} />
      {devices.length ? <div className="do-row-list">{devices.map((device) => <div className="do-row" key={device.id}><Smartphone /><span className="do-row-main"><strong>{device.device_label}</strong><small>{device.platform} · {device.active ? "פעיל" : "נותק"}</small></span>{device.active ? <ObserverQuickAction endpoint="/api/digital-observer/access-settings" body={{ action: "revoke_device", id: device.id }} confirmText="לנתק את המכשיר?"><Trash2 /> ניתוק</ObserverQuickAction> : <span className="do-badge warn">נותק</span>}</div>)}</div> : <div className="do-empty"><Smartphone /><strong>אין מכשיר רשום</strong><span>לחצו על הפעלת Push כדי לרשום את המכשיר ב־Firebase.</span></div>}
    </article>
  </section>;
}

export function ObserverPlanButton({ siteId, packageId, billingCycle = "monthly" }: { siteId: string; packageId: string; billingCycle?: "monthly" | "annual" }) {
  const [idempotencyKey] = useState(() => globalThis.crypto?.randomUUID?.() ?? `${siteId}-${packageId}-${Date.now()}`);
  return <ObserverQuickAction endpoint="/api/digital-observer/billing" body={{ action: "change_plan", observer_site_id: siteId, package_id: packageId, billing_cycle: billingCycle, idempotency_key: idempotencyKey }}><ShieldCheck /> בקשת שינוי מסלול</ObserverQuickAction>;
}

export function ObserverCancelSubscriptionButton({ siteId }: { siteId: string }) {
  const [idempotencyKey] = useState(() => globalThis.crypto?.randomUUID?.() ?? `${siteId}-cancel-${Date.now()}`);
  return <ObserverQuickAction endpoint="/api/digital-observer/billing" body={{ action: "cancel", observer_site_id: siteId, reason: "Customer self-service cancellation", idempotency_key: idempotencyKey }} confirmText="לתזמן את ביטול המנוי לסוף התקופה?"><Trash2 /> תזמון ביטול</ObserverQuickAction>;
}

export function ObserverRefundButton({ siteId, paymentEventId, amountMinor, currency }: {
  siteId: string;
  paymentEventId: string;
  amountMinor: number;
  currency: string;
}) {
  const [idempotencyKey] = useState(() => globalThis.crypto?.randomUUID?.() ?? `${siteId}-${paymentEventId}-refund-${Date.now()}`);
  return <ObserverQuickAction
    endpoint="/api/digital-observer/billing"
    body={{ action: "refund", observer_site_id: siteId, payment_event_id: paymentEventId, amount_minor: amountMinor,
      currency, reason: "Customer requested full refund review", idempotency_key: idempotencyKey }}
    confirmText="לבקש בדיקה ואישור להחזר מלא? ההחזר לא ייחשב כמושלם עד אישור ספק התשלום."
  ><RotateCcw /> בקשת החזר</ObserverQuickAction>;
}

export function ObserverDeletePersonButton({ id }: { id: string }) {
  return <ObserverQuickAction endpoint="/api/digital-observer/known-people" body={{ action: "delete", id }} confirmText="למחוק את רשומת האדם המוכר?"><Trash2 /> מחיקה</ObserverQuickAction>;
}
