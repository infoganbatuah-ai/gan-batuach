/** Provider acceptance is recorded separately from in-app availability. */
export async function recordEventNotifications(db: any, siteId: string, signalId: string, severity: string) {
  if (["info", "low"].includes(severity)) return { push_pending: false };
  const [site, recipients, settings] = await Promise.all([
    db.from("observer_sites").select("owner_profile_id").eq("id", siteId).single(),
    db.from("digital_observer_authorized_recipients").select("recipient_profile_id,channels,receives_critical_alerts").eq("observer_site_id", siteId).eq("active", true),
    db.from("observer_alert_channel_settings").select("member_profile_id,channel,enabled,severity_levels").eq("observer_site_id", siteId)
  ]);
  if (site.error || recipients.error || settings.error) throw new Error("NOTIFICATION_RECIPIENTS_UNAVAILABLE");
  const recipientsFor = (channel: string) => new Set<string>([site.data.owner_profile_id, ...(recipients.data ?? [])
    .filter((r: any) => r.channels?.includes(channel) && (severity !== "critical" || r.receives_critical_alerts))
    .map((r: any) => r.recipient_profile_id)].filter(Boolean));
  const enabled = (id: string, channel: string) => {
    const rows = (settings.data ?? []).filter((s: any) => s.channel === channel);
    const individual = rows.filter((s: any) => s.member_profile_id === id);
    const configured = individual.length ? individual : rows.filter((s: any) => !s.member_profile_id);
    if (!configured.length) return channel === "in_app" || (recipients.data ?? []).some((r: any) => r.recipient_profile_id === id && r.channels?.includes(channel));
    return configured.some((s: any) => s.enabled && (!s.severity_levels?.length || s.severity_levels.includes(severity)));
  };
  for (const id of recipientsFor("in_app")) {
    if (!enabled(id, "in_app")) continue;
    const result = await db.from("digital_observer_notification_deliveries").insert({
      observer_site_id: siteId, signal_id: signalId, recipient_profile_id: id, channel: "in_app", severity,
      provider_mode: "live", delivery_status: "sent", sent_at: new Date().toISOString(),
      dedupe_key: `${signalId}:in_app:${id}`, metadata: { source: "event_journal", external_delivery: false }
    });
    if (result.error && result.error.code !== "23505") throw new Error("NOTIFICATION_WRITE_FAILED");
  }
  let pending = false;
  for (const id of recipientsFor("push")) {
    if (!enabled(id, "push")) continue;
    pending = await deliverPush(db, siteId, signalId, id, severity) || pending;
  }
  return { push_pending: pending };
}

async function deliverPush(db: any, siteId: string, signalId: string, profileId: string, severity: string): Promise<boolean> {
  const key = `${signalId}:push:${profileId}`;
  let row = await db.from("digital_observer_notification_deliveries").insert({
    observer_site_id: siteId, signal_id: signalId, recipient_profile_id: profileId, channel: "push", severity,
    provider_mode: "live", delivery_status: "queued", dedupe_key: key, attempt_count: 0, max_attempts: 3,
    metadata: { source: "event_journal", external_delivery: true }
  }).select("*").single();
  if (row.error?.code === "23505") row = await db.from("digital_observer_notification_deliveries").select("*").eq("observer_site_id", siteId).eq("dedupe_key", key).single();
  if (row.error || !row.data) throw new Error("PUSH_QUEUE_UNAVAILABLE");
  if (["sent", "delivered", "acknowledged", "cancelled", "mocked"].includes(row.data.delivery_status) || row.data.attempt_count >= row.data.max_attempts) return false;
  if (row.data.next_retry_at && Date.parse(row.data.next_retry_at) > Date.now()) return true;
  const attempts = Number(row.data.attempt_count) + 1;
  const lease = new Date(Date.now() + 60_000).toISOString();
  const claim = await db.from("digital_observer_notification_deliveries").update({ attempt_count: attempts, delivery_status: "queued", next_retry_at: lease })
    .eq("id", row.data.id).eq("attempt_count", row.data.attempt_count).select("id").maybeSingle();
  if (claim.error) throw new Error("PUSH_CLAIM_FAILED");
  if (!claim.data) return true;
  let status = "failed", reason: string | null = "push_not_accepted";
  try {
    const { preparePushForNotification } = await import("@/lib/domain/push-service");
    const result = await preparePushForNotification(db, {
      profileId, category: "observer_alert", critical: severity === "critical",
      title: "אירוע חדש בתצפיתן הדיגיטלי", body: "התקבל אירוע הדורש בדיקה. הפרטים זמינים ביומן המאובטח.",
      actionUrl: `/digital-observer/alerts?site=${siteId}&event=${signalId}`, deepLinkType: "observer_event",
      metadata: { observer_site_id: siteId, signal_id: signalId, source: "event_journal" }
    });
    if (result.logs.some((log: any) => ["sent", "delivered", "opened"].includes(log.status))) { status = "sent"; reason = null; }
    else if (result.logs.some((log: any) => ["sent_mock", "queued_mock"].includes(log.status))) { status = "mocked"; reason = "push_provider_not_live"; }
  } catch { reason = "push_provider_failed"; }
  const retry = status === "failed" && attempts < row.data.max_attempts;
  const write = await db.from("digital_observer_notification_deliveries").update({
    delivery_status: status, provider_mode: status === "mocked" ? "mock" : "live", failure_reason: reason,
    sent_at: status === "sent" ? new Date().toISOString() : null, next_retry_at: retry ? lease : null
  }).eq("id", row.data.id).eq("attempt_count", attempts);
  if (write.error) throw new Error("PUSH_RESULT_WRITE_FAILED");
  return retry;
}
