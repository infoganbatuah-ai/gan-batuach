import Link from "next/link";
import { CalendarCheck, Home, MapPin, ShieldCheck } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  InspectorAppFrame,
  InspectorEmpty,
  InspectorGardenThumb,
  InspectorHero,
  InspectorList,
  InspectorMetricCard,
  InspectorMetricGrid,
  InspectorRow,
  InspectorScoreRing,
  InspectorSection,
  InspectorStatus
} from "@/components/inspector-app-ui";

export default async function InspectorCommandCenterPage() {
  const { profile } = await requireRole(["inspector"]);
  const supabase = await createClient();
  const [inspectorRes, gardensRes, requiredRes] = await Promise.all([
    supabase.from("inspectors" as any).select("profile_photo_url").eq("id", profile.id).maybeSingle(),
    supabase.from("gardens" as any).select("id,name,city,address,logo_url,safe_status,last_inspection_score,next_inspection_at").eq("inspector_id", profile.id).order("name"),
    supabase.from("required_inspections" as any).select("id,garden_id,due_at,status,inspection_type,gardens(id,name,city)").eq("inspector_id", profile.id).neq("status", "done").order("due_at").limit(40)
  ]);
  const inspector = inspectorRes.data as any;
  const profileForUi = { ...profile, profile_image_url: inspector?.profile_photo_url ?? profile.profile_image_url };
  const gardens = (gardensRes.data ?? []) as any[];
  const required = (requiredRes.data ?? []) as any[];
  const active = gardens.filter((garden) => garden.safe_status !== "suspended").length;
  const needsCare = gardens.filter((garden) => Number(garden.last_inspection_score ?? 100) < 80).length;
  const next = required[0];

  return (
    <InspectorAppFrame profile={profileForUi} activeHref="/dashboard/inspector/control-center" title="גנים מוקצים" subtitle="יומן ביקורות · בוקר טוב, מפקח" badge="💜">
      <InspectorMetricGrid columns={4}>
        <InspectorMetricCard label="עיר" value={gardens[0]?.city ?? "תל אביב"} hint="אזור פעילות" icon={MapPin} />
        <InspectorMetricCard label="ציון בטיחות" value={`${Math.round(gardens.reduce((sum, g) => sum + Number(g.last_inspection_score ?? 0), 0) / Math.max(gardens.length, 1)) || 92}`} hint="ממוצע גנים" icon={ShieldCheck} />
        <InspectorMetricCard label="גנים פעילים" value={active} hint="מתוך הגנים המוקצים" icon={Home} tone="success" />
        <InspectorMetricCard label="ביקורת הבאה" value={next?.due_at ? new Date(next.due_at).toLocaleDateString("he-IL") : "לא נקבע"} hint={next?.gardens?.name ?? "יופיע לאחר שיבוץ"} icon={CalendarCheck} tone="primary" />
      </InspectorMetricGrid>

      <InspectorHero
        eyebrow="הגנים המוקצים שלי"
        title="כל גן, ציון וביקורת הבאה במקום אחד"
        subtitle="המסך מציג רק גנים ששויכו אליך. פתיחת גן מובילה לביקורות, דוחות וליקויים של אותו גן."
        artwork={<Home />}
        action={<Link className="inspector-action-button" href="/dashboard/inspector/inspections/due">צפה ביומן השבוע</Link>}
      />

      <InspectorSection title="רשימת גנים" subtitle="ציון בטיחות, מנהלת, עיר וביקורת הבאה" icon={Home}>
        <InspectorList>
          {gardens.map((garden) => (
            <InspectorRow
              key={garden.id}
              href={`/dashboard/inspector/inspections?garden=${garden.id}`}
              avatar={<InspectorGardenThumb src={garden.logo_url} name={garden.name} />}
              title={garden.name}
              subtitle={`${garden.city ?? ""} · ${garden.address ?? ""}`}
              meta={garden.next_inspection_at ? `ביקורת הבאה: ${new Date(garden.next_inspection_at).toLocaleDateString("he-IL")}` : "טרם נקבעה ביקורת"}
              status={<><InspectorScoreRing value={garden.last_inspection_score ?? 92} label="בטיחות" /><InspectorStatus tone={Number(garden.last_inspection_score ?? 100) < 80 ? "warning" : "success"}>{garden.safe_status ?? "פעיל"}</InspectorStatus></>}
            />
          ))}
          {gardens.length === 0 ? <InspectorEmpty title="אין גנים מוקצים" text="אדמין צריך לשייך גנים כדי לפתוח יומן ביקורות." icon={Home} /> : null}
        </InspectorList>
      </InspectorSection>

      <InspectorSection title="ביקורות השבוע" subtitle="הביקורות הקרובות לפי תאריך" icon={CalendarCheck} action={<Link href="/dashboard/inspector/inspections/due">צפה ביומן המלא</Link>}>
        <InspectorList>
          {required.slice(0, 8).map((item) => (
            <InspectorRow
              key={item.id}
              href={`/dashboard/inspector/inspections?required=${item.id}`}
              title={item.gardens?.name ?? "גן"}
              subtitle={item.gardens?.city ?? ""}
              meta={item.due_at ? new Date(item.due_at).toLocaleString("he-IL") : "ללא תאריך"}
              status={<InspectorStatus tone="primary">{item.inspection_type ?? "ביקורת"}</InspectorStatus>}
            />
          ))}
          {required.length === 0 ? <InspectorEmpty title="אין ביקורות פתוחות" text="יומן הביקורות יתעדכן לאחר שיוך משימות." icon={CalendarCheck} /> : null}
        </InspectorList>
      </InspectorSection>
    </InspectorAppFrame>
  );
}
