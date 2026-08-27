"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Baby, Bell, BrainCircuit, Cable, Camera, CameraOff, CarFront, Check, ChevronLeft, Cloud, DoorOpen, HardDrive, Heart, HeartPulse, Image, Lightbulb, LoaderCircle, LockKeyhole, Mic, Moon, PawPrint, QrCode, Radar, Router, ShieldCheck, Smartphone, Trash2, UserPlus, UsersRound } from "lucide-react";
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

type ActionState = { busy: boolean; error: string; message: string };

async function postJson(path: string, body: unknown, accessToken?: string | null) {
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
  const payload = await response.json().catch(() => ({}));
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
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<ActionState>({ busy: false, error: "", message: "" });
  const emptyAddress: ObserverAddressFormValue = { address_query: "", city: "", street: "", building_number: "", apartment_number: "", floor_kind: "floor", floor_number: "", postal_code: "", address_place_id: "", address_session_token: "", formatted_address: "", address_verification_status: "unverified" };
  const initialTemplate = getObserverSiteTemplate(defaultType === "home" ? "home" : "custom");
  const [form, setForm] = useState({ name: "", site_type: defaultType, site_template: initialTemplate.key, business_handles_children: false, vision_privacy_mode: "standard_consent", ...emptyAddress, camera_count: 1, branch_count: 1, active_days: ["sun", "mon", "tue", "wed", "thu"], opening_time: "08:00", closing_time: "18:00", schedule_mode: defaultType === "home" ? "event_only" : "business_hours", package_id: "", monitoring_targets: defaultType === "home" ? [] : initialTemplate.defaultTargets });
  const update = (key: string, value: any) => setForm((current) => ({ ...current, [key]: value }));
  const toggleTarget = (value: string) => update("monitoring_targets", form.monitoring_targets.includes(value) ? form.monitoring_targets.filter((item) => item !== value) : [...form.monitoring_targets, value]);
  const weekdays = [["sun", "א׳"], ["mon", "ב׳"], ["tue", "ג׳"], ["wed", "ד׳"], ["thu", "ה׳"], ["fri", "ו׳"], ["sat", "ש׳"]] as const;
  const toggleDay = (value: string) => update("active_days", form.active_days.includes(value) ? form.active_days.filter((item) => item !== value) : [...form.active_days, value]);
  function chooseSiteTemplate(key: ObserverSiteTemplateKey) {
    const template = getObserverSiteTemplate(key);
    setForm((current) => ({
      ...current,
      site_template: template.key,
      business_handles_children: template.childPrivacyRequired,
      vision_privacy_mode: template.childPrivacyRequired ? "skeleton_only" : "standard_consent",
      monitoring_targets: template.defaultTargets
    }));
  }
  async function submit() {
    setState({ busy: true, error: "", message: "" });
    try {
      const data = await postJson(
        "/api/digital-observer/onboarding",
        { ...form, package_id: form.package_id || null }
      );
      setState({ busy: false, error: "", message: "האתר הוקם ותקופת ניסיון של 14 יום נפתחה ללא חיוב." });
      router.push(data.next);
      router.refresh();
    } catch (error) {
      setState({ busy: false, error: error instanceof Error ? error.message : "לא ניתן להשלים את ההקמה", message: "" });
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
  const validStep = step === detailsStep ? form.name.trim().length >= 2 && addressValid : step === cameraStep ? form.camera_count > 0 : true;
  return (
    <div className="do-wizard">
      <div className="do-stepper" aria-label="שלבי הקמה">{stepLabels.map((label, index) => <div className={step >= index + 1 ? "active" : ""} key={label}><b>{step > index + 1 ? <Check /> : index + 1}</b><span>{label}</span></div>)}</div>
      {step === detailsStep ? <section className="do-panel do-form-section"><h2>{defaultType === "home" ? "פרטי הבית" : "פרטי העסק"}</h2><p>המסלול נבחר בהרשמה ונשמר בחשבון. האתר נשמר כמוצר עצמאי ואינו מקושר לגן בטוח.</p>{form.site_type === "business" ? <div className="do-business-registration-grid"><label className="do-field wide"><span>שם העסק</span><input value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="הקלידו שם עסק" /></label><label className="do-field"><span>סוג העסק</span><select value={form.site_template} onChange={(event) => chooseSiteTemplate(event.target.value as ObserverSiteTemplateKey)}>{observerSiteTemplates.filter((template) => template.key !== "home").map((template) => <option value={template.key} key={template.key}>{template.label}</option>)}</select></label><label className="do-field"><span>מספר סניפים</span><input type="number" min={1} max={100} value={form.branch_count} onChange={(event) => update("branch_count", Math.max(1, Number(event.target.value) || 1))} /></label><label className="do-field wide"><span>ימי פעילות</span><span className="do-weekday-row">{weekdays.map(([value, label]) => <button type="button" className={form.active_days.includes(value) ? "selected" : ""} onClick={() => toggleDay(value)} key={value}>{label}</button>)}</span></label><label className="do-field"><span>משעה</span><input type="time" value={form.opening_time} onChange={(event) => update("opening_time", event.target.value)} /></label><label className="do-field"><span>עד שעה</span><input type="time" value={form.closing_time} onChange={(event) => update("closing_time", event.target.value)} /></label></div> : <div className="do-form-grid"><label className="do-field full"><span>שם הבית</span><input value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="הבית שלי" /></label></div>}<ObserverAddressFields value={form} collapsibleDetails={form.site_type === "business"} onChange={(address) => setForm((current) => ({ ...current, ...address }))} />{form.site_type === "business" ? <div className="do-privacy-choice"><label className="do-check"><input type="checkbox" checked={form.business_handles_children} onChange={(event) => setForm((current) => ({ ...current, business_handles_children: event.target.checked, site_template: event.target.checked ? "child_education" : current.site_template === "child_education" ? "custom" : current.site_template, vision_privacy_mode: event.target.checked ? "skeleton_only" : "standard_consent" }))} /><span><strong>העסק מטפל בילדים</strong><small>גן, בית ספר, צהרון או מסגרת ילדים. במצב זה ניתוח הווידאו מוגבל לזיהוי שלד ותנועה ללא זיהוי פנים של ילדים.</small></span></label></div> : null}<div className="do-notice info"><ShieldCheck /><span>הווידאו, התמונות והאירועים נשמרים רק בחשבון שלכם ובהרשאות שבחרתם. הם אינם משותפים ללקוחות אחרים ואינם משמשים לזיהוי של אדם אצל משתמש אחר.</span></div></section> : null}
      {step === cameraStep ? <section className="do-panel do-form-section"><h2>{defaultType === "home" ? "התקנת מצלמות" : "הגדרות המערכת"}</h2><p>{defaultType === "home" ? "המספר משמש להתאמת חבילה בלבד. אין כאן חיבור חי." : "הגדירו את היקף המערכת ואת שעות הניטור. חיבור המצלמות עצמו יבוצע במסך הבא."}</p><div className="do-camera-scope-row"><div><span>מספר מצלמות משוער</span><div className="do-counter"><button type="button" aria-label="הפחתה" onClick={() => update("camera_count", Math.max(1, form.camera_count - 1))}>−</button><strong>{form.camera_count}</strong><button type="button" aria-label="הוספה" onClick={() => update("camera_count", Math.min(500, form.camera_count + 1))}>+</button></div></div><label className="do-field"><span>מתי לנטר?</span><select value={form.schedule_mode} onChange={(event) => update("schedule_mode", event.target.value)}><option value="event_only">רק סביב אירועים</option><option value="night_only">לילה</option><option value="business_hours">שעות פעילות</option><option value="24_7">24/7 לאחר הפעלה מאושרת</option><option value="custom_schedule">לוח מותאם</option></select></label></div><div className="do-notice info"><Camera /><span>מצלמות אינן מתחברות בשלב הזה. אחרי פתיחת תקופת הניסיון תעברו לאשף חיבור מאובטח עם QR, יצרן, NVR/DVR או Gateway.</span></div></section> : null}
      {step === targetsStep ? <section className="do-panel do-form-section"><h2>{defaultType === "home" ? "מה הכי חשוב לכם?" : "מה תרצו לנטר?"}</h2><p>{defaultType === "home" ? "בחרו את הדברים החשובים בבית, כדי שנוכל להתאים עבורכם התראות חכמות ומדויקות." : "התצפיתן מתחיל מיעדי התבנית שבחרתם. אפשר לשנות דגשים בלי לבנות כללים טכניים."}</p><div className={`do-toggle-grid ${defaultType === "home" ? "do-home-priority-grid" : ""}`}>{monitoringOptions.map(([value,label]) => { const TargetIcon = defaultType === "home" ? homeMonitoringIcons[value] ?? Radar : Radar; const selected = form.monitoring_targets.includes(value); return <button type="button" className={selected ? "selected" : ""} onClick={() => toggleTarget(value)} key={value}><TargetIcon /><span>{label}</span>{defaultType === "home" ? <span className="do-option-check" aria-hidden="true">{selected ? <Check /> : null}</span> : selected ? <Check /> : null}</button>; })}</div>{defaultType === "home" ? <p className="do-onboarding-change-note">ניתן לשנות את ההעדפות בכל עת</p> : null}{defaultType === "business" ? <div className="do-notice warn"><ShieldCheck /><span>גניבה, שוד, עימות או אלימות יוצגו תמיד כחשד עם ראיות ורמת ביטחון. נדרשת החלטה אנושית; אין חיוג או פעולה אוטומטית.</span></div> : null}{defaultType === "business" && form.vision_privacy_mode === "skeleton_only" ? <div className="do-notice good"><ShieldCheck /><span>מצב פרטיות לילדים פעיל: זיהוי שלד, תנועה ודפוסים בלבד. זיהוי פנים ואודיו אינם חלק מהמסלול הזה.</span></div> : defaultType === "business" ? <div className="do-notice info"><ShieldCheck /><span>אנשים מוכרים יוצעו רק לאחר תצפיות חוזרות, וכל שמירה תחייב הסכמה מפורשת. לא מופעל זיהוי ביומטרי חי בשלב זה.</span></div> : null}</section> : null}
      {step === 4 ? <section className="do-panel do-form-section"><h2>בחירת חבילה והתחלת ניסיון</h2><p>החבילה קובעת את מגבלות המצלמות והשמירה. תקופת הניסיון נמשכת 14 יום.</p><div className="do-plan-grid">{packages.filter((item) => item.package_type === form.site_type || (form.site_type === "business" && item.package_type === "enterprise")).map((item) => <label className={form.package_id === item.id ? "do-plan selected" : "do-plan"} key={item.id}><input type="radio" name="package_id" value={item.id} checked={form.package_id === item.id} onChange={() => update("package_id", item.id)} /><strong>{item.name}</strong><b>{Number(item.monthly_price || 0).toLocaleString("he-IL")} ₪</b><span>14 ימי ניסיון</span><span>עד {item.camera_limit ?? "לפי הסכם"} מצלמות</span><span>שמירת מקטעים עד {item.recording_retention_hours ?? 0} שעות</span></label>)}</div><div className="do-notice info"><ShieldCheck /><span>ספק התשלום עדיין אינו מחובר, לכן לא ייאסף כרטיס ולא יתבצע חיוב. בתקופת הפיילוט ניתן להגדיר ולבדוק מצלמות; ניטור חי ו-AI יופעלו רק לאחר חיבור ואישור הספקים.</span></div></section> : null}
      <ResultMessage state={state} />
      <div className="do-wizard-actions">{step > 1 ? <button className="do-button secondary" type="button" onClick={() => setStep((value) => value - 1)}>חזרה</button> : <span />}{step < 4 ? <button className="do-button primary" type="button" disabled={!validStep} onClick={() => setStep((value) => value + 1)}>המשך <ChevronLeft /></button> : <button className="do-button primary" type="button" disabled={state.busy || !form.package_id} onClick={submit}>{state.busy ? <LoaderCircle className="do-spin" /> : null}התחלת 14 ימי ניסיון והמשך <ChevronLeft /></button>}</div>
    </div>
  );
}

export function ObserverCameraWizard({ sites, initialSiteId }: { sites: any[]; initialSiteId?: string }) {
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
  const update = (key: string, value: any) => setForm((current) => ({ ...current, [key]: value }));
  const toggleTarget = (value: string) => update("monitoring_targets", form.monitoring_targets.includes(value) ? form.monitoring_targets.filter((item) => item !== value) : [...form.monitoring_targets, value]);
  async function submit() {
    setState({ busy: true, error: "", message: "" });
    try {
      const data = await postJson("/api/digital-observer/cameras", { action: "create", ...form, preview_scene: form.preview_scene || null });
      setState({ busy: false, error: "", message: data.message });
      router.push(`/digital-observer/cameras?site=${form.observer_site_id}&camera=${data.camera.id}`);
      router.refresh();
    } catch (error) { setState({ busy: false, error: error instanceof Error ? error.message : "לא ניתן לשמור מצלמה", message: "" }); }
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
  function chooseMethod(method: ObserverCameraPairingMethod) {
    const descriptor = observerCameraConnectionMethods.find((item) => item.key === method) ?? observerCameraConnectionMethods[0];
    setForm((current) => ({ ...current, pairing_method: method, connector_type: descriptor.connectorType, pairing_payload_kind: "unknown" }));
    setScanState("");
  }
  async function scanQrImage(file?: File) {
    if (!file) return;
    setScanState("קורא את הקוד במכשיר...");
    try {
      const Detector = (window as any).BarcodeDetector;
      if (!Detector) {
        setScanState("הדפדפן אינו תומך בסריקה ישירה. אפשר להמשיך דרך אפליקציית היצרן או Gateway.");
        return;
      }
      const detector = new Detector({ formats: ["qr_code"] });
      const bitmap = await createImageBitmap(file);
      const codes = await detector.detect(bitmap);
      bitmap.close();
      const rawValue = String(codes[0]?.rawValue || "");
      if (!rawValue) {
        setScanState("לא נמצא קוד QR ברור בתמונה. נסו שוב בתאורה טובה.");
        return;
      }
      const payloadKind = classifyObserverPairingPayload(rawValue);
      setForm((current) => ({ ...current, pairing_payload_kind: payloadKind, connector_type: connectorTypeForPairing(current.pairing_method, payloadKind) }));
      setScanState(`הקוד זוהה וסווג כ-${payloadKind === "web_link" ? "קישור יצרן" : payloadKind === "vendor_code" ? "קוד מכשיר" : payloadKind.toUpperCase()}. תוכן הקוד לא נשמר.`);
    } catch {
      setScanState("לא ניתן לקרוא את הקוד. תוכן התמונה לא הועלה ולא נשמר.");
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
      <button className="do-button navy full" type="button" onClick={() => { chooseMethod("qr_scan"); setStep(2); }}>המשך</button>
      <label className="do-button secondary full"><Camera /> סריקת קוד QR<input type="file" accept="image/*" capture="environment" onChange={(event) => { chooseMethod("qr_scan"); void scanQrImage(event.target.files?.[0]); setStep(2); }} /></label>
      <small>או גללו לבחירת חיבור דרך יצרן, רשת, NVR/DVR או Gateway.</small>
    </section> : null}
    {step === 1 ? <section className="do-panel do-form-section do-camera-connector-selection"><h2>הוספת מצלמה</h2><p>בחרו את סוג החיבור המוכר לכם. התצפיתן יציג רק את הפרטים הנדרשים למסלול הזה.</p><div className="do-connector-grid do-pairing-grid do-primary-pairing-grid">{primaryPairingMethods.map((method) => { const PairingIcon = primaryPairingIcons[method.key] ?? Camera; return <button type="button" className={form.pairing_method === method.key ? "selected" : ""} onClick={() => chooseMethod(method.key)} key={method.key}><PairingIcon /><strong>{primaryPairingLabels[method.key] ?? method.label}</strong><span>{method.shortDescription}</span>{form.pairing_method === method.key ? <Check /> : <ChevronLeft />}</button>; })}</div><details className="do-additional-pairing"><summary>אפשרויות נוספות: QR, ‏Gateway ומצלמת הדמיה</summary><div className="do-connector-grid do-pairing-grid">{additionalPairingMethods.map((method) => { const PairingIcon = primaryPairingIcons[method.key] ?? Camera; return <button type="button" className={form.pairing_method === method.key ? "selected" : ""} onClick={() => chooseMethod(method.key)} key={method.key}><PairingIcon /><strong>{method.label}</strong><span>{method.shortDescription}</span><b className="do-badge info">{method.badge}</b>{form.pairing_method === method.key ? <Check /> : null}</button>; })}</div></details><div className="do-notice info"><ShieldCheck /><span>פרטי חיבור רגישים נשמרים רק ב-Gateway או בכספת השרת, ולא בדפדפן.</span></div></section> : null}
    {step === 2 ? <section className="do-panel do-form-section do-camera-test-step"><div className="do-section-head"><div><h2>בדיקת חיבור</h2><p>נבדוק את החיבור למצלמה בלי לחשוף סיסמה בדפדפן.</p></div><span className={selectedMethod.requiresGateway ? "do-badge warn" : "do-badge info"}>{selectedMethod.requiresGateway ? "דורש Gateway" : "בדיקה מאובטחת"}</span></div><div className="do-camera-connection-form"><div className="do-form-grid"><label className="do-field"><span>אתר</span><select value={form.observer_site_id} onChange={(event) => update("observer_site_id", event.target.value)}>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label><label className="do-field"><span>שם המצלמה</span><input value={form.display_name} onChange={(event) => update("display_name", event.target.value)} placeholder="מצלמת כניסה" /></label><label className="do-field"><span>מיקום</span><input value={form.location_label} onChange={(event) => update("location_label", event.target.value)} placeholder="כניסה ראשית" /></label><label className="do-field"><span>יצרן / מתאם</span><select value={form.connector_provider} onChange={(event) => update("connector_provider", event.target.value)}>{observerCameraManufacturers.map((manufacturer) => <option key={manufacturer.value} value={manufacturer.value}>{manufacturer.label}</option>)}</select></label></div><dl className="do-connection-facts"><div><dt>סוג חיבור</dt><dd>{primaryPairingLabels[selectedMethod.key] ?? selectedMethod.label}</dd></div><div><dt>מתאם</dt><dd>{selectedMethod.requiresGateway ? "Gateway מקומי" : "ONVIF / ספק מאושר"}</dd></div><div><dt>סטטוס</dt><dd>מוכן לבדיקה</dd></div></dl></div><div className="do-camera-test-preview"><ObserverCameraMedia name={previewName} scene={previewMode === "home" ? "home-entry" : "business-entry"} mode={previewMode} status="readiness" sourceMode={form.connector_type === "demo" ? "demo" : "readiness"} /><div className="do-camera-preview-controls" aria-label="בקרות תצוגה במצב מוכנות"><span>תצוגה מקדימה</span><button type="button" disabled aria-label="השהיה"><Camera /></button><button type="button" disabled aria-label="שמע"><Mic /></button><button type="button" disabled aria-label="צילום"><Image /></button></div></div><div className="do-connection-check-result"><span><Check /></span><div><strong>הפרטים מוכנים לבדיקה</strong><small>החיבור ייבדק בפועל לאחר חיבור Gateway או ספק מאושר.</small></div><b>{selectedMethod.requiresGateway ? "ממתין ל-Gateway" : "ממתין לספק"}</b></div>{form.pairing_method === "qr_scan" ? <div className="do-qr-capture"><label className="do-button secondary"><QrCode /> צילום או בחירת קוד QR<input type="file" accept="image/*" capture="environment" onChange={(event) => void scanQrImage(event.target.files?.[0])} /></label>{scanState ? <p>{scanState}</p> : <span>הסריקה מתבצעת במכשיר. התמונה ותוכן הקוד אינם נשמרים.</span>}</div> : null}<details className="do-camera-test-help"><summary>הוראות חיבור מפורטות</summary><div className="do-pairing-instructions"><div><strong>מה צריך להכין</strong><ul>{selectedMethod.requiredItems.map((item) => <li key={item}>{item}</li>)}</ul></div><ol>{selectedMethod.steps.map((item) => <li key={item}>{item}</li>)}</ol></div></details></section> : null}
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
              <div><span>מצב</span><strong>{form.connector_type === "demo" ? "הדמיה בטוחה" : selectedMethod.requiresGateway ? "מוכן להגדרת Gateway" : "מוכן לאימות ספק"}</strong></div>
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
      <div className="do-notice info"><ShieldCheck /><span>השמירה יוצרת מקור מוכנות בלבד. וידאו, AI והתראות יתחילו רק לאחר חיבור מאובטח והסכמה מתאימה.</span></div>
    </section> : null}
    <ResultMessage state={state} /><div className="do-wizard-actions">{step < 4 ? <button className="do-button primary" type="button" disabled={step === 2 && form.display_name.trim().length < 2} onClick={() => setStep((value) => value + 1)}>המשך <ChevronLeft /></button> : <button className="do-button primary" type="button" disabled={state.busy || !form.observer_site_id || form.display_name.trim().length < 2} onClick={submit}>שמירת מקור המצלמה</button>}{step > 1 ? <button className="do-button secondary" type="button" onClick={() => setStep((value) => value - 1)}>חזרה</button> : <button className="do-button secondary" type="button" onClick={() => router.push("/digital-observer/cameras")}>ביטול</button>}</div>
  </div>;
}

export function ObserverQuickAction({ endpoint, body, children, confirmText, onDone }: { endpoint: string; body: unknown; children: ReactNode; confirmText?: string; onDone?: () => void }) {
  const router = useRouter();
  const [state, setState] = useState<ActionState>({ busy: false, error: "", message: "" });
  async function run() {
    if (confirmText && !window.confirm(confirmText)) return;
    setState({ busy: true, error: "", message: "" });
    try { const data = await postJson(endpoint, body); setState({ busy: false, error: "", message: data.message || "הפעולה הושלמה" }); onDone?.(); router.refresh(); }
    catch (error) { setState({ busy: false, error: error instanceof Error ? error.message : "הפעולה נכשלה", message: "" }); }
  }
  return <div className="do-inline-action"><button className="do-button secondary" type="button" onClick={run} disabled={state.busy}>{state.busy ? <LoaderCircle className="do-spin" /> : null}{children}</button><ResultMessage state={state} /></div>;
}

export function ObserverRuleForm({ siteId, cameras }: { siteId: string; cameras: any[] }) {
  const router = useRouter();
  const [state, setState] = useState<ActionState>({ busy: false, error: "", message: "" });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    setState({ busy: true, error: "", message: "" });
    try { const result = await postJson("/api/digital-observer/watch-requests", { action: "create", observer_site_id: siteId, camera_source_id: data.get("camera_source_id") || null, title: data.get("title"), description: data.get("description"), watch_type: data.get("watch_type"), priority: Number(data.get("priority") || 5), schedule_mode: data.get("schedule_mode") }); setState({ busy: false, error: "", message: result.message }); event.currentTarget.reset(); router.refresh(); }
    catch (error) { setState({ busy: false, error: error instanceof Error ? error.message : "לא ניתן לשמור כלל", message: "" }); }
  }
  return <form className="do-panel do-form-section do-observer-chat" onSubmit={submit}><h2>דברו עם התצפיתן</h2><p>כתבו מה חשוב לכם והוא יהפוך את הבקשה לכלל מסודר. הכלל נשמר מיד; ניתוח וידאו יופעל רק כשהספקים מחוברים.</p><div className="do-form-grid"><label className="do-field"><span>שם הכלל</span><input name="title" required minLength={2} placeholder="למשל: תנועה אחרי שעות" /></label><label className="do-field"><span>מצלמה</span><select name="camera_source_id"><option value="">כל המצלמות</option>{cameras.map((camera) => <option key={camera.id} value={camera.id}>{camera.display_name}</option>)}</select></label><label className="do-field"><span>סוג</span><select name="watch_type"><option value="after_hours_activity">פעילות מחוץ לשעות</option><option value="restricted_area_entry">כניסה לאזור מוגבל</option><option value="camera_obstruction">מצלמה מכוסה</option><option value="door_left_open">דלת נשארה פתוחה</option><option value="movement_in_area">תנועה באזור</option><option value="custom_text_instruction">הנחיה מותאמת</option></select></label><label className="do-field"><span>לוח זמנים</span><select name="schedule_mode"><option value="always_active">תמיד</option><option value="business_hours">שעות פעילות</option><option value="night_only">לילה</option></select></label><label className="do-field full"><span>מה חשוב לבדוק?</span><textarea name="description" rows={4} required placeholder="לדוגמה: שים לב אם דלת הכניסה נשארת פתוחה יותר מחמש דקות אחרי 22:00" /></label><label className="do-field"><span>רמת דחיפות 1–10</span><input name="priority" type="number" min={1} max={10} defaultValue={5} /></label></div><button className="do-button primary" disabled={state.busy} type="submit"><Radar /> שמירת בקשה לתצפיתן</button><ResultMessage state={state} /></form>;
}

export function ObserverKnownPersonForm({ siteId }: { siteId: string }) {
  const router = useRouter(); const [state, setState] = useState<ActionState>({ busy: false, error: "", message: "" });
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); setState({ busy: true, error: "", message: "" }); try { const result = await postJson("/api/digital-observer/known-people", { action: "create", observer_site_id: siteId, display_name: data.get("display_name"), relationship_label: data.get("relationship_label"), consent_confirmed: data.get("consent") === "on", notify_on_detection: data.get("notify") === "on" }); setState({ busy: false, error: "", message: result.message }); event.currentTarget.reset(); router.refresh(); } catch (error) { setState({ busy: false, error: error instanceof Error ? error.message : "לא ניתן לשמור", message: "" }); } }
  return <form className="do-panel do-form-section" onSubmit={submit}><h2>הוספת אדם מוכר</h2><p>המערכת לא מפעילה זיהוי פנים נסתר. תמונה ועיבוד ביומטרי יתווספו רק לאחר הסכמה וחיבור מאושר.</p><div className="do-form-grid"><label className="do-field"><span>שם</span><input name="display_name" required minLength={2} /></label><label className="do-field"><span>קשר</span><input name="relationship_label" placeholder="בן משפחה / עובד / בעל גישה" /></label></div><label className="do-check"><input name="consent" type="checkbox" /><span>קיימת הסכמה מפורשת לתהליך ההגדרה</span></label><label className="do-check"><input name="notify" type="checkbox" /><span>להכין התראה כאשר הזיהוי יהיה פעיל</span></label><button className="do-button primary" type="submit" disabled={state.busy}>שמירה במצב מוכנות</button><ResultMessage state={state} /></form>;
}

export function ObserverSettingsForm({ siteId, schedule, channels }: { siteId: string; schedule?: any; channels: any[] }) {
  const router = useRouter(); const [state, setState] = useState<ActionState>({ busy: false, error: "", message: "" });
  const enabled = (channel: string) => Boolean(channels.find((item) => item.channel === channel)?.enabled);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); setState({ busy: true, error: "", message: "" }); try { const result = await postJson("/api/digital-observer/settings", { observer_site_id: siteId, schedule_mode: data.get("schedule_mode"), quiet_start: data.get("quiet_start") || undefined, quiet_end: data.get("quiet_end") || undefined, in_app: data.get("in_app") === "on", email: data.get("email") === "on", push: data.get("push") === "on", sms: data.get("sms") === "on", whatsapp: data.get("whatsapp") === "on" }); setState({ busy: false, error: "", message: result.message }); router.refresh(); } catch (error) { setState({ busy: false, error: error instanceof Error ? error.message : "לא ניתן לשמור", message: "" }); } }
  const quiet = schedule?.schedule?.quiet_hours ?? {};
  return <form className="do-panel do-form-section" onSubmit={submit}><h2>ניטור והתראות</h2><div className="do-form-grid"><label className="do-field"><span>מצב ניטור</span><select name="schedule_mode" defaultValue={schedule?.schedule_mode || "event_only"}><option value="event_only">סביב אירועים בלבד</option><option value="night_only">לילה</option><option value="business_hours">שעות פעילות</option><option value="custom_schedule">לוח מותאם</option><option value="24_7">24/7 לאחר אישור הפעלה</option></select></label><label className="do-field"><span>שעות שקטות</span><span className="do-time-fields"><input aria-label="התחלה" name="quiet_start" type="time" defaultValue={quiet.start || "23:00"} /><input aria-label="סיום" name="quiet_end" type="time" defaultValue={quiet.end || "06:00"} /></span></label></div><div className="do-channel-grid"><label><input name="in_app" type="checkbox" defaultChecked={enabled("in_app") || !channels.length} /><Bell /><span><strong>בתוך האפליקציה</strong><small>פעיל במצב הדגמה</small></span></label><label><input name="email" type="checkbox" defaultChecked={enabled("email")} /><Bell /><span><strong>דוא״ל</strong><small>מצב mock עד ספק</small></span></label><label><input name="push" type="checkbox" defaultChecked={enabled("push")} /><Bell /><span><strong>Push</strong><small>דורש הגדרת אפליקציה</small></span></label><label><input name="sms" type="checkbox" defaultChecked={enabled("sms")} /><Bell /><span><strong>SMS</strong><small>כבוי ללא ספק</small></span></label><label><input name="whatsapp" type="checkbox" defaultChecked={enabled("whatsapp")} /><Bell /><span><strong>WhatsApp</strong><small>כבוי ללא ספק מאושר</small></span></label></div><button className="do-button primary" type="submit" disabled={state.busy}>שמירת הגדרות</button><ResultMessage state={state} /></form>;
}

export function ObserverRecipientsDevicesForm({ siteId, recipients, devices }: { siteId: string; recipients: any[]; devices: any[] }) {
  const router = useRouter();
  const [recipientState, setRecipientState] = useState<ActionState>({ busy: false, error: "", message: "" });
  const [deviceState, setDeviceState] = useState<ActionState>({ busy: false, error: "", message: "" });

  async function addRecipient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const channels = data.getAll("recipient_channels").map(String);
    setRecipientState({ busy: true, error: "", message: "" });
    try {
      const result = await postJson("/api/digital-observer/access-settings", {
        action: "create_recipient",
        observer_site_id: siteId,
        display_name: data.get("display_name"),
        relationship_label: data.get("relationship_label"),
        destination: data.get("destination"),
        channels,
        receives_critical_alerts: data.get("critical") === "on"
      });
      setRecipientState({ busy: false, error: "", message: result.message });
      form.reset();
      router.refresh();
    } catch (error) {
      setRecipientState({ busy: false, error: error instanceof Error ? error.message : "לא ניתן לשמור מורשה", message: "" });
    }
  }

  async function registerDevice() {
    setDeviceState({ busy: true, error: "", message: "" });
    try {
      const storageKey = "digital_observer_device_reference";
      const existing = window.localStorage.getItem(storageKey);
      const reference = existing || crypto.randomUUID();
      if (!existing) window.localStorage.setItem(storageKey, reference);
      const result = await postJson("/api/digital-observer/access-settings", {
        action: "register_device",
        observer_site_id: siteId,
        device_label: /Mobi|Android/i.test(navigator.userAgent) ? "המכשיר הנייד שלי" : "הדפדפן שלי",
        platform: "web",
        device_reference: reference
      });
      setDeviceState({ busy: false, error: "", message: result.message });
      router.refresh();
    } catch (error) {
      setDeviceState({ busy: false, error: error instanceof Error ? error.message : "לא ניתן לרשום מכשיר", message: "" });
    }
  }

  return <section className="do-grid cols-2">
    <form className="do-panel do-form-section" onSubmit={addRecipient}>
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
      <button className="do-button secondary" type="button" onClick={registerDevice} disabled={deviceState.busy}>{deviceState.busy ? <LoaderCircle className="do-spin" /> : <Smartphone />} רישום המכשיר הזה</button>
      <ResultMessage state={deviceState} />
      {devices.length ? <div className="do-row-list">{devices.map((device) => <div className="do-row" key={device.id}><Smartphone /><span className="do-row-main"><strong>{device.device_label}</strong><small>{device.platform} · {device.active ? "פעיל" : "נותק"}</small></span>{device.active ? <ObserverQuickAction endpoint="/api/digital-observer/access-settings" body={{ action: "revoke_device", id: device.id }} confirmText="לנתק את המכשיר?"><Trash2 /> ניתוק</ObserverQuickAction> : <span className="do-badge warn">נותק</span>}</div>)}</div> : <div className="do-empty"><Smartphone /><strong>אין מכשיר רשום</strong><span>Push אינו פעיל עד חיבור FCM/APNs/Web Push.</span></div>}
    </article>
  </section>;
}

export function ObserverPlanButton({ siteId, packageId, billingCycle = "monthly" }: { siteId: string; packageId: string; billingCycle?: "monthly" | "annual" }) {
  return <ObserverQuickAction endpoint="/api/digital-observer/billing" body={{ observer_site_id: siteId, package_id: packageId, billing_cycle: billingCycle }}><ShieldCheck /> בחירת החבילה במצב הדגמה</ObserverQuickAction>;
}

export function ObserverDeletePersonButton({ id }: { id: string }) {
  return <ObserverQuickAction endpoint="/api/digital-observer/known-people" body={{ action: "delete", id }} confirmText="למחוק את רשומת האדם המוכר?"><Trash2 /> מחיקה</ObserverQuickAction>;
}
