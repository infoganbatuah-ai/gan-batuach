import "server-only";
import { cache } from "react";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { DEFAULT_ARTICLE_IMAGE, initialArticles, legacyArticles, type Article } from "./articles";
import { observerArticles } from "./observer-articles";

export type EditorialChannel = "gan" | "observer";
export const articleChannel = (slug: string): EditorialChannel => slug.startsWith("observer-") ? "observer" : "gan";
export const articleHref = (slug: string) => articleChannel(slug) === "observer"
  ? `/digital-observer/guides/${slug}` : `/articles/${slug}`;

const legacyBySlug = new Map(legacyArticles.map((article) => [article.slug, article]));
const seedBySlug = new Map(initialArticles.map((article) => [article.slug, article]));

function withEditorialUpgrade(revision: Article): Article {
  const old = legacyBySlug.get(revision.slug);
  const updated = seedBySlug.get(revision.slug);
  if (!old || !updated) return revision;
  const originalBody = revision.body === old.body;
  const originalCover = revision.image_url === DEFAULT_ARTICLE_IMAGE;
  return {
    ...revision,
    body: originalBody ? updated.body : revision.body,
    image_url: originalCover ? updated.image_url : revision.image_url,
    image_alt: originalCover ? updated.image_alt : revision.image_alt,
    sources: JSON.stringify(revision.sources) === JSON.stringify(old.sources) ? updated.sources : revision.sources,
    updated_at: originalBody || originalCover ? updated.updated_at : revision.updated_at
  };
}

// Published editorial copy ships with the site, so search engines can index it
// even before the content migration is installed. Admin revisions override it.
const revisions = cache(async (): Promise<Article[]> => {
  if (!isAdminClientConfigured()) return [];
  try {
    const { data, error } = await createAdminClient().from("editorial_articles").select("*").limit(250);
    if (error) return [];
    return (data ?? []) as Article[];
  } catch { return []; }
});

export async function getPublishedArticles(channel: EditorialChannel = "gan") {
  const overrides = await revisions();
  const merged = new Map([...initialArticles, ...observerArticles].map((article) => [article.slug, article]));
  overrides.forEach((article) => merged.set(article.slug, withEditorialUpgrade(article)));
  return [...merged.values()].filter((article) => articleChannel(article.slug) === channel && article.status === "published" && new Date(article.published_at).getTime() <= Date.now())
    .sort((a, b) => b.published_at.localeCompare(a.published_at));
}

export async function getAdminArticles() {
  const merged = new Map([...initialArticles, ...observerArticles].map((article) => [article.slug, article]));
  (await revisions()).forEach((article) => merged.set(article.slug, withEditorialUpgrade(article)));
  return [...merged.values()].sort((a, b) => b.published_at.localeCompare(a.published_at));
}
