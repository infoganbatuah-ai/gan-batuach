import Link from "next/link";
import type { LucideIcon } from "lucide-react";

type CommandItem = {
  title: string;
  count: number | string;
  description: string;
  href: string;
  tone?: "good" | "warn" | "bad";
  icon: LucideIcon;
};

export function SimpleCommandCenter({ title, subtitle, items }: { title: string; subtitle: string; items: CommandItem[] }) {
  const urgent = items.filter((item) => item.tone === "bad" || item.tone === "warn");

  return (
    <section className="simple-command-center">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Personal Operating Assistant</p>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <span className={urgent.length ? "pill warn" : "pill good"}>{urgent.length ? `${urgent.length} פעולות לטיפול` : "אין חריגים דחופים"}</span>
      </div>
      <div className="simple-command-grid">
        {items.map((item) => (
          <Link className={`simple-command-card ${item.tone ?? "good"}`} href={item.href} key={`${item.title}-${item.href}`}>
            <item.icon size={22} />
            <div>
              <strong>{item.count}</strong>
              <span>{item.title}</span>
              <small>{item.description}</small>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
