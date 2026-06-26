import Link from "next/link";
import { CalendarCheck, ClipboardCheck, Search } from "lucide-react";
import { SearchFilterBar, FormField } from "@/components/gan-batuach-design-system";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  InspectorAppFrame,
  InspectorEmpty,
  InspectorHero,
  InspectorList,
  InspectorMetricCard,
  InspectorMetricGrid,
  InspectorRow,
  InspectorSection,
  InspectorStatus
} from "@/components/inspector-app-ui";

function inspectionTypeLabel(value?: string | null) {
  const labels: Record<string, string> = {
    monthly: "ביקורת חודשית",
    routine: "ביקורת שגרתית",
    follow_up: "מעקב תיקונים",
    urgent: "ביקורת דחופה",
    complaint: "בעקבות תלונה",
    surprise: "ביקורת פתע"
  };
  return labels[String(value ?? "").toLowerCase()] ?? "ביקורת";
}

export default async function InspectorDueInspectionsPage() {
  const { profile } = await requireRole(["inspector"]);
  const supabase = await createClient();
  const [inspectorRes, rowsRes] = await Promise.all([
    supabase.from("inspectors" as any).select("profile_photo_url").eq("id", profile.id).maybeSingle(),
    supabase.from("required_inspections" as any).select("id, garden_id, due_at, status, countdown_day, inspection_type, gardens(name, city, address, last_inspection_score)").eq("inspector_id", profile.id).neq("status", "done").order("due_at").limit(80)
  ]);
  const rows = (rowsRes.data ?? []) as any[];
  const overdue = rows.filter((row) => row.due_at && new Date(row.due_at).getTime() < Date.now()).length;
  const week = rows.filter((row) => {
    if (!row.due_at) return false;
    const diff = Math.ceil((new Date(row.due_at).getTime() - Date.now()) / 86400000);
    return diff >= 0 && diff <= 7;
  }).length;
  const profileForUi = { ...profile, profile_image_url: (inspectorRes.data as any)?.profile_photo_url ?? profile.profile_image_url };

  return (
    <InspectorAppFrame profile={profileForUi} activeHref="/dashboard/inspector/inspections" title="יומן ביקורות" subtitle="קרובות, באיחור ומעקב" badge="ביקורות">
      <InspectorHero
        eyebrow="לוח ביקורות"
        title="מה באיחור, מה קרוב ומה דורש ביקורת המשך"
        subtitle="ביקורות חודשיות, פתע והמשך מוצגות לפי תאריך יעד. לחיצה פותחת מילוי טופס."
        artwork={<CalendarCheck />}
        action={<Link className="inspector-action-button" href="/dashboard/inspector/inspections">מילוי טופס פיקוח</Link>}
      />
      <InspectorMetricGrid columns={3}>
        <InspectorMetricCard label="פתוחות" value={rows.length} hint="בתור הפיקוח" icon={ClipboardCheck} />
        <InspectorMetricCard label="השבוע" value={week} hint="עד 7 ימים" icon={CalendarCheck} tone="primary" />
        <InspectorMetricCard label="באיחור" value={overdue} hint="דורש טיפול" icon={CalendarCheck} tone={overdue ? "warning" : "success"} />
      </InspectorMetricGrid>
      <SearchFilterBar
        search={<FormField label="חיפוש" placeholder="חיפוש גן / עיר" icon={Search} />}
        filters={<><FormField as="select" label="טווח"><option>כל התאריכים</option><option>באיחור</option><option>7 ימים</option><option>24 שעות</option></FormField><FormField as="select" label="סוג"><option>כל הביקורות</option><option>חודשית</option><option>פתע</option><option>מעקב</option></FormField></>}
      />
      <InspectorSection title="ביקורות פתוחות" subtitle="רשימת משימות לפי תאריך יעד" icon={ClipboardCheck}>
        <InspectorList>
          {rows.map((row) => {
            const days = row.due_at ? Math.ceil((new Date(row.due_at).getTime() - Date.now()) / 86400000) : null;
            return (
              <InspectorRow
                key={row.id}
                href={`/dashboard/inspector/inspections?required=${row.id}`}
                title={row.gardens?.name ?? row.garden_id}
                subtitle={`${row.gardens?.city ?? ""} · ${row.gardens?.address ?? ""}`}
                meta={`${inspectionTypeLabel(row.inspection_type)} · ציון אחרון: ${row.gardens?.last_inspection_score ?? "-"} · יעד: ${row.due_at ? new Date(row.due_at).toLocaleDateString("he-IL") : "לא נקבע"}`}
                status={<InspectorStatus tone={days !== null && days < 0 ? "danger" : "warning"}>{days !== null && days < 0 ? `${Math.abs(days)} ימים באיחור` : `${days ?? "-"} ימים נותרו`}</InspectorStatus>}
              />
            );
          })}
          {rows.length === 0 ? <InspectorEmpty title="אין ביקורות פתוחות" text="משימות פיקוח בגנים שהוקצו לך יופיעו כאן לפי תאריך יעד." icon={CalendarCheck} /> : null}
        </InspectorList>
      </InspectorSection>
    </InspectorAppFrame>
  );
}
