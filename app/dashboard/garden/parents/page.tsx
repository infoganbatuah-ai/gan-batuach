import { Baby, Bell, MessageCircle, UsersRound } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { ParentProfileCards } from "@/components/people-profile-cards";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  TeacherActionTile,
  TeacherAiInsight,
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

export default async function GardenParentsPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const [parentsRes, childrenRes, complaintsRes, messagesRes, documentsRes] = await Promise.all([
    supabase.from("parents" as any).select("id, profile_id, full_name, phone, email, address, status, completed_profile, created_at, profiles:profile_id(profile_image_url)").eq("garden_id", gardenId).order("created_at", { ascending: false }),
    supabase.from("children" as any).select("id, full_name, photo_url, status, primary_parent_id").eq("garden_id", gardenId),
    supabase.from("complaints" as any).select("parent_id, id, status, created_at").eq("garden_id", gardenId).neq("status", "closed"),
    supabase.from("messages" as any).select("recipient_id, id, read_at, created_at").eq("garden_id", gardenId).is("read_at", null),
    supabase.from("documents" as any).select("parent_id, id").eq("garden_id", gardenId)
  ]);
  const parentProfileIds = ((parentsRes.data ?? []) as any[]).map((parent) => parent.profile_id).filter(Boolean);
  const credentialsRes = parentProfileIds.length
    ? await supabase.from("generated_credentials" as any).select("id,user_id,username,temporary_password,created_at,password_changed_at,reset_sent_at").in("user_id", parentProfileIds)
    : { data: [] };
  if ((credentialsRes as any).error) console.error("[garden-parents] generated credentials query failed", (credentialsRes as any).error);
  const credentialsByUser = new Map<string, any[]>();
  for (const credential of ((credentialsRes as any).data ?? []) as any[]) {
    const list = credentialsByUser.get(credential.user_id) ?? [];
    list.push(credential);
    credentialsByUser.set(credential.user_id, list);
  }
  const childrenByParent = new Map<string, any[]>();
  for (const child of (childrenRes.data ?? []) as any[]) {
    const list = childrenByParent.get(child.primary_parent_id) ?? [];
    list.push(child);
    childrenByParent.set(child.primary_parent_id, list);
  }
  const countBy = (rows: any[], key: string) => rows.reduce((map, row) => map.set(row[key], (map.get(row[key]) ?? 0) + 1), new Map<string, number>());
  const complaintsByParent = countBy((complaintsRes.data ?? []) as any[], "parent_id");
  const documentsByParent = countBy((documentsRes.data ?? []) as any[], "parent_id");
  const unreadByProfile = countBy((messagesRes.data ?? []) as any[], "recipient_id");
  const rows = ((parentsRes.data ?? []) as any[]).map((parent) => ({
    ...parent,
    profile_image_url: parent.profiles?.profile_image_url,
    generated_credentials: credentialsByUser.get(parent.profile_id) ?? [],
    children: childrenByParent.get(parent.id) ?? [],
    complaint_count: complaintsByParent.get(parent.id) ?? 0,
    document_count: documentsByParent.get(parent.id) ?? 0,
    unread_messages: unreadByProfile.get(parent.profile_id) ?? 0,
    pickup_allowed: true,
    emergency_status: parent.phone ? "תקין" : "טלפון חסר",
    last_interaction_at: parent.created_at
  }));

  return (
    <DashboardShell role="manager" title="הורים" appHome>
      <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.split(" ")[0] ?? "רונית"}`} subtitle="קשר הורים מסודר" avatarUrl={(profile as any).avatar_url ?? null} active="messages">
        <TeacherPageTitle icon={UsersRound} title="הורים ומשפחות" subtitle="ילדים משויכים, הודעות, מסמכים ופניות בכרטיס קצר" action={<a className="button primary" href="#parents-full">ניהול מלא</a>} />

        <TeacherStatsGrid>
          <TeacherStatCard title="הורים פעילים" value={rows.filter((row) => row.status === "active").length} hint="משויכים" icon={UsersRound} tone="green" />
          <TeacherStatCard title="ילדים משויכים" value={rows.reduce((sum, row) => sum + row.children.length, 0)} hint="בגן" icon={Baby} tone="purple" />
          <TeacherStatCard title="הודעות לא נקראו" value={rows.reduce((sum, row) => sum + Number(row.unread_messages), 0)} hint="דורש מענה" icon={Bell} tone={rows.some((row) => row.unread_messages) ? "orange" : "blue"} />
          <TeacherStatCard title="פניות פתוחות" value={rows.reduce((sum, row) => sum + Number(row.complaint_count), 0)} hint="טיפול" icon={MessageCircle} tone={rows.some((row) => row.complaint_count) ? "red" : "green"} />
        </TeacherStatsGrid>

        <TeacherSection title="הורים אחרונים" action={<a href="#parents-full">לכל ההורים ›</a>}>
          {rows.length ? (
            <TeacherCompactList>
              {rows.slice(0, 7).map((row) => (
                <TeacherCompactItem
                  key={row.id}
                  title={row.full_name ?? "הורה"}
                  subtitle={`${row.children.map((child: any) => child.full_name).join(", ") || "אין ילד משויך"} · ${row.phone ?? "טלפון חסר"}`}
                  tone={row.status === "active" ? "green" : "orange"}
                  avatar={row.profile_image_url}
                  meta={row.unread_messages ? `${row.unread_messages} הודעות` : row.emergency_status}
                />
              ))}
            </TeacherCompactList>
          ) : (
            <TeacherEmptyState title="אין הורים פעילים" text="הורים יופיעו כאן לאחר אישור בקשת הצטרפות או הזמנה." />
          )}
        </TeacherSection>

        <TeacherAiInsight metric={`${rows.length}`}>
          כרטיסי הורים מציגים רק מידע תפעולי לגן. מסמכים ופרטי ילדים רגישים נשארים במסכים המורשים.
        </TeacherAiInsight>

        <TeacherQuickActions title="פעולות הורים">
          <TeacherActionTile title="הודעות" href="/dashboard/garden/messages" icon={MessageCircle} tone="purple" />
          <TeacherActionTile title="בקשות הצטרפות" href="/dashboard/garden/enrollment-requests" icon={UsersRound} tone="blue" />
          <TeacherActionTile title="ילדי הגן" href="/dashboard/garden/children" icon={Baby} tone="green" />
        </TeacherQuickActions>

        <details className="teacher-management-details" id="parents-full">
          <summary>ניהול מלא של הורים</summary>
          <div className="teacher-embedded-module">
            <ParentProfileCards parents={rows} />
          </div>
        </details>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
