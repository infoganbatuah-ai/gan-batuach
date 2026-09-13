"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_ARTICLE_IMAGE } from "@/lib/editorial/articles";

const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const list = (input: string) => input.split(",").map((part) => part.trim()).filter(Boolean);

export async function saveArticle(form: FormData) {
  await requireRole(["admin"]);
  const slug = value(form, "slug");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Slug חייב להכיל אותיות אנגליות קטנות, מספרים ומקפים בלבד.");
  const title = value(form, "title");
  const summary = value(form, "summary");
  const body = value(form, "body");
  const image_alt = value(form, "image_alt");
  const meta_title = value(form, "meta_title");
  const meta_description = value(form, "meta_description");
  if (!title || !summary || !body || !image_alt || !meta_title || !meta_description) throw new Error("יש למלא את כל שדות החובה.");
  const client = createAdminClient();
  let image_url = value(form, "current_image") || DEFAULT_ARTICLE_IMAGE;
  const image = form.get("image");
  if (image instanceof File && image.size) {
    const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
    const extension = extensions[image.type];
    if (!extension || image.size > 5 * 1024 * 1024) throw new Error("יש להעלות תמונת JPG, PNG או WebP עד 5MB.");
    const path = `${slug}/${crypto.randomUUID()}.${extension}`;
    const { error } = await client.storage.from("editorial-images").upload(path, await image.arrayBuffer(), { contentType: image.type, upsert: false });
    if (error) throw new Error(`העלאת התמונה נכשלה: ${error.message}`);
    image_url = client.storage.from("editorial-images").getPublicUrl(path).data.publicUrl;
  }
  const faqs = value(form, "faqs").split("\n").map((line) => {
    const separator = line.indexOf("|");
    return { question: line.slice(0, separator).trim(), answer: line.slice(separator + 1).trim() };
  }).filter((item) => item.question && item.answer);
  let sources: { label: string; url: string }[] = [];
  try { sources = JSON.parse(value(form, "sources") || "[]"); } catch { /* Optional references */ }
  sources = sources.filter((item) => typeof item.label === "string" && /^https:\/\//.test(item.url));
  const published_at = value(form, "published_at");
  if (!published_at || Number.isNaN(Date.parse(published_at))) throw new Error("יש לבחור תאריך פרסום תקין.");
  const { error } = await client.from("editorial_articles").upsert({
    slug, title, summary, body, image_url, image_alt, ages: value(form, "ages"),
    garden_groups: list(value(form, "garden_groups")), tags: list(value(form, "tags")),
    meta_title, meta_description, published_at: new Date(published_at).toISOString(),
    status: value(form, "status") === "published" ? "published" : "draft", faqs, sources,
    updated_at: new Date().toISOString()
  }, { onConflict: "slug" });
  if (error) throw new Error(`שמירת הכתבה נכשלה: ${error.message}`);
  revalidatePath("/"); revalidatePath("/articles"); revalidatePath(`/articles/${slug}`); revalidatePath("/sitemap.xml");
  redirect("/dashboard/admin/articles?saved=1");
}
