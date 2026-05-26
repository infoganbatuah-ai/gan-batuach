import { ok, handleRouteError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function item(title: string, body: string, href: string, tone: "good" | "warn" | "bad" = "warn") {
  return { title, body, href, tone };
}

export async function GET() {
  try {
    const { profile } = await requireUser();
    const supabase = await createClient();
    const role = profile.role;
    const gardenId = profile.garden_id;
    const today = new Date().toISOString().slice(0, 10);

    if (role === "admin") {
      const [late, docs, complaints, cameras, ai] = await Promise.all([
        supabase.from("required_inspections" as any).select("id", { count: "exact", head: true }).lt("due_at", new Date().toISOString()).neq("status", "done"),
        supabase.from("documents" as any).select("id", { count: "exact", head: true }).in("status", ["missing", "expired", "rejected"]),
        supabase.from("complaints" as any).select("id", { count: "exact", head: true }).neq("status", "closed"),
        supabase.from("camera_streams" as any).select("id", { count: "exact", head: true }).in("status", ["pending_gateway", "offline", "failed", "error"]),
        supabase.from("ai_events" as any).select("id", { count: "exact", head: true }).in("severity", ["high", "critical"]).neq("status", "done")
      ]);
      return ok({ provider: "pending", role, title: "מה דורש טיפול היום?", summary: "עוזר גן בטוח AI מציג סיכום מבוסס נתונים קיימים. חיבור ספק AI חיצוני עדיין ממתין.", suggestions: [
        item("פיקוחים באיחור", `${late.count ?? 0} גנים צריכים טיפול פיקוח`, "/dashboard/admin/inspections/late", (late.count ?? 0) ? "bad" : "good"),
        item("מסמכים חסרים", `${docs.count ?? 0} מסמכים חסרים/פגי תוקף`, "/dashboard/admin/documents", (docs.count ?? 0) ? "warn" : "good"),
        item("פניות פתוחות", `${complaints.count ?? 0} פניות ותלונות פתוחות`, "/dashboard/admin/complaints", (complaints.count ?? 0) ? "warn" : "good"),
        item("מצלמות ו-AI", `${cameras.count ?? 0} מצלמות ממתינות · ${ai.count ?? 0} אירועי AI חמורים`, "/dashboard/admin/ai-events", (ai.count ?? 0) ? "bad" : "warn")
      ], prompts: ["מה דורש טיפול היום?", "איזה גנים בסיכון?", "איזה מסמכים חסרים?", "סכם לי תלונות פתוחות"] });
    }

    if (role === "manager" || role === "owner") {
      const [children, attendance, docs, messages, inspection, cameras, payments] = await Promise.all([
        supabase.from("children" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId ?? ""),
        supabase.from("attendance" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId ?? "").eq("attendance_date", today).neq("status", "present"),
        supabase.from("documents" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId ?? "").in("status", ["missing", "expired", "rejected"]),
        supabase.from("messages" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId ?? "").eq("recipient_id", profile.id).is("read_at", null),
        supabase.from("required_inspections" as any).select("id, due_at", { count: "exact" }).eq("garden_id", gardenId ?? "").neq("status", "done").order("due_at").limit(1),
        supabase.from("camera_streams" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId ?? "").in("status", ["pending_gateway", "offline", "failed", "error"]),
        supabase.from("children" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId ?? "").in("payment_status", ["overdue", "unpaid", "partial"])
      ]);
      return ok({ provider: "pending", role, title: "תקציר מנהלת להיום", summary: `בגן יש ${children.count ?? 0} ילדים. בדקו חריגי נוכחות, מסמכים, הודעות ופיקוח קרוב.`, suggestions: [
        item("נוכחות ילדים", `${attendance.count ?? 0} ילדים לא מסומנים כנוכחים`, "/dashboard/garden/attendance", (attendance.count ?? 0) ? "warn" : "good"),
        item("מסמכים חסרים", `${docs.count ?? 0} מסמכים דורשים השלמה`, "/dashboard/garden/documents", (docs.count ?? 0) ? "warn" : "good"),
        item("הודעות הורים/אדמין", `${messages.count ?? 0} הודעות לא נקראו`, "/dashboard/garden/messages", (messages.count ?? 0) ? "warn" : "good"),
        item("פיקוח ומצלמות", `${inspection.count ?? 0} פיקוחים פתוחים · ${cameras.count ?? 0} מצלמות ממתינות`, "/dashboard/garden/inspections", (cameras.count ?? 0) ? "warn" : "good"),
        item("תשלומים חסרים", `${payments.count ?? 0} ילדים עם תשלום לטיפול`, "/dashboard/garden/finance", (payments.count ?? 0) ? "bad" : "good")
      ], prompts: ["מה דורש טיפול היום?", "מי עדיין לא שילם?", "איזה ילד דורש תשומת לב?", "איזה מסמכים חסרים?", "מה מצב הפיקוח הקרוב?"] });
    }

    if (role === "parent") {
      const parent = await supabase.from("parents" as any).select("id").eq("profile_id", profile.id).maybeSingle();
      const parentId = (parent.data as any)?.id;
      const children = parentId ? await supabase.from("children" as any).select("id, full_name").eq("primary_parent_id", parentId) : { data: [] };
      const childIds = (children.data ?? []).map((child: any) => child.id);
      const [journals, docs, messages] = await Promise.all([
        childIds.length ? supabase.from("child_daily_journals" as any).select("id", { count: "exact", head: true }).in("child_id", childIds).eq("journal_date", today) : { count: 0 },
        supabase.from("documents" as any).select("id", { count: "exact", head: true }).eq("uploaded_by", profile.id).in("status", ["missing", "rejected"]),
        supabase.from("messages" as any).select("id", { count: "exact", head: true }).eq("recipient_id", profile.id).is("read_at", null)
      ]);
      return ok({ provider: "pending", role, title: "תקציר הילד והגן", summary: "העוזר מסכם יומן יומי, הודעות, מסמכים ודוח פיקוח בשפה פשוטה.", suggestions: [
        item("יומן יומי", `${journals.count ?? 0} עדכונים יומיים זמינים`, "/dashboard/parent/daily-journal", (journals.count ?? 0) ? "good" : "warn"),
        item("מסמכים וטפסים", `${docs.count ?? 0} מסמכים דורשים טיפול`, "/dashboard/parent/documents", (docs.count ?? 0) ? "warn" : "good"),
        item("הודעות", `${messages.count ?? 0} הודעות לא נקראו`, "/dashboard/parent/messages", (messages.count ?? 0) ? "warn" : "good")
      ], prompts: ["סכם לי את היום של הילד", "מה חסר לי להשלים?", "מה אומר ציון הביקורת?", "עזור לי לשלוח הודעה"] });
    }

    if (role === "staff") {
      const [tasks, docs] = await Promise.all([
        supabase.from("tasks" as any).select("id", { count: "exact", head: true }).eq("assigned_to", profile.id).neq("status", "done"),
        supabase.from("documents" as any).select("id", { count: "exact", head: true }).eq("uploaded_by", profile.id).in("status", ["missing", "expired", "rejected"])
      ]);
      return ok({ provider: "pending", role, title: "תקציר צוות", summary: "העוזר מציג משימות, מסמכים חסרים ודגשים לעבודה היומית.", suggestions: [
        item("משימות היום", `${tasks.count ?? 0} משימות פתוחות`, "/dashboard/staff/tasks", (tasks.count ?? 0) ? "warn" : "good"),
        item("מסמכי צוות", `${docs.count ?? 0} מסמכים דורשים טיפול`, "/dashboard/staff/documents", (docs.count ?? 0) ? "warn" : "good")
      ], prompts: ["מה המשימות שלי היום?", "איזה מסמך חסר לי?", "מה חשוב לדעת על הילדים?"] });
    }

    const [due, late] = await Promise.all([
      supabase.from("required_inspections" as any).select("id", { count: "exact", head: true }).eq("inspector_id", profile.id).gte("due_at", new Date().toISOString()).neq("status", "done"),
      supabase.from("required_inspections" as any).select("id", { count: "exact", head: true }).eq("inspector_id", profile.id).lt("due_at", new Date().toISOString()).neq("status", "done")
    ]);
    return ok({ provider: "pending", role, title: "תקציר פקח", summary: "העוזר מסכם גנים משויכים, ביקורות קרובות, איחורים ופערי ציון.", suggestions: [
      item("ביקורות קרובות", `${due.count ?? 0} ביקורות ממתינות`, "/dashboard/inspector/inspections/due", (due.count ?? 0) ? "warn" : "good"),
      item("ביקורות באיחור", `${late.count ?? 0} ביקורות באיחור`, "/dashboard/inspector/inspections/due", (late.count ?? 0) ? "bad" : "good")
    ], prompts: ["מה לבדוק היום?", "איזה גנים באיחור?", "איפה יש פערי ציון?", "סכם לי ליקויים פתוחים"] });
  } catch (error) {
    return handleRouteError(error);
  }
}
