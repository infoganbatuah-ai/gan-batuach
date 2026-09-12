"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { StaffEmployment } from "@/lib/management/staff-employment-context";

export function StaffGardenSelector({ employments, activeGardenId }: { employments: StaffEmployment[]; activeGardenId: string | null }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  if (employments.length < 2) return null;
  return <div className="card" style={{ marginBlockEnd: "1rem", padding: "0.75rem 1rem" }}>
    <label htmlFor="staff-active-garden">גן עבודה פעיל</label>{" "}
    <select id="staff-active-garden" value={activeGardenId ?? ""} disabled={pending} onChange={async event => {
      setPending(true); setError("");
      try {
        const response = await fetch("/api/staff/employment-context", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ garden_id: event.target.value }) });
        if (!response.ok) throw new Error("לא ניתן לבחור את הגן. בדקו שההעסקה עדיין פעילה.");
        router.refresh();
      } catch (cause) { setError(cause instanceof Error ? cause.message : "בחירת הגן נכשלה."); }
      finally { setPending(false); }
    }}>
      {employments.map(item => <option key={item.employment_id} value={item.garden_id}>{item.garden_name} · {item.role_title ?? "צוות"}</option>)}
    </select>
    {error && <small role="alert">{error}</small>}
  </div>;
}
