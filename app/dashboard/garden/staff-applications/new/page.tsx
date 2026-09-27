import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, CheckCircle2, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { RecruitmentHero } from "@/components/recruitment-ui";
import { StaffOpeningForm } from "@/components/self-service-forms";
import { TeacherAppFrame } from "@/components/teacher-app-ui";
import { requireRole } from "@/lib/auth";
import { cleanSyntheticLabel } from "@/lib/domain/display-label";

export default async function NewStaffOpeningPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  return <DashboardShell role="manager" title="פרסום משרה" appHome>
    <TeacherAppFrame title={cleanSyntheticLabel(profile.full_name, "מנהלת")} subtitle="גיוס צוות" avatarUrl={profile.profile_image_url} active="more">
      <Link className="ux08-back-link" href="/dashboard/garden/staff-applications"><ArrowRight /> חזרה למרכז הגיוס</Link>
      <RecruitmentHero compact eyebrow="פרסום ממוקד" title="משרה חדשה לגן" text="ארבעה פרטים ברורים מספיקים לפרסום ראשון. אפשר להשהות או לסגור את המשרה בלי למחוק היסטוריה." />
      <section className="ux08-job-create-layout"><div className="ux08-job-create-form"><header><span>1</span><div><small>שלב 1 מתוך 1</small><h1>פרטי המשרה</h1><p>התפקיד והדרישות משמשים להתאמה קנונית, בלי ציוני AI מומצאים.</p></div></header><StaffOpeningForm /></div><aside><article><BriefcaseBusiness /><h2>תיאור מדויק</h2><p>עוזר למועמדות להבין את התפקיד לפני הגשה.</p></article><article><ShieldCheck /><h2>מידע ציבורי בלבד</h2><p>אין חשיפה של נתוני ילדים, צוות או פעילות פנימית.</p></article><article><CheckCircle2 /><h2>שליטה מלאה</h2><p>טיוטה, פרסום, השהיה וסגירה נשארים במודל הקנוני.</p></article></aside></section>
    </TeacherAppFrame>
  </DashboardShell>;
}
