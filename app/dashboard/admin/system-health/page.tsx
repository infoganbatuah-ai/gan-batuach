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
    async function query<T>(index: number, run: () => PromiseLike<{ data: T[] | null; error: unknown }>) {
      try {
        const response = await run();
        logSupabaseError(`platform service status ${index}`, response.error);
        return { data: response.error ? [] as T[] : response.data ?? [], available: !response.error };
      } catch (error) {
        logSupabaseError(`platform service status ${index}`, error);
        return { data: [] as T[], available: false };
      }
    }
    const [gardens, delivery, cameras, documents, providerHealth, integrations] = await Promise.all([
      query(0, () => supabase.from("gardens" as never).select("id,status,manager_id,inspector_id,inspection_required_status" as never).limit(500)),
      query(1, () => supabase.from("communication_delivery_logs" as never).select("id,status,channel" as never).order("created_at" as never, { ascending: false }).limit(500)),
      query(2, () => supabase.from("camera_streams" as never).select("id,status,health_status" as never).limit(500)),
      query(3, () => supabase.from("documents" as never).select("id,status" as never).limit(500)),
      query(4, () => supabase.from("provider_production_health_metrics" as never).select("integration_type,provider_status,last_successful_request_at" as never).limit(120)),
      query(5, () => supabase.from("production_integrations" as never).select("integration_type,status,production_verified_at" as never).limit(120))
    ]);
    const available = [gardens, delivery, cameras, documents, providerHealth, integrations].map((response) => response.available);
    return { gardens: (gardens.data ?? []) as unknown as GardenHealth[], delivery: (delivery.data ?? []) as unknown as DeliveryHealth[], cameras: (cameras.data ?? []) as unknown as CameraHealth[], documents: (documents.data ?? []) as unknown as DocumentHealth[], providerHealth: (providerHealth.data ?? []) as unknown as ProviderHealth[], integrations: (integrations.data ?? []) as unknown as IntegrationHealth[], available, batchLoaded: true, queryError: available.some((known) => !known) ? "חלק ממקורות מצב השירות לא נטענו" : null };
  }, { gardens: [] as GardenHealth[], delivery: [] as DeliveryHealth[], cameras: [] as CameraHealth[], documents: [] as DocumentHealth[], providerHealth: [] as ProviderHealth[], integrations: [] as IntegrationHealth[], available: Array<boolean>(6).fill(false), batchLoaded: false, queryError: null as string | null });

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
  const known = (index: number) => result.data.available[index];
  const unknown = "לא זמין";
  const recordedProviderState = (type: string): State | null => {
    if (known(4) && known(5)) return providerState(type);
    if (known(4)) {
      const health = result.data.providerHealth.find((item) => item.integration_type === type);
      if (health?.provider_status != null && !["healthy", "operational", "active", "production_active"].includes(String(health.provider_status))) return providerState(type);
    }
    return null;
  };
  const issueState = (index: number, count: number, type: string): State | null => {
    if (known(index) && count > 0) return "degraded";
    const provider = recordedProviderState(type);
    return known(index) || provider === "degraded" ? provider : null;
  };
  const services: Array<{ name: string; description: string; state: State | null; icon: typeof Activity; href: string }> = [
    { name: "יישום", description: "מסך האדמין עבר אימות הרשאה בצד השרת ונענה לבקשה הנוכחית.", state: "operational", icon: ServerCog, href: "/dashboard/admin" },
    { name: "מסד נתונים", description: !result.data.batchLoaded ? "לא זמין — לא הושלמה קבוצת קריאות תקפה." : result.data.queryError ? "חלק משאילתות הבריאות נכשלו; אין הצגת מצב ירוק." : "קריאות המטא־דאטה המוגבלות הושלמו; זו תמונת קריאה בלבד, לא בדיקת מסד מלאה.", state: !result.data.batchLoaded ? null : result.data.queryError ? "degraded" : "operational", icon: Database, href: "/dashboard/admin/database-integrity" },
    { name: "התראות ותקשורת", description: `${known(1) ? deliveryFailures : unknown} כשלים ברשומות המסירה האחרונות. ${recordedProviderState("email") === null ? "מצב הספק לא ידוע." : "מצב הספק לפי רשומות בלבד."}`, state: issueState(1, deliveryFailures, "email"), icon: BellRing, href: "/dashboard/admin/provider-production" },
    { name: "תשלומים", description: financial.payment.checkoutAvailable ? "יכולת checkout קיימת; סטטוס Production מוצג לפי אימות הספק." : "אין יכולת checkout מאומתת.", state: paymentState, icon: CreditCard, href: "/dashboard/admin/subscriptions" },
    { name: "מסמכים ואחסון", description: `${known(3) ? documentIssues : unknown} מסמכים דורשים פעולה. בריאות ספק האחסון אינה מוסקת מקריאת מטא־דאטה. ${recordedProviderState("storage") === null ? "מצב הספק לא ידוע." : ""}`, state: recordedProviderState("storage"), icon: FileText, href: "/dashboard/admin/document-center" },
    { name: "מצלמות / Digital Observer", description: `${known(2) ? cameraIssues : unknown} מקורות במצב מוגבל או לא זמין. Mock, Shadow ו־Sandbox אינם Production. ${recordedProviderState("camera_gateway") === null ? "מצב הספק לא ידוע." : "מצב הספק לפי רשומות בלבד."}`, state: issueState(2, cameraIssues, "camera_gateway"), icon: Camera, href: "/dashboard/admin/provider-production" }
  ];
  const operational = services.filter((item) => item.state === "operational").length;
  const degraded = services.filter((item) => item.state === "degraded").length;
  const unavailable = services.filter((item) => item.state === "unavailable").length;

  const summaryKnown = services.every((service) => service.state !== null);

  return <AdminAppFrame profile={profile} activeHref="/dashboard/admin/system-health" title="מצב מערכת" subtitle="רשומות מצב ומוכנות בלבד; לא בדיקת ספק חיה, מסד מלא או אימות Production." badge={!summaryKnown ? "מצב חלקי — נתונים חסרים" : unavailable ? `${unavailable} לא זמינים` : degraded ? `${degraded} מוגבלים` : "בדיקת שירות"}>
    <div className="platform-admin">
      <AdminSectionIntro eyebrow="SERVICE STATUS" title="מצב שירותי הפלטפורמה" text="כל שירות מוצג לפי מקור המידע שלו. היעדר נתונים, ספק לא מאומת או סביבת בדיקה אינם מסומנים כבריאים." actions={<Link className="admin-primary-button" href="/dashboard/admin/provider-production">מוכנות ספקים</Link>} />
      <AdminDataError message={result.error ?? result.data.queryError} />
      <DashboardGrid columns={4}><MetricCard label="שירותים תפעוליים" value={summaryKnown ? operational : unknown} hint={`מתוך ${services.length}`} icon={HeartPulse} tone={summaryKnown ? ("success") : "default"} /><MetricCard label="שירותים מוגבלים" value={summaryKnown ? degraded : unknown} hint="דורש בדיקה" icon={Activity} tone={summaryKnown ? (degraded ? "warning" : "success") : "default"} /><MetricCard label="לא זמינים" value={summaryKnown ? unavailable : unknown} hint="אין הצלחה מדומה" icon={ServerCog} tone={summaryKnown ? (unavailable ? "danger" : "success") : "default"} /><MetricCard label="פערי גנים" value={known(0) ? gardenIssues : unknown} hint="שיוך או פיקוח" icon={ShieldCheck} tone={known(0) ? (gardenIssues ? "warning" : "success") : "default"} /></DashboardGrid>
      <PremiumCard size="lg"><SectionHeader title="שירותים" subtitle="טקסט וצבע מציגים יחד את המצב" icon={Activity} /><section className="platform-admin-service-grid">{services.map((service) => <AdminTruthState key={service.name} title={<>{service.name} <StatusChip tone={service.state === null ? "default" : service.state === "operational" ? "success" : service.state === "unavailable" ? "danger" : "warning"}>{service.state === null ? "לא ידוע" : stateLabel[service.state]}</StatusChip></>} text={service.description} tone={service.state === null ? "neutral" : stateTone(service.state)} icon={service.icon} action={<Link className="admin-link-button" href={service.href}>פרטים</Link>} />)}</section></PremiumCard>
    </div>
  </AdminAppFrame>;
}
