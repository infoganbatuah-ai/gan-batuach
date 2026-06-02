import Link from "next/link";

export function DashboardFilterChip({
  label,
  clearHref,
  emptyTitle,
  emptyText,
  isEmpty
}: {
  label?: string | null;
  clearHref: string;
  emptyTitle?: string;
  emptyText?: string;
  isEmpty?: boolean;
}) {
  if (!label) return null;
  return (
    <div className={isEmpty ? "filter-context-strip empty" : "filter-context-strip"}>
      <span>מציג: {label}</span>
      <Link className="button secondary tiny" href={clearHref}>ניקוי סינון</Link>
      {isEmpty && emptyTitle ? <strong>{emptyTitle}</strong> : null}
      {isEmpty && emptyText ? <small>{emptyText}</small> : null}
    </div>
  );
}
