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

function limitedText(value: unknown, maxLength: number) {
  return text(value).slice(0, maxLength);
}

function number(value: unknown) {
  const parsed = Number(text(value));
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(10_000, Math.round(parsed)) : 0;
}

function safeRedirectTarget(value: unknown) {
  const target = text(value);
  return target.startsWith("/digital-observer") && !target.startsWith("//")
    ? target
    : "/digital-observer/request-demo";
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
  const redirectTo = safeRedirectTarget(payload.redirect_to);

  // Low-friction spam guard; production rate limiting remains an edge/provider concern.
  if (text(payload.website)) {
    if (isForm) return redirect(request, redirectTo, { submitted: "1" });
    return NextResponse.json({ status: "accepted" }, { status: 202 });
  }

  if (!isAdminClientConfigured()) {
    if (isForm) return redirect(request, redirectTo, { error: "config" });
    return NextResponse.json({ error: "Service role is not configured." }, { status: 503 });
  }

  const siteType = normalizeSiteType(text(payload.site_type));
  const sourceCandidate = text(payload.source) || sourceFromSiteType(siteType);
  const source = allowedSources.has(sourceCandidate) ? sourceCandidate : sourceFromSiteType(siteType);
  const cameraCount = number(payload.camera_count || payload.number_of_cameras || payload.estimated_cameras);
  const packageInterest = limitedText(payload.package_interest || payload.package, 80);
  const monitoringGoals = (Array.isArray(payload.monitoring_goals)
    ? payload.monitoring_goals.map((item: unknown) => limitedText(item, 120)).filter(Boolean)
    : limitedText(payload.monitoring_goals, 1_000).split(",").map((item) => item.trim()).filter(Boolean)
  ).slice(0, 20);
  const interestScore = Math.min(100, Math.max(10, 35 + (cameraCount > 0 ? 15 : 0) + (packageInterest ? 20 : 0) + (source === "digital_observer_demo" ? 20 : 0)));
  const formRoute = safeRedirectTarget(payload.form_route || request.nextUrl.pathname);
  const userAgent = request.headers.get("user-agent") ?? "";

  const leadRow = {
    lead_type: "digital_observer_lead",
    product_type: "digital_observer",
    source,
    status: "new",
    lead_status: "new",
    conversion_status: "new",
    contact_name: limitedText(payload.contact_name || payload.name, 120),
    contact_email: limitedText(payload.contact_email || payload.email, 254),
    contact_phone: limitedText(payload.contact_phone || payload.phone, 40),
    company_name: limitedText(payload.company_name || payload.business_name, 160),
    business_name: limitedText(payload.business_name || payload.company_name, 160),
    site_type: siteType,
    city: limitedText(payload.city, 120),
    estimated_cameras: cameraCount,
    camera_count: cameraCount,
    package_interest: packageInterest || null,
    preferred_contact_method: ["phone", "email", "whatsapp", "sms", "any"].includes(text(payload.preferred_contact_method))
      ? text(payload.preferred_contact_method)
      : null,
    current_camera_system: limitedText(payload.current_camera_system, 240) || null,
    notes: limitedText(payload.notes, 2_000) || null,
    interest_score: interestScore,
    form_route: formRoute,
    utm_source: limitedText(payload.utm_source, 120) || null,
    utm_medium: limitedText(payload.utm_medium, 120) || null,
    utm_campaign: limitedText(payload.utm_campaign, 160) || null,
    utm_term: limitedText(payload.utm_term, 160) || null,
    utm_content: limitedText(payload.utm_content, 160) || null,
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
