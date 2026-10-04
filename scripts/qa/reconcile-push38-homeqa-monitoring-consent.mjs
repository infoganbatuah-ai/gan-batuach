// Mirror the owner's existing Product monitoring consent into the isolated
// PUSH38 qualification database. Product is read-only; only HOME_QA changes.
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const SITE_ID = "cc1673b8-3eb0-4785-a12c-1fb88f425a41";
const apply = process.argv.includes("--apply");
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
  throw new Error("P38_PRODUCT_CONSENT_READ_CONFIGURATION_REQUIRED");

const product = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const source = await product.from("observer_sites")
  .select("id,site_type,active,monitoring_enabled,metadata,updated_at")
  .eq("id", SITE_ID).maybeSingle();
if (source.error || !source.data || source.data.id !== SITE_ID ||
  source.data.site_type !== "home" || source.data.active !== true ||
  source.data.monitoring_enabled !== true ||
  source.data.metadata?.observer_monitoring_consent !== true ||
  !Number.isFinite(Date.parse(source.data.metadata?.observer_monitoring_consent_at || "")) ||
  !Number.isFinite(Date.parse(source.data.updated_at || "")))
  throw new Error("P38_PRODUCT_MONITORING_CONSENT_NOT_AUTHORITATIVE");

const docker = (args, input) => execFileSync("docker", ["--context", "colima-push38t", ...args], {
  encoding: "utf8", timeout: 45_000, input,
  stdio: [input ? "pipe" : "ignore", "pipe", "pipe"]
});
const container = "supabase_db_gan-batuach-push38t";
const labels = JSON.parse(docker(["inspect", "--format", "{{json .Config.Labels}}", container]));
if (labels["com.supabase.cli.project"] !== "gan-batuach-push38t" ||
  docker(["network", "inspect", "push38t-loopback", "--format",
    "{{index .Options \"com.docker.network.bridge.host_binding_ipv4\"}}" ]).trim() !== "127.0.0.1")
  throw new Error("P38_HOME_QA_DATABASE_NOT_ISOLATED");

const provenance = {
  consentAt: source.data.metadata.observer_monitoring_consent_at,
  sourceUpdatedAt: source.data.updated_at,
  reconciledAt: new Date().toISOString()
};
const payload = Buffer.from(JSON.stringify(provenance), "utf8").toString("hex");
const sql = `begin;
create temp table p38_consent on commit drop as
  select * from jsonb_to_record(convert_from(decode('${payload}','hex'),'UTF8')::jsonb)
  as x("consentAt" text,"sourceUpdatedAt" text,"reconciledAt" text);
do $$ begin
  if (select count(*) from public.observer_sites) <> 1 or not exists(
    select 1 from public.observer_sites where id='${SITE_ID}' and site_type='home' and active is true
  ) then raise exception 'P38_HOME_QA_SITE_SCOPE_CONFLICT'; end if;
end $$;
${apply ? `update public.observer_sites set monitoring_enabled=true,
  metadata=metadata||jsonb_build_object(
    'observer_monitoring_consent',true,
    'observer_monitoring_consent_at',(select "consentAt" from p38_consent),
    'home_qa_consent_source','PRODUCT_OWNER_CONSENT_READ_ONLY',
    'home_qa_consent_source_updated_at',(select "sourceUpdatedAt" from p38_consent),
    'home_qa_consent_reconciled_at',(select "reconciledAt" from p38_consent))
  where id='${SITE_ID}';` : ""}
do $$ begin
  if ${apply ? "not" : "false and not"} exists(
    select 1 from public.observer_sites cross join p38_consent
    where id='${SITE_ID}' and monitoring_enabled is true
      and metadata->>'observer_monitoring_consent'='true'
      and metadata->>'observer_monitoring_consent_at'="consentAt"
      and metadata->>'home_qa_consent_source'='PRODUCT_OWNER_CONSENT_READ_ONLY'
  ) then raise exception 'P38_HOME_QA_CONSENT_VERIFY_FAILED'; end if;
end $$;
${apply ? "commit;" : "rollback;"}`;
docker(["exec", "-i", container, "psql", "-X", "-q", "-v", "ON_ERROR_STOP=1",
  "-U", "postgres", "-d", "postgres"], sql);

console.log(JSON.stringify({
  status: apply ? "HOME_QA_MONITORING_CONSENT_RECONCILED" : "HOME_QA_MONITORING_CONSENT_PLAN_PASS",
  site_id: SITE_ID,
  product_consent_at: provenance.consentAt,
  product_writes: 0,
  home_qa_writes: apply ? 1 : 0
}));
