import Image from "next/image";
import Link from "next/link";
import { Activity, Bell, BrainCircuit, Camera, CheckCircle2, Clock3, MapPin, PhoneCall, Radar, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import { ObserverBiometricSetupAction, ObserverQuickAction, ObserverRuleForm } from "@/components/digital-observer/observer-action-forms";
import { ObserverConversationPanel } from "@/components/digital-observer/observer-intelligence-experience";
import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { ObserverLivePlayer } from "@/components/digital-observer/observer-live-player";
import { requireDigitalObserverUser } from "@/lib/domain/digital-observer/access";
import { digitalObserverCameraHasLiveGateway } from "@/lib/domain/digital-observer/camera-live-status";
import { buildObserverDailySummary } from "@/lib/domain/digital-observer/dashboard-summary";
import { cameraReportsLocalEventInsights, digitalObserverEdgeAiPolicy } from "@/lib/domain/digital-observer/edge-ai-policy";
import { getDigitalObserverServiceReadiness } from "@/lib/domain/digital-observer/service-readiness";
import { formatObserverDate, loadObserverRuntime, observerEventLabel, observerModeForSite, observerSignalMatchesCamera, observerStatusLabel, selectObserverSite } from "@/lib/domain/digital-observer/runtime";

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

function baselineSummary(baseline: Record<string, any>) {
  const value = baseline.baseline_value && typeof baseline.baseline_value === "object" ? baseline.baseline_value : {};
  if (baseline.baseline_type === "normal_camera_activity") {
    const samples = Number(value.sample_count || 0);
    const cameras = Number(value.last_active_camera_count || baseline.source_summary?.active_camera_count || 0);
    const motion = Number(value.average_motion_score || 0);
    const light = Number(value.average_luminance_score || 0);
    const motionText = motion >= 0.55 ? "פעילות גבוהה יחסית" : motion >= 0.22 ? "פעילות בינונית" : "פעילות נמוכה";
    const lightText = light >= 0.62 ? "תאורה חזקה" : light >= 0.28 ? "תאורה רגילה" : "תאורה חלשה";
    return `נאספו ${samples} דגימות מקומיות מ-${cameras} מצלמות פעילות. כרגע נמדדות ${motionText} ו${lightText}.`;
  }
  return "הדפוס נבנה מאירועים שנקלטו ומשוב שאומת באתר.";
}

export default async function DigitalObserverRulesPage() {
  const { profile } = await requireDigitalObserverUser("/digital-observer/login?next=/digital-observer/rules");
  const runtime = await loadObserverRuntime(profile.id);
  const site = selectObserverSite(runtime.sites, runtime.cameras);
  const mode = observerModeForSite(site);
  const cameras = site ? runtime.cameras.filter((item) => item.observer_site_id === site.id) : [];
  const activeCameras = cameras.filter(digitalObserverCameraHasLiveGateway);
  const offlineCameraCount = cameras.length - activeCameras.length;
  const rules = site ? runtime.watchRequests.filter((item) => item.observer_site_id === site.id) : [];
  const signals = site ? runtime.signals.filter((item) => item.observer_site_id === site.id) : [];
  const reviewedSignals = signals.filter((signal) => ["confirmed", "resolved", "dismissed"].includes(String(signal.review_status)));
  const dismissedSignals = signals.filter((signal) => signal.review_status === "dismissed");
  const reviewCoverage = signals.length ? Math.round((reviewedSignals.length / signals.length) * 100) : 0;
  const baselines = site ? runtime.baselines.filter((item) => item.observer_site_id === site.id) : [];
  const learning = site ? runtime.learningProfiles.find((item) => item.observer_site_id === site.id) : null;
  const targetDays = Number(site?.learning_target_days || 30);
  const progress = learningProgress(site?.learning_started_at, targetDays);
  const readiness = getDigitalObserverServiceReadiness();
  const sourceReady = activeCameras.length > 0;
  const demoOnly = cameras.length > 0 && cameras.every((camera) => camera.source_mode === "demo");
  const localLearningActive = sourceReady && Boolean(learning) && baselines.some((baseline) => baseline.baseline_type === "normal_camera_activity");
  const edgeInferenceActive = sourceReady && activeCameras.some(cameraReportsLocalEventInsights);
  const biometricSetupEnabled = site?.metadata?.biometric_setup_consent === true;
  const biometricMatchingReady = biometricSetupEnabled && activeCameras.some((camera) => camera.metadata?.edge_policy?.biometric_matching_enabled === true && camera.metadata?.edge_capability_contract?.capabilities?.biometric_matching === true);
  const dailySummary = buildObserverDailySummary(signals);
  const runtimeText = !cameras.length
    ? "ממתין למצלמה הראשונה"
    : edgeInferenceActive
      ? "AI Edge מאומת פעיל"
      : sourceReady
        ? "Gateway פעיל · Edge AI כבוי"
      : readiness.ai.configured
      ? "מוכן ללמידת Shadow מבוקרת"
      : demoOnly
        ? "לומד מתרחישי הדמיה בלבד"
        : "ממתין ל-Gateway ולספק AI";

  return (
    <ObserverAppShell profile={profile} mode={mode} activeHref="/digital-observer/rules" title="התצפיתן שלי" statusLabel={runtimeText}>
      <div className="do-page-stack do-observer-page">
        <section className="do-observer-hero">
          <div className="do-observer-identity" aria-label={runtimeText}>
            <Image className="do-observer-robot" src="/assets/digital-observer/observer-robot-v1.png" alt="" width={700} height={700} priority />
            <div className="do-observer-orbit"><Radar /><span>{progress.percent}%</span><small>חלון איסוף</small></div>
          </div>
          <div className="do-observer-hero-copy">
            <span className="do-observer-runtime-state"><i />{runtimeText}</span>
            <h1>{mode === "business" ? "שלום! מה חשוב שאבדוק בעסק?" : "שלום! במה תרצו שאצפה עבורכם?"}</h1>
            <p>שאלו מה קרה, בקשו לשים לב לדבר מסוים או בדקו מה השתנה בשגרה. המענה מבוסס רק על אירועי האתר ותוצאות שאומתו; זמן לבדו אינו מוכיח אמינות.</p>
          </div>
        </section>

        {!runtime.locationLearningMigrationApplied ? <div className="do-notice warn"><TriangleAlert /><span>שכבת הכתובת והלמידה החדשה ממתינה למיגרציה. אין להציג את האתר כפעיל עד החלתה.</span></div> : null}

        {site ? <>
          <nav className="do-observer-context-chips" aria-label="נושאים לשיחה עם התצפיתן">
            {(mode === "business"
              ? ["כניסה ויציאה", "מחוץ לשעות", "אזור מוגבל", "מצב מצלמה"]
              : ["כניסה", "ילד או תינוק", "חיית מחמד", "שעות שקטות"]
            ).map((label) => <a href="#observer-conversation" key={label}>{label}</a>)}
          </nav>

          <section className="do-observer-live-grid" id="observer-conversation">
            <ObserverConversationPanel
              siteId={site.id}
              ruleSummary={rules[0] ? {
                title: rules[0].title,
                description: rules[0].description,
                active: Boolean(rules[0].active)
              } : null}
              initialPrompt={signals.length
                ? `קיימים ${signals.length} אירועים במידע של האתר. אפשר לשאול מה קרה, מי נכנס או יצא, מה אירע בחניה או למה אירוע מסוים סומן.`
                : "אני מוכן לענות מתוך המידע של האתר. כרגע אין אירוע שמור, ולכן לא אמציא פעילות. אפשר גם לבקש ממני לשים לב לדבר מסוים."}
            />
          </section>

          <details className="do-observer-insight-disclosure">
            <summary>
              <span><Sparkles /><b>מה התצפיתן למד עד עכשיו</b><small>תובנות שמבוססות על נתוני האתר ותוצאות שאומתו</small></span>
              <strong className="do-badge info">{baselines.length} דפוסים</strong>
            </summary>
            <div className="do-observer-insight-content">
              {baselines.length ? <div className="do-insight-grid">{baselines.map((baseline) => <div key={baseline.id}><Sparkles /><span><strong>{baselineLabel(baseline.baseline_type)}</strong><small>{baselineSummary(baseline)}</small><small>{baseline.learning_maturity === "mature" ? "נלמד" : `איסוף נתונים · ${Math.round(Number(baseline.confidence_level || 0) * 100)}% ביטחון`}</small></span></div>)}</div> : <div className="do-empty"><BrainCircuit /><strong>אין עדיין קו בסיס</strong><span>המערכת לא ממציאה שגרה. הנתונים ייאספו אחרי חיבור מצלמה.</span></div>}
              <div className="do-observer-rule-preview">
                <span><Radar /><b>{rules[0]?.title || "כלל תצפית ראשון טרם הוגדר"}</b></span>
                <strong className={rules[0]?.active ? "do-badge good" : "do-badge warn"}>{rules[0]?.active ? "פעיל" : "ממתין להגדרה"}</strong>
              </div>
              <a className="do-button secondary" href="#observer-advanced-rule">הגדרת כלל מתקדם</a>
            </div>
          </details>

          <section className="do-observer-camera-insights">
            <div className="do-section-head"><div><h2>מה התצפיתן רואה בכל מצלמה</h2><p>סיכום טקסטואלי לפי מקור, אירועים ומדדי למידה שנקלטו בפועל.</p></div><span className={localLearningActive ? "do-badge good" : "do-badge warn"}>{localLearningActive ? "למידה פעילה" : "אוסף נתונים"}</span></div>
            <div className="do-observer-camera-insight-grid">{activeCameras.map((camera) => {
              const cameraSignals = signals.filter((signal) => observerSignalMatchesCamera(signal, camera.id));
              const latest = cameraSignals[0];
              const connected = digitalObserverCameraHasLiveGateway(camera);
              return <article key={camera.id}><Camera /><span><strong>{camera.display_name || "מצלמה"}</strong><small>{camera.location_label || "החלל עדיין לא קיבל שם"}</small><p>{latest ? `העדכון האחרון: ${observerEventLabel(latest.metadata?.event_type ?? latest.signal_type)} (${formatObserverDate(latest.created_at)}).` : connected ? "המקור מחובר ונאספים ממנו מדדי פעילות; עדיין אין אירוע עם ראיה להצגה." : "המקור אינו פעיל כרגע, ולכן לא נאספות ממנו תובנות."}</p></span><b className={connected ? "do-badge good" : "do-badge warn"}>{connected ? "פעילה" : "לא זמינה"}</b></article>;
            })}</div>
            {!activeCameras.length ? <div className="do-empty compact"><Camera /><strong>אין מצלמה פעילה לניתוח</strong><span>התובנות יחזרו אוטומטית לאחר קבלת וידאו חי.</span></div> : null}
          </section>

          <section className="do-panel do-daily-observer-summary"><div className="do-section-head"><div><h2>סיכום היום</h2><p>מתעדכן מאירועים אמיתיים בלבד.</p></div><Clock3 /></div><p>{dailySummary.text}</p><Link className="do-link" href="/digital-observer/alerts">פתיחת יומן האירועים המלא</Link></section>

          <details className="do-advanced-rule-panel" id="observer-advanced-rule">
            <summary><Radar /> הגדרה ידנית מתקדמת</summary>
            <ObserverRuleForm siteId={site.id} cameras={cameras} />
          </details>

          <details className="do-observer-operations-disclosure">
            <summary>
              <span><Activity /><b>מצב המערכת, מצלמות ומדדי אמינות</b><small>מידע תפעולי ומוכנות לחיבורים מתקדמים</small></span>
              <strong className={sourceReady ? "do-badge good" : "do-badge warn"}>{runtimeText}</strong>
            </summary>
            <div className="do-observer-operations-content">
              <section className="do-grid cols-4">
                <article className="do-metric"><Camera /><strong>{activeCameras.length}</strong><span>מצלמות פעילות</span></article>
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
                    <div><span>ניתוח וידאו</span><strong>{edgeInferenceActive ? "AI Edge מאומת" : "מנוע Edge טרם הופעל"}</strong></div>
                    <div><span>Push</span><strong>טרם הוגדר ספק מסירה</strong></div>
                    <div><span>Voice</span><strong>כבוי · אין חיוג אוטומטי</strong></div>
                    <div><span>פרטיות</span><strong>{site.vision_privacy_mode === "skeleton_only" ? "שלד ותנועה בלבד" : biometricMatchingReady ? "ביומטריה מקומית מאומתת" : biometricSetupEnabled ? "הסכמה נשמרה · מודל התאמה ממתין" : "זיהוי ביומטרי כבוי עד הסכמה"}</strong></div>
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
                  <div className="do-emergency-centers" aria-label="מוקדי חירום קבועים"><span><PhoneCall /><b>100</b><small>משטרה</small></span><span><PhoneCall /><b>101</b><small>מד״א</small></span><span><PhoneCall /><b>102</b><small>כבאות והצלה</small></span></div>
                  <div className="do-notice warn"><ShieldCheck /><span>שיחה אוטומטית למוקד חירום אינה פעילה. היא תדרוש ספק טלפוניה, אישור משפטי, כתובת מאומתת וביקורת תפעולית.</span></div>
                </article>
              </section>

              <section className="do-panel">
                <div className="do-section-head"><div><h2>AI מקומי ופרטיות מדיה</h2><p>סטטוס יכולות אמיתי ומדיניות Edge ללא ספק AI חיצוני.</p></div><span className={edgeInferenceActive ? "do-badge good" : "do-badge warn"}>{edgeInferenceActive ? "AI Edge מאומת" : "ממתין ל-Edge"}</span></div>
                <div className="do-grid cols-3">
                  <article><ShieldCheck /><h3>פעיל מקומית</h3>{digitalObserverEdgeAiPolicy.activeCapabilities.map((item) => <p key={item}>{item}</p>)}</article>
                  <article><TriangleAlert /><h3>טרם הוגדר</h3>{digitalObserverEdgeAiPolicy.unavailableCapabilities.map((item) => <p key={item}>{item}</p>)}</article>
                  <article><Clock3 /><h3>מחיקה והסכמה</h3><p>{digitalObserverEdgeAiPolicy.retention.frames}</p><p>{digitalObserverEdgeAiPolicy.retention.clips}</p><p>{digitalObserverEdgeAiPolicy.retention.insights}</p></article>
                </div>
                <div className="do-notice info"><ShieldCheck /><span>{digitalObserverEdgeAiPolicy.consent.monitoring}. {biometricSetupEnabled ? "הכנת הביומטריה אושרה באתר; התאמה דורשת גם הסכמה פר אדם ומודל מקומי מאומת" : digitalObserverEdgeAiPolicy.consent.biometrics}.</span>{biometricSetupEnabled ? <Link className="do-button secondary" href="/digital-observer/people#add-known-person">הגדרת אנשים בהסכמה</Link> : <ObserverBiometricSetupAction siteId={site.id} enabled={false} />}</div>
              </section>

          <section className="do-section">
            <div className="do-section-head"><div><h2>המצלמות שהתצפיתן מכיר</h2><p>מוצגים רק מקורות שמחזירים וידאו חי; כל נגן מקבל טוקן מאובטח נפרד.</p></div><span className="do-section-actions">{offlineCameraCount ? <Link className="do-link" href={`/digital-observer/cameras?site=${site.id}&status=offline`}>{offlineCameraCount} מנותקות</Link> : null}<Link className="do-link" href="/digital-observer/cameras">ניהול מצלמות</Link></span></div>
            {activeCameras.length ? <div className="do-camera-grid">{activeCameras.map((camera) => <Link className="do-dashboard-camera-card" href={`/digital-observer/cameras?site=${site.id}&camera=${camera.id}`} key={camera.id}><ObserverLivePlayer compact observerSiteId={site.id} cameraSourceId={camera.id} name={camera.display_name || "מצלמה"} /><span className="do-dashboard-camera-copy"><strong>{camera.display_name || "מצלמה"}</strong><small>שידור חי דרך Gateway</small></span></Link>)}</div> : <div className="do-empty"><Camera /><strong>{cameras.length ? "אין מצלמה שמשדרת כרגע" : "טרם חוברה מצלמה"}</strong><span>{cameras.length ? "המקורות נשמרו, אך התצפיתן כבוי עליהם עד שווידאו חי יחזור." : "לא תתחיל למידה בלי מקור מצלמה בטוח."}</span><Link className="do-button primary" href={cameras.length ? `/digital-observer/cameras?site=${site.id}&status=offline` : "/digital-observer/cameras/add"}>{cameras.length ? "מצלמות מנותקות" : "הוספת מצלמות"}</Link></div>}
          </section>

          <section className="do-panel">
            <div className="do-section-head"><div><h2>מסלול תצפית חיה</h2><p>כך אירוע מורשה עובר מהמצלמה אל הסבר שימושי, בלי לחשוף כתובת מקור או להציג פעולה שלא הופעלה.</p></div><span className={sourceReady && edgeInferenceActive && !demoOnly ? "do-badge good" : "do-badge warn"}>{sourceReady && edgeInferenceActive && !demoOnly ? "AI Edge מאומת" : "מוכנות בלבד"}</span></div>
            <div className="do-grid cols-4">
              <article className="do-metric"><Camera /><strong>{demoOnly ? "דמו" : sourceReady ? "מוכן" : "ממתין"}</strong><span>Gateway ומקור מורשה</span></article>
              <article className="do-metric"><Radar /><strong>{edgeInferenceActive ? "AI Edge" : localLearningActive ? "מדדי פעילות" : "כבוי"}</strong><span>זיהוי אירוע או שינוי</span></article>
              <article className="do-metric"><Activity /><strong>{signals.length}</strong><span>אירועים מובנים באתר</span></article>
              <article className="do-metric"><BrainCircuit /><strong>{reviewedSignals.length}</strong><span>הסברים עם תוצאה מאומתת</span></article>
            </div>
            <div className="do-notice warn"><ShieldCheck /><span>{localLearningActive ? "מדדי תנועה ותאורה מקומיים עשויים להיאסף; הם אינם מודל AI. זיהוי פנים, ביומטריה, קול ועצמים נשארים כבויים עד runtime, מודל מאושר וטעון, בדיקת יכולת והסכמה." : "זיהוי ביומטרי ופעולת חירום נשארים כבויים עד חיבור ספק מאושר ואישור מפורש."}</span></div>
          </section>

          <section className="do-panel">
            <div className="do-section-head"><div><h2>מחזור השיפור של התצפיתן</h2><p>כל הרחבת אוטומציה חייבת לעבור דרך תוצאה מאומתת של האתר, ולא להיפתח רק מפני שעבר זמן.</p></div><span className="do-badge info">מצב בטוח כברירת מחדל</span></div>
            <div className="do-grid cols-4">
              <article className="do-metric"><Activity /><strong>{signals.length}</strong><span>אירועים נקלטו והוסברו</span></article>
              <article className="do-metric"><CheckCircle2 /><strong>{reviewedSignals.length}</strong><span>תוצאות אומתו במשוב</span></article>
              <article className="do-metric"><ShieldCheck /><strong>{reviewCoverage}%</strong><span>כיסוי ביקורת באתר</span></article>
              <article className="do-metric alert"><TriangleAlert /><strong>{dismissedSignals.length}</strong><span>התרעות שווא שסומנו</span></article>
            </div>
            <div className="do-notice info"><BrainCircuit /><span>המערכת משחררת יכולות בהדרגה רק אחרי מדידת דיוק, כיסוי ביקורת והתרעות שווא. ירידה באיכות מחזירה את היכולת ל־Shadow או לביקורת אנושית מלאה.</span></div>
          </section>

              <section className="do-grid cols-2">
            <article className="do-panel"><div className="do-section-head"><div><h2>הבקשות שלי</h2><p>כללים פעילים ומושבתים.</p></div><span className="do-badge info">{rules.length}</span></div>{rules.length ? <div className="do-row-list">{rules.map((rule) => <div className="do-row" key={rule.id}><Radar /><span className="do-row-main"><strong>{rule.title}</strong><small>{rule.description || observerStatusLabel(rule.watch_type)}</small></span><span className="do-row-meta"><b className={rule.active ? "do-badge good" : "do-badge warn"}>{rule.active ? "מוכן להפעלה" : "מושבת"}</b>{rule.active ? <ObserverQuickAction endpoint="/api/digital-observer/watch-requests" body={{ action: "disable", id: rule.id }}>השבתה</ObserverQuickAction> : null}</span></div>)}</div> : <div className="do-empty"><Radar /><strong>אין בקשות ניטור</strong><span>כתבו לתצפיתן מה חשוב לבדוק.</span></div>}</article>
            <article className="do-panel"><div className="do-section-head"><div><h2>עדכונים ותובנות אחרונות</h2><p>כל אירוע מוצג כהערכה ולא כעובדה.</p></div><Link className="do-link" href="/digital-observer/alerts">מרכז ההתראות</Link></div>{signals.length ? <div className="do-row-list">{signals.slice(0, 5).map((signal) => <Link className="do-row" href={`/digital-observer/alerts?event=${signal.id}`} key={signal.id}><Activity /><span className="do-row-main"><strong>{observerEventLabel(signal.metadata?.event_type ?? signal.signal_type)}</strong><small>{signal.recommended_action || "ממתין לבדיקה אנושית"}</small></span><span className="do-row-meta"><b className="do-badge info">{signal.confidence == null ? "ללא ציון" : `${Math.round(Number(signal.confidence) * 100)}%`}</b><time>{formatObserverDate(signal.created_at)}</time></span></Link>)}</div> : <div className="do-empty"><CheckCircle2 /><strong>אין עדכון חדש</strong><span>לא נוצר סיכום יומי מזויף כשאין אירועים.</span></div>}</article>
              </section>

              <section className="do-grid cols-3"><article className="do-panel"><Clock3 /><h3>חלון איסוף בן 30 יום</h3><p>דפוסי שגרה נבנים ברמת האתר והמצלמה. הזמן מספק הקשר אך אינו ציון אמינות.</p></article><article className="do-panel"><ShieldCheck /><h3>משוב בטוח</h3><p>סימון ״הכול בסדר״ מכייל את סוג האירוע וההקשר בלבד ואינו הופך התנהגות למותרת תמיד.</p></article><article className="do-panel"><Bell /><h3>ערוצי עדכון</h3><p>In-app מוכן. Push, דוא״ל, SMS, WhatsApp ושיחה יופעלו רק לאחר חיבור ספק ובדיקת מסירה.</p></article></section>
            </div>
          </details>
        </> : <div className="do-empty"><ShieldCheck /><strong>תחילה יש להקים אתר</strong><Link className="do-button primary" href="/digital-observer/onboarding">תחילת הקמה</Link></div>}
      </div>
    </ObserverAppShell>
  );
}
