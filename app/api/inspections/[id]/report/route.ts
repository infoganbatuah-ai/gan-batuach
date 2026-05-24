import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function esc(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] ?? char));
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const supabase = await createClient();
  const [inspectionRes, answersRes, signatureRes] = await Promise.all([
    supabase.from("inspections" as any).select("*, gardens(name,city,address), inspectors:inspector_id(full_name, phone)").eq("id", id).single(),
    supabase.from("inspection_answers" as any).select("*, inspection_form_questions(question_text, category, weight, critical)").eq("inspection_id", id),
    supabase.from("inspection_signatures" as any).select("*").eq("inspection_id", id).order("signed_at", { ascending: false }).limit(1).maybeSingle()
  ]);
  const inspection = inspectionRes.data as any;
  const answers = (answersRes.data ?? []) as any[];
  const signature = signatureRes.data as any;
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>דוח ביקורת</title><style>body{font-family:Arial,sans-serif;padding:32px;line-height:1.6}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px}.sig{max-width:360px;border:1px solid #ddd}</style></head><body><h1>דוח ביקורת - ${esc(inspection?.gardens?.name)}</h1><p>עיר: ${esc(inspection?.gardens?.city)} · פקח: ${esc(inspection?.inspectors?.full_name)} · תאריך: ${esc(inspection?.completed_at)}</p><h2>ציון סופי: ${esc(inspection?.weighted_score)}</h2><p>ליקויים: ${esc(inspection?.violation_count)} · כשלים קריטיים: ${esc(inspection?.critical_failures)}</p><table><thead><tr><th>קטגוריה</th><th>שאלה</th><th>ציון</th><th>הערה</th><th>צילום/מסמך</th></tr></thead><tbody>${answers.map((a) => `<tr><td>${esc(a.inspection_form_questions?.category)}</td><td>${esc(a.inspection_form_questions?.question_text)}</td><td>${esc(a.score)}</td><td>${esc(a.note)}</td><td>${a.photo_url ? `<a href="${esc(a.photo_url)}">צילום</a>` : ""} ${a.document_url ? `<a href="${esc(a.document_url)}">מסמך</a>` : ""}</td></tr>`).join("")}</tbody></table><h2>חתימת פקח</h2>${signature?.signature_image ? `<img class="sig" src="${esc(signature.signature_image)}">` : "<p>אין חתימה שמורה.</p>"}<p>GPS: ${esc(signature?.gps_lat)}, ${esc(signature?.gps_lng)} · נחתם: ${esc(signature?.signed_at)}</p></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Content-Disposition": "inline; filename=inspection-report.html" } });
}
