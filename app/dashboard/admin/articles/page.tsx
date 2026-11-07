import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";
import { getAdminArticles } from "@/lib/editorial/store";
import { saveArticle } from "./actions";
import "./editorial-admin.css";

export const dynamic = "force-dynamic";

export default async function AdminArticlesPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  await requireRole(["admin"]);
  const articles = await getAdminArticles();
  const { saved } = await searchParams;
  return <DashboardShell role="admin" title="כתבות ותוכן">
    <div className="editorial-admin"><h1>ניהול כתבות: גן בטוח ותצפיתן דיגיטלי</h1>
      <p>ערכו כתבת בסיס או הוסיפו כתבה. רק כתבות בסטטוס ״פורסם״ שמועדן הגיע מוצגות באתר. כתבות גן בטוח ותצפיתן מוצגות במגזינים נפרדים; עריכה נשמרת במערכת התוכן.</p>
      {saved && <p role="status">הכתבה נשמרה. <Link href="/articles">מגזין גן בטוח</Link> · <Link href="/digital-observer/guides">מדריכי תצפיתן</Link></p>}
      <details className="editorial-admin-item"><summary>+ כתבה חדשה</summary><ArticleForm /></details>
      {articles.map((article) => <details key={article.slug} className="editorial-admin-item"><summary>{article.title} · {article.status === "published" ? "פורסם" : "טיוטה"}</summary><ArticleForm article={article} /></details>)}
    </div>
  </DashboardShell>;
}

type ArticleFormData = Awaited<ReturnType<typeof getAdminArticles>>[number];
function ArticleForm({ article }: { article?: ArticleFormData }) {
  return <form action={saveArticle} className="editorial-admin-form">
    <label>מגזין<select name="channel" defaultValue={article?.slug.startsWith("observer-") ? "observer" : "gan"}><option value="gan">גן בטוח — גני ילדים</option><option value="observer">תצפיתן דיגיטלי — בית ועסק</option></select></label>
    <label>Slug באנגלית<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={article?.slug} readOnly={Boolean(article)} /></label>
    <label>כותרת<input name="title" required defaultValue={article?.title} /></label>
    <label>תקציר<textarea name="summary" required rows={3} defaultValue={article?.summary} /></label>
    <label>תוכן מלא — שורה ריקה בין פסקאות; ## לכותרת משנה; - לרשימה. לתמונה פנימית הכניסו [[add-image]] במיקום הרצוי.<textarea name="body" required rows={18} defaultValue={article?.body} /></label>
    <label>תמונה ראשית (JPG, PNG, WebP; עד 5MB)<input type="file" name="image" accept="image/jpeg,image/png,image/webp" /></label>
    <input type="hidden" name="current_image" value={article?.image_url ?? ""} />
    <label>תיאור תמונה בעברית (alt)<input name="image_alt" required defaultValue={article?.image_alt} /></label>
    <label>תמונה פנימית נוספת — אחת בכל שמירה, עד 3MB<input type="file" name="support_image" accept="image/jpeg,image/png,image/webp" /></label>
    <label>טקסט חלופי לתמונה הפנימית<input name="support_image_alt" placeholder="מה רואים בתמונה" /></label>
    <label>כיתוב מתחת לתמונה הפנימית<input name="support_image_caption" placeholder="מה התמונה מוסיפה להסבר" /></label>
    <label>גילאים רלוונטיים<input name="ages" defaultValue={article?.ages} placeholder="לידה–3" /></label>
    <label>קבוצות גן, מופרדות בפסיקים<input name="garden_groups" defaultValue={article?.garden_groups.join(", ")} /></label>
    <label>תגיות, מופרדות בפסיקים<input name="tags" defaultValue={article?.tags.join(", ")} /></label>
    <label>שאלות ותשובות — שאלה | תשובה בכל שורה<textarea name="faqs" rows={4} defaultValue={article?.faqs.map((faq) => `${faq.question} | ${faq.answer}`).join("\n")} /></label>
    <label>מקורות — שם המקור | https://... בכל שורה<textarea name="sources" rows={5} defaultValue={article?.sources.map((source) => `${source.label} | ${source.url}`).join("\n")} /></label>
    <label>Meta title<input name="meta_title" required defaultValue={article?.meta_title} /></label>
    <label>Meta description<textarea name="meta_description" required rows={2} defaultValue={article?.meta_description} /></label>
    <label>תאריך פרסום<input type="datetime-local" name="published_at" required defaultValue={article?.published_at ? new Date(article.published_at).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16)} /></label>
    <label>סטטוס<select name="status" defaultValue={article?.status ?? "draft"}><option value="draft">טיוטה</option><option value="published">פורסם</option></select></label>
    <button type="submit" className="button primary">שמירת כתבה</button>
  </form>;
}
