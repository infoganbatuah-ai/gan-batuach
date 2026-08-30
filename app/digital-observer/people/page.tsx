import Link from "next/link";
import { Bell, BrainCircuit, CameraOff, Check, DoorOpen, Fingerprint, Footprints, LockKeyhole, ScanLine, ShieldCheck, UserRoundCheck, UsersRound, WifiOff, X } from "lucide-react";
import { ObserverBiometricSetupAction, ObserverDeletePersonButton, ObserverKnownPersonForm, ObserverRevokePersonConsentButton } from "@/components/digital-observer/observer-action-forms";
import { ObserverIdentityCandidateReview } from "@/components/digital-observer/observer-intelligence-experience";
import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { requireDigitalObserverUser } from "@/lib/domain/digital-observer/access";
import { formatObserverDate, loadObserverRuntime, observerModeForSite, observerStatusLabel, selectObserverSite } from "@/lib/domain/digital-observer/runtime";

type PageProps = { searchParams?: Promise<{ tab?: string }> };

function accessClassLabel(person: Record<string, any>) {
  const labels: Record<string, string> = {
    household_resident: "דייר/ת הבית",
    authorized_visitor: "מאושר/ת כניסה",
    service_provider: "נותן/ת שירות",
    other: "אחר"
  };
  return labels[String(person.metadata?.access_class ?? "")] || person.relationship_label || "ללא סיווג";
}

export default async function DigitalObserverPeoplePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { profile } = await requireDigitalObserverUser("/digital-observer/login?next=/digital-observer/people");
  const runtime = await loadObserverRuntime(profile.id);
  const site = selectObserverSite(runtime.sites, runtime.cameras);
  const mode = observerModeForSite(site);
  const people = site ? runtime.knownPeople.filter((item) => item.observer_site_id === site.id) : [];
  const candidates = site
    ? runtime.identityCandidates.filter((item) => item.observer_site_id === site.id && ["observing", "ready_for_review"].includes(String(item.candidate_status)))
    : [];
  const cameras = site ? runtime.cameras.filter((item) => item.observer_site_id === site.id) : [];
  const biometricSetupEnabled = site?.metadata?.biometric_setup_consent === true;
  const recipients = site ? runtime.recipients.filter((item) => item.observer_site_id === site.id && item.active !== false) : [];
  const childPrivacy = Boolean(site?.business_handles_children || site?.vision_privacy_mode === "skeleton_only");
  const reviewCount = candidates.filter((item) => item.candidate_status === "ready_for_review").length;
  const featuredPeople = people.slice(0, 3);
  const additionalPeople = people.slice(3);
  const cameraAssignments = cameras.map((camera) => ({
    camera,
    people: people.filter((person) => Array.isArray(person.camera_scope) && person.camera_scope.includes(camera.id))
  }));
  const activeBusinessTab = params?.tab === "people" ? "people" : params?.tab === "roles" ? "roles" : "permissions";
  const peopleTab = mode !== "business" || activeBusinessTab === "people";
  const rolesTab = mode === "business" && activeBusinessTab === "roles";
  const permissionsTab = mode === "business" && activeBusinessTab === "permissions";
  const permissionContacts = [
    { id: `owner-${profile.id}`, name: profile.full_name || "בעל החשבון", note: "בעלים · משתמש מערכת", owner: true, receivesCritical: true },
    ...recipients.map((recipient) => ({ id: recipient.id, name: recipient.display_name, note: recipient.relationship_label || "מורשה עדכונים", owner: false, receivesCritical: Boolean(recipient.receives_critical_alerts) }))
  ];
  const matrixContacts = permissionContacts.slice(0, 4);
  const permissionEvents = [
    { key: "motion", label: "זיהוי תנועה", critical: false, icon: Footprints },
    { key: "restricted", label: "תנועה באזור מוגבל", critical: true, icon: ScanLine },
    { key: "line", label: "חציית קו", critical: false, icon: Footprints },
    { key: "door", label: "דלת פתוחה", critical: false, icon: DoorOpen },
    { key: "camera", label: "תקלה במצלמה", critical: true, icon: CameraOff },
    { key: "offline", label: "מצלמה לא מקוונת", critical: true, icon: WifiOff }
  ];

  return (
    <ObserverAppShell
      profile={profile}
      mode={mode}
      activeHref="/digital-observer/people"
      title={mode === "home" ? "אנשים מוכרים" : permissionsTab ? "צוות והרשאות" : "אנשים מוכרים"}
      statusLabel={childPrivacy ? "פרטיות ילדים: שלד בלבד" : reviewCount ? `${reviewCount} ממתינים לזיהוי` : "למידה מאובטחת"}
      desktopSearch={{ action: "/digital-observer/people", placeholder: "חיפוש אנשים, קבוצות ומצלמות..." }}
    >
      <div className="do-page-stack do-people-screen">
        {peopleTab ? <section className="do-people-reference-head compact">
          <div>
            <h1>{mode === "home" ? "אנשים מוכרים" : "אנשים והרשאות"}</h1>
            <p>{childPrivacy ? "באתר המטפל בילדים מופעלות הרשאות וזיהוי שלד בלבד." : "התצפיתן מציע אנשים שחוזרים לעיתים קרובות, ורק אתם מחליטים מי יוגדר כמוכר."}</p>
          </div>
          <div className="do-people-reference-actions">{!childPrivacy ? <a className="do-button secondary" href="#add-known-person">הוספת אדם</a> : <span><b>{people.length}</b> מוגנים במצב פרטיות</span>}</div>
        </section> : null}

        <nav className="do-people-tabs" aria-label="אנשים והרשאות">
          {mode === "business" ? <>
            <Link className={peopleTab ? "active" : ""} href="/digital-observer/people?tab=people">משתמשים</Link>
            <Link className={rolesTab ? "active" : ""} href="/digital-observer/people?tab=roles">תפקידים</Link>
            <Link className={permissionsTab ? "active" : ""} href="/digital-observer/people">הרשאות והודעות</Link>
          </> : <><span className="active">אנשים</span><Link href="/digital-observer/settings">פרטיות והרשאות</Link></>}
        </nav>

        {site && peopleTab ? (
          <section className="do-people-reference-layout">
            <article className="do-panel do-people-directory">
              <div className="do-section-head"><div><h2>אנשים שהוגדרו</h2><p>הרשאות, הסכמה ומצב הזיהוי לכל אדם.</p></div>{childPrivacy ? <span className="do-badge info">{people.length}</span> : null}</div>
              {people.length ? (
                <div className="do-people-grid">
                  {featuredPeople.map((person) => (
                    <article className="do-person" key={person.id}>
                      <span className="do-person-avatar">{String(person.display_name).slice(0, 1)}</span>
                      <div className="do-person-copy"><strong>{person.display_name}</strong><small>{accessClassLabel(person)}{person.relationship_label ? ` · ${person.relationship_label}` : ""}</small></div>
                      <div className="do-person-statuses"><span className="do-badge info">הסכמה: {observerStatusLabel(person.consent_status)}</span><span className="do-badge warn">זיהוי: {observerStatusLabel(person.recognition_status)}</span></div>
                      <small>עדכון אחרון: {formatObserverDate(person.last_confirmed_at || person.created_at)}</small>
                      {person.consent_status === "approved" ? <ObserverRevokePersonConsentButton id={person.id} /> : null}
                      <ObserverDeletePersonButton id={person.id} />
                    </article>
                  ))}
                </div>
              ) : <div className="do-empty"><UsersRound /><strong>טרם הוגדר אדם מוכר</strong><span>המלצה מהמצלמה תופיע לאחר מספיק תצפיות. אפשר גם להכין אדם ידנית.</span></div>}
              {additionalPeople.length ? <details className="do-people-extra-list"><summary>{additionalPeople.length} אנשים נוספים</summary><div className="do-people-grid">{additionalPeople.map((person) => <article className="do-person" key={person.id}><span className="do-person-avatar">{String(person.display_name).slice(0, 1)}</span><div className="do-person-copy"><strong>{person.display_name}</strong><small>{accessClassLabel(person)}{person.relationship_label ? ` · ${person.relationship_label}` : ""}</small></div><div className="do-person-statuses"><span className="do-badge info">הסכמה: {observerStatusLabel(person.consent_status)}</span><span className="do-badge warn">זיהוי: {observerStatusLabel(person.recognition_status)}</span></div>{person.consent_status === "approved" ? <ObserverRevokePersonConsentButton id={person.id} /> : null}<ObserverDeletePersonButton id={person.id} /></article>)}</div></details> : null}
            </article>
            <aside className="do-people-consent-column do-people-privacy-rail">
              {childPrivacy ? (
                <div className="do-notice good"><ShieldCheck /><span><strong>זיהוי פנים כבוי במקום המטפל בילדים.</strong> התצפיתן משתמש בזיהוי שלד, גודל, תנועה ודפוסים ללא יצירת מאגר פנים של ילדים.</span></div>
              ) : (
                <article className="do-panel do-people-consent-card"><Fingerprint /><h2>הסכמה וזמינות</h2><p>{biometricSetupEnabled ? "הרשאת האתר נשמרה. כל אדם עדיין מחייב הסכמה מפורשת ומודל התאמה מקומי מאומת." : "הפעלת ביומטריה מתחילה מדף הבית או מהתצפיתן שלי, ולאחריה נדרשת הסכמה נפרדת לכל אדם."}</p><span className="do-badge warn">{biometricSetupEnabled ? "הכנה פעילה · התאמה ממתינה" : "כבוי עד הסכמה"}</span>{biometricSetupEnabled ? <ObserverBiometricSetupAction siteId={site.id} enabled /> : null}</article>
              )}
              <article className="do-panel do-people-policy-list">
                <div><ShieldCheck /><span><strong>הרשאה לפי אדם</strong><small>גישה נשמרת לפי האתר בלבד</small></span><b>פעיל</b></div>
                <div><UserRoundCheck /><span><strong>זיהוי אדם מוכר</strong><small>דורש הסכמה וחיבור AI מאושר</small></span><b>מוכנות</b></div>
                <div><Bell /><span><strong>התראה על אדם לא מוכר</strong><small>תופעל רק לאחר חיבור ספק</small></span><b>מוכנות</b></div>
              </article>
              {childPrivacy ? <article className="do-panel do-privacy-lock compact"><LockKeyhole /><h2>הוספת אדם חסומה במצב ילדים</h2><p>למקום זה נבחר ניתוח שלד ותנועה. לא ניתן להוסיף מאגר פנים או מועמדי זיהוי.</p></article> : null}
            </aside>
          </section>
        ) : !site ? <div className="do-empty"><ShieldCheck /><strong>תחילה יש להקים אתר</strong></div> : null}

        {site && peopleTab ? <section className="do-panel do-people-camera-associations">
          <div className="do-section-head"><div><h2>שיוך אנשים למצלמות</h2><p>הטבלה מציגה רק שיוך שנשמר בפועל. זיהוי פנים חי נשאר כבוי.</p></div><span className="do-badge warn">מוכנות בלבד</span></div>
          {cameraAssignments.length ? <div className="do-people-camera-table" role="table" aria-label="שיוך אנשים למצלמות"><div className="do-people-camera-table-head" role="row"><span>מצלמה</span><span>אזור</span><span>אנשים ששויכו</span></div>{cameraAssignments.map(({ camera, people: scopedPeople }) => <div className="do-people-camera-table-row" role="row" key={camera.id}><strong>{camera.display_name}</strong><span>{camera.location_label || "ללא אזור מוגדר"}</span><span>{scopedPeople.length ? scopedPeople.map((person) => person.display_name).join(", ") : "לא שויך"}</span></div>)}</div> : <div className="do-empty compact"><UsersRound /><strong>אין מצלמות לשיוך</strong><span>לא יוצגו שיוכים לפני שמירת מקור מצלמה.</span></div>}
        </section> : null}

        {site && !childPrivacy && peopleTab ? <details className="do-panel do-people-add-disclosure" id="add-known-person"><summary>הוספת אדם מוכר באופן ידני</summary>{biometricSetupEnabled ? <><p>אפשר להוסיף אדם לאחר הסכמה ולבחור בדיוק את המצלמות הרלוונטיות. הצעות אוטומטיות יגיעו רק ממנוע Shadow מחובר ומאושר.</p><ObserverKnownPersonForm siteId={site.id} cameras={cameras.filter((camera) => typeof camera.id === "string").map((camera) => ({ id: camera.id as string, display_name: typeof camera.display_name === "string" ? camera.display_name : null, location_label: typeof camera.location_label === "string" ? camera.location_label : null }))} /></> : <div className="do-notice warn"><ShieldCheck /><span>הרשאת הביומטריה באתר עדיין כבויה. הפעילו אותה תחילה מדף הבית או מ״התצפיתן שלי״.</span></div>}</details> : null}

        {site && !childPrivacy && peopleTab ? (
          <section className="do-section do-people-candidates">
            <div className="do-section-head">
              <div><h2>הצעות מהמצלמות</h2><p>אנשים שנצפו לעיתים קרובות יופיעו כאן לאחר חיבור Gateway ו-AI Shadow.</p></div>
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

        {mode === "business" && site && rolesTab ? (
          <section className="do-panel do-business-role-panel">
            <div className="do-section-head"><div><h2>תפקידים</h2><p>התפקידים משקפים את הרשאות החשבון ומורשי העדכונים הקיימים. הם אינם מעניקים גישה חדשה.</p></div><span className="do-badge info">{permissionContacts.length} משויכים</span></div>
            <div className="do-business-role-grid">
              <article><ShieldCheck /><span><strong>בעל החשבון</strong><small>גישה מלאה לאתר, להגדרות ולניהול הרשאות</small></span><b>1</b></article>
              <article><UsersRound /><span><strong>מורשי עדכונים</strong><small>מקבלים רק את ערוצי העדכון שסומנו עבורם</small></span><b>{recipients.length}</b></article>
              <article><LockKeyhole /><span><strong>משתמשי צוות</strong><small>הזמנה עם כניסה עצמאית ממתינה למסלול הזמנה מאובטח</small></span><b className="do-badge warn">מוכנות</b></article>
            </div>
            <div className="do-notice info"><ShieldCheck /><span>שינוי תפקיד אינו מתבצע בהדמיה. ניהול משתמשי צוות ייפתח רק לאחר חיבור מסלול הזמנה והרשאות שרת מלא.</span></div>
          </section>
        ) : null}

        {mode === "business" && site && permissionsTab ? (
          <section className="do-panel do-business-access-panel" id="team-permissions">
            <div className="do-section-head">
              <div><h2>צוות והרשאות</h2><p>גישה למערכת ומורשי עדכונים הם שני דברים שונים. המטריצה מציגה רק הרשאה שניתנה בפועל.</p></div>
            </div>
            <div className="do-business-access-layout">
              <div className="do-event-permission-matrix" role="table" aria-label="הרשאות התראות לפי סוג אירוע ואיש קשר">
                <div className="do-event-permission-head" role="row"><span>סוג אירוע</span>{matrixContacts.map((contact) => <span key={contact.id}><b>{contact.name}</b><small>{contact.note}</small></span>)}</div>
                {permissionEvents.map((event) => { const EventIcon = event.icon; return <div className="do-event-permission-row" role="row" key={event.key}><span><EventIcon />{event.label}</span>{matrixContacts.map((contact) => { const allowed = contact.owner || (event.critical && contact.receivesCritical); return <i className={allowed ? "allowed" : ""} aria-label={`${contact.name}: ${allowed ? "מקבל" : "לא מקבל"} התראת ${event.label}`} key={contact.id}>{allowed ? <Check /> : <X />}</i>; })}</div>; })}
              </div>
              <aside className="do-permission-contacts" aria-label="אנשי קשר">
                <h3>אנשי קשר</h3>
                {permissionContacts.map((contact) => <article key={contact.id}><span className="do-person-avatar">{String(contact.name).slice(0, 1)}</span><span><strong>{contact.name}</strong><small>{contact.note}</small></span><b>{contact.owner ? "גישה מלאה" : contact.receivesCritical ? "קריטי בלבד" : "ללא ערוץ פעיל"}</b></article>)}
                <Link className="do-button secondary full" href="/digital-observer/settings#access">ניהול אנשי קשר</Link>
              </aside>
            </div>
            {!recipients.length ? <div className="do-empty compact"><UsersRound /><strong>טרם הוגדרו מורשי עדכונים</strong><span>אפשר להוסיף אנשי קשר מוצפנים מההגדרות. הוספה אינה מעניקה להם כניסה למצלמות.</span></div> : null}
            <div className="do-notice info"><ShieldCheck /><span>הזמנת משתמש צוות עם כניסה עצמאית עדיין דורשת מסלול הזמנה מאובטח. המסך אינו מציג איש קשר כאילו קיבל גישה למערכת.</span></div>
          </section>
        ) : null}

        <section className="do-people-privacy-footer"><UserRoundCheck /><span><strong>המידע נשאר במקום שלכם.</strong> זהות או דפוס של אתר אחד אינם זמינים לאחר, והסרה מתבצעת מהמסך הזה.</span><Bell /><span>התראות יופעלו רק לאחר הסכמה וחיבור ספק מתאים.</span></section>
      </div>
    </ObserverAppShell>
  );
}
