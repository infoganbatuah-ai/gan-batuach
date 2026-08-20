"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bell, Camera, Check, ChevronLeft, LoaderCircle, Radar, ShieldCheck, Trash2 } from "lucide-react";
import { digitalObserverConnectorTypes, getDigitalObserverConnector } from "@/lib/domain/digital-observer/connectors";

type ActionState = { busy: boolean; error: string; message: string };

async function postJson(path: string, body: unknown) {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
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
  const [form, setForm] = useState({ name: "", site_type: defaultType, address: "", camera_count: 1, schedule_mode: defaultType === "home" ? "event_only" : "business_hours", package_id: "", monitoring_targets: ["person"] });
  const update = (key: string, value: any) => setForm((current) => ({ ...current, [key]: value }));
  const toggleTarget = (value: string) => update("monitoring_targets", form.monitoring_targets.includes(value) ? form.monitoring_targets.filter((item) => item !== value) : [...form.monitoring_targets, value]);
  async function submit() {
    setState({ busy: true, error: "", message: "" });
    try {
      const data = await postJson("/api/digital-observer/onboarding", { ...form, package_id: form.package_id || null });
      setState({ busy: false, error: "", message: "האתר הוקם במצב הכנה בטוח. ממשיכים לחיבור המצלמה." });
      router.push(data.next);
      router.refresh();
    } catch (error) {
      setState({ busy: false, error: error instanceof Error ? error.message : "לא ניתן להשלים את ההקמה", message: "" });
    }
  }
  const validStep = step === 1 ? form.name.trim().length >= 2 : step === 2 ? form.camera_count > 0 : true;
  return (
    <div className="do-wizard">
      <div className="do-stepper" aria-label="שלבי הקמה">{["פרטי המקום", "מצלמות", "מה לנטר", "חבילה וסיום"].map((label, index) => <div className={step >= index + 1 ? "active" : ""} key={label}><b>{step > index + 1 ? <Check /> : index + 1}</b><span>{label}</span></div>)}</div>
      {step === 1 ? <section className="do-panel do-form-section"><h2>הגדרת המקום</h2><p>האתר נשמר כמוצר עצמאי ואינו מקושר לגן בטוח.</p><div className="do-choice-grid"><label className="do-choice"><input type="radio" name="site_type" checked={form.site_type === "home"} onChange={() => update("site_type", "home")} /><ShieldCheck /><strong>בית</strong><span>משפחה, כניסה, חצר ובעלי חיים</span></label><label className="do-choice"><input type="radio" name="site_type" checked={form.site_type === "business"} onChange={() => update("site_type", "business")} /><Radar /><strong>עסק</strong><span>סניפים, שעות פעילות וצוות</span></label></div><div className="do-form-grid"><label className="do-field"><span>שם המקום</span><input value={form.name} onChange={(event) => update("name", event.target.value)} placeholder={form.site_type === "home" ? "הבית שלי" : "שם העסק"} /></label><label className="do-field"><span>כתובת</span><input value={form.address} onChange={(event) => update("address", event.target.value)} placeholder="עיר, רחוב ומספר" /></label></div></section> : null}
      {step === 2 ? <section className="do-panel do-form-section"><h2>כמה מצלמות יחוברו?</h2><p>המספר משמש להתאמת חבילה בלבד. אין כאן חיבור חי.</p><div className="do-counter"><button type="button" aria-label="הפחתה" onClick={() => update("camera_count", Math.max(1, form.camera_count - 1))}>−</button><strong>{form.camera_count}</strong><button type="button" aria-label="הוספה" onClick={() => update("camera_count", Math.min(500, form.camera_count + 1))}>+</button></div><label className="do-field"><span>מתי לנטר?</span><select value={form.schedule_mode} onChange={(event) => update("schedule_mode", event.target.value)}><option value="event_only">רק סביב אירועים</option><option value="night_only">לילה</option><option value="business_hours">שעות פעילות</option><option value="24_7">24/7 לאחר הפעלה מאושרת</option><option value="custom_schedule">לוח מותאם</option></select></label></section> : null}
      {step === 3 ? <section className="do-panel do-form-section"><h2>למה התצפיתן ישים לב?</h2><p>הבחירה יוצרת מטרות מוכנות. AI חי אינו מופעל בשלב הזה.</p><div className="do-toggle-grid">{[["person","אדם"],["unknown_person","אדם לא מוכר"],["animal","בעל חיים"],["entry_exit","כניסה ויציאה"],["after_hours","פעילות מחוץ לשעות"],["camera_obstruction","מצלמה מכוסה"],["restricted_area","אזור מוגבל"],["door_left_open","דלת שנשארה פתוחה"]].map(([value,label]) => <button type="button" className={form.monitoring_targets.includes(value) ? "selected" : ""} onClick={() => toggleTarget(value)} key={value}><Radar /><span>{label}</span>{form.monitoring_targets.includes(value) ? <Check /> : null}</button>)}</div></section> : null}
      {step === 4 ? <section className="do-panel do-form-section"><h2>חבילה ומצב הפעלה</h2><p>בחירת חבילה אינה מחייבת כרטיס ואינה מבצעת חיוב.</p><div className="do-plan-grid">{packages.filter((item) => item.package_type === form.site_type || item.package_type === "enterprise").map((item) => <label className={form.package_id === item.id ? "do-plan selected" : "do-plan"} key={item.id}><input type="radio" name="package_id" value={item.id} checked={form.package_id === item.id} onChange={() => update("package_id", item.id)} /><strong>{item.name}</strong><b>{Number(item.monthly_price || 0).toLocaleString("he-IL")} ₪</b><span>עד {item.camera_limit ?? "לפי הסכם"} מצלמות</span><span>שמירת מקטעים עד {item.recording_retention_hours ?? 0} שעות</span></label>)}</div><div className="do-notice info"><ShieldCheck /><span>המערכת תישאר במצב הדגמה/מוכנות: ללא תשלום, מצלמה חיה, AI חי או הודעה חיצונית.</span></div></section> : null}
      <ResultMessage state={state} />
      <div className="do-wizard-actions">{step > 1 ? <button className="do-button secondary" type="button" onClick={() => setStep((value) => value - 1)}>חזרה</button> : <span />}{step < 4 ? <button className="do-button primary" type="button" disabled={!validStep} onClick={() => setStep((value) => value + 1)}>המשך <ChevronLeft /></button> : <button className="do-button primary" type="button" disabled={state.busy || !form.package_id} onClick={submit}>שמירת האתר והמשך <ChevronLeft /></button>}</div>
    </div>
  );
}

export function ObserverCameraWizard({ sites, initialSiteId }: { sites: any[]; initialSiteId?: string }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<ActionState>({ busy: false, error: "", message: "" });
  const [form, setForm] = useState({ observer_site_id: initialSiteId || sites[0]?.id || "", display_name: "", location_label: "", connector_type: "demo", connector_provider: "generic", monitoring_targets: ["person"], preview_scene: "" });
  const update = (key: string, value: any) => setForm((current) => ({ ...current, [key]: value }));
  const toggleTarget = (value: string) => update("monitoring_targets", form.monitoring_targets.includes(value) ? form.monitoring_targets.filter((item) => item !== value) : [...form.monitoring_targets, value]);
  async function submit() {
    setState({ busy: true, error: "", message: "" });
    try {
      const data = await postJson("/api/digital-observer/cameras", { action: "create", ...form, preview_scene: form.preview_scene || null });
      setState({ busy: false, error: "", message: data.message });
      router.push(`/digital-observer/cameras?camera=${data.camera.id}`);
      router.refresh();
    } catch (error) { setState({ busy: false, error: error instanceof Error ? error.message : "לא ניתן לשמור מצלמה", message: "" }); }
  }
  const connectorOptions = digitalObserverConnectorTypes.map((type) => {
    const connector = getDigitalObserverConnector(type);
    return [type, connector.label, connector.description] as const;
  });
  return <div className="do-wizard"><div className="do-stepper">{["מקור", "פרטים", "מטרות", "סיום"].map((label,index) => <div className={step >= index + 1 ? "active" : ""} key={label}><b>{step > index + 1 ? <Check /> : index + 1}</b><span>{label}</span></div>)}</div>
    {step === 1 ? <section className="do-panel do-form-section"><h2>בחירת מקור המצלמה</h2><p>המוצר בנוי בשכבת מחברים; מקור חדש אינו חושף פרטי גישה בדפדפן.</p><div className="do-connector-grid">{connectorOptions.map(([value,label,text]) => <button type="button" className={form.connector_type === value ? "selected" : ""} onClick={() => update("connector_type", value)} key={value}><Camera /><strong>{label}</strong><span>{text}</span>{form.connector_type === value ? <Check /> : null}</button>)}</div></section> : null}
    {step === 2 ? <section className="do-panel do-form-section"><h2>פרטי המצלמה</h2><div className="do-form-grid"><label className="do-field"><span>אתר</span><select value={form.observer_site_id} onChange={(event) => update("observer_site_id", event.target.value)}>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label><label className="do-field"><span>שם המצלמה</span><input value={form.display_name} onChange={(event) => update("display_name", event.target.value)} placeholder="למשל: כניסה ראשית" /></label><label className="do-field"><span>מיקום</span><input value={form.location_label} onChange={(event) => update("location_label", event.target.value)} placeholder="כניסה, סלון, חצר או מחסן" /></label><label className="do-field"><span>ספק/יצרן</span><input value={form.connector_provider} onChange={(event) => update("connector_provider", event.target.value)} placeholder="Generic / Hikvision / Dahua" /></label></div><div className="do-notice warn"><ShieldCheck /><span>לא מזינים כאן סיסמה, RTSP או כתובת פרטית. פרטים אלה יוגדרו בשלב Gateway בצד השרת.</span></div></section> : null}
    {step === 3 ? <section className="do-panel do-form-section"><h2>מטרות ניטור</h2><div className="do-toggle-grid">{[["person","אדם"],["unknown_person","אדם לא מוכר"],["animal","בעל חיים"],["entry_exit","כניסה ויציאה"],["after_hours","אחרי שעות"],["camera_obstruction","מצלמה מכוסה"],["restricted_area","אזור מוגבל"],["crowding","צפיפות"],["door_left_open","דלת פתוחה"]].map(([value,label]) => <button type="button" className={form.monitoring_targets.includes(value) ? "selected" : ""} onClick={() => toggleTarget(value)} key={value}><Radar /><span>{label}</span>{form.monitoring_targets.includes(value) ? <Check /> : null}</button>)}</div></section> : null}
    {step === 4 ? <section className="do-panel do-form-section"><h2>סיכום חיבור</h2><div className="do-summary-list"><div><span>מקור</span><strong>{connectorOptions.find((item) => item[0] === form.connector_type)?.[1]}</strong></div><div><span>מצלמה</span><strong>{form.display_name || "טרם הוגדר"}</strong></div><div><span>מטרות</span><strong>{form.monitoring_targets.length}</strong></div><div><span>מצב</span><strong>{form.connector_type === "demo" ? "הדמיה בטוחה" : "מוכן להגדרת Gateway"}</strong></div></div></section> : null}
    <ResultMessage state={state} /><div className="do-wizard-actions">{step > 1 ? <button className="do-button secondary" type="button" onClick={() => setStep((value) => value - 1)}>חזרה</button> : <span />}{step < 4 ? <button className="do-button primary" type="button" disabled={step === 2 && form.display_name.trim().length < 2} onClick={() => setStep((value) => value + 1)}>המשך <ChevronLeft /></button> : <button className="do-button primary" type="button" disabled={state.busy || !form.observer_site_id || form.display_name.trim().length < 2} onClick={submit}>שמירת מקור המצלמה</button>}</div>
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
    try { await postJson("/api/observer-watch-requests", { action: "create", observer_site_id: siteId, camera_id: data.get("camera_id") || null, title: data.get("title"), description: data.get("description"), watch_type: data.get("watch_type"), priority: Number(data.get("priority") || 5), schedule_mode: data.get("schedule_mode"), notification_channels: ["in_app"] }); setState({ busy: false, error: "", message: "כלל הניטור נשמר במצב הכנה עם ביקורת אנושית חובה." }); event.currentTarget.reset(); router.refresh(); }
    catch (error) { setState({ busy: false, error: error instanceof Error ? error.message : "לא ניתן לשמור כלל", message: "" }); }
  }
  const selectableCameras = cameras.filter((camera) => Boolean(camera.camera_stream_id));
  return <form className="do-panel do-form-section" onSubmit={submit}><h2>הגדרת “שים לב ל...”</h2><p>הטקסט נשמר ככלל מובנה; אין ביצוע AI חי בסביבת ההכנה.</p><div className="do-form-grid"><label className="do-field"><span>שם הכלל</span><input name="title" required minLength={2} placeholder="למשל: תנועה אחרי שעות" /></label><label className="do-field"><span>מצלמה</span><select name="camera_id"><option value="">כל המצלמות</option>{selectableCameras.map((camera) => <option key={camera.id} value={camera.camera_stream_id}>{camera.display_name}</option>)}</select></label><label className="do-field"><span>סוג</span><select name="watch_type"><option value="after_hours_activity">פעילות מחוץ לשעות</option><option value="restricted_area_entry">כניסה לאזור מוגבל</option><option value="camera_obstruction">מצלמה מכוסה</option><option value="door_left_open">דלת נשארה פתוחה</option><option value="movement_in_area">תנועה באזור</option><option value="custom_text_instruction">הנחיה מותאמת</option></select></label><label className="do-field"><span>לוח זמנים</span><select name="schedule_mode"><option value="always_active">תמיד</option><option value="business_hours">שעות פעילות</option><option value="night_only">לילה</option></select></label><label className="do-field full"><span>מה חשוב לבדוק?</span><textarea name="description" rows={3} placeholder="תארו באופן פשוט את המצב שדורש תשומת לב" /></label><label className="do-field"><span>רמת דחיפות 1–10</span><input name="priority" type="number" min={1} max={10} defaultValue={5} /></label></div><button className="do-button primary" disabled={state.busy} type="submit"><Radar /> שמירת כלל</button><ResultMessage state={state} /></form>;
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

export function ObserverPlanButton({ siteId, packageId, billingCycle = "monthly" }: { siteId: string; packageId: string; billingCycle?: "monthly" | "annual" }) {
  return <ObserverQuickAction endpoint="/api/digital-observer/billing" body={{ observer_site_id: siteId, package_id: packageId, billing_cycle: billingCycle }}><ShieldCheck /> בחירת החבילה במצב הדגמה</ObserverQuickAction>;
}

export function ObserverDeletePersonButton({ id }: { id: string }) {
  return <ObserverQuickAction endpoint="/api/digital-observer/known-people" body={{ action: "delete", id }} confirmText="למחוק את רשומת האדם המוכר?"><Trash2 /> מחיקה</ObserverQuickAction>;
}
