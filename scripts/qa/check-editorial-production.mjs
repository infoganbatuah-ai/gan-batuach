import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const localEnv = Object.fromEntries(readFileSync(".env.local", "utf8")
  .split(/\r?\n/).filter((line) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(line))
  .map((line) => { const separator = line.indexOf("="); return [line.slice(0, separator), line.slice(separator + 1)]; }));
const environment = { ...localEnv, ...process.env };
const url = environment.NEXT_PUBLIC_SUPABASE_URL;
const adminKey = environment.SUPABASE_SERVICE_ROLE_KEY;
const publicKey = environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !adminKey || !publicKey) throw new Error("Editorial smoke test requires Supabase URL, service role and publishable key.");

const admin = createClient(url, adminKey, { auth: { persistSession: false } });
const visitor = createClient(url, publicKey, { auth: { persistSession: false } });
const slug = `seo-smoke-${randomUUID()}`;
const imagePath = `smoke/${randomUUID()}.png`;
let rowCreated = false;
let imageCreated = false;

try {
  const image = readFileSync("public/assets/company-symbol.png");
  const upload = await admin.storage.from("editorial-images").upload(imagePath, image, { contentType: "image/png", upsert: false });
  if (upload.error) throw upload.error;
  imageCreated = true;
  const imageUrl = admin.storage.from("editorial-images").getPublicUrl(imagePath).data.publicUrl;
  const row = await admin.from("editorial_articles").insert({
    slug, title: "בדיקת מערכת זמנית", summary: "רשומת QA זמנית", body: "בדיקת פרסום",
    image_url: imageUrl, image_alt: "סמל זמני לבדיקת תמונה", ages: "3–6",
    garden_groups: ["חובה"], tags: ["qa"], meta_title: "בדיקת QA", meta_description: "בדיקה זמנית",
    faqs: [], sources: [], published_at: new Date(Date.now() - 60_000).toISOString(), status: "draft"
  });
  if (row.error) throw row.error;
  rowCreated = true;
  const draftRead = await visitor.from("editorial_articles").select("slug").eq("slug", slug);
  if (draftRead.error || draftRead.data?.length !== 0) throw new Error("Draft was exposed to anonymous visitors.");
  const publication = await admin.from("editorial_articles").update({ status: "published" }).eq("slug", slug);
  if (publication.error) throw publication.error;
  const publishedRead = await visitor.from("editorial_articles").select("slug").eq("slug", slug);
  if (publishedRead.error || publishedRead.data?.length !== 1) throw new Error("Published article was not visible to anonymous visitors.");
  console.log(JSON.stringify({ status: "PASS", draftHidden: true, publishedVisible: true, imageUpload: true }));
} finally {
  if (rowCreated) {
    const result = await admin.from("editorial_articles").delete().eq("slug", slug);
    if (result.error) console.error("Temporary article cleanup failed:", result.error.message);
  }
  if (imageCreated) {
    const result = await admin.storage.from("editorial-images").remove([imagePath]);
    if (result.error) console.error("Temporary image cleanup failed:", result.error.message);
  }
}
