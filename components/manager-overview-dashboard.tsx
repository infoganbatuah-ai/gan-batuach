import Link from "next/link";
import type { CSSProperties, ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";
import {
  Activity,
  Baby,
  BarChart3,
  Bell,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ClipboardCheck,
  FileText,
  Megaphone,
  MessageCircle,
  ScanEye,
  ShieldCheck,
  UserRoundPlus,
  UsersRound,
  WalletCards
} from "lucide-react";

type IconType = ComponentType<LucideProps>;

type ScheduleItem = {
  id: string;
  title: string;
  time: string;
  icon?: IconType;
};

type FeedItem = {
  id: string;
  title: string;
  subtitle?: string;
  time?: string;
  tone?: "purple" | "green" | "blue" | "orange";
};

type TaskItem = {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};

export function ManagerOverviewDashboard({
  attendance,
  staff,
  safety,
  schedule,
  updates,
  tasks,
  unreadMessages
}: {
  attendance: { present: number; total: number; completion: number };
  staff: { ready: number; total: number; present: number; names: string[] };
  safety: { score: number; label: string; detail: string };
  schedule: ScheduleItem[];
  updates: FeedItem[];
  tasks: TaskItem[];
  unreadMessages: number;
}) {
  const ringStyle = { "--manager-progress": `${attendance.completion * 3.6}deg` } as CSSProperties;
  const quickActions = [
    { title: "קבלת ילד", href: "/dashboard/garden/children", icon: UserRoundPlus },
    { title: "ספירת נוכחות", href: "/dashboard/garden/attendance", icon: ClipboardCheck },
    { title: "דיווח אירוע", href: "/dashboard/garden/incidents", icon: Activity },
    { title: "הודעה להורים", href: "/dashboard/garden/messages", icon: MessageCircle },
    { title: "הוספת עדכון", href: "/dashboard/garden/daily-journal", icon: Megaphone }
  ];
  const shortcuts = [
    { title: "ילדים", href: "/dashboard/garden/children", icon: Baby },
    { title: "צוות", href: "/dashboard/garden/staff", icon: UsersRound },
    { title: "תשלומים", href: "/dashboard/garden/finance", icon: WalletCards },
    { title: "מצלמות", href: "/dashboard/garden/cameras", icon: Camera },
    { title: "תצפיתן כלול", href: "/dashboard/garden/observer-pilot", icon: ScanEye },
    { title: "בקשות הצטרפות", href: "/dashboard/garden/enrollment-requests", icon: UserRoundPlus },
    { title: "דוחות", href: "/dashboard/garden/reports", icon: BarChart3 }
  ];

  return (
    <div className="manager-reference-dashboard">
      <section className="manager-reference-kpis" aria-label="תמונת מצב יומית">
        <Link className="manager-reference-card manager-safety-card" href="/dashboard/garden/trust-center">
          <span className="manager-card-heading"><ShieldCheck size={23} /> סטטוס בטיחות</span>
          <span className="manager-safety-shield"><CheckCircle2 size={42} /></span>
          <strong>{safety.label}</strong>
          <small>{safety.detail}</small>
          <span className="manager-safety-score">{safety.score}/100</span>
        </Link>

        <Link className="manager-reference-card manager-staff-card" href="/dashboard/garden/staff">
          <span className="manager-card-heading"><UsersRound size={23} /> צוות נוכח היום</span>
          <b>{staff.present}</b>
          <small>מתוך {staff.total}</small>
          <span className="manager-avatar-stack" aria-label="אנשי צוות">
            {staff.names.slice(0, 4).map((name, index) => <i key={`${name}-${index}`}>{name.slice(0, 1)}</i>)}
            {staff.total > 4 ? <i className="more">+{staff.total - 4}</i> : null}
          </span>
          <em>{staff.ready} מאושרים לעבודה</em>
        </Link>

        <Link className="manager-reference-card manager-attendance-card" href="/dashboard/garden/attendance">
          <span className="manager-card-heading"><Baby size={23} /> נוכחות ילדים</span>
          <div className="manager-attendance-content">
            <span className="manager-progress-ring" style={ringStyle}>
              <b>{attendance.present}</b>
              <small>מתוך {attendance.total}</small>
            </span>
            <span className="manager-attendance-legend">
              <span><i className="present" /> נוכחים <b>{attendance.present}</b></span>
              <span><i className="missing" /> חסרים <b>{Math.max(0, attendance.total - attendance.present)}</b></span>
            </span>
          </div>
          <em>{attendance.completion}% מהילדים עודכנו היום</em>
        </Link>
      </section>

      <section className="manager-reference-split">
        <ReferencePanel title="לוח זמנים להיום" icon={CalendarDays} href="/dashboard/garden/daily-journal" linkLabel="לכל לוח הזמנים">
          {schedule.length ? (
            <div className="manager-schedule-list">
              {schedule.slice(0, 5).map((item) => {
                const Icon = item.icon ?? CalendarDays;
                return <article key={item.id}><Icon size={19} /><strong>{item.title}</strong><time>{item.time}</time></article>;
              })}
            </div>
          ) : <ReferenceEmpty text="עדיין לא פורסמו פעילויות להיום" />}
        </ReferencePanel>

        <ReferencePanel title="עדכונים אחרונים" icon={Megaphone} href="/dashboard/garden/notifications" linkLabel="לכל העדכונים">
          {updates.length ? (
            <div className="manager-update-list">
              {updates.slice(0, 4).map((item) => (
                <article key={item.id} className={item.tone ?? "purple"}>
                  <span />
                  <div><strong>{item.title}</strong>{item.subtitle ? <small>{item.subtitle}</small> : null}</div>
                  {item.time ? <time>{item.time}</time> : null}
                  <ChevronLeft size={18} />
                </article>
              ))}
            </div>
          ) : <ReferenceEmpty text="אין עדכונים חדשים כרגע" />}
        </ReferencePanel>
      </section>

      <section className="manager-reference-quick manager-reference-card">
        <header><span><Activity size={23} /> פעולות מהירות</span></header>
        <div>
          {quickActions.map(({ title, href, icon: Icon }) => (
            <Link href={href} key={href}><span><Icon size={29} /></span><b>{title}</b></Link>
          ))}
        </div>
      </section>

      <section className="manager-reference-lower">
        <ReferencePanel title="קיצורי דרך" icon={BarChart3}>
          <div className="manager-shortcut-grid">
            {shortcuts.map(({ title, href, icon: Icon }) => <Link href={href} key={href}><Icon size={25} /><b>{title}</b></Link>)}
          </div>
        </ReferencePanel>

        <ReferencePanel title="משימות להיום" icon={ClipboardCheck} href="/dashboard/garden/tasks" linkLabel="לכל המשימות">
          {tasks.length ? <div className="manager-task-list">{tasks.slice(0, 4).map((task) => <Link href={task.href} key={task.id}><span /><div><strong>{task.title}</strong>{task.subtitle ? <small>{task.subtitle}</small> : null}</div><ChevronLeft size={18} /></Link>)}</div> : <ReferenceEmpty text="אין משימות פתוחות להיום" />}
        </ReferencePanel>

        <ReferencePanel title="הודעות הורים" icon={MessageCircle} href="/dashboard/garden/messages" linkLabel="לכל ההודעות">
          <div className="manager-message-summary">
            <span><Bell size={32} /></span>
            <b>{unreadMessages}</b>
            <strong>{unreadMessages ? "הודעות ממתינות לקריאה" : "אין הודעות חדשות"}</strong>
            <small>{unreadMessages ? "פתחי את מרכז ההודעות כדי להשיב" : "הודעות חדשות יופיעו כאן"}</small>
            <Link href="/dashboard/garden/messages">פתיחת הודעות</Link>
          </div>
        </ReferencePanel>
      </section>
    </div>
  );
}

function ReferencePanel({ title, icon: Icon, href, linkLabel, children }: { title: string; icon: IconType; href?: string; linkLabel?: string; children: ReactNode }) {
  return (
    <section className="manager-reference-panel manager-reference-card">
      <header><span><Icon size={23} /> {title}</span></header>
      <div className="manager-reference-panel-body">{children}</div>
      {href && linkLabel ? <Link className="manager-panel-link" href={href}>{linkLabel}<ChevronLeft size={18} /></Link> : null}
    </section>
  );
}

function ReferenceEmpty({ text }: { text: string }) {
  return <div className="manager-reference-empty"><FileText size={28} /><span>{text}</span></div>;
}
