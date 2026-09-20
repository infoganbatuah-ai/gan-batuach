import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ObserverMark } from "@/components/digital-observer/observer-app-shell";
import { getPublishedArticles } from "@/lib/editorial/store";
import { SITE_URL } from "@/lib/editorial/articles";
import { digitalObserverShareImage } from "@/lib/seo/brand-assets";
import "../../articles/articles.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { absolute: "מדריכי תצפיתן דיגיטלי | מצלמות לבית ולעסק" },
  description: "מדריכים מעשיים על מצלמות חכמות לבית ולעסק, פרטיות, אבטחה, ניתוח וחקירת וידאו. תוכן נפרד ממערכת ניהול הגנים.",
  alternates: { canonical: `${SITE_URL}/digital-observer/guides` },
  robots: { index: true, follow: true },
  openGraph: { type: "website", siteName: "תצפיתן דיגיטלי", locale: "he_IL", url: `${SITE_URL}/digital-observer/guides`, title: "מדריכי תצפיתן דיגיטלי", images: [digitalObserverShareImage] },
  twitter: { card: "summary_large_image", images: [digitalObserverShareImage.url] }
};

export default async function ObserverGuidesPage() {
  const articles = await getPublishedArticles("observer");
  return <div className="do-public"><header className="do-public-header"><Link className="do-auth-brand dark" href="/digital-observer"><ObserverMark /><span><b>תצפיתן דיגיטלי</b><small>מדריכים לבית ולעסק</small></span></Link><nav aria-label="ניווט ראשי"><Link href="/digital-observer">המוצר</Link><Link href="/digital-observer/home">לבית</Link><Link href="/digital-observer/business">לעסק</Link><Link href="/digital-observer/video-investigation">חקירת וידאו</Link></nav></header>
    <main className="editorial-page"><nav className="editorial-crumbs" aria-label="פירורי לחם"><Link href="/digital-observer">תצפיתן דיגיטלי</Link> / מדריכים</nav>
      <header className="editorial-heading"><span className="editorial-kicker">מגזין תצפיתן דיגיטלי</span><h1>מצלמות, בקרה וניתוח וידאו — הסברים מעשיים</h1><p>מידע לבית ולעסק המבוסס על מקורות רשמיים, עם דגש על פרטיות, אבטחה ובדיקה אנושית. אלו אינם מדריכים לניהול גן ילדים.</p></header>
      <div className="editorial-grid">{articles.map((article, index) => <article className="editorial-card" key={article.slug}><Link className="editorial-card-image" href={`/digital-observer/guides/${article.slug}`}><Image src={article.image_url} alt={article.image_alt} width={720} height={405} sizes="(max-width: 700px) 100vw, 33vw" fetchPriority={index === 0 ? "high" : undefined} loading={index === 0 ? "eager" : "lazy"} /></Link><div className="editorial-card-copy"><span className="editorial-kicker">{article.tags.slice(0, 2).join(" · ")}</span><h2><Link href={`/digital-observer/guides/${article.slug}`}>{article.title}</Link></h2><p>{article.summary}</p><Link href={`/digital-observer/guides/${article.slug}`}>לקריאה ←</Link></div></article>)}</div>
    </main></div>;
}
