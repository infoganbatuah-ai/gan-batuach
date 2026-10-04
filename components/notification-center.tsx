"use client";

import Link from "next/link";
import { BellRing, CalendarClock, Check, CheckCircle2, ChevronLeft, ClipboardCheck, CreditCard, ExternalLink, FileCheck2, MessageCircle, Search, ShieldCheck, UserCheck } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

type NotificationRow = {
  id: string; title?: string | null; message?: string | null; body?: string | null; created_at?: string | null;
  scheduled_for?: string | null; read_at?: string | null; status?: string | null; severity?: string | null;
  action_url?: string | null; entity_type?: string | null; notification_type?: string | null;
  preference_category?: string | null; source_domain?: string | null; metadata?: { href?: string } | null;
};

const categoryMeta = {
  attendance: { label: "נוכחות", icon: UserCheck, tone: "green" },
  pickup: { label: "איסוף", icon: UserCheck, tone: "orange" },
  message: { label: "הודעות", icon: MessageCircle, tone: "blue" },
  document: { label: "מסמכים", icon: FileCheck2, tone: "purple" },
  payment: { label: "תשלומים", icon: CreditCard, tone: "orange" },
  task: { label: "משימות", icon: ClipboardCheck, tone: "blue" },
  inspection: { label: "פיקוח", icon: ShieldCheck, tone: "purple" },
  safety: { label: "בטיחות", icon: ShieldCheck, tone: "red" },
  enrollment: { label: "רישום", icon: UserCheck, tone: "green" },
  shift: { label: "משמרות", icon: CalendarClock, tone: "blue" },
  general: { label: "כללי", icon: BellRing, tone: "blue" }
} as const;

type CategoryKey = keyof typeof categoryMeta;

function categoryFor(item: NotificationRow): CategoryKey {
  const source = `${item.preference_category ?? ""} ${item.notification_type ?? ""} ${item.entity_type ?? ""} ${item.source_domain ?? ""} ${item.title ?? ""}`.toLowerCase();
  for (const key of Object.keys(categoryMeta) as CategoryKey[]) {
    if (source.includes(key)) return key;
  }
  if (/מסמ|document/.test(source)) return "document";
  if (/תשלום|tuition|payment|billing/.test(source)) return "payment";
  if (/הודע|message|communication/.test(source)) return "message";
  if (/נוכחות|attendance/.test(source)) return "attendance";
  if (/איסוף|pickup|release/.test(source)) return "pickup";
  if (/בטיחות|camera|safety/.test(source)) return "safety";
  if (/פיקוח|inspection|finding|corrective/.test(source)) return "inspection";
  return "general";
}

function safeHref(item: NotificationRow) {
  const target = item.action_url || item.metadata?.href;
  if (typeof target === "string" && target.startsWith("/dashboard/") && !target.startsWith("//")) return target;
  return item.entity_type === "inspection" ? "/dashboard/inspector/inspections"
    : item.entity_type === "task" ? "/dashboard/staff/tasks"
      : item.entity_type === "communication_thread" ? "/dashboard/parent/messages"
        : "/dashboard";
}

function timestamp(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function NotificationCenter({ notifications }: { notifications: unknown[] }) {
  const [rows, setRows] = useState<NotificationRow[]>(notifications as NotificationRow[]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | CategoryKey>("all");
  const [selected, setSelected] = useState<NotificationRow | null>(null);
  const [isPending, startTransition] = useTransition();

  function markAllRead() {
    startTransition(async () => {
      const response = await fetch("/api/notifications/mark-read", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (response.ok) setRows((current) => current.map((row) => ({ ...row, status: "read", read_at: new Date().toISOString() })));
    });
  }

  async function markRead(id: string) {
    const response = await fetch("/api/notifications/mark-read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [id] }) });
    if (response.ok) {
      const readAt = new Date().toISOString();
      setRows((current) => current.map((row) => row.id === id ? { ...row, status: "read", read_at: readAt } : row));
      setSelected((current) => current?.id === id ? { ...current, status: "read", read_at: readAt } : current);
    }
  }

  const unread = rows.filter((row) => !row.read_at && row.status !== "read").length;
  const categories = useMemo(() => {
    const counts = new Map<CategoryKey, number>();
    for (const row of rows) counts.set(categoryFor(row), (counts.get(categoryFor(row)) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);
  const visible = useMemo(() => rows.filter((row) => {
    const matchesQuery = `${row.title ?? ""} ${row.body ?? row.message ?? ""}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesFilter = filter === "all" || (filter === "unread" ? !row.read_at && row.status !== "read" : categoryFor(row) === filter);
    return matchesQuery && matchesFilter;
  }), [rows, query, filter]);

  return (
    <section className="notification-platform" dir="rtl">
      <div className="notification-platform-head">
        <div><span className="eyebrow">מרכז פעולה</span><h2><BellRing size={24} /> התראות</h2><p>עדכונים בטוחים עם קישור ברור למסך המקור.</p></div>
        <div className="notification-head-actions"><span className={unread ? "notification-unread-badge" : "notification-read-badge"}>{unread} לא נקראו</span><button type="button" disabled={isPending || rows.length === 0} onClick={markAllRead}><CheckCheckIcon /> סימון הכל כנקרא</button></div>
      </div>
      <div className="notification-toolbar">
        <label><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חיפוש בהתראות..." aria-label="חיפוש בהתראות" /></label>
        <div className="notification-filter-chips" role="tablist" aria-label="סינון התראות">
          <button className={filter === "all" ? "active" : ""} type="button" onClick={() => setFilter("all")}>הכל</button>
          <button className={filter === "unread" ? "active" : ""} type="button" onClick={() => setFilter("unread")}>לא נקראו</button>
          {categories.slice(0, 4).map(([key, count]) => <button className={filter === key ? "active" : ""} type="button" onClick={() => setFilter(key)} key={key}>{categoryMeta[key].label} <b>{count}</b></button>)}
        </div>
      </div>
      <div className="notification-layout">
        <div className="notification-list" aria-label="רשימת התראות">
          {visible.length ? visible.map((item) => {
            const category = categoryFor(item);
            const meta = categoryMeta[category];
            const Icon = meta.icon;
            const isUnread = !item.read_at && item.status !== "read";
            return <article className={`notification-row tone-${meta.tone} ${isUnread ? "unread" : ""}`} key={item.id}>
              <button className="notification-row-main" type="button" onClick={() => setSelected(item)}>
                <span className="notification-row-icon"><Icon size={21} /></span>
                <span className="notification-row-copy"><span><strong>{item.title || "עדכון חדש"}</strong>{isUnread ? <i>חדש</i> : null}</span><p>{item.body ?? item.message ?? "יש עדכון חדש במערכת."}</p><small>{meta.label} · {timestamp(item.created_at ?? item.scheduled_for)}</small></span>
                <ChevronLeft size={20} />
              </button>
              {!item.read_at ? <button className="notification-quick-read" type="button" onClick={() => markRead(item.id)} aria-label={`סימון ${item.title ?? "התראה"} כנקראה`}><Check size={16} /></button> : null}
            </article>;
          }) : <div className="notification-empty"><CheckCircle2 size={44} /><strong>{filter === "unread" ? "הכול נקרא" : "אין התראות במסנן הזה"}</strong><span>עדכון חדש יופיע כאן עם הקשר ופעולת המשך.</span></div>}
        </div>
        <aside className={`notification-detail ${selected ? "open" : ""}`} aria-label="פרטי התראה">
          {selected ? (() => {
            const category = categoryFor(selected); const meta = categoryMeta[category]; const Icon = meta.icon;
            return <><button className="notification-detail-back" type="button" onClick={() => setSelected(null)}>חזרה לרשימה</button><span className={`notification-detail-icon tone-${meta.tone}`}><Icon size={28} /></span><span className="eyebrow">{meta.label}</span><h3>{selected.title || "עדכון חדש"}</h3><p>{selected.body ?? selected.message ?? "יש עדכון חדש במערכת."}</p><dl><div><dt>זמן</dt><dd>{timestamp(selected.created_at ?? selected.scheduled_for)}</dd></div><div><dt>סטטוס</dt><dd>{selected.read_at ? "נקרא" : "ממתין לקריאה"}</dd></div></dl><div className="notification-detail-actions"><Link className="button primary" href={safeHref(selected)} onClick={() => { if (!selected.read_at) void markRead(selected.id); }}><ExternalLink size={17} /> מעבר למסך המקור</Link>{!selected.read_at ? <button className="button secondary" type="button" onClick={() => markRead(selected.id)}><CheckCircle2 size={17} /> סימון כנקרא</button> : null}</div></>;
          })() : <div className="notification-detail-placeholder"><BellRing size={38} /><strong>בחרו התראה</strong><span>פרטים ופעולת ההמשך יוצגו כאן.</span></div>}
        </aside>
      </div>
    </section>
  );
}

function CheckCheckIcon() {
  return <CheckCircle2 size={16} aria-hidden="true" />;
}
