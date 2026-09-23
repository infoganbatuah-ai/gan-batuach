import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { PremiumCard, ResponsivePage, StatusChip } from "@/components/gan-batuach-design-system";

type Props = {
  eyebrow?: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AppAuthShell({ eyebrow = "גן בטוח", title, subtitle, children, footer }: Props) {
  return (
    <main className="app-auth-page gb-auth-screen gb-auth-v2" dir="rtl">
      <section className="gb-auth-v2-stage" aria-label="גן בטוח">
        <div className="gb-auth-v2-story" aria-hidden="true">
          <div className="gb-auth-v2-story-copy">
            <Image src="/assets/company-symbol.png" alt="" width={70} height={70} priority />
            <p>גן בטוח</p>
            <strong>ניהול גן שמתחיל באמון.</strong>
            <span>כל מה שצריך כדי לחבר בין צוות, הורים ופיקוח במקום אחד.</span>
          </div>
          <div className="gb-auth-v2-story-chip"><Sparkles size={18} /> פרטיות ובטיחות כבר מהצעד הראשון</div>
        </div>
        <ResponsivePage size="sm" className="gb-auth-page">
          <PremiumCard size="lg" className="app-auth-card-shell gb-auth-card">
          <div className="app-auth-topbar">
          <Link className="app-auth-back" href="/app"><ArrowRight size={18} /> חזרה</Link>
          <StatusChip tone="success" icon={ShieldCheck}>חיבור מאובטח</StatusChip>
          </div>
          <div className="app-auth-brand">
            <Image src="/assets/company-symbol.png" alt="" width={76} height={76} priority />
            <Image src="/assets/company-name.png" alt="גן בטוח" width={190} height={51} priority />
          </div>
          <header className="app-auth-heading">
            <p className="eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </header>
          {children}
          {footer ? <footer className="app-auth-footer">{footer}</footer> : null}
          </PremiumCard>
        </ResponsivePage>
      </section>
    </main>
  );
}
