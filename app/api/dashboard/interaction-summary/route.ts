import { ok, handleRouteError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function card(title: string, count: number, href: string, tone: "good" | "warn" | "bad" = "warn") {
  return { title, count, href, tone };
}

async function safeCount(query: PromiseLike<{ count: number | null; error: unknown }>) {
  const { count, error } = await query;
  if (error) console.error("Dashboard interaction count failed", error);
  return count ?? 0;
}

export async function GET() {
  try {
    const { profile } = await requireUser();
    const supabase = await createClient();
    const role = profile.role;
    const gardenId = profile.garden_id ?? "";
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();

    if (role === "admin") {
      const [late, cameras, complaints, messages, incidents, inspections, ai, attendance] = await Promise.all([
        safeCount(supabase.from("required_inspections" as any).select("id", { count: "exact", head: true }).lt("due_at", now).neq("status", "done")),
        safeCount(supabase.from("camera_streams" as any).select("id", { count: "exact", head: true }).in("status", ["offline", "failed", "error", "pending_gateway"])),
        safeCount(supabase.from("complaints" as any).select("id", { count: "exact", head: true }).neq("status", "closed")),
        safeCount(supabase.from("messages" as any).select("id", { count: "exact", head: true })),
        safeCount(supabase.from("incident_reports" as any).select("id", { count: "exact", head: true }).neq("status", "closed")),
        safeCount(supabase.from("inspections" as any).select("id", { count: "exact", head: true }).gte("created_at", today)),
        safeCount(supabase.from("ai_events" as any).select("id", { count: "exact", head: true }).in("severity", ["high", "critical"]).neq("status", "done")),
        safeCount(supabase.from("attendance" as any).select("id", { count: "exact", head: true }).eq("attendance_date", today))
      ]);
      return ok({ role, commandCards: [card("גנים באיחור פיקוח", late, "/dashboard/admin/inspections/late", late ? "bad" : "good"), card("בעיות מצלמה", cameras, "/dashboard/admin/cameras", cameras ? "warn" : "good"), card("פניות לא פתורות", complaints, "/dashboard/admin/complaints", complaints ? "warn" : "good")], activity: [card("הודעות", messages, "/dashboard/admin/notifications"), card("אירועים", incidents, "/dashboard/admin/complaints", incidents ? "warn" : "good"), card("ביקורות היום", inspections, "/dashboard/admin/inspections", "good"), card("AI alerts", ai, "/dashboard/admin/ai-events", ai ? "bad" : "good"), card("נוכחות", attendance, "/dashboard/admin/reports", "good")] });
    }

    if (role === "manager" || role === "owner") {
      const inspectionRes = await supabase.from("required_inspections" as any).select("id, due_at").eq("garden_id", gardenId).neq("status", "done").order("due_at").limit(1);
      const firstInspection = (inspectionRes.data ?? [])[0] as any;
      const days = firstInspection?.due_at ? Math.ceil((new Date(firstInspection.due_at).getTime() - Date.now()) / 86400000) : null;
      const [attention, messages, incidents, ai, attendance] = await Promise.all([
        safeCount(supabase.from("children" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId).or("allergies.not.is.null,medical_notes.not.is.null,status.neq.active")),
        safeCount(supabase.from("messages" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId).is("read_at", null)),
        safeCount(supabase.from("incident_reports" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId).neq("status", "closed")),
        safeCount(supabase.from("ai_events" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId).neq("status", "done")),
        safeCount(supabase.from("attendance" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId).eq("attendance_date", today))
      ]);
      return ok({ role, commandCards: [card("ילדים שדורשים תשומת לב", attention, "/dashboard/garden/children", attention ? "warn" : "good"), card(days === null ? "אין פיקוח פתוח" : `פיקוח בעוד ${days} ימים`, inspectionRes.count ?? (firstInspection ? 1 : 0), "/dashboard/garden/inspections", days !== null && days < 0 ? "bad" : "warn"), card("הודעות הורים ממתינות", messages, "/dashboard/garden/messages", messages ? "warn" : "good")], activity: [card("הודעות", messages, "/dashboard/garden/messages"), card("אירועים", incidents, "/dashboard/garden/incidents", incidents ? "warn" : "good"), card("פיקוח", firstInspection ? 1 : 0, "/dashboard/garden/inspections"), card("AI alerts", ai, "/dashboard/garden/cameras", ai ? "warn" : "good"), card("נוכחות היום", attendance, "/dashboard/garden/attendance", "good")] });
    }

    if (role === "parent") {
      const parent = await supabase.from("parents" as any).select("id").eq("profile_id", profile.id).maybeSingle();
      const parentId = (parent.data as any)?.id;
      const children = parentId ? await supabase.from("children" as any).select("id").eq("primary_parent_id", parentId) : { data: [] };
      const childIds = (children.data ?? []).map((child: any) => child.id);
      const [journals, docs, messages, gallery] = await Promise.all([
        childIds.length ? safeCount(supabase.from("child_daily_journals" as any).select("id", { count: "exact", head: true }).in("child_id", childIds).eq("journal_date", today)) : 0,
        safeCount(supabase.from("documents" as any).select("id", { count: "exact", head: true }).eq("uploaded_by", profile.id).in("status", ["missing", "rejected", "pending"])),
        safeCount(supabase.from("messages" as any).select("id", { count: "exact", head: true }).eq("recipient_id", profile.id).is("read_at", null)),
        safeCount(supabase.from("gallery_items" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId))
      ]);
      return ok({ role, commandCards: [card("יומן ילד חדש", journals, "/dashboard/parent/daily-journal", journals ? "good" : "warn"), card("מסמך ממתין", docs, "/dashboard/parent/documents", docs ? "warn" : "good"), card("תמונות חדשות", gallery, "/dashboard/parent/gallery", gallery ? "good" : "warn")], activity: [card("הודעות", messages, "/dashboard/parent/messages"), card("יומן יומי", journals, "/dashboard/parent/daily-journal", "good"), card("מסמכים", docs, "/dashboard/parent/documents"), card("תמונות", gallery, "/dashboard/parent/gallery", "good")] });
    }

    if (role === "staff") {
      const [tasks, messages, docs, attendance] = await Promise.all([
        safeCount(supabase.from("tasks" as any).select("id", { count: "exact", head: true }).eq("assigned_to", profile.id).neq("status", "done")),
        safeCount(supabase.from("messages" as any).select("id", { count: "exact", head: true }).eq("recipient_id", profile.id).is("read_at", null)),
        safeCount(supabase.from("documents" as any).select("id", { count: "exact", head: true }).eq("uploaded_by", profile.id).in("status", ["missing", "expired", "rejected"])),
        safeCount(supabase.from("staff_shifts" as any).select("id", { count: "exact", head: true }).eq("profile_id", profile.id).eq("shift_date", today))
      ]);
      return ok({ role, commandCards: [card("משימות פתוחות", tasks, "/dashboard/staff/tasks", tasks ? "warn" : "good"), card("הודעות שלא נקראו", messages, "/dashboard/staff/messages", messages ? "warn" : "good"), card("מסמכים חסרים", docs, "/dashboard/staff/documents", docs ? "bad" : "good")], activity: [card("משימות", tasks, "/dashboard/staff/tasks"), card("הודעות", messages, "/dashboard/staff/messages"), card("מסמכים", docs, "/dashboard/staff/documents"), card("נוכחות", attendance, "/dashboard/staff/attendance", "good")] });
    }

    const [todayInspections, late, incidents, ai, tasks] = await Promise.all([
      safeCount(supabase.from("required_inspections" as any).select("id", { count: "exact", head: true }).eq("inspector_id", profile.id).gte("due_at", today).lte("due_at", `${today}T23:59:59`)),
      safeCount(supabase.from("required_inspections" as any).select("id", { count: "exact", head: true }).eq("inspector_id", profile.id).lt("due_at", now).neq("status", "done")),
      safeCount(supabase.from("incident_reports" as any).select("id", { count: "exact", head: true }).neq("status", "closed")),
      safeCount(supabase.from("ai_events" as any).select("id", { count: "exact", head: true }).neq("status", "done")),
      safeCount(supabase.from("tasks" as any).select("id", { count: "exact", head: true }).eq("assigned_to", profile.id).neq("status", "done"))
    ]);
    return ok({ role, commandCards: [card("ביקורות היום", todayInspections, "/dashboard/inspector/inspections/due", todayInspections ? "warn" : "good"), card("גנים באיחור", late, "/dashboard/inspector/inspections/due", late ? "bad" : "good"), card("משימות פתוחות", tasks, "/dashboard/inspector/tasks", tasks ? "warn" : "good")], activity: [card("אירועים", incidents, "/dashboard/inspector/reports"), card("פיקוחים", todayInspections, "/dashboard/inspector/inspections"), card("AI alerts", ai, "/dashboard/inspector/ai-events", ai ? "warn" : "good"), card("משימות", tasks, "/dashboard/inspector/tasks")] });
  } catch (error) {
    return handleRouteError(error);
  }
}
