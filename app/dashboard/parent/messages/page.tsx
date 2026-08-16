import { MessageCircleHeart } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { ParentAppFrame, ParentEmptyState, ParentHero, ParentSection } from "@/components/parent-app-ui";
import { ParentChildRequestForm } from "@/components/parent-child-request-form";
import { requireRole } from "@/lib/auth";
import { getParentFamilyContext } from "@/lib/domain/parent-family";
import { createClient } from "@/lib/supabase/server";

function statusText(status?: string | null) {
  if (status === "handled") return "טופל";
  if (status === "in_progress") return "בטיפול";
  if (status === "viewed") return "נקרא";
  if (status === "rejected") return "נדחה";
  return "נשלח";
}

export default async function ParentMessagesPage() {
  const { profile } = await requireRole(["parent"]);
  const supabase = await createClient();
  const family = await getParentFamilyContext(supabase as any, profile);
  const childrenById = new Map<string, any>();
  for (const child of family.children as any[]) childrenById.set(child.id, child);
  for (const enrollment of family.enrollments as any[]) {
    const childId = enrollment.child_id ?? enrollment.permanent_child_file_id;
    if (!childId || childrenById.has(childId)) continue;
    childrenById.set(childId, {
      id: childId,
      full_name: enrollment.full_name,
      garden_id: enrollment.garden_id ?? enrollment.kindergarten_id,
      kindergarten_id: enrollment.garden_id ?? enrollment.kindergarten_id,
      status: enrollment.status,
      photo_url: enrollment.photo_url
    });
  }
  const childOptions = Array.from(childrenById.values()).map((child) => ({
    ...child,
    garden_name: (family.gardens as any[]).find((garden) => garden.id === (child.garden_id ?? child.kindergarten_id))?.name
  }));
  const childIds = childOptions.map((child) => child.id).filter(Boolean);
  const requestFilters = [
    `parent_profile_id.eq.${profile.id}`,
    childIds.length ? `child_id.in.(${childIds.join(",")})` : ""
  ].filter(Boolean);
  const requestsRes = requestFilters.length
    ? await supabase
      .from("parent_child_requests" as any)
      .select("id, child_id, request_type, content, recipient_label, recipient_role, status, response_text, created_at, handled_at")
      .or(requestFilters.join(","))
      .order("created_at", { ascending: false })
      .limit(80)
    : { data: [], error: null };
  if (requestsRes.error) console.error("[parent-messages] requests query failed", { profile_id: profile.id, error: requestsRes.error.message });

  return (
    <DashboardShell role="parent" title="פנייה לגן" appHome>
      <ParentAppFrame active="alerts" profileName={profile.full_name} avatarUrl={(profile as any).profile_image_url ?? null}>
        <ParentHero title="הודעות ותקשורת" subtitle="שיחה עם הגן, בקשות ועדכונים במקום אחד" />

      <section className="parent-message-layout">
        <ParentSection title="פנייה חדשה" subtitle="כותבים קצר, בוחרים נושא, ורואים מתי הפנייה נקראה וטופלה." action={<span className="pill good"><MessageCircleHeart size={15} /> ערוץ מאובטח</span>}>
          <ParentChildRequestForm children={childOptions} />
        </ParentSection>
        <ParentSection title="השיחות שלי" subtitle="תשובות מהגן וסטטוס טיפול במקום אחד." className="parent-chat-card">
          {(requestsRes.data ?? []).length === 0 ? (
            <ParentEmptyState title="אין פניות פתוחות כרגע" text="כשתשלחו פנייה לגן, היא תופיע כאן עם סטטוס קריאה וטיפול." />
          ) : (
            <div className="message-thread-list">
              {(requestsRes.data ?? []).map((request: any) => (
                <div className="message-thread parent-message-bubble" key={request.id}>
                  <div>
                    <strong>{request.request_type}</strong>
                    <p>{request.content}</p>
                    {request.response_text ? <p className="success-banner">תשובת הגן: {request.response_text}</p> : null}
                    <small>{request.created_at ? new Date(request.created_at).toLocaleString("he-IL") : ""} · נמען: {request.recipient_label ?? request.recipient_role ?? "מנהלת הגן"}</small>
                  </div>
                  <span className={request.status === "handled" ? "pill good" : request.status === "rejected" ? "pill bad" : "pill warn"}>{statusText(request.status)}</span>
                </div>
              ))}
            </div>
          )}
        </ParentSection>
      </section>
      </ParentAppFrame>
    </DashboardShell>
  );
}
