import Link from "next/link";
import { CheckCircle2, MessageSquareText, Rocket, Users } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard } from "@/components/stat-card";
import { AdminDataError } from "@/components/admin-data-state";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { buildLaunchReadinessSummary, readinessTone } from "@/lib/domain/launch-readiness";

export default async function AdminPilotCenterPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("pilot center", async () => {
    const supabase = await createClient();
    const [pilotsRes, participantsRes, feedbackRes, issuesRes, blockersRes, checklistRes] = await Promise.all([
      supabase.from("pilot_programs" as any).select("*, gardens(name, city)").order("created_at", { ascending: false }).limit(100),
      supabase.from("pilot_participants" as any).select("*, profiles(full_name, role), gardens(name)").order("created_at", { ascending: false }).limit(300),
      supabase.from("pilot_feedback" as any).select("id,user_role,category,status,severity,sentiment,rating,comment,page_path,created_at").order("created_at", { ascending: false }).limit(80),
      supabase.from("launch_issues" as any).select("*").order("created_at", { ascending: false }).limit(120),
      supabase.from("launch_blockers" as any).select("*").order("created_at", { ascending: false }).limit(80),
      supabase.from("launch_checklist" as any).select("*").order("category")
    ]);
    [pilotsRes, participantsRes, feedbackRes, issuesRes, blockersRes, checklistRes].forEach((query, index) => logSupabaseError(`pilot center query ${index}`, (query as any).error));
    return {
      pilots: pilotsRes.data ?? [],
      participants: participantsRes.data ?? [],
      feedback: feedbackRes.data ?? [],
      issues: issuesRes.data ?? [],
      blockers: blockersRes.data ?? [],
      checklist: checklistRes.data ?? [],
      summary: buildLaunchReadinessSummary({ pilots: pilotsRes.data ?? [], participants: participantsRes.data ?? [], issues: issuesRes.data ?? [], blockers: blockersRes.data ?? [], checklist: checklistRes.data ?? [] }),
      queryError: [pilotsRes.error, participantsRes.error, feedbackRes.error, issuesRes.error, blockersRes.error, checklistRes.error].some(Boolean) ? "חלק מנתוני הפיילוט לא נטענו" : null
    };
  }, { pilots: [] as any[], participants: [] as any[], feedback: [] as any[], issues: [] as any[], blockers: [] as any[], checklist: [] as any[], summary: buildLaunchReadinessSummary(), queryError: null as string | null });

  const { summary } = result.data;
  const openIssues = result.data.issues.filter((issue: any) => !["verified", "accepted_risk"].includes(String(issue.status))).slice(0, 8);

  return (
    <DashboardShell role="admin" title="Pilot Center">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">Pilot Operations</p>
          <h1>מרכז ניהול פיילוט.</h1>
          <p>מעקב אחרי גני פיילוט, משתתפים, קליטה, תצפיתן, משובים, בעיות וחסמי השקה.</p>
        </div>
        <div className="profile-actions">
          <span className="pill good"><Rocket size={16} /> Pilot ready layer</span>
          <Link className="button secondary" href="/dashboard/admin/launch-readiness">מוכנות השקה</Link>
        </div>
      </div>
      <AdminDataError message={result.error ?? result.data.queryError} />

      <section className="grid cols-4 dashboard-kpis">
        <StatCard label="פיילוטים פעילים" value={summary.activePilots} tone="good" />
        <StatCard label="פיילוטים הושלמו" value={summary.completedPilots} tone="good" />
        <StatCard label="משתתפים פעילים" value={summary.participantsActive} tone="good" />
        <StatCard label="שביעות רצון" value={summary.satisfactionAverage ? `${summary.satisfactionAverage}%` : "-"} tone="good" />
        <StatCard label="בעיות פתוחות" value={summary.openIssues} tone={summary.openIssues ? "warn" : "good"} />
        <StatCard label="Critical" value={summary.criticalIssues} tone={summary.criticalIssues ? "bad" : "good"} />
        <StatCard label="חסמים" value={summary.openBlockers} tone={summary.openBlockers ? "bad" : "good"} />
        <StatCard label="Checklist" value={`${summary.checklistPercent}%`} tone={summary.checklistPercent >= 80 ? "good" : "warn"} />
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2><Users size={20} /> Pilot kindergartens</h2><p>סטטוס פיילוט, קליטה והפעלת תצפיתן.</p></div>
          {result.data.pilots.length === 0 ? <div className="empty-state"><strong>אין גני פיילוט עדיין</strong><span>לאחר שיוך גן לפיילוט, הוא יופיע כאן.</span></div> : <div className="procedure-list compact-list">
            {result.data.pilots.map((pilot: any) => (
              <div className="mini-row" key={pilot.id}>
                <span>{pilot.pilot_name}</span>
                <strong className={readinessTone(pilot.pilot_status)}>{pilot.pilot_status}</strong>
                <small>{pilot.gardens?.name ?? "ללא גן"} · קליטה {pilot.onboarding_status} · תצפיתן {pilot.observer_status}</small>
              </div>
            ))}
          </div>}
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><Users size={20} /> Participants</h2><p>מנהלות, הורים, צוות ומפקחים בפיילוט.</p></div>
          {result.data.participants.length === 0 ? <div className="empty-state"><strong>אין משתתפים עדיין</strong><span>סטטוס מוזמנים ופעילים יופיע כאן.</span></div> : <div className="procedure-list compact-list">
            {result.data.participants.slice(0, 12).map((participant: any) => (
              <div className="mini-row" key={participant.id}>
                <span>{participant.profiles?.full_name ?? participant.participant_role}</span>
                <strong className={readinessTone(participant.participant_status)}>{participant.participant_status}</strong>
                <small>{participant.participant_role} · {participant.gardens?.name ?? "ללא גן"}</small>
              </div>
            ))}
          </div>}
        </article>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2><MessageSquareText size={20} /> Latest feedback</h2><p>משובים אחרונים ממשתמשי הפיילוט.</p></div>
          {result.data.feedback.length === 0 ? <div className="empty-state"><strong>אין משוב עדיין</strong><span>משוב מהדשבורדים יופיע כאן.</span></div> : <div className="procedure-list compact-list">
            {result.data.feedback.slice(0, 10).map((item: any) => (
              <div className="mini-row" key={item.id}>
                <span>{item.user_role} · {item.category}</span>
                <strong className={readinessTone(item.status)}>{item.status}</strong>
                <small>{item.comment || item.sentiment || "משוב קצר"}</small>
              </div>
            ))}
          </div>}
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><CheckCircle2 size={20} /> Open issues</h2><p>בעיות שצריך לפתור או לאשר לפני הרחבת הפיילוט.</p></div>
          {openIssues.length === 0 ? <div className="empty-state"><strong>אין בעיות פתוחות</strong><span>מעולה. חסמי השקה יופיעו במסך מוכנות השקה.</span></div> : <div className="procedure-list compact-list">
            {openIssues.map((issue: any) => (
              <div className="mini-row" key={issue.id}>
                <span>{issue.title}</span>
                <strong className={issue.severity === "critical" || issue.severity === "high" ? "pill bad" : "pill warn"}>{issue.severity}</strong>
                <small>{issue.status} · {issue.impact ?? ""}</small>
              </div>
            ))}
          </div>}
        </article>
      </section>
    </DashboardShell>
  );
}
