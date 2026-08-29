import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { getEmailProvider } from "@/lib/domain/email-provider";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  try {
    const { profile } = await requireRole(["admin"]);
    if (!profile.email) return fail("לחשבון האדמין המחובר אין כתובת אימייל.", 422);

    const provider = getEmailProvider("resend");
    const readiness = provider.checkReadiness();
    if (!readiness.canSendRealMessages) {
      return fail(`שליחת Resend עדיין אינה פעילה: ${readiness.missing.join(", ")}`, 503);
    }

    const now = new Date();
    const result = await provider.send({
      to: profile.email,
      subject: "בדיקת חיבור Resend — גן בטוח",
      text: `שלום, זוהי בדיקת שליחה חיה ומבוקרת ממערכת גן בטוח. זמן הבדיקה: ${now.toLocaleString("he-IL")}`,
      html: `<div dir="rtl"><h2>חיבור Resend פעיל</h2><p>זוהי בדיקת שליחה חיה ומבוקרת ממערכת גן בטוח.</p><p>${now.toLocaleString("he-IL")}</p></div>`,
      category: "verification",
      metadata: { test_type: "admin_connectivity" }
    });

    const admin = createAdminClient();
    const { error: logError } = await admin.from("email_delivery_logs").insert({
      recipient_profile_id: profile.id,
      category: "verification",
      recipient_email: profile.email,
      subject_preview: "בדיקת חיבור Resend — גן בטוח",
      message_preview: "בדיקת שליחה חיה ומבוקרת ממערכת גן בטוח",
      status: result.status,
      provider: result.provider,
      provider_message_id: result.providerMessageId ?? null,
      provider_reference: result.providerReference ?? "admin_connectivity_test",
      failure_reason: result.failureReason ?? null,
      sent_at: result.status === "sent" ? now.toISOString() : null,
      failed_at: result.status === "failed" ? now.toISOString() : null,
      metadata: { test_type: "admin_connectivity", real_send: true }
    });

    if (logError) return fail("האימייל נשלח אך שמירת לוג המסירה נכשלה.", 500);
    if (result.status === "failed") return fail(result.failureReason || "שליחת Resend נכשלה.", 502);
    return ok({ status: result.status, providerMessageId: result.providerMessageId });
  } catch (error) {
    return handleRouteError(error);
  }
}
