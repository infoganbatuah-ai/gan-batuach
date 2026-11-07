import { fail, handleRouteError } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { user, profile } = await getSessionProfile();
    if (!user || !profile) return fail("נדרשת התחברות מחדש.", 401);
    void request;
    return fail("אימות משתמשים באמצעות SMS מושבת לפי מדיניות הבעלים. קודי SMS קיימים אינם מתקבלים עוד.", 410);
  } catch (error) {
    return handleRouteError(error);
  }
}
