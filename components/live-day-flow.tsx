import Link from "next/link";
import { AlertTriangle, Baby, Bell, CalendarCheck, HeartPulse, Moon, ShieldCheck, Shirt, Utensils, UsersRound } from "lucide-react";

type FlowItem = {
  title: string;
  text: string;
  href: string;
  tone?: "good" | "warn" | "bad";
};

function currentPhase() {
  const hour = new Date().getHours();
  if (hour >= 7 && hour < 10) return { key: "morning", label: "בוקר", title: "מה חשוב עכשיו בבוקר?", icon: CalendarCheck };
  if (hour >= 10 && hour < 13) return { key: "midday", label: "צהריים", title: "מה חשוב עכשיו בצהריים?", icon: Utensils };
  if (hour >= 12 && hour < 15) return { key: "nap", label: "שנת צהריים", title: "מה חשוב עכשיו בזמן מנוחה?", icon: Moon };
  if (hour >= 15 && hour < 17) return { key: "pickup", label: "איסוף", title: "מה חשוב עכשיו באיסוף?", icon: ShieldCheck };
  return { key: "general", label: "יום עבודה", title: "מה חשוב עכשיו?", icon: Bell };
}

export function LiveDayFlow({ counts }: { counts: Record<string, number | null | undefined> }) {
  const phase = currentPhase();
  const Icon = phase.icon;
  const byPhase: Record<string, FlowItem[]> = {
    morning: [
      { title: "נוכחות וילדים חסרים", text: `${counts.missingAttendance ?? 0} ילדים ללא סימון / חסרים`, href: "/dashboard/garden/attendance", tone: counts.missingAttendance ? "warn" : "good" },
      { title: "בגדים להחלפה", text: `${counts.missingClothes ?? 0} ילדים צריכים השלמה`, href: "/dashboard/garden/children?view=attention", tone: counts.missingClothes ? "bad" : "good" },
      { title: "עדכוני הורים", text: `${counts.parentRequests ?? 0} פניות פתוחות`, href: "/dashboard/garden/children?view=attention", tone: counts.parentRequests ? "warn" : "good" }
    ],
    midday: [
      { title: "ארוחות", text: `${counts.withoutMeal ?? 0} ילדים בלי עדכון ארוחה`, href: "/dashboard/garden/child-journal", tone: counts.withoutMeal ? "warn" : "good" },
      { title: "בריאות ואלרגיות", text: `${counts.healthAlerts ?? 0} ילדים עם דגש רפואי`, href: "/dashboard/garden/health", tone: counts.healthAlerts ? "warn" : "good" },
      { title: "אירועים", text: `${counts.openIncidents ?? 0} אירועים פתוחים`, href: "/dashboard/garden/incidents", tone: counts.openIncidents ? "bad" : "good" }
    ],
    nap: [
      { title: "שינה", text: `${counts.withoutSleep ?? 0} ילדים בלי עדכון שינה`, href: "/dashboard/garden/child-journal", tone: counts.withoutSleep ? "warn" : "good" },
      { title: "ילדים מיוחדים", text: `${counts.healthAlerts ?? 0} ילדים לתשומת לב`, href: "/dashboard/garden/children?view=attention", tone: counts.healthAlerts ? "warn" : "good" },
      { title: "שקט תפעולי", text: `${counts.openIncidents ?? 0} אירועים שדורשים מעקב`, href: "/dashboard/garden/incidents", tone: counts.openIncidents ? "bad" : "good" }
    ],
    pickup: [
      { title: "איסוף והרשאות", text: `${counts.pickupPending ?? 0} ילדים ממתינים לאיסוף`, href: "/dashboard/garden/pickup", tone: counts.pickupPending ? "warn" : "good" },
      { title: "פניות שלא נסגרו", text: `${counts.parentRequests ?? 0} בקשות הורים פתוחות`, href: "/dashboard/garden/children?view=attention", tone: counts.parentRequests ? "warn" : "good" },
      { title: "משימות לפני סיום", text: `${counts.openTasks ?? 0} משימות פתוחות`, href: "/dashboard/garden/tasks", tone: counts.openTasks ? "warn" : "good" }
    ],
    general: [
      { title: "נוכחות", text: `${counts.missingAttendance ?? 0} ילדים ללא סימון`, href: "/dashboard/garden/attendance", tone: counts.missingAttendance ? "warn" : "good" },
      { title: "יומן יומי", text: `${counts.withoutMeal ?? 0} ללא ארוחה · ${counts.withoutSleep ?? 0} ללא שינה`, href: "/dashboard/garden/child-journal", tone: (counts.withoutMeal || counts.withoutSleep) ? "warn" : "good" },
      { title: "טיפול פתוח", text: `${counts.parentRequests ?? 0} פניות · ${counts.openIncidents ?? 0} אירועים`, href: "/dashboard/garden/children?view=attention", tone: (counts.parentRequests || counts.openIncidents) ? "bad" : "good" }
    ]
  };
  const items = byPhase[phase.key] ?? byPhase.general;

  return (
    <section className="live-day-flow">
      <div className="live-day-header">
        <Icon size={24} />
        <div>
          <p className="eyebrow">Live Day Flow · {phase.label}</p>
          <h2>{phase.title}</h2>
          <p>המערכת משנה המלצות לפי שלב היום, כדי שהמנהלת והצוות לא יצטרכו לחפש מה דחוף.</p>
        </div>
      </div>
      <div className="live-day-grid">
        {items.map((item) => (
          <Link className={`live-day-card ${item.tone ?? "good"}`} href={item.href} key={item.title}>
            <strong>{item.title}</strong>
            <span>{item.text}</span>
            <small>טפל עכשיו</small>
          </Link>
        ))}
      </div>
      <div className="live-day-phases">
        <span><CalendarCheck size={14} /> בוקר: הגעה</span>
        <span><Utensils size={14} /> צהריים: אוכל ובריאות</span>
        <span><Moon size={14} /> מנוחה: שינה</span>
        <span><UsersRound size={14} /> איסוף: שחרור</span>
        <span><Shirt size={14} /> בגדים</span>
        <span><AlertTriangle size={14} /> חריגים</span>
        <span><HeartPulse size={14} /> בריאות</span>
      </div>
    </section>
  );
}
