import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function envFile(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(readFileSync(path, "utf8").split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => {
    const index = line.indexOf("=");
    return [line.slice(0, index), line.slice(index + 1).trim().replace(/^["']|["']$/g, "")];
  }));
}

const env = { ...envFile(".env.local"), ...process.env };
const targetName = String(process.argv.find((item) => item.startsWith("--name=")) || "").slice(7).trim();
const execute = process.argv.includes("--execute");
if (!targetName) throw new Error("A demo camera name is required");
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Server-only Supabase configuration is unavailable");

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const fail = (scope, error) => {
  if (error) throw new Error(`Synthetic demo cleanup failed at ${scope} (${String(error.code || "unknown")})`);
};

const sourceResult = await supabase.from("digital_observer_camera_sources")
  .select("id,observer_site_id,camera_stream_id,connector_type,connector_provider,source_mode,secret_reference,capabilities,metadata")
  .eq("display_name", targetName)
  .eq("connector_type", "demo")
  .eq("source_mode", "demo");
fail("source lookup", sourceResult.error);
if ((sourceResult.data || []).length !== 1) throw new Error("Cleanup requires exactly one matching synthetic demo source");
const source = sourceResult.data[0];
const hasGatewayBinding = Boolean(source.camera_stream_id || source.secret_reference || source.metadata?.gateway_stream_id || source.metadata?.video_gateway_stream_id);
if (source.capabilities?.live_view === true || hasGatewayBinding) throw new Error("The matching source is not an isolated synthetic demo");

const clipResult = await supabase.from("digital_observer_event_clips")
  .select("id,signal_id,storage_path,snapshot_storage_path")
  .eq("camera_source_id", source.id);
fail("clip preflight", clipResult.error);
if ((clipResult.data || []).some((clip) => clip.storage_path || clip.snapshot_storage_path)) throw new Error("Synthetic demo cleanup refused because stored media exists");

let signalQuery = supabase.from("observer_intelligence_signals")
  .select("id")
  .eq("observer_site_id", source.observer_site_id)
  .contains("metadata", { camera_source_id: source.id });
const signalResult = await signalQuery;
fail("signal preflight", signalResult.error);
const signalIds = (signalResult.data || []).map((item) => item.id);

const summary = {
  matched_sources: 1,
  signals: signalIds.length,
  clips: (clipResult.data || []).length,
  executed: execute
};
if (!execute) {
  console.log(JSON.stringify(summary));
  process.exit(0);
}

if (signalIds.length) {
  fail("notification deletion", (await supabase.from("digital_observer_notification_deliveries").delete().in("signal_id", signalIds)).error);
  fail("signal clip deletion", (await supabase.from("digital_observer_event_clips").delete().in("signal_id", signalIds)).error);
}
fail("camera clip deletion", (await supabase.from("digital_observer_event_clips").delete().eq("camera_source_id", source.id)).error);
fail("identity candidate deletion", (await supabase.from("digital_observer_identity_candidates").delete().eq("camera_source_id", source.id)).error);
fail("watch request deletion", (await supabase.from("observer_watch_requests").delete().eq("camera_source_id", source.id)).error);
if (signalIds.length) fail("signal deletion", (await supabase.from("observer_intelligence_signals").delete().in("id", signalIds)).error);
fail("camera source deletion", (await supabase.from("digital_observer_camera_sources").delete().eq("id", source.id).eq("connector_type", "demo").eq("source_mode", "demo")).error);

const verify = await supabase.from("digital_observer_camera_sources").select("id", { count: "exact", head: true }).eq("id", source.id);
fail("verification", verify.error);
if (verify.count !== 0) throw new Error("Synthetic demo source still exists after cleanup");
console.log(JSON.stringify({ ...summary, removed: true }));
