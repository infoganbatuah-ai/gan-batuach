import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Ban,
  Camera,
  CameraOff,
  CheckCircle2,
  Clock3,
  Eye,
  FileLock2,
  Filter,
  HardDrive,
  LockKeyhole,
  MapPinned,
  Plus,
  RadioTower,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Video,
  WifiOff
} from "lucide-react";
import type { SafetyCamera, SafetyIncident, SafetyRole } from "@/lib/management/safety-cameras";
import { safetySummary } from "@/lib/management/safety-cameras";

type SafetyView = "overview" | "events" | "setup" | "policy" | "readiness";
type SafetyFilter = "all" | "online" | "degraded" | "offline" | "setup_required" | "action";

const stateIcon = {
  online: Video,
  degraded: AlertTriangle,
  offline: WifiOff,
  setup_required: Settings2,
  unavailable: Ban
};

const roleCopy: Record<SafetyRole, { eyebrow: string; title: string; subtitle: string }> = {
  owner: { eyebrow: "מרכז בטיחות", title: "בטיחות ומצלמות", subtitle: "מצב הגן, הרשאות ומוכנות לצפייה — על בסיס אמת תפעולית בלבד" },
  manager: { eyebrow: "מרכז בטיחות", title: "בטיחות ומצלמות", subtitle: "מצב הגן, הרשאות ומוכנות לצפייה — על בסיס אמת תפעולית בלבד" },
  parent: { eyebrow: "בטיחות הילד", title: "מצלמות הגן", subtitle: "רק מצלמות שאושרו למשפחה ורק כאשר יכולת Live אומתה ל־Production" },
  staff: { eyebrow: "בטיחות הצוות", title: "מצלמות מורשות", subtitle: "גישה לפי גן פעיל, תפקיד, אזור ומדיניות המצלמה" },
  inspector: { eyebrow: "פיקוח בטיחות", title: "מצלמות וראיות", subtitle: "הקשר מוגבל לגנים משויכים; Live אינו נפתח ללא הרשאה ואימות Production" },
  admin: { eyebrow: "Platform Safety", title: "מרכז בטיחות ומצלמות", subtitle: "מוכנות, בידוד גנים, מדיניות וביקורת ללא חשיפת תשתית" }
};

const viewLabel: Record<SafetyView, string> = {
  overview: "סקירה",
  events: "אירועים וראיות",
  setup: "הקמה",
  policy: "הרשאות",
  readiness: "מוכנות"
};

function baseFor(role: SafetyRole) {
  if (role === "parent") return "/dashboard/parent/cameras";
  if (role === "staff") return "/dashboard/staff/cameras";
  if (role === "inspector") return "/dashboard/inspector/cameras";
  if (role === "admin") return "/dashboard/admin/cameras";
  return "/dashboard/garden/cameras";
}

function formatDate(value: string | null) {
  if (!value) return "לא התקבל עדכון";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "לא התקבל עדכון";
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Jerusalem" }).format(date);
}

function statusQuery(base: string, filter: SafetyFilter, searchQuery: string) {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("filter", filter);
  if (searchQuery) params.set("q", searchQuery);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

function cameraQuery(base: string, camera: SafetyCamera, filter: SafetyFilter, searchQuery: string) {
  const params = new URLSearchParams();
  params.set("camera", camera.id);
  if (filter !== "all") params.set("filter", filter);
  if (searchQuery) params.set("q", searchQuery);
  return `${base}?${params.toString()}`;
}

function CameraTruthCard({ camera, base, filter, searchQuery }: { camera: SafetyCamera; base: string; filter: SafetyFilter; searchQuery: string }) {
  const Icon = stateIcon[camera.truthState];
  return (
    <article className={`safety-camera-card state-${camera.truthState}`}>
      <div className="safety-camera-visual" aria-label={`${camera.name}: ${camera.statusLabel}`}>
        <div className="safety-camera-area-illustration" aria-hidden="true" />
        <div className="safety-camera-grid-lines" aria-hidden="true" />
        <span className={`safety-status-chip ${camera.truthState}`}><Icon size={14} /> {camera.statusLabel}</span>
        <div className="safety-camera-placeholder">
          {camera.truthState === "online" ? <Camera size={44} /> : <CameraOff size={44} />}
          <strong>{camera.liveLabel}</strong>
          <small>תמונת אזור להמחשה · לא שידור חי ולא הקלטה</small>
        </div>
        <span className="safety-area-label"><MapPinned size={14} /> {camera.area}</span>
      </div>
      <div className="safety-camera-card-body">
        <div>
          <h3>{camera.name}</h3>
          <p>{camera.gardenName ? `${camera.gardenName} · ` : ""}{camera.area}</p>
        </div>
        <dl>
          <div><dt>הרשאה</dt><dd><LockKeyhole size={14} /> {camera.permissionLabel}</dd></div>
          <div><dt>ניטור</dt><dd><Activity size={14} /> {camera.monitoring ? "פעיל לפי חוזה" : "לא פעיל"}</dd></div>
          <div><dt>בדיקה אחרונה</dt><dd><Clock3 size={14} /> {formatDate(camera.lastCheck)}</dd></div>
        </dl>
        <Link className="safety-camera-open" href={cameraQuery(base, camera, filter, searchQuery)} aria-label={`פתיחת פרטי ${camera.name}`}>
          פרטי מצלמה <ArrowLeft size={16} />
        </Link>
      </div>
    </article>
  );
}

function CameraDetail({ camera, base, role }: { camera: SafetyCamera; base: string; role: SafetyRole }) {
  return (
    <aside className="safety-camera-detail" aria-label={`פרטי ${camera.name}`}>
      <header>
        <span className={`safety-detail-icon ${camera.truthState}`}><Camera size={24} /></span>
        <div><small>מצלמה נבחרת</small><h2>{camera.name}</h2><p>{camera.area}</p></div>
        <Link href={base} aria-label="סגירת פרטי מצלמה">×</Link>
      </header>
      <div className="safety-detail-status">
        <span className={`safety-status-chip ${camera.truthState}`}>{camera.statusLabel}</span>
        <span><Clock3 size={15} /> {formatDate(camera.lastCheck)}</span>
      </div>
      <section className="safety-live-truth">
        <Video size={30} />
        <div>
          <strong>{camera.liveLabel}</strong>
          <p>מצב חיבור או מוכנות HLS/WebRTC אינם הוכחת Live ב־Production. הנגן נשאר חסום עד לאישור חוזי מפורש.</p>
        </div>
        <button type="button" disabled aria-disabled="true">Live לא זמין</button>
      </section>
      <dl className="safety-detail-facts">
        <div><dt>גישה לפי תפקיד</dt><dd>{camera.permissionLabel}</dd></div>
        <div><dt>הקלטה</dt><dd>{camera.recordingEnabled ? "מוגדרת לפי מדיניות" : "אין הקלטה בהתאם למדיניות"}</dd></div>
        <div><dt>אירועים</dt><dd>מוצגים רק אירועים קנוניים שעברו הרשאה</dd></div>
        <div><dt>זהות</dt><dd>Track ID אינו זהות ילד</dd></div>
      </dl>
      <div className="safety-detail-actions">
        {role === "owner" || role === "manager" || role === "admin" ? <Link href={`${base}?view=setup`}>בדיקת חיבור</Link> : null}
        <Link href={`${base}?view=events`}>אירועים וראיות</Link>
      </div>
    </aside>
  );
}

function SetupFlow({ managementSlot }: { managementSlot?: ReactNode }) {
  const steps = [
    ["01", "הוספת מערכת", "RTSP, ONVIF, NVR/DVR או Gateway קיים — רק נתיבים נתמכים"],
    ["02", "בדיקת חיבור", "מחובר, לא נגיש, נדרשת הרשאה או הגדרה חסרה"],
    ["03", "מיפוי אזור", "שיוך לאזור קנוני בגן הפעיל"],
    ["04", "בדיקה", "בדיקת מקור ומוכנות ללא חשיפת סוד בדפדפן"],
    ["05", "הפעלה", "השרת בלבד קובע שהמצלמה פעילה"
    ]
  ];
  return (
    <section className="safety-setup" aria-labelledby="safety-setup-title">
      <header><div><span>תהליך מבוקר</span><h2 id="safety-setup-title">הקמת מצלמה או מערכת</h2><p>הקמה אינה הוכחת Live. כל שלב נשאר כפוף להרשאות ולמוכנות ספק.</p></div><Plus size={28} /></header>
      <ol className="safety-setup-steps">
        {steps.map(([number, title, text]) => <li key={number}><b>{number}</b><div><strong>{title}</strong><span>{text}</span></div></li>)}
      </ol>
      <div className="safety-setup-truth"><ShieldCheck size={20} /><span><strong>סודות נשמרים בצד השרת</strong> אין הצגת כתובת מקור, סיסמה או מפתח Gateway במסך.</span></div>
      {managementSlot ? <details className="safety-canonical-manager"><summary>פתיחת אשף ההקמה הקנוני</summary>{managementSlot}</details> : <div className="safety-unavailable"><LockKeyhole size={24} /><div><strong>הקמה אינה זמינה לתפקיד זה</strong><span>יש לפנות לבעלים או למנהל המורשה של הגן.</span></div></div>}
    </section>
  );
}

function EventsAndEvidence({ incidents, role }: { incidents: SafetyIncident[]; role: SafetyRole }) {
  return (
    <div className="safety-events-layout">
      <section className="safety-panel safety-events-panel">
        <header><div><span>אירועים</span><h2>אירועי מצלמה מאומתים</h2></div><Activity size={24} /></header>
        <div className="safety-empty compact"><CheckCircle2 size={28} /><strong>אין אירועי מצלמה מאומתים להצגה</strong><span>רשומות mock, shadow, sandbox או local אינן מוצגות כאירועי Production.</span></div>
      </section>
      <section className="safety-panel safety-incidents-panel">
        <header><div><span>תקריות</span><h2>דיווחי בטיחות קנוניים</h2></div><ShieldAlert size={24} /></header>
        {incidents.length ? <div className="safety-incident-list">{incidents.slice(0, 8).map((incident) => (
          <article key={incident.id}>
            <span className={`safety-severity ${incident.severity}`}>{incident.severity === "high" ? "גבוה" : incident.severity === "critical" ? "קריטי" : "מעקב"}</span>
            <div><strong>{incident.title}</strong><p>{incident.description ?? "דיווח תפעולי ללא תוכן נוסף לתצוגה זו"}</p><small>{incident.gardenName ? `${incident.gardenName} · ` : ""}{formatDate(incident.createdAt)}</small></div>
            <span className="safety-incident-state">{incident.status}</span>
          </article>
        ))}</div> : <div className="safety-empty compact"><ShieldCheck size={28} /><strong>אין תקריות בטיחות להצגה</strong><span>מצב ריק אינו תקלה ואינו אומר שנתוני מצלמה חסרים.</span></div>}
      </section>
      <section className="safety-panel safety-evidence-panel">
        <header><div><span>ראיות</span><h2>גישה חתומה ומוגבלת</h2></div><FileLock2 size={24} /></header>
        <div className="safety-evidence-truth">
          <LockKeyhole size={34} />
          <strong>{role === "inspector" ? "הקשר ראיות בלבד" : "אין ראיה חתומה זמינה ברשימה זו"}</strong>
          <p>ראיה מוצגת רק לאחר בדיקת הרשאה וקבלת כתובת קצרה וחתומה. אין כתובות ציבוריות או נתיבי אחסון.</p>
          <span>מקור · זמן · קשר לאירוע · מצב גישה</span>
        </div>
      </section>
    </div>
  );
}

function PolicyPanel({ role }: { role: SafetyRole }) {
  const rows = [
    ["בעלים / מנהל", "גן פעיל בלבד", "מצב, הקמה ומדיניות", "Live רק אחרי אימות Production"],
    ["הורה", "ילד וגן מקושרים", "מצלמות שאושרו למשפחה", "ללא כלים פנימיים או גנים אחרים"],
    ["צוות", "העסקה, גן, תפקיד ואזור", "רק מצלמות שאושרו לצוות", "אין גישה גורפת לגן"],
    ["מפקח", "שיוך פיקוח פעיל", "ראיות והקשר מוגבל", "Live אינו נניח כברירת מחדל"]
  ];
  return (
    <section className="safety-policy" aria-labelledby="safety-policy-title">
      <header><div><span>מדיניות מצלמות</span><h2 id="safety-policy-title">הרשאות נפרדות לכל תפקיד</h2><p>הגדרת תפקיד אינה מחליפה בדיקת גן, מצלמה ויכולת.</p></div><ShieldCheck size={28} /></header>
      <div className="safety-policy-table" role="table" aria-label="מטריצת הרשאות מצלמות">
        <div className="head" role="row"><span role="columnheader">תפקיד</span><span role="columnheader">היקף</span><span role="columnheader">מה ניתן לראות</span><span role="columnheader">גבול</span></div>
        {rows.map((row) => <div role="row" className={row[0].includes(role === "parent" ? "הורה" : role === "staff" ? "צוות" : role === "inspector" ? "מפקח" : "בעלים") ? "current" : ""} key={row[0]}>{row.map((cell, index) => <span role="cell" key={cell}><small>{["תפקיד", "היקף", "מה ניתן לראות", "גבול"][index]}</small>{cell}</span>)}</div>)}
      </div>
      <div className="safety-policy-cards">
        <article><Eye size={22} /><strong>גישה מתועדת</strong><span>Live, ראיה ושינוי מדיניות נרשמים רק כאשר החוזה הקנוני תומך בכך.</span></article>
        <article><LockKeyhole size={22} /><strong>בידוד גנים</strong><span>הקשר גן פעיל או שיוך מפקח נבדקים בצד השרת.</span></article>
        <article><Ban size={22} /><strong>ללא זיהוי מדומה</strong><span>Track ID, התאמת פנים או אובייקט אינם מוצגים כזהות ילד.</span></article>
      </div>
    </section>
  );
}

function ReadinessPanel({ cameras, role }: { cameras: SafetyCamera[]; role: SafetyRole }) {
  const summary = safetySummary(cameras);
  const continuations = role === "admin" ? [
    ["בריאות ותשתית", "/dashboard/admin/camera-audit"],
    ["Video Gateway", "/dashboard/admin/video-gateway"],
    ["Watch Rules", "/dashboard/admin/observer-watch"],
    ["Observer Intelligence", "/dashboard/admin/observer-intelligence"]
  ] : role === "owner" || role === "manager" ? [
    ["בריאות מצלמות", "/dashboard/garden/camera-health"],
    ["תקריות בטיחות", "/dashboard/garden/incidents"],
    ["Watch Rules", "/dashboard/garden/observer-watch"],
    ["Observer Intelligence", "/dashboard/garden/observer-intelligence"]
  ] : [];
  return (
    <div className="safety-readiness-layout">
      <section className="safety-panel safety-provider-state">
        <header><div><span>תלות חיצונית</span><h2>מוכנות Digital Observer / Gateway</h2></div><RadioTower size={26} /></header>
        <div className="safety-provider-banner"><AlertTriangle size={30} /><div><strong>נדרש אימות Production</strong><p>קיימים חוזי חיבור ובדיקת מוכנות, אך אין כרגע attestation קנוני שמוכיח Live ב־Production למסכי Management.</p></div></div>
        <ul><li><CheckCircle2 /> סטטוסי מצלמה מוצגים מהשרת</li><li><CheckCircle2 /> הרשאות תפקיד וגן נאכפות בצד השרת</li><li><AlertTriangle /> Live נשאר חסום עד חוזה אימות מפורש</li><li><AlertTriangle /> mock/shadow/sandbox אינם מוצגים כ־Production</li></ul>
      </section>
      <section className="safety-panel safety-recording-state">
        <header><div><span>מדיניות הקלטה</span><h2>הקלטה ושמירת ראיות</h2></div><HardDrive size={26} /></header>
        <div className="safety-recording-number"><strong>{summary.recordingDisabled}</strong><span>מצלמות ללא הקלטה מוגדרת</span></div>
        <div className="safety-no-recording"><CameraOff size={24} /><div><strong>אין הקלטה בהתאם למדיניות</strong><span>למצלמה ללא הקלטה לא מוצגים ציר זמן, נגן עבר או ארכיון ראיות.</span></div></div>
      </section>
      <section className="safety-panel safety-capability-state">
        <header><div><span>יכולות</span><h2>Watch Rules וחקירה</h2></div><Sparkles size={26} /></header>
        <div className="safety-capability-row"><strong>Watch Rules</strong><span>{role === "owner" || role === "manager" || role === "admin" ? "בקשות מעקב לבדיקה אנושית זמינות; אין פעולה אוטומטית" : "לא זמין לתפקיד זה"}</span></div>
        <div className="safety-capability-row disabled"><strong>חקירה</strong><span>אין חוזה Management מאומת להצגת חיפוש חקירה; הממשק אינו מוצג כפעיל</span></div>
        {continuations.length ? <nav className="safety-continuations" aria-label="יכולות בטיחות קנוניות נוספות">{continuations.map(([label, href]) => <Link href={href} key={href}>{label}<ArrowLeft size={14} /></Link>)}</nav> : null}
      </section>
    </div>
  );
}

export function SafetyCamerasPlatform({
  role,
  cameras,
  incidents = [],
  gardenName,
  view = "overview",
  filter = "all",
  selectedCameraId,
  searchQuery = "",
  sourceError,
  managementSlot
}: {
  role: SafetyRole;
  cameras: SafetyCamera[];
  incidents?: SafetyIncident[];
  gardenName?: string | null;
  view?: SafetyView;
  filter?: SafetyFilter;
  selectedCameraId?: string | null;
  searchQuery?: string;
  sourceError?: string | null;
  managementSlot?: ReactNode;
}) {
  const base = baseFor(role);
  const copy = roleCopy[role];
  const summary = safetySummary(cameras);
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase("he-IL");
  const filtered = cameras.filter((camera) => {
    const stateMatches = filter === "all" ? true : filter === "action" ? camera.actionRequired : camera.truthState === filter;
    const searchMatches = !normalizedSearch || [camera.name, camera.area, camera.gardenName].filter(Boolean).some((value) => String(value).toLocaleLowerCase("he-IL").includes(normalizedSearch));
    return stateMatches && searchMatches;
  });
  const selected = cameras.find((camera) => camera.id === selectedCameraId) ?? null;
  const views: SafetyView[] = role === "parent" || role === "staff" || role === "inspector"
    ? ["overview", "events", "policy", "readiness"]
    : ["overview", "events", "setup", "policy", "readiness"];
  const filters: Array<[SafetyFilter, string, number]> = [
    ["all", "הכל", summary.total], ["online", "מחוברות", summary.online], ["degraded", "מוגבלות", summary.degraded],
    ["offline", "לא מחוברות", summary.offline], ["setup_required", "הקמה", summary.setupRequired], ["action", "דורשות טיפול", summary.actionRequired]
  ];
  return (
    <div className={`safety-platform safety-role-${role}`} data-role={role}>
      <section className="safety-hero">
        <div className="safety-hero-copy">
          <span className="safety-eyebrow"><ShieldCheck size={16} /> {copy.eyebrow}</span>
          <h1>{copy.title}</h1>
          <p>{copy.subtitle}</p>
          {gardenName ? <span className="safety-garden-context"><MapPinned size={15} /> {gardenName} · הקשר מאומת בצד השרת</span> : null}
        </div>
        <div className="safety-hero-mark" aria-hidden="true"><Image alt="" src="/assets/gan-batuach-brand-mark-official.png" width={86} height={86} loading="eager" /><span><Camera /></span></div>
        <div className="safety-hero-truth"><LockKeyhole size={19} /><div><strong>Capability truth</strong><span>Live לא מסומן כפעיל ללא אימות Production והרשאת תפקיד</span></div></div>
      </section>

      {sourceError ? <div className="safety-source-error" role="alert"><AlertTriangle size={18} />{sourceError}</div> : null}

      <nav className="safety-tabs" aria-label="אזורי בטיחות ומצלמות">
        {views.map((item) => <Link className={view === item ? "active" : ""} href={item === "overview" ? base : `${base}?view=${item}`} key={item}>{viewLabel[item]}</Link>)}
      </nav>

      {view === "overview" ? <>
        <section className="safety-metrics" aria-label="סיכום מצב מצלמות">
          <article className="blue"><Camera /><span>מקורות</span><strong>{summary.total}</strong><small>במסגרת ההרשאה</small></article>
          <article className="green"><Video /><span>מחוברות</span><strong>{summary.online}</strong><small>מצב מקור בלבד</small></article>
          <article className="orange"><AlertTriangle /><span>מוגבלות</span><strong>{summary.degraded}</strong><small>דורש תשומת לב</small></article>
          <article className="red"><CameraOff /><span>לא מחוברות</span><strong>{summary.offline}</strong><small>ללא תצוגה מדומה</small></article>
          <article className="purple"><Settings2 /><span>הקמה</span><strong>{summary.setupRequired}</strong><small>ממתינות להגדרה</small></article>
          <article className="navy"><ShieldAlert /><span>פעולה</span><strong>{summary.actionRequired}</strong><small>מצב אמת נוכחי</small></article>
        </section>

        <section className="safety-toolbar">
          <form className="safety-search" action={base} method="get" role="search">
            <Search size={17} />
            <input name="q" defaultValue={searchQuery} aria-label="חיפוש מצלמה לפי שם או אזור" placeholder="חיפוש לפי שם או אזור" />
            {filter !== "all" ? <input type="hidden" name="filter" value={filter} /> : null}
            <button type="submit">חיפוש</button>
          </form>
          <div className="safety-filter-chips" aria-label="סינון מצלמות"><Filter size={16} />{filters.map(([value, label, count]) => <Link className={filter === value ? "active" : ""} href={statusQuery(base, value, searchQuery)} key={value}>{label} <b>{count}</b></Link>)}</div>
        </section>

        <div className={`safety-camera-workspace ${selected ? "has-detail" : ""}`}>
          <section className="safety-camera-grid" aria-label="רשימת מצלמות">
            {filtered.length ? filtered.map((camera) => <CameraTruthCard camera={camera} base={base} filter={filter} searchQuery={searchQuery} key={camera.id} />) : <div className="safety-empty"><CameraOff size={42} /><strong>{cameras.length ? "אין מצלמות במסנן או בחיפוש" : "אין מערכת מצלמות מוגדרת"}</strong><span>{cameras.length ? "אפשר לשנות את החיפוש או לבחור מצב אחר." : role === "owner" || role === "manager" || role === "admin" ? "אפשר לעבור להקמה ולחבר מקור נתמך." : "אין מצלמות שהקשר ההרשאה הנוכחי מאפשר להציג."}</span>{role === "owner" || role === "manager" || role === "admin" ? <Link href={`${base}?view=setup`}><Plus size={17} /> מעבר להקמה</Link> : null}</div>}
          </section>
          {selected ? <CameraDetail camera={selected} base={base} role={role} /> : null}
        </div>

        <section className="safety-overview-footer">
          <article><ShieldCheck size={24} /><div><strong>בידוד גן ותפקיד</strong><span>רק מצלמות בהקשר הפעיל והמאומת מוצגות.</span></div><Link href={`${base}?view=policy`}>מדיניות</Link></article>
          <article><RadioTower size={24} /><div><strong>תלות חיצונית</strong><span>תקלה בספק אינה חוסמת ניהול גן אחר.</span></div><Link href={`${base}?view=readiness`}>מוכנות</Link></article>
          <article><FileLock2 size={24} /><div><strong>ראיות פרטיות</strong><span>גישה קצרה, חתומה ומתועדת בלבד.</span></div><Link href={`${base}?view=events`}>אירועים</Link></article>
        </section>
      </> : null}

      {view === "events" ? <EventsAndEvidence incidents={incidents} role={role} /> : null}
      {view === "setup" ? <SetupFlow managementSlot={managementSlot} /> : null}
      {view === "policy" ? <PolicyPanel role={role} /> : null}
      {view === "readiness" ? <ReadinessPanel cameras={cameras} role={role} /> : null}
    </div>
  );
}
