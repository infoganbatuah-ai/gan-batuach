import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

const allowedSources = new Set([
  "digital_observer_home",
  "digital_observer_business",
  "digital_observer_office",
  "digital_observer_warehouse",
  "digital_observer_store",
  "digital_observer_parking",
  "digital_observer_demo",
  "digital_observer_pricing",
  "digital_observer_start",
  "referral",
  "campaign"
]);

function text(value: unknown) {
  if (Array.isArray(value)) return String(value[0] ?? "").trim();
  return String(value ?? "").trim();
}

function number(value: unknown) {
  const parsed = Number(text(value));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

function normalizeSiteType(value: string) {
  if (value === "parking") return "parking_lot";
  if (value === "parking_lot") return "parking_lot";
  if (["home", "office", "business", "warehouse", "store", "custom"].includes(value)) return value;
  return "custom";
}

function sourceFromSiteType(siteType: string) {
  if (siteType === "parking_lot") return "digital_observer_parking";
  if (["home", "business", "office", "warehouse", "store"].includes(siteType)) return `digital_observer_${siteType}`;
  return "digital_observer_start";
}

function redirect(request: NextRequest, target: string, params: Record<string, string>) {
  const url = new URL(target, request.url);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return NextResponse.redirect(url, 303);
}

async function parsePayload(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return { payload: await request.json(), isForm: false };
  const formData = await request.formData();
  return { payload: Object.fromEntries(formData.entries()), isForm: true };
}

export async function POST(request: NextRequest) {
  const { payload, isForm } = await parsePayload(request);
  const redirectTo = text(payload.redirect_to) || "/digital-observer/request-demo";

  if (!isAdminClientConfigured()) {
    if (isForm) return redirect(request, redirectTo, { error: "config" });
    return NextResponse.json({ error: "Service role is not configured." }, { status: 503 });
  }

  const siteType = normalizeSiteType(text(payload.site_type));
  const sourceCandidate = text(payload.source) || sourceFromSiteType(siteType);
  const source = allowedSources.has(sourceCandidate) ? sourceCandidate : sourceFromSiteType(siteType);
  const cameraCount = number(payload.camera_count || payload.number_of_cameras || payload.estimated_cameras);
  const packageInterest = text(payload.package_interest || payload.package);
  const monitoringGoals = Array.isArray(payload.monitoring_goals) ? payload.monitoring_goals.map(text).filter(Boolean) : text(payload.monitoring_goals).split(",").map((item) => item.trim()).filter(Boolean);
  const interestScore = Math.min(100, Math.max(10, 35 + (cameraCount > 0 ? 15 : 0) + (packageInterest ? 20 : 0) + (source === "digital_observer_demo" ? 20 : 0)));
  const formRoute = text(payload.form_route) || request.nextUrl.pathname;
  const userAgent = request.headers.get("user-agent") ?? "";

  const leadRow = {
    lead_type: "digital_observer_lead",
    product_type: "digital_observer",
    source,
    status: "new",
    lead_status: "new",
    conversion_status: "new",
    contact_name: text(payload.contact_name || payload.name),
    contact_email: text(payload.contact_email || payload.email),
    contact_phone: text(payload.contact_phone || payload.phone),
    company_name: text(payload.company_name || payload.business_name),
    business_name: text(payload.business_name || payload.company_name),
    site_type: siteType,
    city: text(payload.city),
    estimated_cameras: cameraCount,
    camera_count: cameraCount,
    package_interest: packageInterest || null,
    preferred_contact_method: text(payload.preferred_contact_method) || null,
    current_camera_system: text(payload.current_camera_system) || null,
    notes: text(payload.notes) || null,
    interest_score: interestScore,
    form_route: formRoute,
    utm_source: text(payload.utm_source) || null,
    utm_medium: text(payload.utm_medium) || null,
    utm_campaign: text(payload.utm_campaign) || null,
    utm_term: text(payload.utm_term) || null,
    utm_content: text(payload.utm_content) || null,
    metadata: {
      product: "digital_observer",
      monitoring_goals: monitoringGoals,
      user_agent: userAgent.slice(0, 500),
      lead_capture_mode: isForm ? "form_post" : "json_api"
    }
  };

  if (!leadRow.contact_name || !leadRow.contact_phone) {
    if (isForm) return redirect(request, redirectTo, { error: "missing" });
    return NextResponse.json({ error: "contact_name and phone are required." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const lead = await supabase.from("digital_observer_leads" as any).insert(leadRow).select("id").single();
  if (lead.error) {
    if (isForm) return redirect(request, redirectTo, { error: "save" });
    return NextResponse.json({ error: "Could not create Digital Observer lead." }, { status: 500 });
  }

  const eventType = source === "digital_observer_demo" ? "demo_form_submitted" : source === "digital_observer_start" ? "start_monitoring_clicked" : packageInterest ? "package_selected" : "homepage_cta_click";
  await supabase.from("digital_observer_marketing_events" as any).insert({
    event_type: eventType,
    source,
    site_type: siteType,
    package_interest: packageInterest || null,
    lead_id: lead.data?.id ?? null,
    route: formRoute,
    utm: {
      source: text(payload.utm_source) || null,
      medium: text(payload.utm_medium) || null,
      campaign: text(payload.utm_campaign) || null,
      term: text(payload.utm_term) || null,
      content: text(payload.utm_content) || null
    },
    metadata: { camera_count: cameraCount, preferred_contact_method: leadRow.preferred_contact_method }
  });

  if (isForm) return redirect(request, redirectTo, { submitted: "1" });
  return NextResponse.json({ id: lead.data?.id, status: "created" }, { status: 201 });
}
