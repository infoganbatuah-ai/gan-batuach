"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Baby, Building2, CheckCircle2, LoaderCircle, MapPin, ShieldCheck, XCircle } from "lucide-react";

type Payload = { invitations: any[]; children: any[]; gardens: any[]; fee_groups: any[] };

export function ParentKindergartenInvitationsPanel() {
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [selection, setSelection] = useState<Record<string, { child: string; group: string }>>({});

  async function load() {
    try {
      const response = await fetch("/api/parent/garden-invitations", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "לא ניתן לטעון הזמנות");
      setData(body.data ?? { invitations: [], children: [], gardens: [], fee_groups: [] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "לא ניתן לטעון הזמנות");
    }
  }

  useEffect(() => { void load(); }, []);
  const gardensById = useMemo(() => new Map((data?.gardens ?? []).map((garden) => [garden.id, garden])), [data]);
  if (!data?.invitations?.length) return null;

  async function decide(invitationId: string, action: "accept" | "reject") {
    const selected = selection[invitationId] ?? { child: "", group: "" };
    if (action === "accept" && !selected.child) {
      setMessage("יש לבחור ילד לפני אישור ההצטרפות.");
      return;
    }
    setBusyId(invitationId);
    setMessage("");
    try {
      const response = await fetch("/api/parent/garden-invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitation_id: invitationId, action, child_profile_id: selected.child || undefined, requested_class_id: selected.group || undefined })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "לא ניתן לעדכן את ההזמנה");
      setMessage(action === "accept" ? "ההצטרפות אושרה והילד שויך לגן." : "ההזמנה נדחתה ולא נוצר שיוך.");
      await load();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "לא ניתן לעדכן את ההזמנה");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="parent-invitations-live-panel">
      <div className="section-heading"><div><p className="eyebrow">נדרשת פעולה</p><h2>הזמנות מגני ילדים</h2><p>הגן לא יקבל גישה לכרטיס הילד עד שתבחרו ילד ותאשרו.</p></div><ShieldCheck /></div>
      <div className="parent-invitation-list">
        {data.invitations.map((invitation) => {
          const garden = gardensById.get(invitation.target_id) as any;
          const groups = data.fee_groups.filter((group) => group.garden_id === invitation.target_id);
          const selected = selection[invitation.id] ?? { child: "", group: invitation.metadata?.requested_class_id ?? "" };
          return <article key={invitation.id}>
            <div className="parent-invitation-garden"><span>{garden?.image_url ? <img src={garden.image_url} alt="" /> : <Building2 />}</span><div><h3>{garden?.name ?? "גן ילדים"}</h3><p><MapPin size={16} /> {garden?.city ?? ""} · {garden?.address ?? "כתובת לא פורסמה"}</p><small>{garden?.public_description ?? "פרטי הגן זמינים לפני האישור."}</small></div></div>
            <Link className="button secondary tiny" href={`/gardens/${invitation.target_id}`}>צפייה בפרטי הגן לפני אישור</Link>
            <div className="parent-invitation-fields">
              <label><Baby size={18} /> בחירת ילד<select value={selected.child} onChange={(event) => setSelection((current) => ({ ...current, [invitation.id]: { ...selected, child: event.target.value } }))}><option value="">בחרו כרטיס ילד</option>{data.children.map((child) => <option value={child.id} key={child.id}>{child.full_name}</option>)}</select></label>
              <label>קבוצה ותשלום חודשי<select value={selected.group} onChange={(event) => setSelection((current) => ({ ...current, [invitation.id]: { ...selected, group: event.target.value } }))}><option value="">הגן ישייך קבוצה בהמשך</option>{groups.map((group) => <option value={group.id} key={group.id}>{group.group_name} · {group.show_price_public ? `${Number(group.monthly_fee).toLocaleString("he-IL")} ₪ לחודש` : "מחיר לא פורסם"}</option>)}</select></label>
            </div>
            {data.children.length === 0 ? <p className="warning-banner">עדיין אין כרטיס ילד. צרו כרטיס ילד בהמשך העמוד ורק אחר כך אשרו את ההזמנה.</p> : null}
            <div className="parent-invitation-actions"><button className="button primary" disabled={busyId === invitation.id || !selected.child} onClick={() => void decide(invitation.id, "accept")} type="button">{busyId === invitation.id ? <LoaderCircle className="spin" /> : <CheckCircle2 />} אישור ושיוך הילד</button><button className="button secondary" disabled={busyId === invitation.id} onClick={() => void decide(invitation.id, "reject")} type="button"><XCircle /> דחיית ההזמנה</button></div>
          </article>;
        })}
      </div>
      {message ? <p className={message.includes("אושרה") || message.includes("נדחתה") ? "success-banner" : "error-banner"}>{message}</p> : null}
    </section>
  );
}
