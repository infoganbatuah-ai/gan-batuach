export function AdminDataError({ message = "לא ניתן לטעון את הנתונים כרגע" }: { message?: string | null }) {
  if (!message) return null;
  return <div className="error-banner">{message}</div>;
}

export function AdminEmptyState({ title = "עדיין אין רשומות במודול הזה", body = "ברגע שייווצרו פריטים רלוונטיים, הם יוצגו כאן עם פעולות ברורות להמשך טיפול." }: { title?: string; body?: string }) {
  return <div className="empty-state"><strong>{title}</strong><span>{body}</span></div>;
}
