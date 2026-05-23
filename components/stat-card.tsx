export function StatCard({ label, value, tone = "default" }: { label: string; value: string | number; tone?: "default" | "good" | "warn" | "bad" }) {
  return (
    <article className="card stat">
      <strong>{value}</strong>
      <span>{label}</span>
      {tone !== "default" ? <div className={`pill ${tone}`}>{tone === "good" ? "תקין" : tone === "warn" ? "דורש בדיקה" : "חריג"}</div> : null}
    </article>
  );
}
