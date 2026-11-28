"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BellRing, CheckCheck } from "lucide-react";
import { safeGanNotificationDestination } from "@/lib/domain/gan-notification-destination";
import { requestGanMarkAllRead } from "@/lib/domain/gan-notification-read-all";
import { parseGanNotificationFeed } from "@/lib/domain/gan-notification-feed";

type NotificationRow = {
  id: string;
  title?: string | null;
  message?: string | null;
  body?: string | null;
  read_at?: string | null;
  status?: string | null;
  action_url?: string | null;
  metadata?: { href?: string | null } | null;
};

const centerByRole: Record<string, string> = {
  admin: "/dashboard/admin/notifications",
  manager: "/dashboard/garden/notifications",
  owner: "/dashboard/garden/notifications",
  staff: "/dashboard/staff/notifications",
  inspector: "/dashboard/inspector/notifications",
  parent: "/dashboard/parent/notifications"
};

function actionHref(item: NotificationRow) {
  return safeGanNotificationDestination(item.action_url) ??
    safeGanNotificationDestination(item.metadata?.href) ?? "/dashboard";
}

export function NotificationBell({ role }: { role: string }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const centerHref = centerByRole[role] ?? "/dashboard";

  useEffect(() => {
    let cancelled = false;
    fetch("/api/notifications")
      .then(async (response) => ({ response, body: await response.json() }))
      .then(({ response, body }) => {
        if (cancelled) return;
        const feed = parseGanNotificationFeed(response.ok, body);
        if (!feed) { setLoadError(true); return; }
        setLoadError(false);
        setRows(feed.rows as NotificationRow[]);
        setUnread(feed.unread);
      })
      .catch(() => { if (!cancelled) setLoadError(true); });
    return () => {
      cancelled = true;
    };
  }, []);

  const previewRows = useMemo(() => rows.slice(0, 5), [rows]);

  async function markAllRead() {
    if (await requestGanMarkAllRead(fetch)) {
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
          <div className="notification-popover-head"><strong>מה דורש תשומת לב?</strong><button type="button" disabled={loadError} onClick={markAllRead}><CheckCheck size={15} /> הכל נקרא</button></div>
          {loadError ? <div className="empty-mini" role="alert">לא ניתן לטעון התראות כרגע.</div> : previewRows.length === 0 ? <div className="empty-mini">אין התראות פתוחות כרגע.</div> : previewRows.map((item) => (
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
