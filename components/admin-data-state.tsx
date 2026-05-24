export function AdminDataError({ message = "לא ניתן לטעון את הנתונים כרגע" }: { message?: string | null }) {
  if (!message) return null;
  return <div className="error-banner">{message}</div>;
}

export function AdminEmptyState({ title = "אין נתונים להצגה כרגע", body = "כאשר ייווצרו רשומות במערכת הן יופיעו כאן." }: { title?: string; body?: string }) {
  return <div className="empty-state"><strong>{title}</strong><span>{body}</span></div>;
}
