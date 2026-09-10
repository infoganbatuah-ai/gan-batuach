import { buildCostReport, type CostUsage } from "../../../services/video-gateway/cost-intelligence.mjs";
import { createDigitalObserverAdminDataClient } from "./admin-access";

type Row = Record<string, unknown>;
export type CostFilters = { tenantId?: string | null; siteId?: string | null; sourceId?: string | null; resourceType?: string | null; from?: string | null; to?: string | null; limit?: number };

function asUsage(row: Row): CostUsage {
  return {
    contract: String(row.contract_version),
    schema_version: 1,
    usage_id: String(row.id),
    idempotency_key: String(row.idempotency_key),
    resource_type: String(row.resource_type),
    provider_id: String(row.provider_id),
    tenant_id: String(row.observer_tenant_id),
    site_id: String(row.observer_site_id),
    source_id: row.camera_source_id == null ? null : String(row.camera_source_id),
    ai_job_id: row.ai_job_id == null ? null : String(row.ai_job_id),
    model: row.model == null ? null : String(row.model),
    model_version: row.model_version == null ? null : String(row.model_version),
    execution_target_id: row.execution_target_id == null ? null : String(row.execution_target_id),
    execution_target_class: row.execution_target_class == null ? null : String(row.execution_target_class),
    quantity: Number(row.quantity),
    unit: String(row.unit),
    window_start: String(row.window_start),
    window_end: String(row.window_end),
    currency: String(row.currency),
    calculated_cost: row.calculated_cost == null ? null : Number(row.calculated_cost),
    attribution_quality: String(row.attribution_quality) as CostUsage["attribution_quality"],
    provenance: row.provenance && typeof row.provenance === "object" ? row.provenance : {}
  } as CostUsage;
}

export async function loadCostIntelligence(filters: CostFilters = {}) {
  const supabase = createDigitalObserverAdminDataClient();
  let query = supabase.from("digital_observer_cost_usage_events" as never)
    .select("id,contract_version,idempotency_key,resource_type,provider_id,observer_tenant_id,observer_site_id,camera_source_id,ai_job_id,model,model_version,execution_target_id,execution_target_class,quantity,unit,window_start,window_end,currency,calculated_cost,attribution_quality,provenance")
    .order("window_start", { ascending: false }).limit(Math.min(5_000, Math.max(1, filters.limit ?? 1_000)));
  if (filters.tenantId) query = query.eq("observer_tenant_id", filters.tenantId);
  if (filters.siteId) query = query.eq("observer_site_id", filters.siteId);
  if (filters.sourceId) query = query.eq("camera_source_id", filters.sourceId);
  if (filters.resourceType) query = query.eq("resource_type", filters.resourceType);
  if (filters.from) query = query.gte("window_start", filters.from);
  if (filters.to) query = query.lte("window_end", filters.to);

  const [usageResult, ratesResult, reconciliationsResult, sitesResult] = await Promise.all([
    query,
    supabase.from("digital_observer_cost_rate_catalogs" as never).select("id,catalog_key,version,provider_id,resource_type,unit,currency,unit_cost,attribution_quality,source,effective_at,expires_at").order("effective_at", { ascending: false }).limit(500),
    supabase.from("digital_observer_cost_reconciliations" as never).select("id,provider_id,period_start,period_end,currency,calculated_cost,actual_provider_cost,variance,approved_tolerance,status,reconciled_at").order("reconciled_at", { ascending: false }).limit(100),
    supabase.from("observer_sites" as never).select("id,name").limit(1_000)
  ]);
  const available = !usageResult.error;
  const events = ((usageResult.data ?? []) as Row[]).map(asUsage);
  return {
    available,
    unavailableReason: usageResult.error ? "COST_TELEMETRY_NOT_AVAILABLE" : null,
    events,
    report: buildCostReport(events),
    rates: (ratesResult.data ?? []) as Row[],
    reconciliations: (reconciliationsResult.data ?? []) as Row[],
    sites: (sitesResult.data ?? []) as Row[],
    providerReconciliation: reconciliationsResult.data?.length ? "AVAILABLE" : "NOT AVAILABLE",
    billingChanged: false,
    customerPricingIncluded: false
  };
}

export function formatCostCsv(events: CostUsage[]) {
  const columns = ["window_start", "resource_type", "provider_id", "tenant_id", "site_id", "source_id", "ai_job_id", "execution_target_class", "quantity", "unit", "currency", "calculated_cost", "attribution_quality"];
  const csv = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [columns.join(","), ...events.map(event => columns.map(column => csv((event as Record<string, unknown>)[column])).join(","))].join("\n");
}
