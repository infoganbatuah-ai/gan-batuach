import { Building2, MailCheck } from "lucide-react";
import { requireApprovedInspector } from "@/lib/management/operational-role";
import { InspectorPreliminaryGardens } from "@/components/inspector-preliminary-gardens";
import { InspectorAppFrame, InspectorHero, InspectorSection } from "@/components/inspector-app-ui";

export default async function PreliminaryGardensPage() {
  const { profile } = await requireApprovedInspector();
  return (
    <InspectorAppFrame profile={profile} activeHref="/dashboard/inspector/preliminary-gardens" title="הקמת גן מקדים" subtitle="טיוטה מאובטחת והזמנת בעלים או גננת" badge="הקמת גן">
      <InspectorHero eyebrow="GB-M21" title="פותחים תיק גן ומעבירים את ההמשך לבעלים" subtitle="טיוטת הגן נשארת לא פעילה ולא ציבורית. ההזמנה החתומה מעבירה את הנמען לאונבורדינג הקיים." artwork={<Building2 />} />
      <InspectorSection title="פרטי הגן והזמנה" subtitle="זהות בסיסית, נמען ותפקיד — ללא יצירת סיסמה זמנית" icon={MailCheck}>
        <InspectorPreliminaryGardens />
      </InspectorSection>
    </InspectorAppFrame>
  );
}
