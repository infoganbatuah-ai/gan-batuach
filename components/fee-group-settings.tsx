"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Settings2 } from "lucide-react";
import { CollapsibleActionPanel } from "@/components/collapsible-action-panel";

type FeeGroup = {
  id?: string;
  group_name?: string;
  age_range?: string | null;
  monthly_fee?: number | string | null;
  capacity?: number | string | null;
  show_price_public?: boolean;
  market_average_fee?: number | string | null;
  active?: boolean;
};

const defaultGroups = ["לידה עד 3", "גילאי 3-4", "גילאי 4-5", "קבוצה מעורבת"];

export function FeeGroupSettings({ groups, childCount }: { groups: FeeGroup[]; childCount: number }) {
  const router = useRouter();
  const first = groups[0] ?? {};
  const [selectedId, setSelectedId] = useState(first.id ?? "");
  const selected = groups.find((group) => group.id === selectedId) ?? {};
  const [groupName, setGroupName] = useState(selected.group_name ?? (childCount ? "ברירת מחדל לגן" : defaultGroups[0]));
  const [ageRange, setAgeRange] = useState(selected.age_range ?? "");
  const [monthlyFee, setMonthlyFee] = useState(String(selected.monthly_fee ?? ""));
  const [capacity, setCapacity] = useState(String(selected.capacity ?? ""));
  const [showPricePublic, setShowPricePublic] = useState(Boolean(selected.show_price_public));
  const [active, setActive] = useState(selected.active ?? true);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function selectGroup(id: string) {
    const group = groups.find((item) => item.id === id);
    setSelectedId(id);
    setGroupName(group?.group_name ?? "");
    setAgeRange(group?.age_range ?? "");
    setMonthlyFee(String(group?.monthly_fee ?? ""));
    setCapacity(String(group?.capacity ?? ""));
    setShowPricePublic(Boolean(group?.show_price_public));
    setActive(group?.active ?? true);
    setUpdateExisting(false);
    setMessage(null);
  }

  function startNew(name = "") {
    setSelectedId("");
    setGroupName(name);
    setAgeRange("");
    setMonthlyFee("");
    setCapacity("");
    setShowPricePublic(false);
    setActive(true);
    setUpdateExisting(false);
    setMessage(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/garden/fee-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedId || undefined,
          group_name: groupName,
          age_range: ageRange,
          monthly_fee: Number(monthlyFee || 0),
          capacity: capacity ? Number(capacity) : null,
          show_price_public: showPricePublic,
          active,
          update_existing_children: updateExisting
        })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "השמירה נכשלה");
      setMessage(updateExisting ? "ההגדרה נשמרה ועודכנה לילדים בקבוצה." : "ההגדרה נשמרה. היא תחול על ילדים חדשים או על ילדים שתקשרו לקבוצה.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "השמירה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="dashboard-section fee-settings-section">
      <div className="section-heading">
        <h2><Settings2 size={20} /> הגדרת תשלום חודשי לפי קבוצת גיל</h2>
        <p>הגדירו מחיר ברירת מחדל לפי כיתה או קבוצת גיל. ילד יקבל את מחיר הקבוצה, אלא אם הוגדר לו הסדר מיוחד.</p>
      </div>
      <div className="grid cols-2 dashboard-panels">
        <article className="card fee-group-list">
          <div className="profile-actions">
            {groups.map((group) => (
              <button className={group.id === selectedId ? "button primary tiny" : "button secondary tiny"} type="button" key={group.id} onClick={() => selectGroup(group.id ?? "")}>
                {group.group_name} · ₪{Number(group.monthly_fee ?? 0).toLocaleString("he-IL")}
              </button>
            ))}
            <button className="button tiny" type="button" onClick={() => startNew(groups.length ? "" : "ברירת מחדל לגן")}>קבוצה חדשה</button>
          </div>
          <div className="quick-history-cards">
            {defaultGroups.map((name) => <button className="soft-choice" type="button" key={name} onClick={() => startNew(name)}>{name}</button>)}
          </div>
        </article>
      </div>
      <CollapsibleActionPanel
        title={groups.length ? "הוספת / עריכת קבוצת תשלום" : "הגדרת קבוצת התשלום הראשונה"}
        description={groups.length ? "הקבוצות הקיימות מופיעות למעלה. פתחו את הטופס רק כשצריך לשנות מחיר או להוסיף קבוצה." : "עדיין אין קבוצות תשלום, לכן כדאי להגדיר אחת כדי שהילדים יקבלו מחיר ברירת מחדל."}
        buttonLabel={groups.length ? "הוספת קבוצת גיל" : "הגדרת קבוצה ראשונה"}
        defaultOpen={groups.length === 0}
      >
        {({ close }) => <form className="card fee-group-form" onSubmit={submit}>
          <label>שם קבוצה / כיתה<input value={groupName} onChange={(event) => setGroupName(event.target.value)} required placeholder="לדוגמה: גילאי 3-4" /></label>
          <label>טווח גילאים<input value={ageRange} onChange={(event) => setAgeRange(event.target.value)} placeholder="לדוגמה: 3 עד 4" /></label>
          <label>תשלום חודשי<input value={monthlyFee} onChange={(event) => setMonthlyFee(event.target.value)} type="number" min="0" required placeholder="₪" /></label>
          <label>קיבולת בקבוצה<input value={capacity} onChange={(event) => setCapacity(event.target.value)} type="number" min="0" placeholder="מספר ילדים" /></label>
          <label className="check-row"><input checked={showPricePublic} onChange={(event) => setShowPricePublic(event.target.checked)} type="checkbox" /> להציג מחיר בכרטיס הציבורי</label>
          {selected.market_average_fee ? <div className="gateway-setup-state"><strong>המלצת מחיר חכמה</strong><p>ממוצע שוק לקבוצה דומה: ₪{Number(selected.market_average_fee).toLocaleString("he-IL")}. המחיר שלך {Number(monthlyFee || 0) > Number(selected.market_average_fee) ? `גבוה ב-${Math.round(((Number(monthlyFee || 0) - Number(selected.market_average_fee)) / Number(selected.market_average_fee)) * 100)}% מהממוצע` : Number(monthlyFee || 0) < Number(selected.market_average_fee) ? `נמוך ב-${Math.round(((Number(selected.market_average_fee) - Number(monthlyFee || 0)) / Number(selected.market_average_fee)) * 100)}% מהממוצע` : "שווה לממוצע"}.</p></div> : <div className="gateway-setup-state"><strong>המלצת מחיר חכמה</strong><p>אין עדיין מספיק נתונים מצטברים לקבוצת גיל זו. המערכת תציג ממוצע כשהצטברו גנים דומים.</p></div>}
          <label className="check-row"><input checked={active} onChange={(event) => setActive(event.target.checked)} type="checkbox" /> קבוצה פעילה</label>
          <div className="sync-choice-box">
            <strong>אם הסכום השתנה, האם לעדכן גם את הילדים בקבוצה זו?</strong>
            <label><input checked={updateExisting} onChange={() => setUpdateExisting(true)} name="sync" type="radio" /> לעדכן את כל הילדים בקבוצה</label>
            <label><input checked={!updateExisting} onChange={() => setUpdateExisting(false)} name="sync" type="radio" /> להחיל רק על ילדים חדשים</label>
          </div>
          <div className="profile-actions"><button className="button primary" disabled={busy} type="submit">{busy ? "שומר..." : "שמירת הגדרת תשלום"}</button><button className="button secondary" type="button" onClick={close}>ביטול</button></div>
          {message ? <small className="payment-action-message">{message}</small> : null}
        </form>}
      </CollapsibleActionPanel>
    </section>
  );
}
