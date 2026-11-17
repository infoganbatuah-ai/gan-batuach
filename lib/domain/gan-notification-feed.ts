type NotificationFeed = { rows: unknown[]; unread: number };

export function parseGanNotificationFeed(ok: boolean, body: unknown): NotificationFeed | null {
  if (!ok || !body || typeof body !== "object" || !("data" in body)) return null;
  const data = body.data;
  if (!data || typeof data !== "object" || !("rows" in data) || !("unread" in data) ||
      ("warning" in data && data.warning) || !Array.isArray(data.rows) ||
      !Number.isSafeInteger(data.unread) || (data.unread as number) < 0) return null;
  return { rows: data.rows, unread: data.unread as number };
}
