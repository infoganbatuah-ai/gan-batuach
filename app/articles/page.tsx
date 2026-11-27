import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BrandHeader } from "@/components/brand-header";
import { getPublishedArticles } from "@/lib/editorial/store";
import { SITE_URL } from "@/lib/editorial/articles";
import { ganBatuachShareImage } from "@/lib/seo/brand-assets";
import "./articles.css";

const topicClusters = [
  { title: "ניהול גן מקצה לקצה", description: "רישום, כרטיס ילד, צוות, הורים ותהליכי עבודה.", slugs: ["kindergarten-management-system", "kindergarten-registration-guide", "digital-child-profile", "parent-platform-transparency"] },
  { title: "בקרה, פיקוח ובטיחות", description: "סטנדרט פרטי, ביקורות, אנשי צוות ולמידה מאירועים.", slugs: ["what-is-gan-batuach", "private-kindergarten-inspections", "kindergarten-staff-checks", "learning-from-kindergarten-incidents"] },
  { title: "בחירה, המלצות ודירוג", description: "כלים להורים לבחירת גן ולקריאה נכונה של מידע.", slugs: ["how-to-choose-safe-kindergarten", "kindergarten-reviews-recommendations", "kindergarten-quality-score"] },
  { title: "מצלמות, מידע ופרטיות", description: "גבולות שימוש, הרשאות ושקיפות שאינה חושפת ילדים.", slugs: ["cameras-in-kindergartens", "digital-child-profile", "parent-platform-transparency"] },
] as const;

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "כתבות ומדריכים על גני ילדים",
  description: "מדריכים מהימנים על בחירת גן ילדים, ניהול גנים פרטיים, בטיחות, מצלמות, בקרה ופיקוח. הסברים ושאלות שכדאי לשאול.",
  alternates: { canonical: `${SITE_URL}/articles` },
  openGraph: { type: "website", locale: "he_IL", siteName: "גן בטוח", title: "מגזין גן בטוח | כתבות על גני ילדים", description: "מדריכים על בחירת גן, ניהול, בטיחות ופיקוח.", url: `${SITE_URL}/articles`, images: [ganBatuachShareImage] },
  twitter: { card: "summary_large_image", title: "מגזין גן בטוח | כתבות על גני ילדים", description: "מדריכים על בחירת גן, ניהול, בטיחות ופיקוח.", images: [ganBatuachShareImage.url] }
};

export default async function ArticlesPage() {
  const articles = await getPublishedArticles();
  const breadcrumbSchema = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "ראשי", item: SITE_URL }, { "@type": "ListItem", position: 2, name: "כתבות", item: `${SITE_URL}/articles` }] };
  return <><BrandHeader /><main className="editorial-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema).replace(/</g, "\\u003c") }} />
    <nav className="editorial-crumbs" aria-label="פירורי לחם"><Link href="/">ראשי</Link> / כתבות</nav>
    <header className="editorial-heading"><span className="editorial-kicker">מגזין גן בטוח</span><h1>מדריכים לבחירת גן, ניהול ופיקוח</h1><p>מידע מקצועי להורים, לצוות ולמנהלי גנים. הסברים על רגולציה מבוססים על מקורות רשמיים; תו התקן של גן בטוח הוא סטנדרט פרטי שאינו מחליף רישוי ממשלתי.</p></header>
    <section className="editorial-topics" aria-labelledby="topic-clusters-title">
      <h2 id="topic-clusters-title">נושאים מרכזיים</h2>
      <div className="editorial-topic-grid">{topicClusters.map((cluster) => <article key={cluster.title}><h3>{cluster.title}</h3><p>{cluster.description}</p><ul>{cluster.slugs.map((slug) => {
        const article = articles.find((item) => item.slug === slug);
        return article ? <li key={slug}><Link href={`/articles/${slug}`}>{article.title}</Link></li> : null;
      })}</ul></article>)}</div>
    </section>
    <div className="editorial-grid">{articles.map((article, index) => <article className="editorial-card" key={article.slug}>
      <Link href={`/articles/${article.slug}`} className="editorial-card-image"><Image src={article.image_url} alt={article.image_alt} width={720} height={380} sizes="(max-width: 700px) 100vw, 33vw" unoptimized={!article.image_url.startsWith("/")} fetchPriority={index === 0 ? "high" : undefined} loading={index === 0 ? "eager" : "lazy"} /></Link>
      <div className="editorial-card-copy"><span className="editorial-kicker">{article.tags.slice(0, 2).join(" · ")}</span><h2><Link href={`/articles/${article.slug}`}>{article.title}</Link></h2><p>{article.summary}</p><small>{new Intl.DateTimeFormat("he-IL", { dateStyle: "medium" }).format(new Date(article.published_at))} · {article.garden_groups.join(" · ")}</small><Link href={`/articles/${article.slug}`}>לקריאה ←</Link></div>
    </article>)}</div>
    <p className="editorial-footer"><Link href="/safety-standard">מהו תו התקן הפרטי?</Link> · <Link href="/kindergarten-management">מערכת לניהול גן ילדים</Link> · <Link href="/">דף הבית</Link></p>
  </main></>;
}
