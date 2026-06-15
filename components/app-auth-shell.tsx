import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";

type Props = {
  eyebrow?: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AppAuthShell({ eyebrow = "גן בטוח", title, subtitle, children, footer }: Props) {
  return (
    <main className="app-auth-page">
      <section className="app-auth-card-shell">
        <div className="app-auth-topbar">
          <Link className="app-auth-back" href="/app"><ArrowRight size={18} /> חזרה</Link>
          <span className="pill good"><ShieldCheck size={14} /> חיבור מאובטח</span>
        </div>
        <div className="app-auth-brand">
          <Image src="/assets/company-symbol.png" alt="" width={62} height={62} priority />
          <Image src="/assets/company-name.png" alt="גן בטוח" width={142} height={38} priority />
        </div>
        <header className="app-auth-heading">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </header>
        {children}
        {footer ? <footer className="app-auth-footer">{footer}</footer> : null}
      </section>
    </main>
  );
}
