import Link from "next/link";
import { Bell, BrainCircuit, Check, Fingerprint, LockKeyhole, ShieldCheck, UserRoundCheck, UsersRound, X } from "lucide-react";
import { ObserverDeletePersonButton, ObserverKnownPersonForm } from "@/components/digital-observer/observer-action-forms";
import { ObserverIdentityCandidateReview } from "@/components/digital-observer/observer-intelligence-experience";
import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { requireDigitalObserverUser } from "@/lib/domain/digital-observer/access";
import { formatObserverDate, loadObserverRuntime, observerModeForSite, observerStatusLabel } from "@/lib/domain/digital-observer/runtime";

export default async function DigitalObserverPeoplePage() {
  const { profile } = await requireDigitalObserverUser("/digital-observer/login?next=/digital-observer/people");
  const runtime = await loadObserverRuntime(profile.id);
  const site = runtime.sites[0] ?? null;
  const mode = observerModeForSite(site);
  const people = site ? runtime.knownPeople.filter((item) => item.observer_site_id === site.id) : [];
  const candidates = site
    ? runtime.identityCandidates.filter((item) => item.observer_site_id === site.id && ["observing", "ready_for_review"].includes(String(item.candidate_status)))
    : [];
  const cameras = site ? runtime.cameras.filter((item) => item.observer_site_id === site.id) : [];
  const recipients = site ? runtime.recipients.filter((item) => item.observer_site_id === site.id && item.active !== false) : [];
  const childPrivacy = Boolean(site?.business_handles_children || site?.vision_privacy_mode === "skeleton_only");
  const reviewCount = candidates.filter((item) => item.candidate_status === "ready_for_review").length;

  return (
    <ObserverAppShell
      profile={profile}
      mode={mode}
      activeHref="/digital-observer/people"
      title={mode === "home" ? "אנשים מוכרים" : "אנשים והרשאות"}
      statusLabel={childPrivacy ? "פרטיות ילדים: שלד בלבד" : reviewCount ? `${reviewCount} ממתינים לזיהוי` : "למידה מאובטחת"}
    >
      <div className="do-page-stack">
        <section className="do-people-overview">
          <div>
            <span className="do-badge info"><BrainCircuit /> למידה אישית למקום בלבד</span>
            <h1>התצפיתן מציע, אתם מחליטים מי מוכר</h1>
            <p>כאשר מנוע הווידאו יזהה אדם שחוזר לעיתים קרובות, הוא יופיע כאן לבחירה. לא צריך להעלות מראש כל אדם, והמערכת לא משתפת זהויות בין לקוחות.</p>
          </div>
          <div className="do-people-kpis"><span><strong>{candidates.length}</strong> אנשים בתהליך למידה</span><span><strong>{people.length}</strong> אנשים שהוגדרו</span></div>
        </section>

        {childPrivacy ? (
          <div className="do-notice good"><ShieldCheck /><span><strong>זיהוי פנים כבוי במקום המטפל בילדים.</strong> התצפיתן משתמש בזיהוי שלד, גודל, תנועה ודפוסים ללא יצירת מאגר פנים של ילדים.</span></div>
        ) : (
          <div className="do-notice warn"><Fingerprint /><span><strong>אין זיהוי פנים נסתר.</strong> תמונת מועמד זמינה לזמן קצר ורק לבעלי הרשאה. שמירה כאדם מוכר מחייבת הסכמה מפורשת ואינה מפעילה ביומטריה חיה.</span></div>
        )}

        {mode === "business" && site ? (
          <section className="do-panel do-business-access-panel">
            <div className="do-section-head">
              <div><h2>צוות והרשאות</h2><p>גישה למערכת ומורשי עדכונים הם שני דברים שונים. המטריצה מציגה רק הרשאה שניתנה בפועל.</p></div>
              <Link className="do-button secondary" href="/digital-observer/settings">ניהול מורשי עדכונים</Link>
            </div>
            <div className="do-permission-matrix" role="table" aria-label="הרשאות צוות ומורשי עדכונים">
              <div className="do-permission-head" role="row"><span>אדם</span><span>מצלמות</span><span>אירועים</span><span>דוחות</span><span>חיוב</span><span>התראות</span></div>
              <div className="do-permission-row" role="row">
                <span><b>{profile.full_name || "בעל החשבון"}</b><small>בעלים · משתמש מערכת מאומת</small></span>
                {["מצלמות", "אירועים", "דוחות", "חיוב", "התראות"].map((label) => <i className="allowed" data-label={label} aria-label={`${label}: מורשה`} key={label}><Check /></i>)}
              </div>
              {recipients.map((recipient) => (
                <div className="do-permission-row" role="row" key={recipient.id}>
                  <span><b>{recipient.display_name}</b><small>{recipient.relationship_label || "מורשה עדכונים"} · ללא כניסה למערכת</small></span>
                  {["מצלמות", "אירועים", "דוחות", "חיוב"].map((label) => <i data-label={label} aria-label={`${label}: אין הרשאת מערכת`} key={label}><X /></i>)}
                  <i className="allowed" data-label="התראות" aria-label="התראות: לפי ערוצים מאושרים"><Check /></i>
                </div>
              ))}
            </div>
            {!recipients.length ? <div className="do-empty compact"><UsersRound /><strong>טרם הוגדרו מורשי עדכונים</strong><span>אפשר להוסיף אנשי קשר מוצפנים מההגדרות. הוספה אינה מעניקה להם כניסה למצלמות.</span></div> : null}
            <div className="do-notice info"><ShieldCheck /><span>הזמנת משתמש צוות עם כניסה עצמאית עדיין דורשת מסלול הזמנה מאובטח. המסך אינו מציג איש קשר כאילו קיבל גישה למערכת.</span></div>
          </section>
        ) : null}

        {site && !childPrivacy ? (
          <section className="do-section">
            <div className="do-section-head">
              <div><h2>אנשים שנצפו לעיתים קרובות</h2><p>נוצרים אוטומטית מתצפיות חוזרות לאחר חיבור Gateway ו-AI Shadow.</p></div>
              <span className={reviewCount ? "do-badge warn" : "do-badge info"}>{reviewCount ? `${reviewCount} דורשים החלטה` : "אין החלטה ממתינה"}</span>
            </div>
            {!runtime.identityCandidateMigrationApplied ? (
              <div className="do-empty"><BrainCircuit /><strong>שכבת האנשים שנצפו ממתינה למיגרציה</strong><span>הקוד אינו מציג הצעות מזויפות. לאחר החלת המיגרציה ומנוע Shadow, המועמדים יגיעו מהמצלמות.</span></div>
            ) : candidates.length ? (
              <div className="do-candidate-grid">
                {candidates.map((candidate) => (
                  <ObserverIdentityCandidateReview
                    candidate={candidate}
                    cameraName={cameras.find((camera) => camera.id === candidate.camera_source_id)?.display_name}
                    key={candidate.id}
                  />
                ))}
              </div>
            ) : (
              <div className="do-empty do-empty-rich"><UsersRound /><strong>עדיין אין אנשים חוזרים להצעה</strong><span>{cameras.length ? "מקורות המצלמה קיימים, אך Gateway ו-AI Shadow טרם סיפקו תצפיות מאומתות." : "הוסיפו מצלמה כדי להתחיל את מסלול הלמידה. לא יוצגו כאן פרצופים מומצאים."}</span></div>
            )}
          </section>
        ) : null}

        {site ? (
          <section className="do-grid cols-2 do-people-management">
            <article className="do-panel">
              <div className="do-section-head"><div><h2>אנשים שהוגדרו</h2><p>הרשאות, הסכמה ומצב הזיהוי לכל אדם.</p></div><span className="do-badge info">{people.length}</span></div>
              {people.length ? (
                <div className="do-people-grid">
                  {people.map((person) => (
                    <article className="do-person" key={person.id}>
                      <span className="do-person-avatar">{String(person.display_name).slice(0, 1)}</span>
                      <div className="do-person-copy"><strong>{person.display_name}</strong><small>{person.relationship_label || "ללא תיאור"}</small></div>
                      <div className="do-person-statuses"><span className="do-badge info">הסכמה: {observerStatusLabel(person.consent_status)}</span><span className="do-badge warn">זיהוי: {observerStatusLabel(person.recognition_status)}</span></div>
                      <small>עדכון אחרון: {formatObserverDate(person.last_confirmed_at || person.created_at)}</small>
                      <ObserverDeletePersonButton id={person.id} />
                    </article>
                  ))}
                </div>
              ) : <div className="do-empty"><UsersRound /><strong>טרם הוגדר אדם מוכר</strong><span>המלצה מהמצלמה תופיע למעלה לאחר מספיק תצפיות. אפשר גם להכין אדם ידנית.</span></div>}
            </article>
            {childPrivacy ? <article className="do-panel do-privacy-lock"><LockKeyhole /><h2>הוספת אדם חסומה במצב ילדים</h2><p>למקום זה נבחר ניתוח שלד ותנועה. לא ניתן להוסיף מאגר פנים או מועמדי זיהוי.</p></article> : <ObserverKnownPersonForm siteId={site.id} />}
          </section>
        ) : <div className="do-empty"><ShieldCheck /><strong>תחילה יש להקים אתר</strong></div>}

        <section className="do-grid cols-3">
          <article className="do-panel"><UserRoundCheck /><h3>הפרדה בין לקוחות</h3><p>זהות, תמונה או דפוס של אתר אחד אינם זמינים לאתר אחר.</p></article>
          <article className="do-panel"><Bell /><h3>התראה לבחירה</h3><p>אפשר לבחור למי לקבל עדכון רק לאחר הסכמה וחיבור ספק מתאים.</p></article>
          <article className="do-panel"><ShieldCheck /><h3>שליטה ומחיקה</h3><p>אפשר לסמן לא מוכר, לבטל הסכמה או למחוק רשומה מהחשבון.</p></article>
        </section>
      </div>
    </ObserverAppShell>
  );
}
