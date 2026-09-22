import "server-only";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { initialArticles, type Article } from "./articles";

// Published editorial copy ships with the site, so search engines can index it
// even before the content migration is installed. Admin revisions override it.
async function revisions(): Promise<Article[]> {
  if (!isAdminClientConfigured()) return [];
  try {
    const { data, error } = await createAdminClient().from("editorial_articles").select("*").limit(250);
    if (error) return [];
    return (data ?? []) as Article[];
  } catch { return []; }
}

export async function getPublishedArticles() {
  const overrides = await revisions();
  const merged = new Map(initialArticles.map((article) => [article.slug, article]));
  overrides.forEach((article) => merged.set(article.slug, article));
  return [...merged.values()].filter((article) => article.status === "published" && new Date(article.published_at).getTime() <= Date.now())
    .sort((a, b) => b.published_at.localeCompare(a.published_at));
}

export async function getAdminArticles() {
  const merged = new Map(initialArticles.map((article) => [article.slug, article]));
  (await revisions()).forEach((article) => merged.set(article.slug, article));
  return [...merged.values()].sort((a, b) => b.published_at.localeCompare(a.published_at));
}
