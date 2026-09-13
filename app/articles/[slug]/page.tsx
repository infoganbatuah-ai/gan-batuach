import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandHeader } from "@/components/brand-header";
import { getPublishedArticles } from "@/lib/editorial/store";
import { SITE_URL } from "@/lib/editorial/articles";
import "../articles.css";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = (await getPublishedArticles()).find((item) => item.slug === slug);
  if (!article) return { title: "כתבה לא נמצאה", robots: { index: false } };
  const url = `${SITE_URL}/articles/${slug}`;
  return { title: { absolute: `${article.meta_title} | גן בטוח` }, description: article.meta_description,
    alternates: { canonical: url }, openGraph: { type: "article", title: article.meta_title, description: article.meta_description, url, locale: "he_IL", publishedTime: article.published_at, images: [{ url: article.image_url, alt: article.image_alt }] },
    twitter: { card: "summary_large_image", title: article.meta_title, description: article.meta_description, images: [article.image_url] } };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const articles = await getPublishedArticles();
  const article = articles.find((item) => item.slug === slug);
  if (!article) notFound();
  const url = `${SITE_URL}/articles/${slug}`;
  const articleSchema = { "@context": "https://schema.org", "@type": "Article", headline: article.title, description: article.summary, image: new URL(article.image_url, SITE_URL).href, datePublished: article.published_at, dateModified: article.updated_at ?? article.published_at, author: { "@type": "Organization", name: "מערכת גן בטוח" }, publisher: { "@type": "Organization", name: "גן בטוח", url: SITE_URL }, mainEntityOfPage: url, inLanguage: "he-IL" };
  const crumbs = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "ראשי", item: SITE_URL }, { "@type": "ListItem", position: 2, name: "כתבות", item: `${SITE_URL}/articles` }, { "@type": "ListItem", position: 3, name: article.title, item: url }] };
  // FAQ markup describes the visible questions; rich-result eligibility is Google's decision.
  const faqSchema = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: article.faqs.map((faq) => ({ "@type": "Question", name: faq.question, acceptedAnswer: { "@type": "Answer", text: faq.answer } })) };
  return <><BrandHeader /><main className="editorial-page editorial-article">
    {[articleSchema, crumbs, ...(article.faqs.length ? [faqSchema] : [])].map((schema, index) => <script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />)}
    <nav className="editorial-crumbs" aria-label="פירורי לחם"><Link href="/">ראשי</Link> / <Link href="/articles">כתבות</Link> / {article.title}</nav>
    <article><header className="editorial-heading"><span className="editorial-kicker">{article.tags.join(" · ")}</span><h1>{article.title}</h1><p>{article.summary}</p><small>מערכת גן בטוח · {new Intl.DateTimeFormat("he-IL", { dateStyle: "long" }).format(new Date(article.published_at))}</small></header>
      <figure className="editorial-cover"><Image src={article.image_url} alt={article.image_alt} width={1200} height={630} sizes="(max-width: 800px) 100vw, 900px" unoptimized={!article.image_url.startsWith("/")} priority /></figure>
      <div className="editorial-reading"><aside className="editorial-facts"><b>למי רלוונטי?</b><p>גילאים: {article.ages}</p><p>קבוצות גן: {article.garden_groups.join(" · ")}</p></aside>
        {article.body.split(/\n\s*\n/).filter(Boolean).map((paragraph, i) => <p key={i}>{paragraph}</p>)}
        {article.slug === "what-is-gan-batuach" && <p>חשוב להבחין: מיזם ״הגן הבטוח״ של <a href="https://www.sii.org.il/he/lobby/information/children/safekindergarten" target="_blank" rel="noopener noreferrer">מכון התקנים הישראלי</a> הוא מיזם נפרד. גן בטוח אינו מציג את הסטנדרט הפרטי שלו כתעודה מטעם המכון.</p>}
        <h2>איך גן בטוח נכנס לתמונה?</h2><p>גן בטוח מחבר בין <Link href="/join-kindergarten">מערכת לניהול גן ילדים</Link>, <Link href="/safety-standard">תו תקן פרטי ותהליכי בקרה</Link> לבין מידע שימושי להורים. כל יכולת או נתון על גן מסוים יש לאמת לפי המצב בפועל; הסטנדרט אינו אישור ממשלתי.</p>
        {article.sources.length > 0 && <section><h2>מקורות לקריאה נוספת</h2><ul>{article.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a></li>)}</ul></section>}
        <section><h2>שאלות ותשובות</h2>{article.faqs.map((faq) => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</section>
        <p className="editorial-disclaimer">המידע כללי ואינו ייעוץ משפטי, רפואי או תחליף לבדיקת סטטוס הרישוי והדין החל על המסגרת.</p>
      </div></article>
    <section className="editorial-related"><h2>ממשיכים לקרוא</h2><div className="editorial-related-grid">{articles.filter((item) => item.slug !== slug).slice(0, 3).map((item) => <Link key={item.slug} href={`/articles/${item.slug}`}>{item.title} ←</Link>)}</div></section>
  </main></>;
}
