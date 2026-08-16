import { DashboardShell } from "@/components/dashboard-shell";
import { DashboardFilterChip } from "@/components/dashboard-filter-chip";
import { ModuleListPage } from "@/components/module-list-page";
import { GardenDocumentUploadPanel } from "@/components/garden-document-upload-panel";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CheckCircle2, FileText, ShieldAlert, Upload } from "lucide-react";
import {
  TeacherActionTile,
  TeacherAppFrame,
  TeacherCompactItem,
  TeacherCompactList,
  TeacherEmptyState,
  TeacherPageTitle,
  TeacherQuickActions,
  TeacherSection,
  TeacherStatCard,
  TeacherStatsGrid
} from "@/components/teacher-app-ui";

export default async function GardenDocumentsPage({ searchParams }: { searchParams: Promise<{ filter?: string; upload?: string }> }) {
  const { profile } = await requireRole(["manager", "owner"]);
  const params = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("documents" as any).select("id, name, document_type, status, expires_at, created_at, file_url").eq("garden_id", profile.garden_id ?? "").order("created_at", { ascending: false });
  const rows = (data ?? [])
    .filter((doc: any) => {
      if (params.filter === "missing") return ["missing", "required", "expired", "rejected"].includes(doc.status);
      if (params.filter === "review") return doc.status === "pending_review";
      return true;
    })
    .map((doc: any) => ({ ...doc, title: doc.name, description: `${doc.document_type} · תוקף ${doc.expires_at ? new Date(doc.expires_at).toLocaleDateString("he-IL") : "לא הוגדר"}` }));
  const missing = rows.filter((doc: any) => ["missing", "required", "expired", "rejected"].includes(doc.status)).length;
  const review = rows.filter((doc: any) => doc.status === "pending_review").length;
  const ready = rows.filter((doc: any) => ["approved", "valid"].includes(doc.status)).length;
  return (
    <DashboardShell role="manager" title="מסמכים" appHome>
      <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`} subtitle="מסמכים ואישורים" avatarUrl={(profile as any).profile_image_url ?? null} active="more">
        <TeacherPageTitle icon={FileText} title="מסמכים ואישורים" subtitle="מסמכי גן, צוות, ילדים, אישורי מצלמות ובטיחות" />
        <TeacherStatsGrid>
          <TeacherStatCard title="מסמכים" value={rows.length} hint="במערכת" icon={FileText} tone="blue" />
          <TeacherStatCard title="תקינים" value={ready} hint="מאושרים" icon={CheckCircle2} tone="green" />
          <TeacherStatCard title="דורשים טיפול" value={missing} hint="חסר / פג תוקף" icon={ShieldAlert} tone={missing ? "red" : "green"} href="/dashboard/garden/documents?filter=missing" />
          <TeacherStatCard title="בבדיקה" value={review} hint="ממתינים לאישור" icon={Upload} tone={review ? "orange" : "green"} href="/dashboard/garden/documents?filter=review" />
        </TeacherStatsGrid>
        <DashboardFilterChip label={params.filter === "missing" ? "מסמכים חסרים / דחויים / פגי תוקף" : params.filter === "review" ? "מסמכים שממתינים לאישור" : null} clearHref="/dashboard/garden/documents" isEmpty={rows.length === 0} emptyTitle={params.filter === "missing" ? "אין כרגע מסמכים חסרים" : params.filter === "review" ? "אין כרגע מסמכים שממתינים לאישור" : undefined} emptyText="כל המסמכים במסנן הזה תקינים כרגע." />

        <TeacherSection title="רשימת מסמכים" action={<a href="/dashboard/garden/documents?filter=missing">דורשים טיפול</a>}>
          {rows.length ? (
            <TeacherCompactList>
              {rows.slice(0, 8).map((doc: any) => (
                <TeacherCompactItem
                  key={doc.id}
                  title={doc.name ?? doc.document_type ?? "מסמך"}
                  subtitle={doc.description}
                  tone={["missing", "expired", "rejected"].includes(doc.status) ? "red" : doc.status === "pending_review" ? "orange" : "green"}
                  meta={doc.status ?? "חדש"}
                />
              ))}
            </TeacherCompactList>
          ) : (
            <TeacherEmptyState title={params.filter === "missing" ? "אין כרגע מסמכים חסרים" : "אין מסמכים עדיין"} text={params.filter === "missing" ? "אין מסמכים חסרים, דחויים או פגי תוקף כרגע." : "העלו מסמכים מתוך תהליך הקליטה או מרכז המסמכים."} />
          )}
        </TeacherSection>

        <TeacherQuickActions title="פעולות מסמכים">
          <TeacherActionTile title="העלאת מסמך" href="/dashboard/garden/documents?upload=1#document-upload" icon={Upload} tone="purple" />
          <TeacherActionTile title="דורשים טיפול" href="/dashboard/garden/documents?filter=missing" icon={ShieldAlert} tone="orange" />
        </TeacherQuickActions>

        <GardenDocumentUploadPanel gardenId={profile.garden_id ?? ""} documents={rows as any[]} defaultOpen={params.upload === "1"} />

        <details className="teacher-management-details" open={params.upload === "1"}>
          <summary>ניהול מלא</summary>
          <ModuleListPage title="מרכז מסמכי גן" eyebrow="Document Center" description="מסמכי גן, צוות, ילדים, אישורי מצלמות, תברואה, בטיחות ותוקף." rows={rows} emptyTitle={params.filter === "missing" ? "אין כרגע מסמכים חסרים" : "אין מסמכים עדיין"} emptyText={params.filter === "missing" ? "אין מסמכים חסרים, דחויים או פגי תוקף כרגע." : "העלו מסמכים מתוך תהליך הקליטה או מרכז המסמכים. מסמכים חסרים יוצגו לאדמין ולפקח."} />
        </details>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
