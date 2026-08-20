import Link from "next/link";
import { ObserverOnboardingWizard } from "@/components/digital-observer/observer-action-forms";
import { ObserverMark } from "@/components/digital-observer/observer-app-shell";
import { requireDigitalObserverUser } from "@/lib/domain/digital-observer/access";
import { loadObserverRuntime, type ObserverMode } from "@/lib/domain/digital-observer/runtime";

type PageProps = { searchParams?: Promise<{ type?: string }> };

export default async function DigitalObserverOnboardingPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { profile } = await requireDigitalObserverUser("/digital-observer/login?next=/digital-observer/onboarding");
  const runtime = await loadObserverRuntime(profile.id);
  const defaultType: ObserverMode = params?.type === "business" ? "business" : "home";
  return (
    <main className="do-onboarding-page" dir="rtl">
      <header className="do-onboarding-header">
        <Link className="do-auth-brand dark" href="/digital-observer"><ObserverMark /><span><b>תצפיתן דיגיטלי</b><small>הקמת חשבון עצמאי</small></span></Link>
        <Link className="do-link" href="/api/auth/logout">יציאה בטוחה</Link>
      </header>
      <div className="do-onboarding-content">
        <header className="do-intro"><span className="do-badge info">4 שלבים פשוטים</span><h1>הגדרת {defaultType === "home" ? "הבית" : "העסק"} שלך</h1><p>מגדירים את המקום, המצלמות, מטרות הניטור והחבילה. זהו חשבון תצפיתן עצמאי שאינו מחובר למסלול גננת או לגן בטוח.</p></header>
        <ObserverOnboardingWizard packages={runtime.packages} defaultType={defaultType} />
      </div>
    </main>
  );
}
