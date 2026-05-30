"use client";

import Link from "next/link";
import { useState } from "react";
import { HelpCircle, X } from "lucide-react";

type Item = {
  label: string;
  count: number;
  href: string;
  action: string;
  severity?: "good" | "warn" | "bad";
};

export function ForgotSomethingButton({ items }: { items: Item[] }) {
  const [open, setOpen] = useState(false);
  const activeItems = items.filter((item) => item.count > 0);

  return (
    <>
      <button className="forgot-floating-button" type="button" onClick={() => setOpen(true)}>
        <HelpCircle size={18} />
        שכחתי משהו?
        {activeItems.length ? <span>{activeItems.length}</span> : null}
      </button>
      {open ? (
        <div className="forgot-overlay" role="dialog" aria-modal="true">
          <div className="forgot-panel">
            <button className="icon-button close" type="button" onClick={() => setOpen(false)} aria-label="סגירה"><X size={18} /></button>
            <p className="eyebrow">Operating Assistant</p>
            <h2>מה אולי נשכח היום?</h2>
            <p>רשימה קצרה של דברים שמנהלת או צוות לא אמורים לזכור לבד.</p>
            {activeItems.length === 0 ? <div className="empty-mini">נראה שהדברים החשובים מעודכנים כרגע.</div> : (
              <div className="forgot-list">
                {activeItems.map((item) => (
                  <Link className={`forgot-item ${item.severity ?? "warn"}`} href={item.href} key={item.label}>
                    <strong>{item.count}</strong>
                    <span>{item.label}</span>
                    <small>{item.action}</small>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
