import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";
import {
  Activity, Baby, BarChart3, Bell, Building2, CalendarDays, CheckCircle2,
  ChevronLeft, CircleAlert, ClipboardCheck, Clock3, FileClock, GraduationCap,
  Landmark, Megaphone, MessageCircle, ShieldCheck, UserRoundPlus, UsersRound,
  WalletCards
} from "lucide-react";

type IconType = ComponentType<LucideProps>;
type ScheduleItem = { id: string; title: string; time: string; icon?: IconType };
type FeedItem = { id: string; title: string; subtitle?: string; time?: string; tone?: "purple" | "green" | "blue" | "orange" };
type TaskItem = { id: string; title: string; subtitle?: string; href: string };
type ClassroomItem = { id: string; name: string; assigned: number; capacity: number | null };

export function ManagerOverviewDashboard({
  garden, attendance, staff, safety, classrooms, enrollment, schedule, updates,
  tasks, unreadMessages, finance, operations
}: {
  garden: { name: string; city: string; dateLabel: string };
  attendance: { present: number; absent: number; departed: number; total: number; notRecorded: number; completion: number };
  staff: { active: number; present: number; scheduled: number; missingClockOut: number };
  safety: { state: string; label: string; detail: string; cameras: number; operationalCameras: number };
  classrooms: ClassroomItem[];
  enrollment: { open: number; informationRequired: number; waitlisted: number; awaitingPayment: number };
  finance: { outstanding: string; overdue: number; reconciliation: number; subscription: string };
  operations: { tasks: number; complaints: number; documents: number; inspections: number; correctiveActions: number };
  schedule: ScheduleItem[];
  updates: FeedItem[];
  tasks: TaskItem[];
  unreadMessages: number;
}) {
  const ringStyle = { "--manager-progress": `${attendance.completion * 3.6}deg` } as CSSProperties;
  const actionTotal = operations.tasks + operations.complaints + operations.documents + operations.correctiveActions + enrollment.open;
  const quickActions = [
    { title: "הוספת ילד/ה", href: "/dashboard/garden/children?new=1#new-child", icon: UserRoundPlus, tone: "blue" },
    { title: "ניהול נוכחות", href: "/dashboard/garden/attendance", icon: ClipboardCheck, tone: "green" },
    { title: "הזמנת הורה", href: "/dashboard/garden/parents", icon: UsersRound, tone: "purple" },
    { title: "הזמנת צוות", href: "/dashboard/garden/staff-applications", icon: GraduationCap, tone: "cyan" },
    { title: "שליחת הודעה", href: "/dashboard/garden/messages?compose=1#message-workbench", icon: MessageCircle, tone: "blue" },
    { title: "יצירת משימה", href: "/dashboard/garden/tasks", icon: CheckCircle2, tone: "orange" }
  ];

  return (
    <div className="manager-reference-dashboard">
      <section className="manager-command-hero" aria-labelledby="manager-command-title">
        <div className="manager-command-hero-copy">
          <span className="manager-command-eyebrow"><Building2 size={18} /> {garden.name}{garden.city ? ` · ${garden.city}` : ""}</span>
          <h2 id="manager-command-title">מה קורה היום בגן?</h2>
          <p>{garden.dateLabel} · תמונת מצב תפעולית ממקורות הגן המאומתים</p>
          <div className="manager-command-hero-actions">
            <Link href="/dashboard/garden/attendance">פתיחת נוכחות</Link>
            <Link href="/dashboard/garden/command-center">כל מה שדורש טיפול <span>{actionTotal}</span></Link>
          </div>
        </div>
        <div className="manager-command-hero-art" aria-hidden="true">
          <Image src="/assets/gan-batuach-auth-hero.webp" alt="" fill sizes="(max-width: 720px) 42vw, 390px" priority />
          <span>כל יום הוא הזדמנות לגדול בביטחון</span>
        </div>
      </section>

      <section className="manager-today-strip" aria-label="היום בגן">
        <TodayMetric label="צפויים" value={attendance.total} hint="ילדים פעילים" icon={Baby} tone="blue" href="/dashboard/garden/children" />
        <TodayMetric label="נוכחים" value={attendance.present} hint="בגן עכשיו" icon={CheckCircle2} tone="green" href="/dashboard/garden/attendance" />
        <TodayMetric label="נעדרים" value={attendance.absent} hint="סומנו היום" icon={CircleAlert} tone="red" href="/dashboard/garden/attendance?filter=missing" />
        <TodayMetric label="יצאו" value={attendance.departed} hint="שוחררו מהגן" icon={Clock3} tone="purple" href="/dashboard/garden/pickup" />
        <TodayMetric label="צוות נוכח" value={`${staff.present}/${staff.active}`} hint={`${staff.scheduled} משובצים`} icon={UsersRound} tone="cyan" href="/dashboard/garden/staff" />
        <TodayMetric label="לטיפול" value={actionTotal} hint="משימות ובקשות" icon={ClipboardCheck} tone="orange" href="/dashboard/garden/command-center" />
      </section>

      <section className="manager-command-grid manager-command-grid-primary" aria-label="מצב תפעולי מרכזי">
        <article className="manager-reference-card manager-operational-card manager-attendance-card">
          <CardHeading icon={Baby} title="נוכחות ילדים" href="/dashboard/garden/attendance" />
          <div className="manager-attendance-content">
            <span className="manager-progress-ring" style={ringStyle} aria-label={`${attendance.completion}% מרשומות הנוכחות עודכנו`}>
              <b>{attendance.present}</b><small>מתוך {attendance.total}</small>
            </span>
            <span className="manager-attendance-legend">
              <span><i className="present" /> נוכחים <b>{attendance.present}</b></span>
              <span><i className="absent" /> נעדרים <b>{attendance.absent}</b></span>
              <span><i className="departed" /> יצאו <b>{attendance.departed}</b></span>
              <span><i className="pending" /> טרם עודכנו <b>{attendance.notRecorded}</b></span>
            </span>
          </div>
          <footer><span>{attendance.completion}% עודכנו</span><Link href="/dashboard/garden/attendance">ניהול נוכחות <ChevronLeft size={17} /></Link></footer>
        </article>

        <article className="manager-reference-card manager-operational-card manager-staff-card">
          <CardHeading icon={UsersRound} title="צוות היום" href="/dashboard/garden/staff" />
          <div className="manager-staff-status-grid">
            <span><b>{staff.present}</b><small>נוכחים עכשיו</small></span>
            <span><b>{staff.scheduled}</b><small>משמרות היום</small></span>
            <span className={staff.missingClockOut ? "attention" : "ok"}><b>{staff.missingClockOut}</b><small>יציאה חסרה</small></span>
          </div>
          <p>{staff.active ? `${staff.active} אנשי צוות בהעסקה פעילה` : "טרם הופעל צוות בגן"}</p>
          <footer><Link href="/dashboard/garden/staff-time">משמרות ושעות <ChevronLeft size={17} /></Link><Link href="/dashboard/garden/staff-applications">גיוס צוות</Link></footer>
        </article>

        <article className={`manager-reference-card manager-operational-card manager-safety-card state-${safety.state}`}>
          <CardHeading icon={ShieldCheck} title="בטיחות ומצלמות" href="/dashboard/garden/cameras" />
          <div className="manager-safety-status">
            <span className="manager-safety-shield"><ShieldCheck size={39} /></span>
            <div><strong>{safety.label}</strong><small>{safety.detail}</small></div>
          </div>
          <div className="manager-camera-counts"><span><b>{safety.operationalCameras}</b> פעילות מאומתת</span><span><b>{Math.max(0, safety.cameras - safety.operationalCameras)}</b> דורשות בדיקה</span></div>
          <footer><Link href="/dashboard/garden/cameras">פתיחת מצלמות <ChevronLeft size={17} /></Link><Link href="/dashboard/garden/trust-center">מדיניות בטיחות</Link></footer>
        </article>
      </section>

      <section className="manager-command-grid manager-command-grid-secondary">
        <ReferencePanel title="כיתות וקיבולת" icon={GraduationCap} href="/dashboard/garden/reports?type=capacity" linkLabel="דוח קיבולת">
          {classrooms.length ? <div className="manager-classroom-list">{classrooms.slice(0, 5).map((room) => {
            const remaining = room.capacity === null ? null : Math.max(0, room.capacity - room.assigned);
            const over = room.capacity !== null && room.assigned > room.capacity;
            return <Link href="/dashboard/garden/children" key={room.id}><span><b>{room.name}</b><small>{room.assigned} ילדים משויכים</small></span><em className={over ? "danger" : room.capacity === null ? "neutral" : "good"}>{room.capacity === null ? "קיבולת לא הוגדרה" : over ? "חריגה לבדיקה" : `${remaining} מקומות פנויים`}</em></Link>;
          })}</div> : <ReferenceEmpty text="עדיין לא הוגדרו כיתות פעילות" action="הגדרת כיתות" href="/onboarding/kindergarten" />}
        </ReferencePanel>

        <ReferencePanel title="מרכז תשומת לב" icon={CircleAlert} href="/dashboard/garden/command-center" linkLabel="לכל הפריטים">
          <div className="manager-attention-grid">
            <AttentionItem label="משימות פתוחות" value={operations.tasks} href="/dashboard/garden/tasks" tone="blue" />
            <AttentionItem label="בקשות רישום" value={enrollment.open} href="/dashboard/garden/enrollment-requests" tone="purple" />
            <AttentionItem label="מסמכים לטיפול" value={operations.documents} href="/dashboard/garden/documents" tone="orange" />
            <AttentionItem label="תלונות פתוחות" value={operations.complaints} href="/dashboard/garden/command-center#complaints" tone="red" />
            <AttentionItem label="פעולות מתקנות" value={operations.correctiveActions} href="/dashboard/garden/corrective-actions" tone="orange" />
            <AttentionItem label="ביקורות נדרשות" value={operations.inspections} href="/dashboard/garden/inspections" tone="green" />
          </div>
          {enrollment.informationRequired || enrollment.awaitingPayment || enrollment.waitlisted ? <p className="manager-attention-note">רישום: {enrollment.informationRequired} ממתינים למידע · {enrollment.awaitingPayment} לתשלום · {enrollment.waitlisted} ברשימת המתנה</p> : null}
        </ReferencePanel>
      </section>

      <section className="manager-reference-quick manager-reference-card">
        <header><span><Activity size={23} /> פעולות מהירות</span><Link href="/dashboard/garden/command-center">כל הפעולות</Link></header>
        <div>{quickActions.map(({ title, href, icon: Icon, tone }) => <Link className={tone} href={href} key={title}><span><Icon size={27} /></span><b>{title}</b></Link>)}</div>
      </section>

      <section className="manager-command-grid manager-finance-communication-grid">
        <ReferencePanel title="שכר לימוד הורים" icon={WalletCards} href="/dashboard/garden/tuition-ledger" linkLabel="פתיחת ספר שכר לימוד">
          <div className="manager-finance-summary"><strong>{finance.outstanding}</strong><span>יתרה פתוחה</span><div><em>{finance.overdue} באיחור</em><em>{finance.reconciliation} להתאמה</em></div><small>הורה ← גן · הסדרים ידניים נשארים זמינים</small></div>
        </ReferencePanel>
        <ReferencePanel title="מנוי גן בטוח" icon={Landmark} href="/dashboard/garden/subscription" linkLabel="ניהול מנוי הגן">
          <div className="manager-subscription-summary"><span><ShieldCheck size={34} /></span><strong>{finance.subscription}</strong><small>גן ← גן בטוח · נפרד מתשלומי הורים</small><p>אמצעי תשלום אלקטרוני מוצג רק כאשר הספק זמין ומאומת.</p></div>
        </ReferencePanel>
        <ReferencePanel title="תקשורת" icon={MessageCircle} href="/dashboard/garden/messages" linkLabel="פתיחת הודעות">
          <div className="manager-message-summary"><span><Bell size={30} /></span><b>{unreadMessages}</b><strong>{unreadMessages ? "הודעות ממתינות לקריאה" : "אין הודעות חדשות"}</strong><small>הודעות, שידורים והתראות נשארים ערוצים נפרדים.</small><div><Link href="/dashboard/garden/messages?compose=1#message-workbench">הודעה חדשה</Link><Link href="/dashboard/garden/communication">שידור ועדכונים</Link></div></div>
        </ReferencePanel>
      </section>

      <section className="manager-reference-split">
        <ReferencePanel title="לוח זמנים להיום" icon={CalendarDays} href="/dashboard/garden/daily-journal" linkLabel="ללוח היום">
          {schedule.length ? <div className="manager-schedule-list">{schedule.slice(0, 5).map((item) => { const Icon = item.icon ?? CalendarDays; return <article key={item.id}><Icon size={19} /><strong>{item.title}</strong><time>{item.time}</time></article>; })}</div> : <ReferenceEmpty text="עדיין לא פורסמו פעילויות להיום" />}
        </ReferencePanel>
        <ReferencePanel title="פעילות ועדכונים" icon={Megaphone} href="/dashboard/garden/notifications" linkLabel="למרכז ההתראות">
          {updates.length ? <div className="manager-update-list">{updates.slice(0, 5).map((item) => <article key={item.id} className={item.tone ?? "purple"}><span /><div><strong>{item.title}</strong>{item.subtitle ? <small>{item.subtitle}</small> : null}</div>{item.time ? <time>{item.time}</time> : null}<ChevronLeft size={18} /></article>)}</div> : <ReferenceEmpty text="אין עדכונים חדשים כרגע" />}
        </ReferencePanel>
      </section>

      <section className="manager-command-grid manager-command-grid-secondary">
        <ReferencePanel title="משימות קרובות" icon={ClipboardCheck} href="/dashboard/garden/tasks" linkLabel="לכל המשימות">
          {tasks.length ? <div className="manager-task-list">{tasks.slice(0, 5).map((task) => <Link href={task.href} key={task.id}><span /><div><strong>{task.title}</strong>{task.subtitle ? <small>{task.subtitle}</small> : null}</div><ChevronLeft size={18} /></Link>)}</div> : <ReferenceEmpty text="אין משימות פתוחות להיום" />}
        </ReferencePanel>
        <ReferencePanel title="כל סביבת הניהול" icon={BarChart3}>
          <div className="manager-domain-grid">
            <DomainGroup title="ילדים והורים" links={[["ילדים וכיתות", "/dashboard/garden/children"], ["בקשות רישום", "/dashboard/garden/enrollment-requests"], ["הורים ומורשים", "/dashboard/garden/parents"], ["איסוף בטוח", "/dashboard/garden/pickup"]]} />
            <DomainGroup title="צוות" links={[["ניהול צוות", "/dashboard/garden/staff"], ["מועמדים וגיוס", "/dashboard/garden/staff-applications"], ["משמרות ושעות", "/dashboard/garden/staff-time"]]} />
            <DomainGroup title="תפעול ופיקוח" links={[["משימות", "/dashboard/garden/tasks"], ["ביקורות", "/dashboard/garden/inspections"], ["פעולות מתקנות", "/dashboard/garden/corrective-actions"], ["מסמכים", "/dashboard/garden/documents"]]} />
            <DomainGroup title="מידע והגדרות" links={[["דוחות", "/dashboard/garden/reports"], ["התראות", "/dashboard/garden/notifications"], ["בטיחות ומצלמות", "/dashboard/garden/cameras"], ["הגדרות והרשאות", "/dashboard/garden/settings"]]} />
          </div>
        </ReferencePanel>
      </section>
    </div>
  );
}

function TodayMetric({ label, value, hint, icon: Icon, tone, href }: { label: string; value: ReactNode; hint: string; icon: IconType; tone: string; href: string }) {
  return <Link className={`manager-today-metric ${tone}`} href={href}><span><Icon size={20} /></span><div><strong>{value}</strong><b>{label}</b><small>{hint}</small></div></Link>;
}

function CardHeading({ icon: Icon, title, href }: { icon: IconType; title: string; href: string }) {
  return <header className="manager-card-heading"><span><Icon size={21} /> {title}</span><Link href={href}>הצג הכל <ChevronLeft size={16} /></Link></header>;
}

function AttentionItem({ label, value, href, tone }: { label: string; value: number; href: string; tone: string }) {
  return <Link className={tone} href={href}><b>{value}</b><span>{label}</span><ChevronLeft size={16} /></Link>;
}

function ReferencePanel({ title, icon: Icon, href, linkLabel, children }: { title: string; icon: IconType; href?: string; linkLabel?: string; children: ReactNode }) {
  return <section className="manager-reference-panel manager-reference-card"><header><span><Icon size={22} /> {title}</span></header><div className="manager-reference-panel-body">{children}</div>{href && linkLabel ? <Link className="manager-panel-link" href={href}>{linkLabel}<ChevronLeft size={18} /></Link> : null}</section>;
}

function ReferenceEmpty({ text, action, href }: { text: string; action?: string; href?: string }) {
  return <div className="manager-reference-empty"><FileClock size={31} /><span>{text}</span>{action && href ? <Link href={href}>{action}</Link> : null}</div>;
}

function DomainGroup({ title, links }: { title: string; links: Array<[string, string]> }) {
  return <section><b>{title}</b>{links.map(([label, href]) => <Link href={href} key={href}>{label}<ChevronLeft size={15} /></Link>)}</section>;
}
