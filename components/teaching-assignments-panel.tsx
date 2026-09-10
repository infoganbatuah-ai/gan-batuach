"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, UserRoundCheck } from "lucide-react";

type Assignment = { id: string; profile_id: string; staff_id: string | null; assignment_kind: string; title: string; status: string };
type StaffMember = { id: string; profile_id: string | null; full_name: string | null; approved_to_work: boolean; onboarding_status?: string | null };

export function TeachingAssignmentsPanel({ ownerEligible, ownerAssignment, assignments, staff }: {
  ownerEligible: boolean;
  ownerAssignment: Assignment | null;
  assignments: Assignment[];
  staff: StaffMember[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function mutate(key: string, body: Record<string, string>) {
    setPending(key);
    setMessage(null);
    try {
      const response = await fetch("/api/garden/teaching-assignments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "הפעולה נכשלה");
      setMessage("הקצאת ההוראה עודכנה.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "הפעולה נכשלה");
    } finally {
      setPending(null);
    }
  }

  const byStaff = new Map(assignments.filter(item => item.assignment_kind === "delegated_teacher").map(item => [item.staff_id, item]));
  return (
    <section className="dashboard-section teaching-assignments-panel">
      <div className="section-heading"><h2><GraduationCap size={20} /> הקצאות הוראה</h2><p>הרשאת עבודה חינוכית לילדים, נוכחות, יומן ותקשורת. ההקצאה אינה מעניקה הרשאות ניהול גן.</p></div>
      {ownerEligible && <div className="profile-actions"><strong>בעלים שהוא גם גננת</strong>{ownerAssignment?.status === "active"
        ? <button className="button secondary tiny" disabled={pending === ownerAssignment.id} onClick={() => mutate(ownerAssignment.id, { action: "suspend", assignment_id: ownerAssignment.id })}>השהיית תפקיד ההוראה</button>
        : ownerAssignment
          ? <button className="button tiny" disabled={pending === ownerAssignment.id} onClick={() => mutate(ownerAssignment.id, { action: "reactivate", assignment_id: ownerAssignment.id })}>הפעלת תפקיד ההוראה</button>
          : <button className="button tiny" disabled={pending === "owner"} onClick={() => mutate("owner", { action: "activate_owner_teacher" })}>הפעלה כגננת</button>}
      </div>}
      <div className="teacher-compact-list">
        {staff.map(member => {
          const assignment = byStaff.get(member.id);
          const eligible = member.approved_to_work && member.onboarding_status === "active" && Boolean(member.profile_id);
          return <div className="teacher-compact-item" key={member.id}>
            <UserRoundCheck size={18} />
            <div><strong>{member.full_name || "איש צוות"}</strong><span>{assignment?.status === "active" ? assignment.title : eligible ? "זמין/ה להאצלת הוראה" : "נדרש אישור צוות פעיל"}</span></div>
            {assignment?.status === "active"
              ? <button className="button secondary tiny" disabled={pending === assignment.id} onClick={() => mutate(assignment.id, { action: "suspend", assignment_id: assignment.id })}>השהיה</button>
              : assignment
                ? <button className="button tiny" disabled={!eligible || pending === assignment.id} onClick={() => mutate(assignment.id, { action: "reactivate", assignment_id: assignment.id })}>הפעלה מחדש</button>
                : <button className="button tiny" disabled={!eligible || pending === member.id} onClick={() => mutate(member.id, { action: "delegate_teacher", staff_id: member.id, title: "גננת מואצלת" })}>האצלת הוראה</button>}
          </div>;
        })}
      </div>
      {message && <p role="status" aria-live="polite">{message}</p>}
    </section>
  );
}
