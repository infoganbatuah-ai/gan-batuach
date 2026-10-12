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
  const channel = value(form, "channel") === "observer" ? "observer" : "gan";
  if ((channel === "observer") !== slug.startsWith("observer-")) throw new Error("כתבות תצפיתן חייבות להתחיל ב־observer-; כתבות גן בטוח אינן משתמשות בקידומת זו.");
  const title = value(form, "title");
  const summary = value(form, "summary");
  let body = value(form, "body");
  const image_alt = value(form, "image_alt");
  const meta_title = value(form, "meta_title");
  const meta_description = value(form, "meta_description");
  if (!title || !summary || !body || !image_alt || !meta_title || !meta_description) throw new Error("יש למלא את כל שדות החובה.");
  const faqs = value(form, "faqs").split("\n").map((line) => {
    const separator = line.indexOf("|");
    return { question: line.slice(0, separator).trim(), answer: line.slice(separator + 1).trim() };
  }).filter((item) => item.question && item.answer);
  const sources = value(form, "sources").split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const separator = line.indexOf("|");
    return { label: separator > 0 ? line.slice(0, separator).trim() : "", url: line.slice(separator + 1).trim() };
  });
  if (sources.length > 12 || sources.some((item) => !item.label || !/^https:\/\//.test(item.url))) throw new Error("מקורות: עד 12 שורות בפורמט שם המקור | https://...");
  const published_at = value(form, "published_at");
  if (!published_at || Number.isNaN(Date.parse(published_at))) throw new Error("יש לבחור תאריך פרסום תקין.");
  const supportImage = form.get("support_image");
  if (supportImage instanceof File && supportImage.size) {
    if (!value(form, "support_image_alt") || !value(form, "support_image_caption")) throw new Error("יש לציין טקסט חלופי וכיתוב לתמונה הפנימית.");
  } else if (body.includes("[[add-image]]")) throw new Error("הסמן [[add-image]] דורש העלאת תמונה פנימית.");
  const client = createAdminClient();
  let image_url = value(form, "current_image") || DEFAULT_ARTICLE_IMAGE;
  const image = form.get("image");
  const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  const totalUploadSize = (image instanceof File ? image.size : 0) + (supportImage instanceof File ? supportImage.size : 0);
  if (totalUploadSize > 5 * 1024 * 1024) throw new Error("גודל התמונות יחד חייב להיות עד 5MB. אפשר להעלות תמונה נוספת בשמירה הבאה.");
  if (image instanceof File && image.size && (!extensions[image.type] || image.size > 5 * 1024 * 1024)) throw new Error("יש להעלות תמונת JPG, PNG או WebP עד 5MB.");
  if (supportImage instanceof File && supportImage.size && (!extensions[supportImage.type] || supportImage.size > 3 * 1024 * 1024)) throw new Error("תמונה פנימית חייבת להיות JPG, PNG או WebP עד 3MB.");
  if (image instanceof File && image.size) {
    const extension = extensions[image.type];
    const path = `${slug}/${crypto.randomUUID()}.${extension}`;
    const { error } = await client.storage.from("editorial-images").upload(path, await image.arrayBuffer(), { contentType: image.type, upsert: false });
    if (error) throw new Error(`העלאת התמונה נכשלה: ${error.message}`);
    image_url = client.storage.from("editorial-images").getPublicUrl(path).data.publicUrl;
  }
  if (supportImage instanceof File && supportImage.size) {
    const extension = extensions[supportImage.type];
    const alt = value(form, "support_image_alt").replace(/[\]"\r\n]/g, " ").trim();
    const caption = value(form, "support_image_caption").replace(/["\r\n]/g, " ").trim();
    if (!alt || !caption) throw new Error("יש לציין טקסט חלופי וכיתוב לתמונה הפנימית.");
    const path = `${slug}/${crypto.randomUUID()}.${extension}`;
    const { error } = await client.storage.from("editorial-images").upload(path, await supportImage.arrayBuffer(), { contentType: supportImage.type, upsert: false });
    if (error) throw new Error(`העלאת התמונה הפנימית נכשלה: ${error.message}`);
    const url = client.storage.from("editorial-images").getPublicUrl(path).data.publicUrl;
    const markup = `![${alt}](${url} "${caption}")`;
    body = body.includes("[[add-image]]") ? body.replace("[[add-image]]", markup) : `${body}\n\n${markup}`;
  }
  const { error } = await client.from("editorial_articles").upsert({
    slug, title, summary, body, image_url, image_alt, ages: value(form, "ages"),
    garden_groups: list(value(form, "garden_groups")), tags: list(value(form, "tags")),
    meta_title, meta_description, published_at: new Date(published_at).toISOString(),
    status: value(form, "status") === "published" ? "published" : "draft", faqs, sources,
    updated_at: new Date().toISOString()
  }, { onConflict: "slug" });
  if (error) throw new Error(`שמירת הכתבה נכשלה: ${error.message}`);
  revalidatePath("/"); revalidatePath("/articles"); revalidatePath(`/articles/${slug}`);
  revalidatePath("/digital-observer"); revalidatePath("/digital-observer/guides"); revalidatePath(`/digital-observer/guides/${slug}`); revalidatePath("/sitemap.xml");
  redirect("/dashboard/admin/articles?saved=1");
}
