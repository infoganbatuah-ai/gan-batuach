import { LockKeyhole, MessageCircleOff, ShieldCheck } from "lucide-react";
import { requireOperationalRole } from "@/lib/management/operational-role";
import { InspectorAppFrame, InspectorHero, InspectorMetricCard, InspectorMetricGrid, InspectorSection } from "@/components/inspector-app-ui";
import { StatusChip } from "@/components/gan-batuach-design-system";

export default async function InspectorMessagesPage() {
  const { profile } = await requireOperationalRole(["inspector"]);
  return (
    <InspectorAppFrame profile={profile} activeHref="/dashboard/inspector/notifications" title="תקשורת מפקח" subtitle="תקשורת מוגבלת לפי שיוך וסמכות" badge="הרשאה מוגבלת">
      <InspectorHero eyebrow="גבולות תקשורת" title="אין גישה לצ׳אט התפעולי של הגן" subtitle="מפקח מקבל התראות ופעולות רק בהקשר פיקוח, תלונה או תיקון שהוקצו לו. שיחות משפחה וצוות נשארות פרטיות." artwork={<MessageCircleOff />} />
      <InspectorMetricGrid columns={3}>
        <InspectorMetricCard label="צ׳אט גן" value="חסום" hint="לפי מדיניות" icon={LockKeyhole} tone="warning" />
        <InspectorMetricCard label="התראות פיקוח" value="מורשות" hint="לפי שיוך" icon={ShieldCheck} tone="success" />
        <InspectorMetricCard label="פרטי משפחה" value="מוגנים" hint="ללא חשיפה" icon={LockKeyhole} />
      </InspectorMetricGrid>
      <InspectorSection title="איפה מתקשרים?" subtitle="הפעולה נשארת בתוך ההקשר הקנוני" icon={ShieldCheck}>
        <div className="inspector-communication-boundary">
          <StatusChip tone="warning">אין צ׳אט גן כללי</StatusChip>
          <h2>השתמשו בפעולה מתוך הפיקוח או התיקון</h2>
          <p>הודעה הקשורה לממצא, ראיה או פעולה מתקנת נוצרת רק מתוך המסך המורשה שלה. מרכז ההתראות מציג עדכון בטוח וקישור לאותו הקשר.</p>
          <a className="button primary" href="/dashboard/inspector/notifications">מעבר להתראות הפיקוח</a>
        </div>
      </InspectorSection>
    </InspectorAppFrame>
  );
}
