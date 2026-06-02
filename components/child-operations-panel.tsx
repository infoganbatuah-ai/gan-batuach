"use client";

import { useState, useTransition } from "react";
import type { ReactNode } from "react";
import { Baby, Bell, CheckCircle2, Moon, Smile, Utensils } from "lucide-react";
import { ChildPaymentActions } from "@/components/child-payment-actions";

const chips = {
  meals: ["אכל הכל", "אכל חלקית", "לא אכל", "לא רלוונטי"],
  sleep: ["ישן טוב", "ישן מעט", "לא ישן"],
  mood: ["שמח", "רגוע", "עייף", "בוכה", "לא שקט"],
  bathroom: ["רגיל", "לא היה", "החלפה"],
  health: ["תקין", "חום", "שיעול", "נפילה", "לא מרגיש טוב"]
};

export function ChildOperationsPanel({ child, gardenId }: { child: any; gardenId: string }) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [journal, setJournal] = useState({ meals: "", sleep: "", mood: "", bathroom: "", health: "", note: "" });
  const [clothes, setClothes] = useState(Boolean(child.has_change_clothes));
  const [clothesNotes, setClothesNotes] = useState(child.change_clothes_notes ?? "");

  function setField(field: keyof typeof journal, value: string) {
    setJournal((current) => ({ ...current, [field]: value }));
  }

  function saveJournal() {
    setMessage("");
    startTransition(async () => {
      const response = await fetch("/api/child-daily-journals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          garden_id: gardenId,
          child_id: child.id,
          meals: journal.meals ? [{ title: "עדכון ארוחה", note: journal.meals }] : [],
          sleep_summary: journal.sleep,
          mood: journal.mood,
          bathroom: journal.bathroom,
          medicine: journal.health,
          notes_to_parents: journal.note,
          staff_signature: "עדכון מהיר"
        })
      });
      setMessage(response.ok ? "העדכון נשמר ונשלחה התראה להורה." : "לא ניתן לשמור עדכון יומי כרגע.");
    });
  }

  function saveClothes() {
    setMessage("");
    startTransition(async () => {
      const response = await fetch(`/api/garden/children/${child.id}/operations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "change_clothes", has_change_clothes: clothes, change_clothes_notes: clothesNotes })
      });
      setMessage(response.ok ? "סטטוס בגדים להחלפה נשמר." : "לא ניתן לשמור סטטוס בגדים כרגע.");
    });
  }

  return (
    <section className="grid cols-2 dashboard-panels">
      <article className="card action-panel child-quick-ops">
        <div className="section-heading"><h2><Utensils size={20} /> עדכון יומי מהיר</h2><p>צ׳יפים מהירים + הערה חופשית. כל שמירה יוצרת התראת הורה.</p></div>
        {message ? <div className={message.includes("נשמר") ? "success-banner" : "error-banner"}>{message}</div> : null}
        <QuickChips icon={<Utensils size={15} />} title="ארוחות" values={chips.meals} selected={journal.meals} onSelect={(value) => setField("meals", value)} />
        <QuickChips icon={<Moon size={15} />} title="שינה" values={chips.sleep} selected={journal.sleep} onSelect={(value) => setField("sleep", value)} />
        <QuickChips icon={<Smile size={15} />} title="מצב רוח" values={chips.mood} selected={journal.mood} onSelect={(value) => setField("mood", value)} />
        <QuickChips title="שירותים / החתלה" values={chips.bathroom} selected={journal.bathroom} onSelect={(value) => setField("bathroom", value)} />
        <QuickChips title="בריאות" values={chips.health} selected={journal.health} onSelect={(value) => setField("health", value)} />
        <label>הערה להורים<input value={journal.note} onChange={(event) => setField("note", event.target.value)} placeholder="משהו קצר וברור להורה" /></label>
        <button className="button primary" type="button" disabled={pending} onClick={saveJournal}><CheckCircle2 size={16} /> שמירת עדכון יומי</button>
      </article>

      <article className="card action-panel">
        <div className="section-heading"><h2><Baby size={20} /> בגדים להחלפה ותשלום</h2><p>לילדים צעירים חשוב לוודא בגדים להחלפה; חסר יוצר התראה להורה.</p></div>
        <div className="sync-choice-box">
          <strong>סטטוס בגדים להחלפה</strong>
          <label><input checked={clothes} onChange={() => setClothes(true)} name="clothes" type="radio" /> יש בגדים להחלפה</label>
          <label><input checked={!clothes} onChange={() => setClothes(false)} name="clothes" type="radio" /> חסר בגדים להחלפה</label>
          <input value={clothesNotes} onChange={(event) => setClothesNotes(event.target.value)} placeholder="הערה להורה / לצוות" />
          <button className="button secondary" type="button" disabled={pending} onClick={saveClothes}><Bell size={15} /> שמירת סטטוס</button>
        </div>
        <div className="payment-profile-box">
          <h3>תשלום ילד</h3>
          <p>מחיר בפועל: ₪{child.actual_monthly_fee ?? child.monthly_fee ?? 0} · חוב: ₪{child.debt_amount ?? 0}</p>
          <p>{child.payments_paused ? "תשלומים נעצרו" : "תשלומים פעילים"} · תוקף עד {child.valid_until ?? "-"}</p>
          <ChildPaymentActions childId={child.id} amount={Number(child.actual_monthly_fee ?? child.monthly_fee ?? 0)} />
        </div>
      </article>
    </section>
  );
}

function QuickChips({ title, values, selected, onSelect, icon }: { title: string; values: string[]; selected: string; onSelect: (value: string) => void; icon?: ReactNode }) {
  return <div className="quick-chip-field"><strong>{icon}{title}</strong><div>{values.map((value) => <button className={selected === value ? "chip active" : "chip"} key={value} type="button" onClick={() => onSelect(value)}>{value}</button>)}</div></div>;
}
