import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ObserverMark } from "@/components/digital-observer/observer-app-shell";
import { getPublishedArticles } from "@/lib/editorial/store";
import { SITE_URL } from "@/lib/editorial/articles";
import { ArticleContent, getInlineImages } from "@/lib/editorial/article-content";
import "../../../articles/articles.css";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = (await getPublishedArticles("observer")).find((item) => item.slug === slug);
  if (!article) return { robots: { index: false } };
  const url = `${SITE_URL}/digital-observer/guides/${slug}`;
  const cover = new URL(article.image_url, SITE_URL).href;
  return { title: { absolute: article.meta_title }, description: article.meta_description,
    alternates: { canonical: url }, robots: { index: true, follow: true, "max-image-preview": "large" },
    openGraph: { type: "article", siteName: "תצפיתן דיגיטלי", locale: "he_IL", title: article.meta_title, description: article.meta_description, url, publishedTime: article.published_at, modifiedTime: article.updated_at, images: [{ url: cover, width: 1440, height: 810, alt: article.image_alt }] },
    twitter: { card: "summary_large_image", title: article.meta_title, description: article.meta_description, images: [cover] } };
}

export default async function ObserverGuidePage({ params }: Props) {
  const { slug } = await params;
  const articles = await getPublishedArticles("observer");
  const article = articles.find((item) => item.slug === slug);
  if (!article) notFound();
  const url = `${SITE_URL}/digital-observer/guides/${slug}`;
  const schemas = [
    { "@context": "https://schema.org", "@type": "Article", headline: article.title, description: article.summary, image: [article.image_url, ...getInlineImages(article.body).map((item) => item.src)].map((path) => new URL(path, SITE_URL).href), datePublished: article.published_at, dateModified: article.updated_at ?? article.published_at, author: { "@type": "Organization", name: "מערכת תצפיתן דיגיטלי" }, publisher: { "@type": "Organization", name: "גן בטוח", url: SITE_URL }, mainEntityOfPage: url, inLanguage: "he-IL" },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "תצפיתן דיגיטלי", item: `${SITE_URL}/digital-observer` }, { "@type": "ListItem", position: 2, name: "מדריכים", item: `${SITE_URL}/digital-observer/guides` }, { "@type": "ListItem", position: 3, name: article.title, item: url }] },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: article.faqs.map((faq) => ({ "@type": "Question", name: faq.question, acceptedAnswer: { "@type": "Answer", text: faq.answer } })) }
  ];
  return <div className="do-public"><header className="do-public-header"><Link className="do-auth-brand dark" href="/digital-observer"><ObserverMark /><span><b>תצפיתן דיגיטלי</b><small>מדריכים לבית ולעסק</small></span></Link><nav aria-label="ניווט ראשי"><Link href="/digital-observer">המוצר</Link><Link href="/digital-observer/guides">כל המדריכים</Link><Link href="/digital-observer/trust">פרטיות ואמון</Link></nav></header>
    <main className="editorial-page editorial-article">{schemas.map((schema, index) => <script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />)}
      <nav className="editorial-crumbs" aria-label="פירורי לחם"><Link href="/digital-observer">תצפיתן דיגיטלי</Link> / <Link href="/digital-observer/guides">מדריכים</Link> / {article.title}</nav>
      <article><header className="editorial-heading"><span className="editorial-kicker">{article.tags.join(" · ")}</span><h1>{article.title}</h1><p>{article.summary}</p><small>מערכת תצפיתן דיגיטלי · {new Intl.DateTimeFormat("he-IL", { dateStyle: "long" }).format(new Date(article.published_at))}</small></header>
        <figure className="editorial-cover"><Image src={article.image_url} alt={article.image_alt} width={1440} height={810} sizes="(max-width: 800px) 100vw, 900px" fetchPriority="high" loading="eager" unoptimized={!article.image_url.startsWith("/")} /></figure>
        <div className="editorial-reading"><ArticleContent body={article.body} />
          <h2>איך תצפיתן דיגיטלי נכנס לתמונה?</h2><p>תצפיתן דיגיטלי הוא מוצר עצמאי ל<Link href="/digital-observer/home">בית</Link>, ל<Link href="/digital-observer/business">עסק</Link> ול<Link href="/digital-observer/video-investigation">בדיקת אירועי וידאו</Link>. התאמת מצלמה ויכולת ניתוח בפועל תלויות בחיבור, בהרשאות ובמוכנות המוצר; התראה אינה קביעה אוטומטית.</p>
          <section><h2>מקורות לקריאה נוספת</h2><ul>{article.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a></li>)}</ul></section>
          <section><h2>שאלות ותשובות</h2>{article.faqs.map((faq) => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</section>
          <p className="editorial-disclaimer">המידע כללי ואינו ייעוץ משפטי או הנחיית חירום. התמונות הן אילוסטרציות שנוצרו למאמר ואינן צילום ממערכת או מאירוע אמיתי.</p>
        </div></article>
      <section className="editorial-related"><h2>ממשיכים לקרוא</h2><div className="editorial-related-grid">{articles.filter((item) => item.slug !== slug).map((item) => <Link key={item.slug} href={`/digital-observer/guides/${item.slug}`}>{item.title} ←</Link>)}</div></section>
    </main></div>;
}
