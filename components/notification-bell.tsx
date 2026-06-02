"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BellRing, CheckCheck } from "lucide-react";

type NotificationRow = Record<string, any>;

const centerByRole: Record<string, string> = {
  admin: "/dashboard/admin/notifications",
  manager: "/dashboard/garden/notifications",
  owner: "/dashboard/garden/notifications",
  staff: "/dashboard/staff/notifications",
  inspector: "/dashboard/inspector/notifications",
  parent: "/dashboard/parent/notifications"
};

function actionHref(item: NotificationRow) {
  return item.action_url || item.metadata?.href || "/dashboard";
}

export function NotificationBell({ role }: { role: string }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const centerHref = centerByRole[role] ?? "/dashboard";

  useEffect(() => {
    let cancelled = false;
    fetch("/api/notifications")
      .then((response) => response.json())
      .then((body) => {
        if (cancelled) return;
        setRows(body.data?.rows ?? []);
        setUnread(body.data?.unread ?? 0);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const previewRows = useMemo(() => rows.slice(0, 5), [rows]);

  async function markAllRead() {
    const ids = rows.map((row) => row.id);
    if (!ids.length) return;
    const response = await fetch("/api/notifications/mark-read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
    if (response.ok) {
      setRows((current) => current.map((row) => ({ ...row, status: "read", read_at: new Date().toISOString() })));
      setUnread(0);
    }
  }

  return (
    <div className="notification-bell-wrap">
      <button className="notification-bell" type="button" onClick={() => setOpen((value) => !value)} aria-label="פתיחת התראות">
        <BellRing size={18} />
        {unread ? <span>{unread}</span> : null}
      </button>
      {open ? (
        <div className="notification-popover">
          <div className="notification-popover-head"><strong>מה דורש תשומת לב?</strong><button type="button" onClick={markAllRead}><CheckCheck size={15} /> הכל נקרא</button></div>
          {previewRows.length === 0 ? <div className="empty-mini">אין התראות פתוחות כרגע.</div> : previewRows.map((item) => (
            <Link className="notification-preview-row" href={actionHref(item)} key={item.id}>
              <span className={item.read_at ? "dot good" : "dot warn"} />
              <div><strong>{item.title}</strong><small>{item.message ?? item.body ?? "עדכון חדש במערכת"}</small></div>
            </Link>
          ))}
          <Link className="button primary tiny" href={centerHref}>פתיחת מרכז ההתראות</Link>
        </div>
      ) : null}
    </div>
  );
}
