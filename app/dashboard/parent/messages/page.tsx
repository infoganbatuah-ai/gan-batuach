import { MessageCircleHeart } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
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
  const childOptions = (family.children as any[]).map((child) => ({
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
    <DashboardShell role="parent" title="פנייה לגן">
      <div className="dashboard-hero-card parent-hero-card">
        <div>
          <p className="eyebrow">פניות הורים</p>
          <h1>פנייה מתועדת לגן.</h1>
          <p>בחרו ילד, סוג פנייה ונמען. הפנייה תישלח רק למי שרלוונטי לגן של הילד, ותוכלו לעקוב אחרי הסטטוס כאן.</p>
        </div>
        <span className="pill good"><MessageCircleHeart size={15} /> ערוץ מאובטח</span>
      </div>

      <section className="grid cols-2 dashboard-panels">
        <ParentChildRequestForm children={childOptions} />
        <article className="card action-panel">
          <div className="section-heading">
            <h2>הפניות שלי</h2>
            <p>סטטוס טיפול ותשובות מהגן יופיעו כאן.</p>
          </div>
          {(requestsRes.data ?? []).length === 0 ? (
            <div className="empty-state">
              <strong>אין פניות פתוחות כרגע</strong>
              <span>כשתשלחו פנייה לגן, היא תופיע כאן עם סטטוס קריאה וטיפול.</span>
            </div>
          ) : (
            <div className="message-thread-list">
              {(requestsRes.data ?? []).map((request: any) => (
                <div className="message-thread" key={request.id}>
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
        </article>
      </section>
    </DashboardShell>
  );
}
