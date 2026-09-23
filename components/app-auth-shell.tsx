import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, BarChart3, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { PremiumCard, ResponsivePage } from "@/components/gan-batuach-design-system";
import { GanBatuachBrand } from "@/components/gan-batuach-brand";

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
            <p>ברוכים הבאים לגן בטוח</p>
            <strong>לנהל את הגן בביטחון, ברוגע ובחכמה.</strong>
            <span>ילדים, צוות, הורים ופיקוח מתחברים למקום אחד — בטוח, ברור ונעים לשימוש.</span>
            <div className="gb-auth-v2-trust-row">
              <span><ShieldCheck /> בטיחות ושקט</span>
              <span><UsersRound /> שיתוף ושקיפות</span>
              <span><BarChart3 /> ניהול חכם</span>
            </div>
          </div>
          <div className="gb-auth-v2-story-chip"><Sparkles size={18} /> פרטיות ובטיחות כבר מהצעד הראשון</div>
        </div>
        <ResponsivePage size="sm" className="gb-auth-page">
          <PremiumCard size="lg" className="app-auth-card-shell gb-auth-card">
          <div className="app-auth-topbar">
          <Link className="app-auth-back" href="/app"><ArrowRight size={18} /> חזרה</Link>
          <span className="gb-auth-step-security"><ShieldCheck size={16} /> המידע שלך בטוח</span>
          </div>
          <div className="app-auth-brand">
            <GanBatuachBrand />
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
