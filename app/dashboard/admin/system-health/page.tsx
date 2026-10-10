import Link from "next/link";
import { Activity, BellRing, Camera, CreditCard, Database, FileText, HeartPulse, ServerCog, ShieldCheck } from "lucide-react";
import { AdminAppFrame } from "@/components/admin-app-ui";
import { AdminDataError } from "@/components/admin-data-state";
import { DashboardGrid, MetricCard, PremiumCard, SectionHeader, StatusChip } from "@/components/gan-batuach-design-system";
import { AdminSectionIntro, AdminTruthState } from "@/components/platform-admin-ui";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { requireRole } from "@/lib/auth";
import { getFinancialProviderCapabilities } from "@/lib/domain/financial-provider-capability";
import { createClient } from "@/lib/supabase/server";

type State = "operational" | "degraded" | "setup_required" | "unavailable";
type GardenHealth = { status?: string | null; manager_id?: string | null; inspector_id?: string | null; inspection_required_status?: string | null };
type DeliveryHealth = { status?: string | null; channel?: string | null };
type CameraHealth = { status?: string | null; health_status?: string | null };
type DocumentHealth = { status?: string | null };
type ProviderHealth = { integration_type?: string | null; provider_status?: string | null; last_successful_request_at?: string | null };
type IntegrationHealth = { integration_type?: string | null; status?: string | null; production_verified_at?: string | null };
const stateLabel: Record<State, string> = { operational: "תפעולי", degraded: "מוגבל", setup_required: "נדרשת הגדרה", unavailable: "לא זמין" };
const stateTone = (state: State): "good" | "warning" | "danger" => state === "operational" ? "good" : state === "unavailable" ? "danger" : "warning";

export default async function AdminSystemHealthPage() {
  const { profile } = await requireRole(["admin"]);
  const financial = getFinancialProviderCapabilities();
  const result = await safeAdminData("platform service status", async () => {
    const supabase = await createClient();
    const [gardens, delivery, cameras, documents, providerHealth, integrations] = await Promise.all([
      supabase.from("gardens" as never).select("id,status,manager_id,inspector_id,inspection_required_status" as never).limit(500),
      supabase.from("communication_delivery_logs" as never).select("id,status,channel" as never).order("created_at" as never, { ascending: false }).limit(500),
      supabase.from("camera_streams" as never).select("id,status,health_status" as never).limit(500),
      supabase.from("documents" as never).select("id,status" as never).limit(500),
      supabase.from("provider_production_health_metrics" as never).select("integration_type,provider_status,last_successful_request_at" as never).limit(120),
      supabase.from("production_integrations" as never).select("integration_type,status,production_verified_at" as never).limit(120)
    ]);
    [gardens, delivery, cameras, documents, providerHealth, integrations].forEach((item, index) => logSupabaseError(`platform service status ${index}`, item.error));
    return { gardens: (gardens.data ?? []) as unknown as GardenHealth[], delivery: (delivery.data ?? []) as unknown as DeliveryHealth[], cameras: (cameras.data ?? []) as unknown as CameraHealth[], documents: (documents.data ?? []) as unknown as DocumentHealth[], providerHealth: (providerHealth.data ?? []) as unknown as ProviderHealth[], integrations: (integrations.data ?? []) as unknown as IntegrationHealth[], queryError: [gardens, delivery, cameras, documents, providerHealth, integrations].some((item) => item.error) ? "חלק ממקורות מצב השירות לא נטענו" : null };
  }, { gardens: [] as GardenHealth[], delivery: [] as DeliveryHealth[], cameras: [] as CameraHealth[], documents: [] as DocumentHealth[], providerHealth: [] as ProviderHealth[], integrations: [] as IntegrationHealth[], queryError: null as string | null });

  const providerState = (type: string): State => {
    const health = result.data.providerHealth.find((item) => item.integration_type === type);
    const integration = result.data.integrations.find((item) => item.integration_type === type);
    if (!health && !integration) return "setup_required";
    if (["failed", "offline", "unavailable"].includes(String(health?.provider_status ?? integration?.status))) return "unavailable";
    if (["degraded", "warning", "pending"].includes(String(health?.provider_status ?? integration?.status))) return "degraded";
    if (integration?.production_verified_at && ["healthy", "operational", "active", "production_active"].includes(String(health?.provider_status ?? integration?.status))) return "operational";
    return "setup_required";
  };
  const deliveryFailures = result.data.delivery.filter((item) => /failed|bounced/i.test(String(item.status))).length;
  const cameraIssues = result.data.cameras.filter((item) => ["offline", "failed", "error", "degraded", "unhealthy"].includes(String(item.status)) || ["degraded", "unhealthy", "offline"].includes(String(item.health_status))).length;
  const gardenIssues = result.data.gardens.filter((item) => !item.manager_id || !item.inspector_id || item.inspection_required_status === "pending_first_inspection").length;
  const documentIssues = result.data.documents.filter((item) => ["rejected", "expired", "replacement_required", "missing"].includes(String(item.status))).length;
  const paymentState: State = financial.payment.checkoutAvailable && financial.payment.providerAdapterVerified && financial.payment.webhookVerified ? "operational" : financial.payment.checkoutAvailable ? "degraded" : "setup_required";
  const services: Array<{ name: string; description: string; state: State; icon: typeof Activity; href: string }> = [
    { name: "יישום", description: "מסך האדמין עבר אימות הרשאה בצד השרת ונענה לבקשה הנוכחית.", state: "operational", icon: ServerCog, href: "/dashboard/admin" },
    { name: "מסד נתונים", description: result.data.queryError ? "חלק משאילתות הבריאות נכשלו; אין הצגת מצב ירוק." : "שאילתות הבריאות המוגבלות הושלמו.", state: result.data.queryError ? "degraded" : "operational", icon: Database, href: "/dashboard/admin/database-integrity" },
    { name: "התראות ותקשורת", description: `${deliveryFailures} כשלים ברשומות המסירה האחרונות. זמינות ספק נבדקת בנפרד.`, state: deliveryFailures ? "degraded" : providerState("email"), icon: BellRing, href: "/dashboard/admin/provider-production" },
    { name: "תשלומים", description: financial.payment.checkoutAvailable ? "יכולת checkout קיימת; סטטוס Production מוצג לפי אימות הספק." : "אין יכולת checkout מאומתת.", state: paymentState, icon: CreditCard, href: "/dashboard/admin/subscriptions" },
    { name: "מסמכים ואחסון", description: `${documentIssues} מסמכים דורשים פעולה. בריאות ספק האחסון אינה מוסקת מקריאת מטא־דאטה.`, state: providerState("storage"), icon: FileText, href: "/dashboard/admin/document-center" },
    { name: "מצלמות / Digital Observer", description: `${cameraIssues} מקורות במצב מוגבל או לא זמין. Mock, Shadow ו־Sandbox אינם Production.`, state: cameraIssues ? "degraded" : providerState("camera_gateway"), icon: Camera, href: "/dashboard/admin/provider-production" }
  ];
  const operational = services.filter((item) => item.state === "operational").length;
  const degraded = services.filter((item) => item.state === "degraded").length;
  const unavailable = services.filter((item) => item.state === "unavailable").length;

  return <AdminAppFrame profile={profile} activeHref="/dashboard/admin/system-health" title="מצב מערכת" subtitle="בריאות שירותים ומוכנות ספקים לפי מקורות מאומתים." badge={unavailable ? `${unavailable} לא זמינים` : degraded ? `${degraded} מוגבלים` : "בדיקת שירות"}>
    <div className="platform-admin">
      <AdminSectionIntro eyebrow="SERVICE STATUS" title="מצב שירותי הפלטפורמה" text="כל שירות מוצג לפי מקור המידע שלו. היעדר נתונים, ספק לא מאומת או סביבת בדיקה אינם מסומנים כבריאים." actions={<Link className="admin-primary-button" href="/dashboard/admin/provider-production">מוכנות ספקים</Link>} />
      <AdminDataError message={result.error ?? result.data.queryError} />
      <DashboardGrid columns={4}><MetricCard label="שירותים תפעוליים" value={operational} hint={`מתוך ${services.length}`} icon={HeartPulse} tone="success" /><MetricCard label="שירותים מוגבלים" value={degraded} hint="דורש בדיקה" icon={Activity} tone={degraded ? "warning" : "success"} /><MetricCard label="לא זמינים" value={unavailable} hint="אין הצלחה מדומה" icon={ServerCog} tone={unavailable ? "danger" : "success"} /><MetricCard label="פערי גנים" value={gardenIssues} hint="שיוך או פיקוח" icon={ShieldCheck} tone={gardenIssues ? "warning" : "success"} /></DashboardGrid>
      <PremiumCard size="lg"><SectionHeader title="שירותים" subtitle="טקסט וצבע מציגים יחד את המצב" icon={Activity} /><section className="platform-admin-service-grid">{services.map((service) => <AdminTruthState key={service.name} title={<>{service.name} <StatusChip tone={service.state === "operational" ? "success" : service.state === "unavailable" ? "danger" : "warning"}>{stateLabel[service.state]}</StatusChip></>} text={service.description} tone={stateTone(service.state)} icon={service.icon} action={<Link className="admin-link-button" href={service.href}>פרטים</Link>} />)}</section></PremiumCard>
    </div>
  </AdminAppFrame>;
}
