import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";
import { AlertTriangle, ArrowLeft, BarChart3, CheckCircle2, Clock3, CreditCard, FileText, Landmark, ReceiptText, ShieldCheck, WalletCards } from "lucide-react";

type Icon = ComponentType<LucideProps>;
export type FinanceTone = "blue" | "green" | "orange" | "red" | "purple" | "neutral";

export const tuitionStatusLabels: Record<string, string> = {
  pending: "לתשלום", overdue: "באיחור", partially_paid: "שולם חלקית", paid: "שולם",
  waived: "ללא חיוב", reconciliation_required: "נדרשת התאמה", cancelled: "בוטל",
  manual_settlement: "תשלום ידני", provider_settlement: "תשלום ספק", adjustment: "התאמה",
  unapplied_credit: "זיכוי לא משויך", reversal: "ביטול פעולה"
};

export function financeTone(status?: string | null): FinanceTone {
  if (["paid", "active", "verified", "waived"].includes(String(status))) return "green";
  if (["overdue", "failed", "payment_failed", "suspended", "cancelled"].includes(String(status))) return "red";
  if (["partially_paid", "pending", "pending_payment", "trial"].includes(String(status))) return "orange";
  if (["reconciliation_required", "unapplied_credit"].includes(String(status))) return "purple";
  return "neutral";
}

export function money(value: unknown) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 2 }).format(Number.isFinite(amount) ? amount : 0);
}

export function dateText(value?: string | null) {
  if (!value) return "לא נקבע";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "לא נקבע" : date.toLocaleDateString("he-IL");
}

export function periodText(value?: string | null) {
  if (!value) return "תקופה לא ידועה";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value.slice(0, 7) : date.toLocaleDateString("he-IL", { month: "long", year: "numeric" });
}

export function FinanceHero({ eyebrow, title, text, action, children }: { eyebrow?: string; title: string; text: string; action?: ReactNode; children?: ReactNode }) {
  return <section className="finance-hero">
    <div className="finance-hero-copy">{eyebrow ? <span>{eyebrow}</span> : null}<h2>{title}</h2><p>{text}</p>{action ? <div className="finance-hero-actions">{action}</div> : null}</div>
    <div className="finance-hero-visual" aria-hidden="true"><div><WalletCards size={42} /><ReceiptText size={31} /><Landmark size={34} /></div></div>
    {children}
  </section>;
}

export function FinanceMetric({ label, value, hint, icon: Icon, tone = "blue" }: { label: string; value: ReactNode; hint?: string; icon: Icon; tone?: FinanceTone }) {
  return <article className={`finance-metric ${tone}`}><span className="finance-metric-icon"><Icon size={24} /></span><div><strong>{value}</strong><b>{label}</b>{hint ? <small>{hint}</small> : null}</div></article>;
}

export function FinanceMetrics({ children }: { children: ReactNode }) { return <section className="finance-metrics">{children}</section>; }

export function FinanceSection({ title, text, action, children, className = "" }: { title: string; text?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`finance-section ${className}`}><header><div><h3>{title}</h3>{text ? <p>{text}</p> : null}</div>{action}</header>{children}</section>;
}

export function FinanceStatus({ status, children }: { status: string; children?: ReactNode }) {
  return <span className={`finance-status ${financeTone(status)}`}>{children ?? tuitionStatusLabels[status] ?? status}</span>;
}

export function FinanceTruthBanner({ kind = "info", title, text, action }: { kind?: "info" | "warning" | "success"; title: string; text: string; action?: ReactNode }) {
  const Icon = kind === "warning" ? AlertTriangle : kind === "success" ? CheckCircle2 : ShieldCheck;
  return <section className={`finance-truth-banner ${kind}`}><Icon size={24} /><div><strong>{title}</strong><span>{text}</span></div>{action}</section>;
}

export function FinanceQuickActions() {
  const items: Array<{ href: string; label: string; text: string; icon: Icon; tone: FinanceTone }> = [
    { href: "/dashboard/garden/tuition-ledger", label: "ספר שכר לימוד", text: "חיובים, תשלומים והתאמות", icon: WalletCards, tone: "blue" },
    { href: "/dashboard/garden/subscription", label: "מנוי גן בטוח", text: "גן ← גן בטוח", icon: ShieldCheck, tone: "purple" },
    { href: "/dashboard/garden/reports", label: "דוחות כספיים", text: "כניסה למנוע הדוחות", icon: BarChart3, tone: "green" },
    { href: "/dashboard/garden/tuition-ledger?panel=history", label: "היסטוריית פעולות", text: "ביקורת ותיעוד", icon: FileText, tone: "orange" }
  ];
  return <div className="finance-quick-actions">{items.map(({ href, label, text, icon: Icon, tone }) => <Link className={`finance-quick-action ${tone}`} href={href} key={href}><span><Icon size={23} /></span><div><b>{label}</b><small>{text}</small></div><ArrowLeft size={18} /></Link>)}</div>;
}

export function FinanceEmpty({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return <div className="finance-empty"><span><ReceiptText size={28} /></span><strong>{title}</strong><p>{text}</p>{action}</div>;
}

export const financeIcons = { AlertTriangle, CheckCircle2, Clock3, CreditCard, Landmark, ReceiptText, ShieldCheck, WalletCards };
