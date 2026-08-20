import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bell, Camera, Check, Radar, ShieldCheck } from "lucide-react";
import { ObserverMark } from "@/components/digital-observer/observer-app-shell";
import { DIGITAL_OBSERVER_USE_CASES } from "@/lib/domain/digital-observer-product";

type PageProps = { params: Promise<{ useCase: string }> };

function findUseCase(key: string) {
  return DIGITAL_OBSERVER_USE_CASES.find((item) => item.key === key);
}

export function generateStaticParams() {
  return DIGITAL_OBSERVER_USE_CASES.map((item) => ({ useCase: item.key }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const item = findUseCase((await params).useCase);
  return item ? { title: { absolute: `${item.title} | תצפיתן דיגיטלי` }, description: item.solution, alternates: { canonical: item.path } } : {};
}

export default async function DigitalObserverUseCasePage({ params }: PageProps) {
  const item = findUseCase((await params).useCase);
  if (!item) notFound();

  return <main className="do-public" dir="rtl">
    <header className="do-public-header"><Link className="do-auth-brand dark" href="/digital-observer"><ObserverMark /><span><b>תצפיתן דיגיטלי</b><small>{item.title}</small></span></Link><nav><Link href="/digital-observer">המוצר</Link><Link href="/digital-observer/pricing">חבילות</Link><Link href="/digital-observer/trust">פרטיות ואמון</Link></nav><div><Link className="do-button secondary" href="/digital-observer/login">התחברות</Link><Link className="do-button primary" href={`/digital-observer/register?type=${item.key === "home" ? "home" : "business"}`}>התחלה</Link></div></header>
    <section className="do-pricing-head"><span className="do-badge info">{item.audience}</span><h1>{item.title}</h1><p>{item.solution}</p><div className="do-button-row"><Link className="do-button primary" href={`/digital-observer/register?type=${item.key === "home" ? "home" : "business"}`}>יצירת חשבון <ArrowLeft /></Link><Link className="do-button secondary" href={`/digital-observer/request-demo?site_type=${item.key}`}>בקשת הדגמה</Link></div></section>
    <section className="do-public-use"><div><Radar /><span>הצורך</span><h2>מה המערכת פותרת</h2><p>{item.problem}</p><ul>{item.benefits.map((benefit) => <li key={benefit}><Check /> {benefit}</li>)}</ul></div><div><ShieldCheck /><span>הפתרון</span><h2>{item.packageSuggestion}</h2><p>{item.solution}</p><ul><li><Camera /> {item.cameraSetup}</li><li><Bell /> {item.alerts}</li></ul></div></section>
    <section className="do-public-trust"><ShieldCheck /><div><h2>מתחילים במצב בדיקה</h2><p>אין הפעלה של מצלמה, AI, הודעה או חיוב אמיתי לפני חיבור ספק מאושר ובדיקת הרשאות.</p></div><Link className="do-button secondary light" href="/digital-observer/trust">פרטיות ואמון</Link></section>
  </main>;
}
