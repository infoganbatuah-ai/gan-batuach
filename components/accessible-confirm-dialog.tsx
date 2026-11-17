"use client";

import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { AlertTriangle, X } from "lucide-react";

export function AccessibleConfirmDialog({ open, title, description, consequence, confirmLabel, cancelLabel = "ביטול", onConfirm, onCancel, busy = false, children }: { open: boolean; title: string; description: string; consequence?: string; confirmLabel: string; cancelLabel?: string; onConfirm: () => void; onCancel: () => void; busy?: boolean; children?: ReactNode }) {
  const titleId = useId(); const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null); const cancelRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  useEffect(() => { onCancelRef.current = onCancel; }, [onCancel]);
  useLayoutEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();
    const focusFrame = requestAnimationFrame(() => cancelRef.current?.focus());
    const dialog = dialogRef.current;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onCancelRef.current(); return; }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    const onFocusIn = (event: FocusEvent) => {
      if (dialog && event.target instanceof Node && !dialog.contains(event.target)) cancelRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
    return () => { cancelAnimationFrame(focusFrame); document.removeEventListener("keydown", onKeyDown); document.removeEventListener("focusin", onFocusIn); previous?.focus(); };
  }, [open]);
  if (!open) return null;
  return (
    <div className="ux19-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onCancel(); }}>
      <div ref={dialogRef} className="ux19-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
        <button className="ux19-dialog-close" type="button" onClick={onCancel} aria-label="סגירת חלון האישור"><X size={22} /></button>
        <span className="ux19-dialog-icon" aria-hidden="true"><AlertTriangle size={34} /></span>
        <div><h2 id={titleId}>{title}</h2><p id={descriptionId}>{description}</p>{consequence ? <strong>{consequence}</strong> : null}</div>
        {children}
        <div className="ux19-dialog-actions"><button ref={cancelRef} className="button secondary" type="button" onClick={onCancel} disabled={busy}>{cancelLabel}</button><button className="button ux19-destructive-button" type="button" onClick={onConfirm} disabled={busy}>{busy ? "מבצעים…" : confirmLabel}</button></div>
      </div>
    </div>
  );
}
