import "server-only";

// Only a designated q669 installation uses the qualified local writer. A hosted
// enrollment target cannot silently delegate Site creation to the legacy writer.
export function qaSiteWriterMode(): "product" | "local-atomic" | "closed" {
  const project = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const flag = process.env.OBSERVER_QA_ATOMIC_SITE_SAVE;
  if (project === "http://127.0.0.1:39869") {
    return flag === "1" && !process.env.VERCEL_ENV ? "local-atomic" : "closed";
  }
  if (project === "https://qrkodgtccyzmshitowdt.supabase.co" || flag === "1") return "closed";
  return "product";
}
