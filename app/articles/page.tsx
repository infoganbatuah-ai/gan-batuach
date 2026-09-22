import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BrandHeader } from "@/components/brand-header";
import { getPublishedArticles } from "@/lib/editorial/store";
import { SITE_URL } from "@/lib/editorial/articles";
import "./articles.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "כתבות ומדריכים על גני ילדים",
  description: "מדריכים מהימנים על בחירת גן ילדים, ניהול גנים פרטיים, בטיחות, מצלמות, בקרה ופיקוח. הסברים ושאלות שכדאי לשאול.",
  alternates: { canonical: `${SITE_URL}/articles` },
  openGraph: { title: "מגזין גן בטוח | כתבות על גני ילדים", description: "מדריכים על בחירת גן, ניהול, בטיחות ופיקוח.", url: `${SITE_URL}/articles`, images: ["/assets/hero-control-center.png"] },
  twitter: { card: "summary_large_image" }
};

export default async function ArticlesPage() {
  const articles = await getPublishedArticles();
  return <><BrandHeader /><main className="editorial-page">
    <nav className="editorial-crumbs" aria-label="פירורי לחם"><Link href="/">ראשי</Link> / כתבות</nav>
    <header className="editorial-heading"><span className="editorial-kicker">מגזין גן בטוח</span><h1>מדריכים לבחירת גן, ניהול ופיקוח</h1><p>מידע מקצועי להורים, לצוות ולמנהלי גנים. הסברים על רגולציה מבוססים על מקורות רשמיים; תו התקן של גן בטוח הוא סטנדרט פרטי שאינו מחליף רישוי ממשלתי.</p></header>
    <div className="editorial-grid">{articles.map((article, index) => <article className="editorial-card" key={article.slug}>
      <Link href={`/articles/${article.slug}`} className="editorial-card-image"><Image src={article.image_url} alt={article.image_alt} width={720} height={380} sizes="(max-width: 700px) 100vw, 33vw" unoptimized={!article.image_url.startsWith("/")} priority={index === 0} /></Link>
      <div className="editorial-card-copy"><span className="editorial-kicker">{article.tags.slice(0, 2).join(" · ")}</span><h2><Link href={`/articles/${article.slug}`}>{article.title}</Link></h2><p>{article.summary}</p><small>{new Intl.DateTimeFormat("he-IL", { dateStyle: "medium" }).format(new Date(article.published_at))} · {article.garden_groups.join(" · ")}</small><Link href={`/articles/${article.slug}`}>לקריאה ←</Link></div>
    </article>)}</div>
    <p className="editorial-footer"><Link href="/safety-standard">מהו תו התקן הפרטי?</Link> · <Link href="/join-kindergarten">ניהול גן ילדים</Link> · <Link href="/">דף הבית</Link></p>
  </main></>;
}
