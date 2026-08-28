import Link from "next/link";
import { ObserverOnboardingWizard } from "@/components/digital-observer/observer-action-forms";
import { ObserverAuthDevicePreview } from "@/components/digital-observer/observer-auth-device-preview";
import { ObserverMark } from "@/components/digital-observer/observer-app-shell";
import { LogoutButton } from "@/components/logout-button";
import { requireDigitalObserverUser } from "@/lib/domain/digital-observer/access";
import { loadObserverRuntime, selectObserverSite, type ObserverMode } from "@/lib/domain/digital-observer/runtime";

type PageProps = { searchParams?: Promise<{ type?: string; error?: string; create?: string }> };

export default async function DigitalObserverOnboardingPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { profile, observerAccount } = await requireDigitalObserverUser("/digital-observer/login?next=/digital-observer/onboarding");
  const runtime = await loadObserverRuntime(profile.id);
  const defaultType: ObserverMode = observerAccount?.account_type === "business" ? "business" : "home";
  const createRequested = params?.create === "1";
  const existingSite = createRequested ? null : selectObserverSite(runtime.sites, runtime.cameras);
  const onboardingType: ObserverMode = existingSite?.site_type === "home" ? "home" : defaultType;
  return (
    <main className="do-onboarding-page" dir="rtl">
      <header className="do-onboarding-header">
        <Link className="do-auth-brand dark" href="/digital-observer"><ObserverMark /><span><b>תצפיתן דיגיטלי</b><small>הקמת חשבון עצמאי</small></span></Link>
        <LogoutButton compact redirectTo="/digital-observer/login" className="do-link" />
      </header>
      <div className="do-onboarding-content">
        <header className="do-intro"><span className="do-badge info">{existingSite ? "עריכת אתר קיים" : `מסלול ${defaultType === "home" ? "ביתי" : "עסקי"} · 4 שלבים`}</span><h1>{existingSite ? `עדכון ${existingSite.name}` : `הגדרת ${defaultType === "home" ? "הבית" : "העסק"} שלך`}</h1><p>{existingSite ? "העדכון נשמר באותו אתר. מקורות המצלמה, אירועים, חברי האתר והסכמות קיימים נשארים ללא שינוי." : `${defaultType === "home" ? "ממשק פשוט למשפחה, אזורי הבית ואנשים מורשים." : "ניהול אתרים, תבניות ענפיות, צוות והרשאות עסקיות."} זהו חשבון תצפיתן עצמאי שאינו מחובר למסלול גננת או לגן בטוח.`}</p></header>
        {params?.error ? <div className="do-notice bad" role="alert"><span>{params.error}</span></div> : null}
        <ObserverOnboardingWizard packages={runtime.packages} defaultType={onboardingType} existingSite={existingSite} createRequested={createRequested || !existingSite} />
        <ObserverAuthDevicePreview screen={defaultType === "home" ? "home-onboarding" : "business-onboarding"} />
      </div>
    </main>
  );
}
