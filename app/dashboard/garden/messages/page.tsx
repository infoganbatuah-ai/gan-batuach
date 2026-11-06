import { MessageCircle, MessageSquareText, Send, UserRound } from "lucide-react";
import { AdminDataError } from "@/components/admin-data-state";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
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

type MessageCenterProps = Parameters<typeof InternalMessagingCenter>[0];
type RecipientRow = { profiles?: MessageCenterProps["recipients"][number] | null };
type LinkedChild = { id: string; parents?: { profile_id?: string | null } | null };
type GardenMessage = { id: string; status?: string | null; sender?: { full_name?: string | null } | null; body?: string | null; content?: string | null };
type ParentRequest = { id: string; child_id: string; status?: string | null; request_type?: string | null; content?: string | null; children?: { full_name?: string | null } | null; parents?: { full_name?: string | null } | null; created_at?: string | null; recipient_label?: string | null; response_text?: string | null };
async function messageQuery(label: string, query: () => PromiseLike<{ data: unknown; error: unknown }>) {
  try {
    const result = await query();
    logSupabaseError(label, result.error);
    return result.error ? { data: null, error: true } : { data: result.data, error: false };
  } catch {
    logSupabaseError(label, true);
    return { data: null, error: true };
  }
}

export default async function GardenMessagesPage({ searchParams }: { searchParams: Promise<{ childId?: string; status?: string; compose?: string }> }) {
  const { profile } = await requireRole(["manager", "owner"]);
  const { childId, status, compose } = await searchParams;
  const avatarUrl = (profile as any).profile_image_url ?? null;
  if (!profile.id || !profile.garden_id) {
    return <DashboardShell role="manager" title="הודעות" appHome><TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`} subtitle="הודעות ותקשורת גננת" avatarUrl={avatarUrl} active="messages"><AdminDataError message="לא ניתן לטעון הודעות ללא פרופיל ושיוך לגן" /></TeacherAppFrame></DashboardShell>;
  }
  const gardenId = profile.garden_id ?? "";
  const result = await safeAdminData("garden messages", async () => {
    const supabase = await createClient();
    const [parentsRes, staffRes, childrenRes, messagesRes, parentRequestsRes] = await Promise.all([
      messageQuery("garden messages parents", () => supabase.from("parents" as any).select("profiles:profile_id(id, full_name, email, role, profile_image_url)").eq("garden_id", gardenId)),
      messageQuery("garden messages staff", () => supabase.from("staff" as any).select("profiles:profile_id(id, full_name, email, role, profile_image_url)").eq("garden_id", gardenId)),
      messageQuery("garden messages children", () => supabase.from("children" as any).select("id, full_name, primary_parent_id, parents:primary_parent_id(profile_id)").eq("garden_id", gardenId).order("full_name")),
      messageQuery("garden messages conversations", () => supabase.from("messages" as any).select("*, sender:sender_id(full_name, profile_image_url), recipient:recipient_id(full_name, profile_image_url)").eq("garden_id", gardenId).or(`sender_id.eq.${profile.id},recipient_id.eq.${profile.id}`).order("created_at", { ascending: false }).limit(80)),
      messageQuery("garden messages requests", () => supabase.from("parent_child_requests" as any).select("id, child_id, parent_profile_id, request_type, content, recipient_label, status, response_text, created_at, children(full_name), parents:parent_id(full_name, phone)").eq("garden_id", gardenId).order("created_at", { ascending: false }).limit(80))
    ]);
    const available = [!parentsRes.error, !staffRes.error, !childrenRes.error, !messagesRes.error, !parentRequestsRes.error];
    return { parents: (parentsRes.data ?? []) as RecipientRow[], staff: (staffRes.data ?? []) as RecipientRow[], linkedChildren: (childrenRes.data ?? []) as LinkedChild[], messages: (messagesRes.data ?? []) as GardenMessage[], parentRequests: (parentRequestsRes.data ?? []) as ParentRequest[], available, queryError: available.some((value) => !value) ? "חלק מנתוני ההודעות לא נטענו" : null };
  }, { parents: [] as RecipientRow[], staff: [] as RecipientRow[], linkedChildren: [] as LinkedChild[], messages: [] as GardenMessage[], parentRequests: [] as ParentRequest[], available: [false, false, false, false, false], queryError: null as string | null });
  const { parents, staff, linkedChildren, available } = result.data;
  const recipientsAvailable = available[0] && available[1];
  const workbenchAvailable = recipientsAvailable && available[2] && available[3];
  // Inspector and Admin roles never appear in the operational messaging picker.
  // Complaints and privileged support use their own audited workflows.
  const recipients = [...parents.map((row) => row.profiles).filter(Boolean), ...staff.map((row) => row.profiles).filter(Boolean)];
  const messages = result.data.messages.filter((message) => {
    if (status === "open") return !["closed", "handled", "archived", "read"].includes(message.status as string);
    return true;
  });
  const parentRequests = result.data.parentRequests.filter((request) => {
    if (status === "open") return ["new", "viewed", "in_progress"].includes(String(request.status));
    return true;
  });
  const preselectedChild = linkedChildren.find((child) => child.id === childId);
  const preselectedRecipientId = preselectedChild?.parents?.profile_id;
  return (
    <DashboardShell role="manager" title="הודעות" appHome>
      <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`} subtitle="הודעות ותקשורת גננת" avatarUrl={avatarUrl} active="messages">
      <TeacherPageTitle icon={MessageSquareText} title="הודעות ותקשורת" subtitle="הורים וצוות בהקשר הגן בלבד" />
      <AdminDataError message={result.error ?? result.data.queryError} />
      <TeacherStatsGrid>
        <TeacherStatCard title="הודעות" value={available[3] ? messages.length : "לא זמין"} hint="אחרונות" icon={MessageCircle} tone={available[3] ? "blue" : "neutral"} />
        <TeacherStatCard title="פניות הורים" value={available[4] ? parentRequests.length : "לא זמין"} hint="לטיפול" icon={UserRound} tone={!available[4] ? "neutral" : parentRequests.length ? "orange" : "green"} />
        <TeacherStatCard title="נמענים" value={recipientsAvailable ? recipients.length : "לא זמין"} hint="זמינים" icon={Send} tone={recipientsAvailable ? "purple" : "neutral"} />
        <TeacherStatCard title="ילדים מקושרים" value={available[2] ? linkedChildren.length : "לא זמין"} hint="לשיחה" icon={UserRound} tone={available[2] ? "green" : "neutral"} />
      </TeacherStatsGrid>
      {available[3] && available[4] ? <DashboardFilterChip label={status === "open" ? "הודעות / פניות פתוחות" : null} clearHref="/dashboard/garden/messages" isEmpty={messages.length === 0 && parentRequests.length === 0} emptyTitle="אין כרגע הודעות פתוחות" emptyText="כל ההודעות והפניות במסנן הזה טופלו או נקראו." /> : <TeacherEmptyState title="נתוני הסינון לא זמינים" text="לא ניתן להסיק שכל ההודעות והפניות טופלו לפני טעינת הנתונים." />}

      <section className="teacher-dashboard-grid">
        <TeacherSection title="פניות אחרונות" action={<a href="/dashboard/garden/messages?status=open">פתוחות</a>}>
          {!available[4] ? <TeacherEmptyState title="הפניות לא זמינות" text="לא ניתן לטעון פניות הורים כרגע." /> : parentRequests.length ? (
            <TeacherCompactList>
              {parentRequests.slice(0, 6).map((request) => (
                <TeacherCompactItem key={request.id} title={`${request.request_type ?? "פנייה"} · ${request.children?.full_name ?? "ילד/ה"}`} subtitle={request.content ?? "אין תוכן"} tone={["new", "viewed", "in_progress"].includes(String(request.status)) ? "orange" : "green"} meta={request.status ?? "חדש"} />
              ))}
            </TeacherCompactList>
          ) : <TeacherEmptyState title="אין פניות פתוחות" text="כאשר הורה ישלח בקשה לגן, היא תופיע כאן." />}
        </TeacherSection>
        <TeacherSection title="שיחות אחרונות">
          {!available[3] ? <TeacherEmptyState title="השיחות לא זמינות" text="לא ניתן לטעון הודעות כרגע." /> : messages.length ? (
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

      <section id="message-workbench">
        {workbenchAvailable ? <InternalMessagingCenter gardenId={gardenId} currentProfileId={profile.id} recipients={recipients as MessageCenterProps["recipients"]} linkedChildren={linkedChildren as MessageCenterProps["linkedChildren"]} messages={messages as MessageCenterProps["messages"]} preselectedChildId={childId} preselectedRecipientId={preselectedRecipientId as MessageCenterProps["preselectedRecipientId"]} defaultOpen={compose === "1"} /> : <TeacherEmptyState title="עורך ההודעות לא זמין" text="נדרשים נתוני נמענים, ילדים והודעות מלאים לפני ניהול ושליחה." />}
      </section>
      <details className="teacher-management-details">
        <summary>פניות הורים רשמיות</summary>
      <section className="dashboard-section">
        <div className="section-heading"><h2>פניות הורים לטיפול</h2><p>פניות שנשלחו דרך מסך ההורה עם נמען ותיעוד סטטוס. תגובה כאן תופיע להורה.</p></div>
        {!available[4] ? <TeacherEmptyState title="פניות ההורים לא זמינות" text="לא ניתן להציג תוכן או פעולות לפני טעינת הפניות." /> : parentRequests.length === 0 ? <div className="empty-state"><strong>אין פניות הורים פתוחות</strong><span>כאשר הורה ישלח בקשה לגן, היא תופיע כאן עם הילד, סוג הפנייה וסטטוס טיפול.</span></div> : <div className="procedure-list">{parentRequests.map((request) => <article className="card procedure-card" key={request.id}><div><span className={request.status === "handled" ? "pill good" : request.status === "rejected" ? "pill bad" : "pill warn"}>{request.status ?? "new"}</span><h3>{request.request_type ?? "פניית הורה"} · {request.children?.full_name ?? "ילד/ה"}</h3><p>{request.content}</p><small>{request.parents?.full_name ?? "הורה"} · {request.created_at ? new Date(request.created_at).toLocaleString("he-IL") : ""} · נמען: {request.recipient_label ?? "מנהלת הגן"}</small>{request.response_text ? <p className="success-banner">תגובה שנשלחה: {request.response_text}</p> : null}</div><ParentRequestActions childId={request.child_id} requestId={request.id} /></article>)}</div>}
      </section>
      </details>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
