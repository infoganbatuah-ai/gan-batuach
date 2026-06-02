import Link from "next/link";

type StatCardProps = {
  label: string;
  value: string | number;
  tone?: "default" | "good" | "warn" | "bad";
  href?: string;
};

export function StatCard({ label, value, tone = "default", href }: StatCardProps) {
  const labelByTone = tone === "good" ? "תקין" : tone === "warn" ? "דורש בדיקה" : tone === "bad" ? "חריג" : null;
  const content = (
    <>
      <strong>{value}</strong>
      <span>{label}</span>
      {labelByTone ? <div className={`pill ${tone}`}>{labelByTone}</div> : null}
    </>
  );

  if (href) {
    return (
      <Link className={`card stat stat-${tone} stat-link`} href={href} aria-label={`${label} - פתיחה`}>
        {content}
      </Link>
    );
  }

  return (
    <article className={`card stat stat-${tone}`}>
      {content}
    </article>
  );
}
