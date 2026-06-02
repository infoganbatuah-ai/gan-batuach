"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";

export function CollapsibleActionPanel({
  title,
  description,
  buttonLabel,
  children,
  defaultOpen = false,
  className = ""
}: {
  title: string;
  description?: string;
  buttonLabel: string;
  children: (controls: { close: () => void }) => ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`collapsible-action-panel ${className}`}>
      <div className="card action-panel compact-action-panel">
        <div className="section-heading">
          <div>
            <h2>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button className="button primary" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
            {open ? <ChevronUp size={16} /> : <Plus size={16} />}
            {open ? "סגירה" : buttonLabel}
          </button>
        </div>
      </div>
      {open ? <div className="collapsible-action-body">{children({ close: () => setOpen(false) })}</div> : null}
      {!open ? <div className="collapsed-form-hint"><ChevronDown size={14} /> הטופס מוסתר כדי לשמור על מסך נקי. לחצו לפתיחה כשצריך.</div> : null}
    </section>
  );
}
