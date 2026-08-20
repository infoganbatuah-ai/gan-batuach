import { ObserverOnboardingWizard } from "@/components/digital-observer/observer-action-forms";
import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { requireUser } from "@/lib/auth";
import { loadObserverRuntime, type ObserverMode } from "@/lib/domain/digital-observer/runtime";

type PageProps = { searchParams?: Promise<{ type?: string }> };

export default async function DigitalObserverOnboardingPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { profile } = await requireUser("/digital-observer/login?next=/digital-observer/onboarding");
  const runtime = await loadObserverRuntime(profile.id);
  const defaultType: ObserverMode = params?.type === "business" ? "business" : "home";
  return (
    <ObserverAppShell profile={profile} mode={defaultType} activeHref="/digital-observer/sites" title="הקמת מקום חדש" statusLabel="סביבה בטוחה להגדרה">
      <div className="do-page-stack">
        <header className="do-intro"><span className="do-badge info">4 שלבים פשוטים</span><h1>חברו מצלמה, בחרו למה לשים לב, וקבלו עדכון רק כשמשהו חשוב קורה.</h1><p>ההקמה יוצרת אתר עצמאי של התצפיתן. אין חיבור לגן בטוח, אין חיוב ואין הפעלה חיה.</p></header>
        <ObserverOnboardingWizard packages={runtime.packages} defaultType={defaultType} />
      </div>
    </ObserverAppShell>
  );
}
