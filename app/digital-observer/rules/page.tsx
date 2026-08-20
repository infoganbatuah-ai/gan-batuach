import Link from "next/link";
import { Activity, Bell, BrainCircuit, Camera, CheckCircle2, Clock3, MapPin, Radar, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import { ObserverQuickAction, ObserverRuleForm } from "@/components/digital-observer/observer-action-forms";
import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { ObserverCameraMedia } from "@/components/digital-observer/observer-camera-media";
import { requireDigitalObserverUser } from "@/lib/domain/digital-observer/access";
import { getDigitalObserverServiceReadiness } from "@/lib/domain/digital-observer/service-readiness";
import { formatObserverDate, loadObserverRuntime, observerEventLabel, observerModeForSite, observerStatusLabel } from "@/lib/domain/digital-observer/runtime";

function learningProgress(startedAt?: string | null, targetDays = 30) {
  if (!startedAt) return { days: 0, percent: 0 };
  const start = new Date(startedAt).getTime();
  if (Number.isNaN(start)) return { days: 0, percent: 0 };
  const days = Math.max(1, Math.min(targetDays, Math.floor((Date.now() - start) / 86_400_000) + 1));
  return { days, percent: Math.round((days / targetDays) * 100) };
}

function baselineLabel(value: string) {
  const labels: Record<string, string> = {
    normal_occupancy_patterns: "נוכחות רגילה",
    normal_movement_patterns: "דפוסי תנועה",
    normal_activity_levels: "רמת פעילות",
    normal_active_hours: "שעות פעילות",
    normal_camera_activity: "התנהגות מצלמות",
    normal_zone_usage: "שימוש באזורים"
  };
  return labels[value] ?? value;
}

export default async function DigitalObserverRulesPage() {
  const { profile } = await requireDigitalObserverUser("/digital-observer/login?next=/digital-observer/rules");
  const runtime = await loadObserverRuntime(profile.id);
  const site = runtime.sites[0] ?? null;
  const mode = observerModeForSite(site);
  const cameras = site ? runtime.cameras.filter((item) => item.observer_site_id === site.id) : [];
  const rules = site ? runtime.watchRequests.filter((item) => item.observer_site_id === site.id) : [];
  const signals = site ? runtime.signals.filter((item) => item.observer_site_id === site.id) : [];
  const baselines = site ? runtime.baselines.filter((item) => item.observer_site_id === site.id) : [];
  const learning = site ? runtime.learningProfiles.find((item) => item.observer_site_id === site.id) : null;
  const targetDays = Number(site?.learning_target_days || 30);
  const progress = learningProgress(site?.learning_started_at, targetDays);
  const readiness = getDigitalObserverServiceReadiness();
  const sourceReady = cameras.some((camera) => ["connected", "healthy", "online", "active"].includes(String(camera.status ?? camera.health_status)));
  const demoOnly = cameras.length > 0 && cameras.every((camera) => camera.source_mode === "demo");
  const runtimeText = !cameras.length
    ? "ממתין למצלמה הראשונה"
    : sourceReady && readiness.ai.configured
      ? "מוכן ללמידת Shadow מבוקרת"
      : demoOnly
        ? "לומד מתרחישי הדמיה בלבד"
        : "ממתין ל-Gateway ולספק AI";

  return (
    <ObserverAppShell profile={profile} mode={mode} activeHref="/digital-observer/rules" title="התצפיתן שלי" statusLabel={runtimeText}>
      <div className="do-page-stack">
        <section className="do-observer-hero">
          <div>
            <span className="do-badge info">מנוע למידה אישי</span>
            <h1>התצפיתן עובד בשבילכם, בלי להמציא פעילות</h1>
            <p>המערכת אוספת רק אירועים ונתוני שגרה מאושרים של האתר שלכם. לאחר 30 ימי למידה היא יכולה להציע חריגות, וכל מסקנה עדיין דורשת בדיקה אנושית.</p>
          </div>
          <div className="do-observer-orbit" aria-label={runtimeText}><Radar /><span>{progress.percent}%</span><small>למידת שגרה</small></div>
        </section>

        {!runtime.locationLearningMigrationApplied ? <div className="do-notice warn"><TriangleAlert /><span>שכבת הכתובת והלמידה החדשה ממתינה למיגרציה. אין להציג את האתר כפעיל עד החלתה.</span></div> : null}

        {site ? <>
          <section className="do-grid cols-4">
            <article className="do-metric"><Camera /><strong>{cameras.length}</strong><span>מצלמות באתר</span></article>
            <article className="do-metric"><Activity /><strong>{signals.length}</strong><span>אירועים שנקלטו</span></article>
            <article className="do-metric"><BrainCircuit /><strong>{progress.days}/{targetDays}</strong><span>ימי למידה</span></article>
            <article className="do-metric"><Bell /><strong>{rules.filter((rule) => rule.active).length}</strong><span>בקשות פעילות</span></article>
          </section>

          <section className="do-grid cols-2 do-observer-command-grid">
            <article className="do-panel">
              <div className="do-section-head"><div><h2>מצב המנוע</h2><p>סטטוס שנגזר מהחיבורים והנתונים הקיימים.</p></div><span className={sourceReady ? "do-badge good" : "do-badge warn"}>{runtimeText}</span></div>
              <div className="do-learning-track" aria-label={`התקדמות למידה ${progress.percent}%`}><span style={{ width: `${progress.percent}%` }} /></div>
              <div className="do-summary-list">
                <div><span>פרופיל למידה</span><strong>{learning ? observerStatusLabel(learning.learning_status) : "יתחיל לאחר הוספת מצלמה"}</strong></div>
                <div><span>בשלות</span><strong>{learning?.learning_maturity === "mature" ? "בשל" : learning?.learning_maturity === "calibrated" ? "מכויל" : learning ? "בתהליך למידה" : "טרם התחיל"}</strong></div>
                <div><span>ניתוח וידאו</span><strong>{readiness.ai.configured ? "Shadow בלבד, עם ביקורת" : "ספק AI טרם חובר"}</strong></div>
                <div><span>פרטיות</span><strong>{site.vision_privacy_mode === "skeleton_only" ? "שלד ותנועה בלבד" : "זיהוי ביומטרי כבוי עד הסכמה"}</strong></div>
              </div>
            </article>
            <article className="do-panel">
              <div className="do-section-head"><div><h2>כתובת והיערכות לחירום</h2><p>המיקום ישמש בעתיד למפה, דיווח וסטטיסטיקה אזורית.</p></div><MapPin /></div>
              <strong>{site.address || "טרם הוגדרה כתובת"}</strong>
              <p>{site.address_verification_status === "verified"
                ? "הכתובת מסונכרנת למיקום גיאוגרפי."
                : readiness.address.configured
                  ? "הכתובת עדיין דורשת בחירה ואימות מול ספק המפות לפני דיווח חירום."
                  : "ספק המפות טרם חובר, ולכן הכתובת נשמרת ידנית ואינה מוכנה לדיווח חירום."}</p>
              <div className="do-notice warn"><ShieldCheck /><span>שיחה אוטומטית למוקד חירום אינה פעילה. היא תדרוש ספק טלפוניה, אישור משפטי, כתובת מאומתת וביקורת תפעולית.</span></div>
            </article>
          </section>

          <section className="do-section">
            <div className="do-section-head"><div><h2>המצלמות שהתצפיתן מכיר</h2><p>תמונה מוצגת כהדמיה רק למקור דמו; מקור אמיתי אינו מוצג כ-LIVE בלי stream מאובטח.</p></div><Link className="do-link" href="/digital-observer/cameras">ניהול מצלמות</Link></div>
            {cameras.length ? <div className="do-camera-grid">{cameras.slice(0, 4).map((camera) => <Link href={`/digital-observer/cameras?camera=${camera.id}`} key={camera.id}><ObserverCameraMedia name={camera.display_name} mode={mode} scene={camera.preview_scene} status={camera.status ?? camera.health_status} sourceMode={camera.source_mode} /></Link>)}</div> : <div className="do-empty"><Camera /><strong>טרם חוברה מצלמה</strong><span>לא תתחיל למידה בלי מקור מצלמה בטוח.</span><Link className="do-button primary" href="/digital-observer/cameras/add">הוספת מצלמה</Link></div>}
          </section>

          <section className="do-grid cols-2">
            <ObserverRuleForm siteId={site.id} cameras={cameras} />
            <article className="do-panel">
              <div className="do-section-head"><div><h2>מה התצפיתן למד עד עכשיו</h2><p>אין מסקנה אם אין נתונים אמיתיים או סינתטיים מסומנים.</p></div></div>
              {baselines.length ? <div className="do-insight-grid">{baselines.map((baseline) => <div key={baseline.id}><Sparkles /><span><strong>{baselineLabel(baseline.baseline_type)}</strong><small>{baseline.learning_maturity === "mature" ? "נלמד" : `איסוף נתונים · ${Math.round(Number(baseline.confidence_level || 0) * 100)}% ביטחון`}</small></span></div>)}</div> : <div className="do-empty"><BrainCircuit /><strong>אין עדיין קו בסיס</strong><span>המערכת לא ממציאה שגרה. הנתונים ייאספו אחרי חיבור מצלמה.</span></div>}
            </article>
          </section>

          <section className="do-grid cols-2">
            <article className="do-panel"><div className="do-section-head"><div><h2>הבקשות שלי</h2><p>כללים פעילים ומושבתים.</p></div><span className="do-badge info">{rules.length}</span></div>{rules.length ? <div className="do-row-list">{rules.map((rule) => <div className="do-row" key={rule.id}><Radar /><span className="do-row-main"><strong>{rule.title}</strong><small>{rule.description || observerStatusLabel(rule.watch_type)}</small></span><span className="do-row-meta"><b className={rule.active ? "do-badge good" : "do-badge warn"}>{rule.active ? "מוכן להפעלה" : "מושבת"}</b>{rule.active ? <ObserverQuickAction endpoint="/api/digital-observer/watch-requests" body={{ action: "disable", id: rule.id }}>השבתה</ObserverQuickAction> : null}</span></div>)}</div> : <div className="do-empty"><Radar /><strong>אין בקשות ניטור</strong><span>כתבו לתצפיתן מה חשוב לבדוק.</span></div>}</article>
            <article className="do-panel"><div className="do-section-head"><div><h2>עדכונים ותובנות אחרונות</h2><p>כל אירוע מוצג כהערכה ולא כעובדה.</p></div><Link className="do-link" href="/digital-observer/alerts">מרכז ההתראות</Link></div>{signals.length ? <div className="do-row-list">{signals.slice(0, 5).map((signal) => <Link className="do-row" href={`/digital-observer/alerts?event=${signal.id}`} key={signal.id}><Activity /><span className="do-row-main"><strong>{observerEventLabel(signal.metadata?.event_type ?? signal.signal_type)}</strong><small>{signal.recommended_action || "ממתין לבדיקה אנושית"}</small></span><span className="do-row-meta"><b className="do-badge info">{signal.confidence == null ? "ללא ציון" : `${Math.round(Number(signal.confidence) * 100)}%`}</b><time>{formatObserverDate(signal.created_at)}</time></span></Link>)}</div> : <div className="do-empty"><CheckCircle2 /><strong>אין עדכון חדש</strong><span>לא נוצר סיכום יומי מזויף כשאין אירועים.</span></div>}</article>
          </section>

          <section className="do-grid cols-3"><article className="do-panel"><Clock3 /><h3>למידה בת 30 יום</h3><p>דפוסי שגרה נבנים ברמת האתר והמצלמה, ללא העברת זהויות בין לקוחות.</p></article><article className="do-panel"><ShieldCheck /><h3>משוב בטוח</h3><p>סימון ״הכול בסדר״ מכייל את סוג האירוע וההקשר בלבד ואינו הופך התנהגות למותרת תמיד.</p></article><article className="do-panel"><Bell /><h3>ערוצי עדכון</h3><p>In-app מוכן. Push, דוא״ל, SMS, WhatsApp ושיחה יופעלו רק לאחר חיבור ספק ובדיקת מסירה.</p></article></section>
        </> : <div className="do-empty"><ShieldCheck /><strong>תחילה יש להקים אתר</strong><Link className="do-button primary" href="/digital-observer/onboarding">תחילת הקמה</Link></div>}
      </div>
    </ObserverAppShell>
  );
}
