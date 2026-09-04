import { createClient } from "@supabase/supabase-js";

const siteId = process.argv[2];
if (!/^[a-f0-9-]{36}$/.test(siteId || "")) throw new Error("A scoped observer site is required");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const [site, cameras, signals] = await Promise.all([
  db.from("observer_sites").select("id,site_type,monitoring_enabled,metadata").eq("id", siteId).single(),
  db.from("digital_observer_camera_sources").select("id,display_name,location_label,status,metadata").eq("observer_site_id", siteId),
  db.from("observer_intelligence_signals").select("id,created_at,metadata").eq("observer_site_id", siteId).order("created_at", {ascending:false}).limit(10)
]);
console.log(JSON.stringify({ site_ok: !site.error, camera_ok: !cameras.error, signals_ok: !signals.error,
  monitoring: site.data?.monitoring_enabled, consent: site.data?.metadata?.observer_monitoring_consent,
  cameras: cameras.data?.map(c => ({id:c.id,name:c.display_name,location:c.location_label,status:c.status,zone:c.metadata?.zone_type,has_line:Boolean(c.metadata?.crossing_line),has_gateway:Boolean(c.metadata?.gateway_id)})),
  latest_events: signals.data?.map(s=>({at:s.created_at,type:s.metadata?.event_type,camera:s.metadata?.camera_source_id})),
  errors:[site.error?.code,cameras.error?.code,signals.error?.code].filter(Boolean)
},null,2));
if (site.error || cameras.error || signals.error) process.exitCode = 1;
