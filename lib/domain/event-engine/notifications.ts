/* eslint-disable @typescript-eslint/no-explicit-any -- dynamic Supabase notification tables do not have generated database types. */
/** Provider acceptance is recorded separately from in-app availability. */
export async function recordEventNotifications(db: any, siteId: string, signalId: string, severity: string, options: { allowPush?: boolean } = {}) {
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
      provider_mode: "sandbox", delivery_status: "sent", sent_at: new Date().toISOString(),
      dedupe_key: `${signalId}:in_app:${id}`, metadata: { source: "event_journal", external_delivery: false }
    });
    if (result.error && result.error.code !== "23505") throw new Error("NOTIFICATION_WRITE_FAILED");
  }
  // PUSH 39 fail-closed boundary: raw Event persistence may create only the
  // local in-app journal entry. External delivery requires a canonical,
  // authorized action intent and the new delivery orchestrator. Legacy
  // allowPush callers are intentionally ignored so provider configuration or
  // a recipient preference can never activate a real send by itself.
  void options;
  return { push_pending: false };
}
