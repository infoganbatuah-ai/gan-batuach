export function StatCard({ label, value, tone = "default" }: { label: string; value: string | number; tone?: "default" | "good" | "warn" | "bad" }) {
  const labelByTone = tone === "good" ? "תקין" : tone === "warn" ? "דורש בדיקה" : tone === "bad" ? "חריג" : null;
  return (
    <article className={`card stat stat-${tone}`}>
      <strong>{value}</strong>
      <span>{label}</span>
      {labelByTone ? <div className={`pill ${tone}`}>{labelByTone}</div> : null}
    </article>
  );
}
