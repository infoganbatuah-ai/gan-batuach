import Link from "next/link";
import { Activity, BellRing, Camera, CreditCard, Database, FileText, HeartPulse, ServerCog, ShieldCheck } from "lucide-react";
import { AdminAppFrame } from "@/components/admin-app-ui";
import { AdminDataError } from "@/components/admin-data-state";
import { DashboardGrid, MetricCard, PremiumCard, SectionHeader, StatusChip } from "@/components/gan-batuach-design-system";
import { AdminSectionIntro, AdminTruthState } from "@/components/platform-admin-ui";
import { adminBoundedRows, safeAdminData, logSupabaseError, type AdminReadState } from "@/lib/admin-safe";
import { requireRole } from "@/lib/auth";
import { getFinancialProviderCapabilities } from "@/lib/domain/financial-provider-capability";
import { createClient } from "@/lib/supabase/server";

type State = "operational" | "degraded" | "setup_required" | "unavailable" | "unknown";
type GardenHealth = { status?: string | null; manager_id?: string | null; inspector_id?: string | null; inspection_required_status?: string | null };
type DeliveryHealth = { status?: string | null; channel?: string | null };
type CameraHealth = { status?: string | null; health_status?: string | null };
type DocumentHealth = { status?: string | null };
type ProviderHealth = { integration_type?: string | null; provider?: string | null; provider_status?: string | null; last_successful_request_at?: string | null; credentials_missing?: boolean | null; production_mode_enabled?: boolean | null };
type IntegrationHealth = { integration_type?: string | null; provider?: string | null; status?: string | null; environment?: string | null; send_mode?: string | null };
const stateLabel: Record<State, string> = { operational: "תפעולי", degraded: "מוגבל", setup_required: "נדרשת הגדרה", unavailable: "לא זמין", unknown: "לא נמדד" };
const stateTone = (state: State): "good" | "warning" | "danger" => state === "operational" ? "good" : state === "unavailable" ? "danger" : "warning";

export default async function AdminSystemHealthPage() {
  const { profile } = await requireRole(["admin"]);
  const financial = getFinancialProviderCapabilities();
  const result = await safeAdminData("platform service status", async () => {
    const supabase = await createClient();
    const [gardens, delivery, cameras, documents, providerHealth, integrations] = await Promise.all([
      supabase.from("gardens" as never).select("id,status,manager_id,inspector_id,inspection_required_status" as never, { count: "exact" }).limit(500),
      supabase.from("provider_delivery_logs" as never).select("id,status,channel" as never, { count: "exact" }).order("created_at" as never, { ascending: false }).limit(500),
      supabase.from("camera_streams" as never).select("id,status,health_status" as never, { count: "exact" }).limit(500),
      supabase.from("documents" as never).select("id,status" as never, { count: "exact" }).limit(500),
      supabase.from("provider_production_health_metrics" as never).select("integration_type,provider,provider_status,last_successful_request_at,credentials_missing,production_mode_enabled" as never, { count: "exact" }).limit(120),
      supabase.from("production_integrations" as never).select("integration_type,provider,status,environment,send_mode" as never, { count: "exact" }).eq("environment" as never, "production" as never).limit(120)
    ]);
    [gardens, delivery, cameras, documents, providerHealth, integrations].forEach((item, index) => logSupabaseError(`platform service status ${index}`, item.error));
    const reads = { gardens: adminBoundedRows(gardens), delivery: adminBoundedRows(delivery), cameras: adminBoundedRows(cameras), documents: adminBoundedRows(documents), providerHealth: adminBoundedRows(providerHealth), integrations: adminBoundedRows(integrations) };
    const sourceState = Object.fromEntries(Object.entries(reads).map(([key, value]) => [key, value.state])) as Record<keyof typeof reads, AdminReadState>;
    const sourceNames: Record<keyof typeof reads, string> = { gardens: "גנים", delivery: "מסירה", cameras: "מצלמות", documents: "מסמכים", providerHealth: "מדדי ספקים", integrations: "הגדרות ספקים" };
    const unavailable = (Object.entries(sourceState) as [keyof typeof reads, AdminReadState][]).filter(([, state]) => state !== "complete").map(([key, state]) => `${sourceNames[key]} ${state === "partial" ? "מוצגים חלקית" : "לא נטענו"}`);
    return { gardens: reads.gardens.rows as GardenHealth[], delivery: reads.delivery.rows as DeliveryHealth[], cameras: reads.cameras.rows as CameraHealth[], documents: reads.documents.rows as DocumentHealth[], providerHealth: reads.providerHealth.rows as ProviderHealth[], integrations: reads.integrations.rows as IntegrationHealth[], sourceState, queryError: unavailable.length ? unavailable.join(" · ") : null };
  }, { gardens: [] as GardenHealth[], delivery: [] as DeliveryHealth[], cameras: [] as CameraHealth[], documents: [] as DocumentHealth[], providerHealth: [] as ProviderHealth[], integrations: [] as IntegrationHealth[], sourceState: { gardens: "unavailable", delivery: "unavailable", cameras: "unavailable", documents: "unavailable", providerHealth: "unavailable", integrations: "unavailable" } as Record<"gardens" | "delivery" | "cameras" | "documents" | "providerHealth" | "integrations", AdminReadState>, queryError: null as string | null });

  const ready = (source: keyof typeof result.data.sourceState) => !result.error && result.data.sourceState[source] === "complete";
  const providerState = (type: string): State => {
    if (!ready("providerHealth") || !ready("integrations")) return "unknown";
    const integrations = result.data.integrations.filter((item) => item.integration_type === type);
    if (!integrations.length) return "setup_required";
    const matched = integrations.map((integration) => ({ integration, health: result.data.providerHealth.find((item) => item.integration_type === type && item.provider === integration.provider) }));
    if (matched.some(({ integration, health }) => ["active", "production_active"].includes(String(integration.status)) && integration.environment === "production" && ["production", "live"].includes(String(integration.send_mode)) && health?.provider_status === "production_active" && health.production_mode_enabled === true && health.credentials_missing === false && Boolean(health.last_successful_request_at))) return "operational";
    if (matched.some(({ integration, health }) => ["failed", "disabled"].includes(String(health?.provider_status ?? integration.status)))) return "unavailable";
    if (matched.some(({ health }) => health?.provider_status === "degraded")) return "degraded";
    return "setup_required";
  };
  const deliveryFailures = ready("delivery") ? result.data.delivery.filter((item) => item.status === "failed").length : null;
  const cameraIssues = ready("cameras") ? result.data.cameras.filter((item) => ["offline", "failed", "error", "degraded", "unhealthy"].includes(String(item.status)) || ["degraded", "unhealthy", "offline"].includes(String(item.health_status))).length : null;
  const gardenIssues = ready("gardens") ? result.data.gardens.filter((item) => !item.manager_id || !item.inspector_id || item.inspection_required_status === "pending_first_inspection").length : null;
  const documentIssues = ready("documents") ? result.data.documents.filter((item) => ["rejected", "expired", "missing"].includes(String(item.status))).length : null;
  const paymentState: State = financial.payment.checkoutAvailable && financial.payment.providerAdapterVerified && financial.payment.webhookVerified ? "operational" : financial.payment.checkoutAvailable ? "degraded" : "setup_required";
  const services: Array<{ name: string; description: string; state: State; icon: typeof Activity; href: string }> = [
    { name: "יישום", description: "מסך האדמין עבר אימות הרשאה בצד השרת ונענה לבקשה הנוכחית.", state: "operational", icon: ServerCog, href: "/dashboard/admin" },
    { name: "קריאות נתוני מערכת", description: result.error || result.data.queryError ? "חלק מקריאות המסך נכשלו או הוגבלו; זו אינה בדיקת זמינות למסד הנתונים." : "קריאות המסך הושלמו; זו אינה בדיקת זמינות למסד הנתונים.", state: result.error || result.data.queryError ? "degraded" : "operational", icon: Database, href: "/dashboard/admin/database-integrity" },
    { name: "התראות ותקשורת", description: deliveryFailures === null ? "נתוני המסירה לא נמדדו במלואם; זמינות ספק נבדקת בנפרד." : `${deliveryFailures} כשלים ברשומות המסירה האחרונות. זמינות ספק נבדקת בנפרד.`, state: deliveryFailures === null ? "unknown" : deliveryFailures ? "degraded" : providerState("email"), icon: BellRing, href: "/dashboard/admin/provider-production" },
    { name: "תשלומים", description: financial.payment.checkoutAvailable ? "יכולת checkout קיימת; סטטוס Production מוצג לפי אימות הספק." : "אין יכולת checkout מאומתת.", state: paymentState, icon: CreditCard, href: "/dashboard/admin/subscriptions" },
    { name: "מסמכים ואחסון", description: documentIssues === null ? "נתוני המסמכים לא נמדדו במלואם; בריאות ספק האחסון אינה מוסקת ממטא־דאטה." : `${documentIssues} מסמכים דורשים פעולה. בריאות ספק האחסון אינה מוסקת מקריאת מטא־דאטה.`, state: documentIssues === null ? "unknown" : providerState("storage"), icon: FileText, href: "/dashboard/admin/document-center" },
    { name: "מצלמות / Digital Observer", description: cameraIssues === null ? "מצב מקורות המצלמה לא נמדד במלואו; אין טענת Live או AI." : `${cameraIssues} מקורות במצב מוגבל או לא זמין. Mock, Shadow ו־Sandbox אינם Production.`, state: cameraIssues === null ? "unknown" : cameraIssues ? "degraded" : providerState("camera_gateway"), icon: Camera, href: "/dashboard/admin/provider-production" }
  ];
  const operational = services.filter((item) => item.state === "operational").length;
  const degraded = services.filter((item) => item.state === "degraded").length;
  const unavailable = services.filter((item) => item.state === "unavailable").length;
  const unknown = services.filter((item) => item.state === "unknown").length;

  return <AdminAppFrame profile={profile} activeHref="/dashboard/admin/system-health" title="מצב מערכת" subtitle="בריאות שירותים ומוכנות ספקים לפי מקורות מאומתים." badge={unknown ? `${unknown} לא נמדדו` : unavailable ? `${unavailable} לא זמינים` : degraded ? `${degraded} מוגבלים` : "בדיקת שירות"}>
    <div className="platform-admin">
      <AdminSectionIntro eyebrow="SERVICE STATUS" title="מצב שירותי הפלטפורמה" text="כל שירות מוצג לפי מקור המידע שלו. היעדר נתונים, ספק לא מאומת או סביבת בדיקה אינם מסומנים כבריאים." actions={<Link className="admin-primary-button" href="/dashboard/admin/provider-production">מוכנות ספקים</Link>} />
      <AdminDataError message={result.error ?? result.data.queryError} />
      <DashboardGrid columns={4}><MetricCard label="שירותים תפעוליים" value={operational} hint={`מתוך ${services.length}`} icon={HeartPulse} tone={result.error || result.data.queryError ? "warning" : "success"} /><MetricCard label="שירותים מוגבלים" value={degraded} hint="דורש בדיקה" icon={Activity} tone={degraded ? "warning" : "success"} /><MetricCard label="לא זמינים / לא נמדדו" value={unavailable + unknown} hint={`${unavailable} לא זמינים · ${unknown} לא נמדדו`} icon={ServerCog} tone={unavailable ? "danger" : unknown ? "warning" : "success"} /><MetricCard label="פערי גנים" value={gardenIssues ?? "—"} hint={gardenIssues === null ? "מקור לא זמין" : "שיוך או פיקוח"} icon={ShieldCheck} tone={gardenIssues === null ? "warning" : gardenIssues ? "warning" : "success"} /></DashboardGrid>
      <PremiumCard size="lg"><SectionHeader title="שירותים" subtitle="טקסט וצבע מציגים יחד את המצב" icon={Activity} /><section className="platform-admin-service-grid">{services.map((service) => <AdminTruthState key={service.name} title={<>{service.name} <StatusChip tone={service.state === "operational" ? "success" : service.state === "unavailable" ? "danger" : "warning"}>{stateLabel[service.state]}</StatusChip></>} text={service.description} tone={stateTone(service.state)} icon={service.icon} action={<Link className="admin-link-button" href={service.href}>פרטים</Link>} />)}</section></PremiumCard>
    </div>
  </AdminAppFrame>;
}
