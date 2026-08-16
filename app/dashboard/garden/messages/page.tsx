import { MessageCircle, MessageSquareText, Send, UserRound } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { DashboardFilterChip } from "@/components/dashboard-filter-chip";
import { InternalMessagingCenter } from "@/components/internal-messaging-center";
import { ParentRequestActions } from "@/components/parent-request-actions";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
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

export default async function GardenMessagesPage({ searchParams }: { searchParams: Promise<{ childId?: string; status?: string; compose?: string }> }) {
  const { profile } = await requireRole(["manager", "owner"]);
  const { childId, status, compose } = await searchParams;
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const [parentsRes, staffRes, inspectorsRes, childrenRes, messagesRes, parentRequestsRes] = await Promise.all([
    supabase.from("parents" as any).select("profiles:profile_id(id, full_name, email, role, profile_image_url)").eq("garden_id", gardenId),
    supabase.from("staff" as any).select("profiles:profile_id(id, full_name, email, role, profile_image_url)").eq("garden_id", gardenId),
    supabase.from("profiles" as any).select("id, full_name, email, role, profile_image_url").in("role", ["admin", "inspector"]).limit(50),
    supabase.from("children" as any).select("id, full_name, primary_parent_id, parents:primary_parent_id(profile_id)").eq("garden_id", gardenId).order("full_name"),
    supabase.from("messages" as any).select("*, sender:sender_id(full_name, profile_image_url), recipient:recipient_id(full_name, profile_image_url)").eq("garden_id", gardenId).or(`sender_id.eq.${profile.id},recipient_id.eq.${profile.id}`).order("created_at", { ascending: false }).limit(80),
    supabase.from("parent_child_requests" as any).select("id, child_id, parent_profile_id, request_type, content, recipient_label, status, response_text, created_at, children(full_name), parents:parent_id(full_name, phone)").eq("garden_id", gardenId).order("created_at", { ascending: false }).limit(80)
  ]);
  const recipients = [...(parentsRes.data ?? []).map((row: any) => row.profiles).filter(Boolean), ...(staffRes.data ?? []).map((row: any) => row.profiles).filter(Boolean), ...(inspectorsRes.data ?? [])];
  const messages = ((messagesRes.data ?? []) as any[]).filter((message) => {
    if (status === "open") return !["closed", "handled", "archived", "read"].includes(message.status);
    return true;
  });
  const parentRequests = ((parentRequestsRes.data ?? []) as any[]).filter((request) => {
    if (status === "open") return ["new", "viewed", "in_progress"].includes(String(request.status));
    return true;
  });
  const preselectedChild = ((childrenRes.data ?? []) as any[]).find((child) => child.id === childId);
  const preselectedRecipientId = preselectedChild?.parents?.profile_id;
  return (
    <DashboardShell role="manager" title="הודעות" appHome>
      <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`} subtitle="הודעות ותקשורת גננת" avatarUrl={(profile as any).profile_image_url ?? null} active="messages">
      <TeacherPageTitle icon={MessageSquareText} title="הודעות ותקשורת" subtitle="הורים, צוות, פיקוח ואדמין במקום אחד" />
      <TeacherStatsGrid>
        <TeacherStatCard title="הודעות" value={messages.length} hint="אחרונות" icon={MessageCircle} tone="blue" />
        <TeacherStatCard title="פניות הורים" value={parentRequests.length} hint="לטיפול" icon={UserRound} tone={parentRequests.length ? "orange" : "green"} />
        <TeacherStatCard title="נמענים" value={recipients.length} hint="זמינים" icon={Send} tone="purple" />
        <TeacherStatCard title="ילדים מקושרים" value={(childrenRes.data ?? []).length} hint="לשיחה" icon={UserRound} tone="green" />
      </TeacherStatsGrid>
      <DashboardFilterChip label={status === "open" ? "הודעות / פניות פתוחות" : null} clearHref="/dashboard/garden/messages" isEmpty={messages.length === 0 && parentRequests.length === 0} emptyTitle="אין כרגע הודעות פתוחות" emptyText="כל ההודעות והפניות במסנן הזה טופלו או נקראו." />

      <section className="teacher-dashboard-grid">
        <TeacherSection title="פניות אחרונות" action={<a href="/dashboard/garden/messages?status=open">פתוחות</a>}>
          {parentRequests.length ? (
            <TeacherCompactList>
              {parentRequests.slice(0, 6).map((request) => (
                <TeacherCompactItem key={request.id} title={`${request.request_type ?? "פנייה"} · ${request.children?.full_name ?? "ילד/ה"}`} subtitle={request.content ?? "אין תוכן"} tone={["new", "viewed", "in_progress"].includes(String(request.status)) ? "orange" : "green"} meta={request.status ?? "חדש"} />
              ))}
            </TeacherCompactList>
          ) : <TeacherEmptyState title="אין פניות פתוחות" text="כאשר הורה ישלח בקשה לגן, היא תופיע כאן." />}
        </TeacherSection>
        <TeacherSection title="שיחות אחרונות">
          {messages.length ? (
            <TeacherCompactList>
              {messages.slice(0, 6).map((message) => (
                <TeacherCompactItem key={message.id} title={message.sender?.full_name ?? "הודעה"} subtitle={message.body ?? message.content ?? "הודעה"} tone="blue" meta={message.status ?? "נשלח"} />
              ))}
            </TeacherCompactList>
          ) : <TeacherEmptyState title="אין הודעות להצגה" text="שלחי הודעה מהירה להורה או לצוות." />}
        </TeacherSection>
      <TeacherQuickActions title="פעולות תקשורת">
          <TeacherActionTile title="שליחת הודעה" href="/dashboard/garden/messages?compose=1#message-workbench" icon={Send} tone="purple" />
          <TeacherActionTile title="פניות פתוחות" href="/dashboard/garden/messages?status=open" icon={MessageCircle} tone="orange" />
        </TeacherQuickActions>
      </section>

      <details className="teacher-management-details" id="message-workbench" open={compose === "1" || Boolean(childId)}>
        <summary>ניהול מלא של הודעות</summary>
      <section className="dashboard-section">
        <div className="section-heading"><h2>פניות הורים לטיפול</h2><p>פניות שנשלחו דרך מסך ההורה עם נמען ותיעוד סטטוס. תגובה כאן תופיע להורה.</p></div>
        {parentRequests.length === 0 ? <div className="empty-state"><strong>אין פניות הורים פתוחות</strong><span>כאשר הורה ישלח בקשה לגן, היא תופיע כאן עם הילד, סוג הפנייה וסטטוס טיפול.</span></div> : <div className="procedure-list">{parentRequests.map((request) => <article className="card procedure-card" key={request.id}><div><span className={request.status === "handled" ? "pill good" : request.status === "rejected" ? "pill bad" : "pill warn"}>{request.status ?? "new"}</span><h3>{request.request_type ?? "פניית הורה"} · {request.children?.full_name ?? "ילד/ה"}</h3><p>{request.content}</p><small>{request.parents?.full_name ?? "הורה"} · {request.created_at ? new Date(request.created_at).toLocaleString("he-IL") : ""} · נמען: {request.recipient_label ?? "מנהלת הגן"}</small>{request.response_text ? <p className="success-banner">תגובה שנשלחה: {request.response_text}</p> : null}</div><ParentRequestActions childId={request.child_id} requestId={request.id} /></article>)}</div>}
      </section>
      <InternalMessagingCenter gardenId={gardenId} recipients={recipients} linkedChildren={(childrenRes.data ?? []) as any[]} messages={messages} preselectedChildId={childId} preselectedRecipientId={preselectedRecipientId} defaultOpen={compose === "1"} />
      </details>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
