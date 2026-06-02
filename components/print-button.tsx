"use client";

export function PrintButton({ label = "הדפסה / שמירה כ-PDF" }: { label?: string }) {
  return <button className="button secondary" type="button" onClick={() => window.print()}>{label}</button>;
}
