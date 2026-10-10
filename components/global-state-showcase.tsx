"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  ChevronLeft,
  CircleUserRound,
  Filter,
  Home,
  Languages,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles
} from "lucide-react";
import { AccessibleConfirmDialog } from "@/components/accessible-confirm-dialog";
import {
  CanonicalStatus,
  GlobalEmptyState,
  GlobalLoadingState,
  GlobalStatePanel,
  GlobalSuccessState,
  PermissionDeniedState,
  ProviderState,
  StateAction
} from "@/components/global-state-system";
import { FormField, StatusChip } from "@/components/gan-batuach-design-system";
import { ux19Views, type Ux19View } from "@/lib/ui/ux19-views";

const viewLabels: Record<Ux19View, string> = {
  loading: "טעינה",
  empty: "מצב ריק",
  error: "שגיאה",
  "permission-denied": "אין הרשאה",
  unavailable: "שירות לא זמין",
  "offline-degraded": "מנותק / פעילות חלקית",
  success: "הצלחה",
  "destructive-confirmation": "אישור פעולה רגישה",
  validation: "אימות טופס",
  "status-variants": "מצבי מערכת",
  "calendar-date": "תאריך ולוח שנה",
  "select-dropdown": "בחירה ורשימה",
  toggles: "מתגים",
  "search-filter": "חיפוש וסינון",
  settings: "הגדרות",
  "modal-drawer": "חלון ומגירה",
  "mixed-direction": "תוכן דו־כיווני",
  accessibility: "נגישות"
};

const sections = [
  { label: "מצבי מערכת", icon: Sparkles, views: ux19Views.slice(0, 10) },
  { label: "רכיבי קלט", icon: SlidersHorizontal, views: ux19Views.slice(10, 15) },
  { label: "התנהגות גלובלית", icon: ShieldCheck, views: ux19Views.slice(15) }
] as const;

function ToggleRow({ label, description, initial = false }: { label: string; description: string; initial?: boolean }) {
  const [checked, setChecked] = useState(initial);
  return (
    <div className="ux19-toggle-row">
      <span><b>{label}</b><small>{description}</small></span>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} className="ux19-toggle" onClick={() => setChecked((value) => !value)}><i /></button>
    </div>
  );
}

function CalendarDemo() {
  const days = Array.from({ length: 35 }, (_, index) => index - 2);
  return (
    <section className="ux19-demo-card ux19-calendar-card" aria-labelledby="calendar-title">
      <div className="ux19-demo-heading"><span><CalendarDays /></span><div><h2 id="calendar-title">בחירת תאריך</h2><p>ספטמבר 2026</p></div></div>
      <div className="ux19-weekdays" aria-hidden="true">{["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"].map((day) => <b key={day}>{day}</b>)}</div>
      <div className="ux19-calendar-grid" role="grid" aria-label="ספטמבר 2026">{days.map((day, index) => <button type="button" role="gridcell" aria-selected={day === 12} disabled={day < 1 || day > 30} className={day === 12 ? "selected" : ""} key={index}>{day > 0 && day <= 30 ? day : ""}</button>)}</div>
      <button className="button primary" type="button">בחירת 12 בספטמבר</button>
    </section>
  );
}

function FormValidationDemo() {
  return (
    <section className="ux19-demo-card ux19-form-demo" aria-labelledby="form-title">
      <div className="ux19-demo-heading"><span><CircleUserRound /></span><div><h2 id="form-title">פרטים אישיים</h2><p>כל שדה כולל תווית והודעה ברורה.</p></div></div>
      <FormField label="שם מלא" required hint="כפי שמופיע במסמך הרשמי" defaultValue="מיכל כהן" />
      <FormField label="דוא״ל" required error="יש להזין כתובת דוא״ל תקינה" type="email" defaultValue="michal@" />
      <FormField label="טלפון" hint="הטלפון יכול להישאר לא מאומת" type="tel" dir="ltr" defaultValue="052-1234567" />
      <button className="button primary" type="button">שמירת שינויים</button>
    </section>
  );
}

function StatusDemo() {
  const statuses = ["active", "pending", "verified", "unverified", "action_required", "blocked", "rejected", "expired", "completed", "overdue", "unavailable", "degraded"];
  return <section className="ux19-demo-card"><div className="ux19-demo-heading"><span><ShieldCheck /></span><div><h2>שפה אחידה למצבים</h2><p>טקסט וסמל מלווים כל צבע.</p></div></div><div className="ux19-status-grid">{statuses.map((status) => <CanonicalStatus key={status} status={status} />)}</div></section>;
}

function MixedDirectionDemo() {
  return (
    <section className="ux19-demo-card" aria-labelledby="bidi-title">
      <div className="ux19-demo-heading"><span><Languages /></span><div><h2 id="bidi-title">ערכים דו־כיווניים</h2><p>הממשק נשאר מימין לשמאל, והערכים נשארים קריאים.</p></div></div>
      <dl className="ux19-values-list">
        <div><dt>דוא״ל</dt><dd dir="ltr">michal.cohen@example.com</dd></div>
        <div><dt>טלפון</dt><dd dir="ltr">+972 52-123-4567</dd></div>
        <div><dt>סכום</dt><dd dir="ltr">₪ 1,234.56</dd></div>
        <div><dt>מזהה מסמך</dt><dd dir="ltr">GB-INV-2026-0142.pdf</dd></div>
        <div><dt>חותמת זמן</dt><dd dir="ltr">2026-09-12 10:24 GMT+3</dd></div>
      </dl>
    </section>
  );
}

function SettingsDemo() {
  return <section className="ux19-demo-card"><div className="ux19-demo-heading"><span><Settings /></span><div><h2>הגדרות מערכת</h2><p>קטגוריות עקביות עם יעד מגע ברור.</p></div></div><div className="ux19-settings-list">{[{ label: "פרופיל אישי", icon: CircleUserRound }, { label: "אבטחה", icon: ShieldCheck }, { label: "התראות", icon: Bell }, { label: "שפה ונגישות", icon: Languages }].map(({ label, icon: Icon }) => <button key={label} type="button"><span><Icon />{label}</span><ChevronLeft aria-hidden="true" /></button>)}</div></section>;
}

function ViewContent({ view }: { view: Ux19View }) {
  const [dialogOpen, setDialogOpen] = useState(view === "destructive-confirmation");
  const [drawerOpen, setDrawerOpen] = useState(view === "modal-drawer");

  if (view === "loading") return <GlobalLoadingState title="טוענים את נתוני הגן" description="הכרטיסים נשמרים במקומם כדי למנוע קפיצת פריסה." />;
  if (view === "empty") return <GlobalEmptyState title="עדיין אין משימות" description="משימות חדשות שהוקצו לך יופיעו כאן." action={<StateAction href="/ux19-system-states?view=validation">יצירת משימה</StateAction>} />;
  if (view === "error") return <GlobalStatePanel kind="error" title="לא הצלחנו לטעון את המידע" description="החלק הזה לא זמין כרגע. שאר העמוד ממשיך לפעול." action={<button className="button primary" type="button">ניסיון נוסף</button>} secondaryAction={<button className="button secondary" type="button">מעבר לעזרה</button>} />;
  if (view === "permission-denied") return <PermissionDeniedState description="הגישה מוגבלת לפי התפקיד והגן הפעיל. פרטי המשאב לא נחשפו." backHref="/" />;
  if (view === "unavailable") return <ProviderState state="production_verification_required" action={<button className="button secondary" type="button">בדיקת מצב השירות</button>} />;
  if (view === "offline-degraded") return <div className="ux19-state-pair"><ProviderState state="offline" action={<button className="button primary" type="button">ניסיון נוסף</button>} /><ProviderState state="degraded" /></div>;
  if (view === "success") return <GlobalSuccessState title="השינויים נשמרו" description="ההעדפות עודכנו ונכנסו לתוקף." action={<StateAction href="/ux19-system-states?view=settings">חזרה להגדרות</StateAction>} />;
  if (view === "validation") return <FormValidationDemo />;
  if (view === "status-variants") return <StatusDemo />;
  if (view === "calendar-date") return <CalendarDemo />;
  if (view === "select-dropdown") return <section className="ux19-demo-card"><div className="ux19-demo-heading"><span><Filter /></span><div><h2>בחירה וסינון</h2><p>תוויות גלויות והקשר ברור.</p></div></div><FormField as="select" label="גן פעיל" defaultValue="hashaked"><option value="hashaked">גן השקד — תל אביב</option><option value="rimon">גן רימון — חיפה</option></FormField><fieldset className="ux19-radio-group"><legend>מצב תצוגה</legend><label><input name="view" type="radio" defaultChecked /> כל הרשומות</label><label><input name="view" type="radio" /> נדרשת פעולה</label></fieldset></section>;
  if (view === "toggles") return <section className="ux19-demo-card"><div className="ux19-demo-heading"><span><Bell /></span><div><h2>העדפות התראות</h2><p>כל מתג מציג את שמו ומצבו.</p></div></div><div className="ux19-toggle-list"><ToggleRow label="התראות מערכת" description="עדכונים חשובים על החשבון" initial /><ToggleRow label="עדכוני גן" description="שינויים בפעילות הגן" initial /><ToggleRow label="הודעות שיווקיות" description="תוכן שאינו תפעולי" /></div></section>;
  if (view === "search-filter") return <section className="ux19-demo-card"><div className="ux19-demo-heading"><span><Search /></span><div><h2>חיפוש וסינון</h2><p>במובייל המסננים מוצגים כפעולה ברורה.</p></div></div><div className="ux19-searchbar"><label><span className="sr-only">חיפוש</span><Search aria-hidden="true" /><input type="search" placeholder="חיפוש לפי שם…" /></label><button type="button" className="button secondary"><Filter />סינון <b>2</b></button></div><div className="ux19-filter-chips"><button type="button" aria-pressed="true">הכול</button><button type="button" aria-pressed="false">פעיל</button><button type="button" aria-pressed="false">נדרשת פעולה</button></div></section>;
  if (view === "settings") return <SettingsDemo />;
  if (view === "mixed-direction") return <MixedDirectionDemo />;
  if (view === "accessibility") return <section className="ux19-demo-card"><div className="ux19-demo-heading"><span><ShieldCheck /></span><div><h2>נגישות מובנית</h2><p>מקלדת, מיקוד, תוויות ומשמעות שאינה תלויה בצבע.</p></div></div><div className="ux19-a11y-grid"><button className="button primary" type="button">מיקוד ברור</button><button className="button secondary" type="button">יעד מגע 44px</button><StatusChip tone="warning">נדרשת פעולה</StatusChip><label className="ux19-check"><input type="checkbox" defaultChecked /> קבלת התראות נגישות</label></div></section>;

  return (
    <>
      <section className="ux19-demo-card"><div className="ux19-demo-heading"><span><AlertTriangle /></span><div><h2>{view === "destructive-confirmation" ? "פעולה רגישה" : "חלון ומגירה"}</h2><p>המיקוד נשמר, ניתן לסגור באמצעות Escape, והוא חוזר לנקודת הפתיחה.</p></div></div><button className="button primary" type="button" onClick={() => view === "destructive-confirmation" ? setDialogOpen(true) : setDrawerOpen(true)}>פתיחת {view === "destructive-confirmation" ? "אישור" : "מגירה"}</button></section>
      <AccessibleConfirmDialog open={dialogOpen} title="הסרת גישה" description="המשתמש לא יוכל לגשת לגן לאחר האישור." consequence="הפעולה תירשם ביומן הביקורת." confirmLabel="הסרת גישה" onConfirm={() => setDialogOpen(false)} onCancel={() => setDialogOpen(false)} />
      {drawerOpen ? <div className="ux19-drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setDrawerOpen(false); }}><aside className="ux19-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title"><h2 id="drawer-title">מסננים</h2><FormField as="select" label="מצב" defaultValue="active"><option value="active">פעיל</option><option value="pending">ממתין</option></FormField><button className="button primary" type="button" onClick={() => setDrawerOpen(false)}>הצגת תוצאות</button></aside></div> : null}
    </>
  );
}

export function GlobalStateShowcase({ initialView }: { initialView: Ux19View }) {
  const active = useMemo(() => ux19Views.includes(initialView) ? initialView : "loading", [initialView]);
  return (
    <main className="ux19-showcase-shell" data-ux19-view={active}>
      <aside className="ux19-showcase-sidebar">
        <div className="ux19-showcase-brand"><Image src="/assets/company-symbol.png" width={48} height={48} alt="" priority /><span><b>גן בטוח</b><small>מערכת המצבים</small></span></div>
        <nav aria-label="מצבי מערכת לבדיקת UX">{sections.map(({ label, icon: Icon, views }) => <div key={label}><p><Icon />{label}</p>{views.map((view) => <Link key={view} href={`/ux19-system-states?view=${view}`} aria-current={active === view ? "page" : undefined} className={active === view ? "active" : ""}>{viewLabels[view]}<ChevronLeft aria-hidden="true" /></Link>)}</div>)}</nav>
      </aside>
      <section className="ux19-showcase-main">
        <header className="ux19-showcase-header"><div><p>מערכת עיצוב גלובלית · סביבת פיתוח</p><h1>{viewLabels[active]}</h1></div><div><button type="button" aria-label="התראות"><Bell /></button><span><b>מיכל כהן</b><small>מנהלת גן</small></span><CircleUserRound /></div></header>
        <div className="ux19-showcase-stage"><div className="ux19-showcase-context"><span><Home />גן השקד</span><CanonicalStatus status="active" /></div><ViewContent view={active} /></div>
        <nav className="ux19-showcase-mobile-nav" aria-label="ניווט תחתון"><Link href="/"><Home />בית</Link><Link href="/ux19-system-states?view=settings"><Settings />הגדרות</Link><Link href="/ux19-system-states?view=accessibility"><ShieldCheck />נגישות</Link></nav>
      </section>
    </main>
  );
}
