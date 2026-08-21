import Link from "next/link";
import { ObserverOnboardingWizard } from "@/components/digital-observer/observer-action-forms";
import { ObserverMark } from "@/components/digital-observer/observer-app-shell";
import { LogoutButton } from "@/components/logout-button";
import { requireDigitalObserverUser } from "@/lib/domain/digital-observer/access";
import { loadObserverRuntime, type ObserverMode } from "@/lib/domain/digital-observer/runtime";

type PageProps = { searchParams?: Promise<{ type?: string; error?: string }> };

export default async function DigitalObserverOnboardingPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { profile, observerAccount } = await requireDigitalObserverUser("/digital-observer/login?next=/digital-observer/onboarding");
  const runtime = await loadObserverRuntime(profile.id);
  const defaultType: ObserverMode = observerAccount?.account_type === "business" ? "business" : "home";
  return (
    <main className="do-onboarding-page" dir="rtl">
      <header className="do-onboarding-header">
        <Link className="do-auth-brand dark" href="/digital-observer"><ObserverMark /><span><b>תצפיתן דיגיטלי</b><small>הקמת חשבון עצמאי</small></span></Link>
        <LogoutButton compact redirectTo="/digital-observer/login" className="do-link" />
      </header>
      <div className="do-onboarding-content">
        <header className="do-intro"><span className="do-badge info">מסלול {defaultType === "home" ? "ביתי" : "עסקי"} · 4 שלבים</span><h1>הגדרת {defaultType === "home" ? "הבית" : "העסק"} שלך</h1><p>{defaultType === "home" ? "ממשק פשוט למשפחה, אזורי הבית ואנשים מורשים." : "ניהול אתרים, תבניות ענפיות, צוות והרשאות עסקיות."} זהו חשבון תצפיתן עצמאי שאינו מחובר למסלול גננת או לגן בטוח.</p></header>
        {params?.error ? <div className="do-notice bad" role="alert"><span>{params.error}</span></div> : null}
        <ObserverOnboardingWizard packages={runtime.packages} defaultType={defaultType} />
      </div>
    </main>
  );
}
